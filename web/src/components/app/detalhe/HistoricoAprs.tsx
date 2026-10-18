import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { dataHora, hora } from "@/lib/formatar";
import { aprAprovadaDisponivel, situacaoDaApr, type AprDaOs, type ExecucaoDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { Recolhivel } from "./Recolhivel";

/**
 * Histórico das APRs desta OS (da mais recente para a mais antiga), com o resultado de cada uma e, nas aprovadas, quem assinou
 * (com a hora), quem ainda não assinou e quem recusou (com o motivo).
 */
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
          const situacao = situacaoDaApr(apr);
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
                      ? situacao.pronta
                        ? " · assinada por todos, ampara a execução de hoje"
                        : " · aguardando assinaturas"
                      : usadas.has(apr.id)
                        ? " · usada numa execução"
                        : situacao.inviavel
                          ? " · não serve mais (recusa)"
                          : " · de outro dia, não vale para executar"
                    : ` · ${motivo}`}
                </span>
              </span>
              {!aprovada && (
                <Link className="btn btn-line btn-sm" href={`${rotas.app.bloqueio(osId)}?apr=${apr.id}`}>
                  Ver motivo
                </Link>
              )}
              {aprovada && (
                <ul className="stack g4 small" style={{ flexBasis: "100%", listStyle: "none", padding: 0, margin: 0 }} aria-label="Assinaturas da APR">
                  {apr.participantes.map((p) => (
                    <li key={p.usuario_id}>
                      {p.recusou_em ? (
                        <>
                          <strong style={{ color: "var(--blq)" }}>{p.nome} recusou a APR</strong> em {dataHora(p.recusou_em)}: {p.recusa_motivo ?? "sem motivo registrado"}
                        </>
                      ) : p.assinada_em ? (
                        <>
                          {p.nome} assinou às {hora(p.assinada_em)}
                          {p.assinatura_presencial ? " (no aparelho do responsável)" : ""}
                        </>
                      ) : (
                        <>{p.nome} ainda não assinou</>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Recolhivel>
  );
}
