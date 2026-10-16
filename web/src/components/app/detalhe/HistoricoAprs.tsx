import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { dataHora } from "@/lib/formatar";
import { aprAprovadaDisponivel, type AprDaOs, type ExecucaoDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { Recolhivel } from "./Recolhivel";

/** Histórico das APRs desta OS (da mais recente para a mais antiga), com o resultado de cada uma. */
export function HistoricoAprs({ aprs, execucoes, osId }: { aprs: AprDaOs[]; execucoes: ExecucaoDaOs[]; osId: string }) {
  if (aprs.length === 0) return null;
  const disponivel = aprAprovadaDisponivel(aprs, execucoes);
  const usadas = new Set(execucoes.filter((e) => e.resultado !== "cancelada").map((e) => e.apr_id));

  return (
    <Recolhivel titulo="APRs desta OS" resumo={`${aprs.length} ${aprs.length === 1 ? "APR" : "APRs"}`}>
      <div className="list-box">
        {[...aprs].reverse().map((apr) => {
          const aprovada = apr.resultado === "aprovada";
          const motivo = `${apr.itens_reprovados.length} item(ns) reprovado(s)`;
          return (
            <div key={apr.id} className="list-row" style={{ minHeight: 56, flexWrap: "wrap" }}>
              <Badge tone={aprovada ? "enc" : "blq"}>{aprovada ? "Aprovada" : "Bloqueada"}</Badge>
              <span className="grow stack" style={{ gap: 0 }}>
                <span style={{ fontSize: 14 }}>
                  {dataHora(apr.concluida_em)} · {apr.modelo.codigo} v{apr.modelo.versao}
                </span>
                <span className="small">
                  {apr.preenchida_por.nome}
                  {aprovada
                    ? apr.id === disponivel?.id
                      ? " · ampara a execução de hoje"
                      : usadas.has(apr.id)
                        ? " · usada numa execução"
                        : " · de outro dia, não vale para executar"
                    : ` · ${motivo}`}
                </span>
              </span>
              {!aprovada && (
                <Link className="btn btn-line btn-sm" href={`${rotas.app.bloqueio(osId)}?apr=${apr.id}`}>
                  Ver motivo
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </Recolhivel>
  );
}
