"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useReducer, useState, type ReactNode } from "react";
import type { Bloqueio } from "@/data/bloqueio";
import type { Resposta } from "@/data/checklist";
import {
  bloqueioPorReprovacao,
  estadoInicialChecklist,
  estaReprovada,
  itensReprovados,
  podeAvancar,
  preencherAte,
  totalPerguntas,
  type EstadoChecklist,
} from "@/lib/checklist";
import { rotas } from "@/lib/telas";

type Acao =
  | { tipo: "reiniciar" }
  | { tipo: "responder"; resposta: Resposta }
  | { tipo: "proxima" }
  | { tipo: "anterior" }
  | { tipo: "irPara"; indice: number }
  | { tipo: "voltarDaRevisao" }
  | { tipo: "observar"; texto: string }
  | { tipo: "anexarFoto" }
  | { tipo: "atalhoPergunta9" }
  | { tipo: "atalhoResponderResto" }
  | { tipo: "validar" };

function semChave<T>(mapa: Partial<Record<number, T>>, chave: number): Partial<Record<number, T>> {
  const copia = { ...mapa };
  delete copia[chave];
  return copia;
}

/** Avança para a próxima pergunta; depois da última, abre a revisão. */
function avancar(estado: EstadoChecklist): EstadoChecklist {
  if (estado.indice < totalPerguntas - 1) return { ...estado, indice: estado.indice + 1 };
  return { ...estado, modo: "revisao" };
}

function reduzir(estado: EstadoChecklist, acao: Acao): EstadoChecklist {
  switch (acao.tipo) {
    case "reiniciar":
      return estadoInicialChecklist;
    case "responder": {
      const comResposta = { ...estado, respostas: { ...estado.respostas, [estado.indice]: acao.resposta } };
      if (estaReprovada(comResposta, estado.indice)) return comResposta;
      // Resposta que não reprova descarta a evidência antiga e segue adiante.
      return avancar({
        ...comResposta,
        observacoes: semChave(comResposta.observacoes, estado.indice),
        fotos: semChave(comResposta.fotos, estado.indice),
      });
    }
    case "proxima":
      return podeAvancar(estado) ? avancar(estado) : estado;
    case "anterior":
      return estado.indice > 0 ? { ...estado, indice: estado.indice - 1 } : estado;
    case "irPara":
      return { ...estado, indice: acao.indice, modo: "pergunta" };
    case "voltarDaRevisao":
      return { ...estado, indice: totalPerguntas - 1, modo: "pergunta" };
    case "observar":
      return { ...estado, observacoes: { ...estado.observacoes, [estado.indice]: acao.texto } };
    case "anexarFoto":
      return { ...estado, fotos: { ...estado.fotos, [estado.indice]: true } };
    case "atalhoPergunta9":
      return preencherAte(estadoInicialChecklist, 8);
    case "atalhoResponderResto":
      return { ...preencherAte(estado, totalPerguntas), modo: "revisao" };
    case "validar":
      return { ...estado, concluido: true };
  }
}

interface ChecklistContexto {
  estado: EstadoChecklist;
  /** Tela de bloqueio a mostrar na próxima visita (consumida ao abrir). */
  bloqueioPendente: Bloqueio | null;
  reiniciar: () => void;
  responder: (resposta: Resposta) => void;
  proxima: () => void;
  anterior: () => void;
  irPara: (indice: number) => void;
  voltarDaRevisao: () => void;
  observar: (texto: string) => void;
  anexarFoto: () => void;
  atalhoPergunta9: () => void;
  atalhoResponderResto: () => void;
  /** Valida a APR: sem itens reprovados libera a execução; com reprovados bloqueia a OS. */
  validar: () => void;
  definirBloqueio: (bloqueio: Bloqueio) => void;
  consumirBloqueio: () => void;
}

const ChecklistContext = createContext<ChecklistContexto | null>(null);

/** Estado da APR em andamento, compartilhado entre checklist, bloqueio e aprovação. */
export function ChecklistProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [estado, despachar] = useReducer(reduzir, estadoInicialChecklist);
  const [bloqueioPendente, setBloqueioPendente] = useState<Bloqueio | null>(null);

  const consumirBloqueio = useCallback(() => setBloqueioPendente(null), []);

  const validar = useCallback(() => {
    despachar({ tipo: "validar" });
    if (itensReprovados(estado).length === 0) {
      router.push(rotas.app.aprovada);
      return;
    }
    setBloqueioPendente(bloqueioPorReprovacao(estado));
    router.push(rotas.app.bloqueio);
  }, [estado, router]);

  const contexto = useMemo<ChecklistContexto>(
    () => ({
      estado,
      bloqueioPendente,
      reiniciar: () => despachar({ tipo: "reiniciar" }),
      responder: (resposta) => despachar({ tipo: "responder", resposta }),
      proxima: () => despachar({ tipo: "proxima" }),
      anterior: () => despachar({ tipo: "anterior" }),
      irPara: (indice) => despachar({ tipo: "irPara", indice }),
      voltarDaRevisao: () => despachar({ tipo: "voltarDaRevisao" }),
      observar: (texto) => despachar({ tipo: "observar", texto }),
      anexarFoto: () => despachar({ tipo: "anexarFoto" }),
      atalhoPergunta9: () => despachar({ tipo: "atalhoPergunta9" }),
      atalhoResponderResto: () => despachar({ tipo: "atalhoResponderResto" }),
      validar,
      definirBloqueio: setBloqueioPendente,
      consumirBloqueio,
    }),
    [estado, bloqueioPendente, validar, consumirBloqueio],
  );

  return <ChecklistContext value={contexto}>{children}</ChecklistContext>;
}

export function useChecklist(): ChecklistContexto {
  const contexto = useContext(ChecklistContext);
  if (!contexto) throw new Error("useChecklist precisa estar dentro de <ChecklistProvider>.");
  return contexto;
}
