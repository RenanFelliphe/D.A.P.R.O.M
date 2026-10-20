import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import type { OsDetalhe } from "@/data/detalhe";
import { AVISO_DA_ASSINATURA_FINAL_ESPERA, assinaturaFinalEsperaConferencia, conferenciaEmDestaque, type ConferenciaDaOs } from "@/lib/conferencia";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { BotaoCiencia } from "./BotaoCiencia";

/**
 * A assinatura final do supervisor (a antiga "ciência"), depois da execução: `encerrando` (o responsável ainda vai preencher e assinar o
 * encerramento), `aguardando_supervisor` (o supervisor da equipe lê o relatório da execução e assina, mesmo que tenha participado do
 * serviço) e `encerrada` (quem assinou e quando). Nos outros status não há o que mostrar. Com a conferência da execução ainda sem comparar as
 * versões (parte do serviço foi registrada sem sinal), o botão da assinatura dá lugar ao aviso e ao link da conferência: a `api` recusa a assinatura (409).
 */
export function CienciaSupervisor({ os, podeDarCiencia, conferencias }: { os: OsDetalhe; podeDarCiencia: boolean; conferencias?: ConferenciaDaOs[] }) {
  if (os.status !== "encerrando" && os.status !== "aguardando_supervisor" && os.status !== "encerrada") return null;
  return (
    <Panel style={{ gap: 8 }}>
      <h2>Assinatura final do supervisor</h2>
      {os.status === "encerrando" ? (
        <p className="muted">O serviço terminou e o tempo parou. O responsável ainda vai preencher e assinar o encerramento; só depois a OS segue para a assinatura do supervisor.</p>
      ) : os.status === "aguardando_supervisor" ? (
        podeDarCiencia ? (
          <>
            <p className="muted">O responsável já assinou o encerramento. Leia o relatório da execução e assine para concluir a OS: o PDF é gerado com a sua assinatura.</p>
            {assinaturaFinalEsperaConferencia(conferencias) ? (
              <>
                <Notice tone="al" icon="clock">
                  {AVISO_DA_ASSINATURA_FINAL_ESPERA}
                </Notice>
                <LinkButton variant="p" sm href={rotas.app.conferencia(os.id, conferenciaEmDestaque(conferencias ?? [])?.id)} style={{ alignSelf: "flex-start" }}>
                  Abrir a conferência
                </LinkButton>
              </>
            ) : (
              <BotaoCiencia osId={os.id} />
            )}
          </>
        ) : (
          <p className="muted">Pendente: o supervisor da equipe {os.equipe.nome} ainda não assinou.</p>
        )
      ) : os.ciencia_em ? (
        <p>
          <strong style={{ color: "var(--enc)" }}>Assinada e concluída em {dataHora(os.ciencia_em)}</strong>
          {os.ciencia_por_nome && <span className="muted"> · {os.ciencia_por_nome}</span>}
        </p>
      ) : (
        <p className="muted">OS concluída, sem registro da assinatura do supervisor (histórico).</p>
      )}
    </Panel>
  );
}
