import Link from "next/link";
import { Panel, TableWrap } from "@/components/web/Panel";
import { Paginas } from "@/components/web/quadro/Paginas";
import type { RespostaHistorico } from "@/data/detalhe";
import { dataHora, duracao } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

interface HistoricoDoLocalProps {
  osId: string;
  local: string;
  equipamento: string | null;
  /** `equipamento`: só as execuções do equipamento; `local`: todas as do local. */
  escopo: "equipamento" | "local";
  historico: RespostaHistorico;
  hrefDoEscopo: (escopo: "equipamento" | "local") => string;
  hrefDaPagina: (pagina: number) => string;
}

/** Execuções encerradas do local (ou do equipamento), da mais recente à mais antiga. */
export function HistoricoDoLocal({ osId, local, equipamento, escopo, historico, hrefDoEscopo, hrefDaPagina }: HistoricoDoLocalProps) {
  return (
    <Panel>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Histórico do {escopo === "equipamento" ? "equipamento" : "local"}</h2>
          <span className="muted">
            Execuções encerradas {escopo === "equipamento" ? <>do equipamento <span className="mono">{equipamento}</span> em </> : "em "}
            {local}
          </span>
        </div>
        {equipamento && (
          <Link href={hrefDoEscopo(escopo === "equipamento" ? "local" : "equipamento")} style={{ fontSize: 13.5, fontWeight: 600 }}>
            {escopo === "equipamento" ? "Ver todo o local" : "Ver só o equipamento"}
          </Link>
        )}
      </div>
      {historico.execucoes.length === 0 ? (
        <p className="muted">Nenhuma execução encerrada neste {escopo === "equipamento" ? "equipamento" : "local"} ainda.</p>
      ) : (
        <TableWrap>
          <table className="tb">
            <thead>
              <tr>
                <th>Ordem</th>
                <th>Atividade</th>
                <th>Executor</th>
                <th>Encerrada em</th>
                <th className="r">Tempo líquido</th>
              </tr>
            </thead>
            <tbody>
              {historico.execucoes.map((e) => (
                <tr key={e.id}>
                  <td className="mono">
                    {e.os.id === osId ? (
                      <span title="Esta OS">{e.os.numero_ordem ?? "—"} (esta)</span>
                    ) : (
                      <Link href={rotas.web.os(e.os.id)}>{e.os.numero_ordem ?? "sem nº"}</Link>
                    )}
                  </td>
                  <td>
                    {e.os.titulo}
                    {escopo === "local" && e.os.equipamento && <div className="small mono">{e.os.equipamento}</div>}
                    {e.descricao_atividade && <div className="small">{e.descricao_atividade}</div>}
                  </td>
                  <td>{e.executor.nome}</td>
                  <td>{dataHora(e.fim)}</td>
                  <td className="r">{duracao(e.tempo_liquido_min)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      <Paginas pagina={historico.pagina} tamanho={historico.tamanho} total={historico.total} unidade="execuções" hrefDa={hrefDaPagina} />
    </Panel>
  );
}
