import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { apiOuNulo } from "@/lib/api";
import { data, dataDoDia, dataHora } from "@/lib/formatar";
import { rotas, urlDoPdf } from "@/lib/rotas";
import { rotuloDoStatus, type Equipe, type Usuario } from "@/lib/tipos";
import { DecisoesDaOs } from "./DecisoesDaOs";
import { CausaDoBloqueio } from "./DetalheBloqueio";
import { DetalheCicloPreventiva } from "./DetalheCicloPreventiva";
import { DetalheAusencia } from "./DetalheAusencia";
import { DetalheAvisoGeral } from "./DetalheAvisoGeral";
import { DetalheRepresentacao } from "./DetalheRepresentacao";
import { DetalheFalhaImportacao } from "./DetalheFalhaImportacao";
import { MarcarLidoAoAbrir } from "./MarcarLidoAoAbrir";
import { aparenciaDoAlerta, ehAvisoGeral, ehDeAusencia, ehDeCiclo, ehDeRepresentacao, ehDoUsuario, perfilAgeSobreAlertas, rotuloDaLeitura, rotuloDoAlerta, type Alerta, type DetalheDaOs } from "./tipos";

/** Avisos de OS que só informam (a reserva, a ciência, o PDF): não pedem decisão sobre a OS, mesmo encerrada. */
const SO_INFORMAM: Alerta["tipo"][] = ["os_reservada", "os_reserva_desfeita", "os_ciencia", "pdf_os_falhou"];

interface DetalheAlertaProps {
  alerta: Alerta;
  usuario: Usuario;
  equipes: Equipe[];
  /** Abrir o alerta o marca como lido (só para quem pode agir sobre alertas, e só o próprio alerta). */
  marcarAoAbrir: boolean;
}

/**
 * Painel de detalhe do alerta: a OS, o que aconteceu e, para o impedimento, o que causou e as decisões do supervisor ou
 * admin. Abrir o próprio alerta o marca como lido, sem botão; o admin que abre o alerta de outra pessoa só o lê.
 */
export async function DetalheAlerta({ alerta, usuario, equipes, marcarAoAbrir }: DetalheAlertaProps) {
  // A ausência de um usuário não tem OS: o supervisor responde na equipe.
  if (ehDeAusencia(alerta)) return <DetalheAusencia alerta={alerta} usuario={usuario} marcarAoAbrir={marcarAoAbrir} />;
  // O representante que assumiu a equipe (ou a devolveu) também não tem OS.
  if (ehDeRepresentacao(alerta)) return <DetalheRepresentacao alerta={alerta} usuario={usuario} marcarAoAbrir={marcarAoAbrir} />;
  // A conta de uma pessoa, a equipe sem supervisor, o registro de funcionários, o treinamento e a Vitória: detalhe geral.
  if (ehAvisoGeral(alerta)) return <DetalheAvisoGeral alerta={alerta} usuario={usuario} marcarAoAbrir={marcarAoAbrir} />;
  // A falha de importação não tem OS: detalhe próprio.
  if (alerta.tipo === "falha_importacao" || !alerta.os_id) return <DetalheFalhaImportacao alerta={alerta} usuario={usuario} marcarAoAbrir={marcarAoAbrir} />;
  // O do ciclo das preventivas fala do plano, não de uma decisão sobre a OS.
  if (ehDeCiclo(alerta)) return <DetalheCicloPreventiva alerta={alerta} usuario={usuario} marcarAoAbrir={marcarAoAbrir} />;
  const osId = alerta.os_id;
  const bloqueio = alerta.tipo === "bloqueio";
  const inspecao = alerta.tipo === "inspecao_com_pendencia";
  const { icone, urgente } = aparenciaDoAlerta(alerta);
  const podeAgir = perfilAgeSobreAlertas(usuario);
  const naoLido = alerta.lido_em === null;

  // A OS pode já não ser visível ao usuário (por exemplo, o supervisor reprogramou para outra equipe): 404.
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${osId}`);
  const os = detalhe?.os ?? null;
  const aberta = os !== null && os.status !== "encerrada" && os.status !== "cancelada" && os.status !== "devolvida";
  const decide = podeAgir && aberta && (bloqueio || alerta.tipo === "apoio_encerrado");

  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g6" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <Badge tone={urgente ? "blq" : inspecao ? "al" : "lib"}>
              <Icon name={icone} size={13} />
              {rotuloDoAlerta(alerta)}
            </Badge>
            <Badge tone="neu">{rotuloDaLeitura(alerta, usuario)}</Badge>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.25 }}>
            <span className="mono">{alerta.numero_ordem ? `OS ${alerta.numero_ordem}` : "OS de apoio"}</span> — {alerta.titulo}
          </h2>
        </div>
        {os && (
          <div className="row wrap g12">
            {/* O PDF que não saiu: abrir o PDF gera de novo, na hora. */}
            {alerta.tipo === "pdf_os_falhou" && os.status === "encerrada" && (
              <a href={urlDoPdf(osId)} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600 }}>
                Abrir o PDF
              </a>
            )}
            <Link href={rotas.app.os(osId)} style={{ fontSize: 14, fontWeight: 600 }}>
              Abrir OS
            </Link>
          </div>
        )}
      </div>

      <Notice tone={urgente ? "blq" : "info"} icon={bloqueio ? "octagon" : urgente ? "alert" : "info"} style={{ fontSize: 14.5 }}>
        {alerta.detalhe}
      </Notice>

      {os ? (
        <dl className="dl d2">
          <div>
            <dt>Local</dt>
            <dd>
              {os.local_instalacao.codigo}
              {os.local_instalacao.endereco ? ` · ${os.local_instalacao.endereco}` : ""}
            </dd>
          </div>
          <div>
            <dt>Equipe da OS</dt>
            <dd>{os.equipe.nome}</dd>
          </div>
          <div>
            <dt>Situação da OS</dt>
            <dd>
              {rotuloDoStatus[os.status]} · programada para {dataDoDia(os.data_inicio_prog)}
            </dd>
          </div>
          <div>
            <dt>Recebido em</dt>
            <dd>
              {dataHora(alerta.criado_em)}
              {alerta.email_enviado_em ? ` · e-mail enviado ${data(alerta.email_enviado_em)}` : ""}
            </dd>
          </div>
        </dl>
      ) : (
        <Notice tone="al" icon="alert" style={{ fontSize: 14 }}>
          Você não tem acesso à OS deste alerta (ela pode ter sido reprogramada para outra equipe).
        </Notice>
      )}

      {bloqueio && detalhe && <CausaDoBloqueio aprs={detalhe.aprs} execucoes={detalhe.execucoes} />}

      {os && !aberta && !inspecao && !SO_INFORMAM.includes(alerta.tipo) && (
        <Notice tone="off" icon="info" style={{ fontSize: 14 }}>
          A OS está {rotuloDoStatus[os.status].toLowerCase()}: não há mais o que decidir sobre ela.
        </Notice>
      )}

      {decide && os && (
        <>
          <div className="stack g4">
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>O que fazer com a OS</h3>
            <p className="muted">
              {bloqueio
                ? "A OS fica pendente. A equipe pode fazer uma nova APR a qualquer momento; você acompanha e pode reprogramar ou abrir uma OS de apoio. Nada feito em campo é apagado."
                : "A OS original continua pendente: a equipe já pode fazer uma nova APR, e reprogramar é opcional."}
            </p>
          </div>
          <DecisoesDaOs os={os} usuario={usuario} equipes={equipes} comApoio={bloqueio} />
        </>
      )}

      {!podeAgir && (
        <div className="row between wrap" style={{ paddingTop: 4, borderTop: "1px solid var(--line2)" }}>
          <span className="muted">Você acompanha os alertas em modo de leitura.</span>
        </div>
      )}

      {podeAgir && naoLido && marcarAoAbrir && ehDoUsuario(alerta, usuario) && <MarcarLidoAoAbrir alertaId={alerta.id} />}
    </Panel>
  );
}
