import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { apiOuNulo } from "@/lib/api";
import { dataDoDia, dataHora } from "@/lib/formatar";
import { aparenciaDaSituacao, contagemRegressiva, rotuloDaBase, rotuloDoPlano, type DetalheDoPlano } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";
import type { Usuario } from "@/lib/tipos";
import { MarcarLidoAoAbrir } from "./MarcarLidoAoAbrir";
import { ehDoUsuario, perfilAgeSobreAlertas, rotuloDaLeitura, rotuloDoAlerta, type Alerta } from "./tipos";

/**
 * Detalhe do alerta do ciclo de uma preventiva (próximo ou vencido): o que o alerta disse e a situação do plano agora (a
 * OS do ciclo seguinte pode já ter chegado do SAP). O sistema não cria a OS: o atalho leva às OS preventivas do quadro,
 * onde está o histórico do plano e o intervalo.
 */
export async function DetalheCicloPreventiva({ alerta, usuario, marcarAoAbrir }: { alerta: Alerta; usuario: Usuario; marcarAoAbrir: boolean }) {
  const vencido = alerta.tipo === "preventiva_vencida";
  const podeAgir = perfilAgeSobreAlertas(usuario);
  const naoLido = alerta.lido_em === null;
  const detalhe = alerta.plano_preventiva_id ? await apiOuNulo<DetalheDoPlano>(`/preventivas/${alerta.plano_preventiva_id}`) : null;
  const plano = detalhe?.plano ?? null;
  const agora = plano ? aparenciaDaSituacao[plano.situacao] : null;

  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g6" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <Badge tone={vencido ? "blq" : "al"}>
              <Icon name="clock" size={13} />
              {rotuloDoAlerta(alerta)}
            </Badge>
            <Badge tone="neu">{rotuloDaLeitura(alerta, usuario)}</Badge>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.25 }}>{plano?.titulo ?? alerta.titulo ?? "Preventiva"}</h2>
          {plano && <span className="small mono">{rotuloDoPlano(plano)}</span>}
        </div>
        <Link href={rotas.app.preventivas} style={{ fontSize: 14, fontWeight: 600 }}>
          Abrir as OS preventivas
        </Link>
      </div>

      <Notice tone={vencido ? "blq" : "al"} icon="clock" style={{ fontSize: 14.5 }}>
        {alerta.detalhe}
      </Notice>

      {plano && agora ? (
        <dl className="dl d2">
          <div>
            <dt>Situação do ciclo agora</dt>
            <dd>
              <Badge tone={agora.tom}>{agora.rotulo}</Badge> {contagemRegressiva(plano)}
              {plano.proximo_ciclo ? ` · próximo ciclo em ${dataDoDia(plano.proximo_ciclo)}` : ""}
            </dd>
          </div>
          <div>
            <dt>Intervalo</dt>
            <dd>{plano.intervalo_descricao ? `${plano.intervalo_descricao}, contado ${rotuloDaBase[plano.base_do_ciclo]}` : "Sem intervalo"}</dd>
          </div>
          <div>
            <dt>Última OS do plano</dt>
            <dd>
              {plano.ultima_os ? (
                <>
                  <Link href={rotas.app.os(plano.ultima_os.id)} className="mono">
                    {plano.ultima_os.numero_ordem ?? "OS"}
                  </Link>{" "}
                  · programada para {dataDoDia(plano.ultima_os.data_inicio_prog)}
                  {plano.ultima_os.encerrada_em ? ` · encerrada em ${dataDoDia(plano.ultima_os.encerrada_em)}` : ""}
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Equipe</dt>
            <dd>{plano.equipe?.nome ?? "—"}</dd>
          </div>
          <div>
            <dt>Recebido em</dt>
            <dd>{dataHora(alerta.criado_em)}</dd>
          </div>
          <div>
            <dt>Como seguir</dt>
            <dd>
              {plano.situacao === "vencido" || plano.situacao === "proximo"
                ? "Confira no SAP se a OS do próximo ciclo está programada; ela entra no sistema pela importação e reinicia a contagem."
                : "O ciclo já foi atendido ou mudou desde o alerta: nada a fazer."}
            </dd>
          </div>
        </dl>
      ) : (
        <Notice tone="al" icon="alert" style={{ fontSize: 14 }}>
          Você não tem acesso a este plano de preventiva (a equipe da última OS pode ter mudado).
        </Notice>
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
