import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import type { AlertaDaOs, ReprogramacaoDaOs } from "@/data/detalhe";
import { dataDoDia, dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

const rotuloDoAlerta: Record<string, string> = {
  bloqueio: "Impedimento",
  conflito_planejamento: "Conflito de planejamento",
  apoio_encerrado: "OS de apoio encerrada",
  execucao_duplicada: "Execução duplicada",
  preventiva_proxima: "Preventiva: ciclo próximo",
  preventiva_vencida: "Preventiva: ciclo vencido",
};

/** Alertas gerados para esta OS (com o destinatário) e as reprogramações feitas nela. */
export function AlertasDaOs({ alertas, reprogramacoes }: { alertas: AlertaDaOs[]; reprogramacoes: ReprogramacaoDaOs[] }) {
  return (
    <>
      <Panel style={{ gap: 8 }}>
        <h2>Alertas desta OS</h2>
        {alertas.length === 0 ? (
          <p className="muted">Nenhum alerta. Sem impedimento, conflito de planejamento nem execução duplicada.</p>
        ) : (
          <>
            {alertas.map((a) => (
              <div key={a.id} className="stack g4" style={{ paddingBottom: 8, borderBottom: "1px solid var(--line2)" }}>
                <div className="row between g8">
                  <Badge tone={a.tipo === "bloqueio" ? "blq" : "al"}>{rotuloDoAlerta[a.tipo] ?? a.tipo}</Badge>
                  <span className="small">{dataHora(a.criado_em)}</span>
                </div>
                <span style={{ fontSize: 13.5 }}>{a.detalhe}</span>
                <span className="small">
                  Para {a.destinatario_nome} · {a.lido_em ? `lido em ${dataHora(a.lido_em)}` : "não lido"}
                  {a.email_enviado_em ? " · e-mail enviado" : ""}
                </span>
              </div>
            ))}
            <Link href={rotas.web.alertas} style={{ fontSize: 13.5, fontWeight: 600 }}>
              Ir para os alertas
            </Link>
          </>
        )}
      </Panel>
      {reprogramacoes.length > 0 && (
        <Panel style={{ gap: 8 }}>
          <h2>Reprogramações</h2>
          {reprogramacoes.map((r) => (
            <div key={r.id} className="stack g4" style={{ paddingBottom: 8, borderBottom: "1px solid var(--line2)" }}>
              <strong style={{ fontSize: 13.5 }}>
                {dataDoDia(r.data_anterior)} → {dataDoDia(r.data_nova)}
              </strong>
              {r.equipe_anterior_id !== r.equipe_nova_id && (
                <span className="small">
                  Equipe: {r.equipe_anterior_nome ?? "—"} → {r.equipe_nova_nome ?? "—"}
                </span>
              )}
              <span style={{ fontSize: 13.5 }}>{r.justificativa}</span>
              <span className="small">
                {r.usuario_nome} · {dataHora(r.criada_em)}
              </span>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}
