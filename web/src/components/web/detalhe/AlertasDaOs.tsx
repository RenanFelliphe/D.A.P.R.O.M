import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import type { AlertaDaOs, ReprogramacaoDaOs } from "@/data/detalhe";
import { rotuloDoTipo } from "@/components/web/alertas/tipos";
import { dataDoDia, dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

/** Rótulos curtos desta lista; o que não está aqui (a conferência da execução, por exemplo) vem de `rotuloDoTipo`, o texto único de `shared`. */
const rotuloDoAlerta: Record<string, string> = {
  bloqueio: "Impedimento",
  conflito_planejamento: "Conflito de planejamento",
  apoio_encerrado: "OS de apoio encerrada",
  execucao_duplicada: "Execução duplicada",
  preventiva_proxima: "Preventiva: ciclo próximo",
  preventiva_vencida: "Preventiva: ciclo vencido",
  inspecao_com_pendencia: "Inspeção com pendência",
  pedido_de_acao: "Pedido de um participante",
  pedido_decidido: "Resposta a um pedido",
  acao_de_participante: "Ação de um participante",
  apr_para_assinar: "APR aguardando assinatura",
  direito_de_recusa: "Direito de recusa na APR",
  lesao_ou_enfermidade: "Lesão ou enfermidade",
  clima_extremo: "Risco climático extremo na APR",
  os_para_assinar: "OS aguardando assinatura",
};

/** Impedimento e os avisos de segurança do trabalho (recusa, lesão ou enfermidade) em vermelho; os demais em âmbar. */
const TIPOS_CRITICOS = ["bloqueio", "direito_de_recusa", "lesao_ou_enfermidade", "clima_extremo", "conferencia_para_decidir", "conferencia_cobranca", "conferencia_tempo_esgotado"];

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
                  <Badge tone={TIPOS_CRITICOS.includes(a.tipo) ? "blq" : "al"}>{rotuloDoAlerta[a.tipo] ?? (rotuloDoTipo as Record<string, string>)[a.tipo] ?? a.tipo}</Badge>
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
