"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import {
  nomeDoItem,
  pendenciasAbertas,
  problemasDoConteudo,
  type ConteudoDoRascunho,
  type Fase,
  type PassoExplicacao,
  type RascunhoDoEditor,
} from "@/lib/treinamento-servico";
import { useToast } from "@/state/toast";

/** O corpo do `PUT`: a `ordem` dos passos sempre de 0 em diante, na ordem da tela (reordenar não conta como editar). */
const normalizar = (c: ConteudoDoRascunho): ConteudoDoRascunho => ({
  explicacao: c.explicacao.map((p, i) => ({ ...p, ordem: i })),
  fases: c.fases,
  cenario_path: c.cenario_path,
});

const conteudoDe = (r: Pick<RascunhoDoEditor, "explicacao" | "fases" | "cenario_path">): ConteudoDoRascunho => ({ explicacao: r.explicacao, fases: r.fases, cenario_path: r.cenario_path });

/**
 * O rascunho que uma tela do editor está mexendo: o conteúdo na tela, se há alteração não salva, o que falta preencher e as
 * pendências da Vitória (recalculadas a cada edição, as mesmas que a `api` confere ao publicar). Salvar manda o rascunho
 * inteiro (`PUT .../rascunho`); com campo vazio, nem tenta e aponta o que falta.
 */
export function useRascunho(codigo: string, inicial: RascunhoDoEditor) {
  const roteador = useRouter();
  const exibirAviso = useToast();
  const [conteudo, setConteudo] = useState<ConteudoDoRascunho>(() => conteudoDe(inicial));
  const [salvo, setSalvo] = useState(() => JSON.stringify(normalizar(conteudoDe(inicial))));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** Só depois de tentar salvar os campos vazios ficam marcados: enquanto a pessoa escreve, a tela não reclama. */
  const [mostrarProblemas, setMostrarProblemas] = useState(false);

  const sujo = JSON.stringify(normalizar(conteudo)) !== salvo;
  const problemas = problemasDoConteudo(conteudo);
  const pendencias = pendenciasAbertas(conteudo);

  useEffect(() => {
    if (!sujo) return;
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sujo]);

  async function salvar(novo: ConteudoDoRascunho = conteudo, { silencioso = false } = {}): Promise<boolean> {
    const corpo = normalizar(novo);
    const faltando = problemasDoConteudo(corpo);
    if (faltando.length > 0) {
      setMostrarProblemas(true);
      const itens = [...new Set(faltando.map(nomeDoItem))];
      setErro(`Falta preencher: ${itens.length === 1 ? itens[0] : `${itens.slice(0, -1).join(", ")} e ${itens.at(-1)}`}.`);
      return false;
    }
    setErro(null);
    setSalvando(true);
    try {
      await chamar<RascunhoDoEditor>("PUT", `/treinamentos/${encodeURIComponent(codigo)}/rascunho`, corpo);
      setSalvo(JSON.stringify(corpo));
      setMostrarProblemas(false);
      if (!silencioso) exibirAviso("Rascunho salvo.");
      roteador.refresh();
      return true;
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível salvar o rascunho. Tente de novo.");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  return {
    conteudo,
    sujo,
    salvando,
    erro,
    problemas,
    pendencias,
    mostrarProblemas,
    salvar,
    /**
     * Grava um conteúdo novo e só então o mostra (a revisão confirma um item com um toque, sem barra de salvar): se a
     * gravação falhar, a tela continua como estava, com o erro, em vez de mostrar um "Conferido" que não foi salvo.
     */
    trocarESalvar: async (novo: ConteudoDoRascunho) => {
      const salvou = await salvar(novo, { silencioso: true });
      if (salvou) setConteudo(novo);
      return salvou;
    },
    /** Grava antes de algo que lê o rascunho do servidor (testar, pedir ajuste à Vitória); sem alteração, não chama a `api`. */
    garantirSalvo: () => (sujo ? salvar(conteudo, { silencioso: true }) : Promise.resolve(true)),
    /** Troca o conteúdo pelo que veio do servidor (o rascunho que a Vitória acabou de gravar): fica tudo salvo. */
    substituir: (r: Pick<RascunhoDoEditor, "explicacao" | "fases" | "cenario_path">) => {
      const novo = conteudoDe(r);
      setConteudo(novo);
      setSalvo(JSON.stringify(normalizar(novo)));
      setErro(null);
    },
    descartar: () => {
      setConteudo(JSON.parse(salvo) as ConteudoDoRascunho);
      setMostrarProblemas(false);
      setErro(null);
    },
    /** As mensagens do que falta num item, só depois de tentar salvar. */
    problemasDo: (parte: "passo" | "fase", indice: number) => (mostrarProblemas ? problemas.filter((p) => p.parte === parte && p.indice === indice).map((p) => p.mensagem) : []),
    mudarPasso: (indice: number, parcial: Partial<PassoExplicacao>) =>
      setConteudo((c) => ({ ...c, explicacao: c.explicacao.map((p, i) => (i === indice ? { ...p, ...parcial } : p)) })),
    mudarExplicacao: (f: (passos: PassoExplicacao[]) => PassoExplicacao[]) => setConteudo((c) => ({ ...c, explicacao: f(c.explicacao) })),
    mudarFase: (indice: number, fase: Fase) => setConteudo((c) => ({ ...c, fases: c.fases.map((x, i) => (i === indice ? fase : x)) })),
    mudarFases: (f: (fases: Fase[]) => Fase[]) => setConteudo((c) => ({ ...c, fases: f(c.fases) })),
    mudarCenario: (cenario_path: string | null) => setConteudo((c) => ({ ...c, cenario_path })),
  };
}

export type Rascunho = ReturnType<typeof useRascunho>;

/** Troca um item de lugar com o vizinho (`-1` sobe, `1` desce). */
export function mover<T>(lista: T[], indice: number, sentido: -1 | 1): T[] {
  const destino = indice + sentido;
  if (destino < 0 || destino >= lista.length) return lista;
  const copia = [...lista];
  [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
  return copia;
}
