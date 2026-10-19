"use client";

import { useEffect, useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import type { Digitalizacao, EstadoDaDigitalizacao } from "./tipos-digitalizacao";

const SITUACAO: Record<Exclude<EstadoDaDigitalizacao, "registrada">, { rotulo: (d: Digitalizacao) => string; tom: BadgeTone }> = {
  lendo: { rotulo: (d) => (d.paginas > 0 ? `Lendo · folha ${d.paginas_lidas} de ${d.paginas}` : "Lendo"), tom: "exe" },
  lida: { rotulo: () => "Pronta para conferir", tom: "lib" },
  falhou: { rotulo: () => "A leitura falhou", tom: "blq" },
};

interface DigitalizacoesEmAbertoProps {
  /** Muda quando algo foi enviado, registrado ou descartado: a lista é pedida de novo. */
  versao: number;
  aoAbrir: (id: string) => void;
}

/**
 * As digitalizações que ainda não foram registradas: em leitura, prontas para conferir ou que falharam. A leitura roda em
 * segundo plano, então dá para sair da tela e voltar aqui para continuar a conferência. Sem nenhuma, não desenha nada.
 */
export function DigitalizacoesEmAberto({ versao, aoAbrir }: DigitalizacoesEmAbertoProps) {
  const [lista, setLista] = useState<Digitalizacao[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [descartando, setDescartando] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    chamar<{ digitalizacoes: Digitalizacao[] }>("GET", "/digitalizacoes")
      .then((r) => ativo && setLista(r.digitalizacoes))
      .catch(() => ativo && setLista([]));
    return () => {
      ativo = false;
    };
  }, [versao]);

  async function descartar(d: Digitalizacao) {
    setDescartando(d.id);
    setErro(null);
    try {
      await chamar("DELETE", `/digitalizacoes/${d.id}`);
      setLista((atual) => atual.filter((x) => x.id !== d.id));
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Servidor indisponível. Tente de novo.");
    } finally {
      setDescartando(null);
    }
  }

  if (lista.length === 0) return null;
  return (
    <Panel>
      <div className="stack" style={{ gap: 2 }}>
        <h2>Digitalizações em aberto · {lista.length}</h2>
        <span className="muted">PDFs de OS já executadas no papel que ainda não foram registrados.</span>
      </div>
      <ul className="lista-aberta">
        {lista.map((d) => {
          const s = SITUACAO[d.estado as keyof typeof SITUACAO];
          return (
            <li key={d.id}>
              <span className="stack" style={{ gap: 2, minWidth: 0, flex: 1 }}>
                <span className="mono" style={{ fontSize: 13.5, fontWeight: 600, overflowWrap: "anywhere" }}>
                  {d.nome_arquivo}
                </span>
                <span className="small">enviado em {dataHora(d.criada_em)}</span>
              </span>
              {s && <Badge tone={s.tom}>{s.rotulo(d)}</Badge>}
              <div className="row g8">
                <Button variant="line" sm onClick={() => aoAbrir(d.id)}>
                  {d.estado === "lida" ? "Conferir" : "Abrir"}
                </Button>
                <Button variant="line" sm onClick={() => descartar(d)} disabled={d.estado === "lendo" || descartando === d.id} aria-label={`Descartar ${d.nome_arquivo}`}>
                  <Icon name={descartando === d.id ? "refresh" : "trash"} size={16} className={descartando === d.id ? "spin" : undefined} />
                  Descartar
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {erro && (
        <span className="entrada-retorno erro" role="alert">
          {erro}
        </span>
      )}
    </Panel>
  );
}
