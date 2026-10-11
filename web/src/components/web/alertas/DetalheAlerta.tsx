import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import type { Atividade } from "@/components/web/os-nova/tipos";
import { apiOuNulo, api } from "@/lib/api";
import { data, dataDoDia, dataHora, hoje } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus, type Equipe, type Usuario } from "@/lib/tipos";
import { BotaoMarcarComoLido } from "./BotaoMarcarComoLido";
import { CartaoApoio } from "./CartaoApoio";
import { CartaoReprogramar } from "./CartaoReprogramar";
import { CausaDoBloqueio } from "./DetalheBloqueio";
import { perfilAgeSobreAlertas, rotuloDoAlerta, type Alerta, type DetalheDaOs } from "./tipos";

/** Painel de detalhe do alerta: a OS, o que aconteceu e, para o impedimento, o que causou e as decisões do supervisor ou analista. */
export async function DetalheAlerta({ alerta, usuario, equipes }: { alerta: Alerta; usuario: Usuario; equipes: Equipe[] }) {
  const bloqueio = alerta.tipo === "bloqueio";
  const podeAgir = perfilAgeSobreAlertas(usuario.perfil);
  const naoLido = alerta.lido_em === null;

  // A OS pode já não ser visível ao usuário (por exemplo, o supervisor reprogramou para outra equipe): 404.
  const detalhe = await apiOuNulo<DetalheDaOs>(`/os/${alerta.os_id}`);
  const os = detalhe?.os ?? null;
  const aberta = os !== null && os.status !== "encerrada" && os.status !== "cancelada";
  const decide = podeAgir && aberta && (bloqueio || alerta.tipo === "apoio_encerrado");
  const atividades = decide && bloqueio ? (await api<{ atividades: Atividade[] }>("/atividades", { consulta: { tamanho: 200 } })).atividades : [];
  const hojeDia = hoje();

  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g6" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <Badge tone={bloqueio ? "blq" : "lib"}>
              <Icon name={bloqueio ? "octagon" : "refresh"} size={13} />
              {rotuloDoAlerta(alerta)}
            </Badge>
            <Badge tone="neu">{naoLido ? "Não lido" : "Lido"}</Badge>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.25 }}>
            <span className="mono">{alerta.numero_ordem ? `OS ${alerta.numero_ordem}` : "OS manual"}</span> — {alerta.titulo}
          </h2>
        </div>
        {os && (
          <Link href={rotas.web.os(alerta.os_id)} style={{ fontSize: 14, fontWeight: 600 }}>
            Abrir OS
          </Link>
        )}
      </div>

      <Notice tone={bloqueio ? "blq" : "info"} icon={bloqueio ? "octagon" : "info"} style={{ fontSize: 14.5 }}>
        {alerta.detalhe}
      </Notice>

      {os ? (
        <dl className="dl" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
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
              {alerta.email_enviado_em ? ` · e-mail enviado ${data(alerta.email_enviado_em)}` : " · e-mail ainda não enviado"}
            </dd>
          </div>
        </dl>
      ) : (
        <Notice tone="al" icon="alert" style={{ fontSize: 14 }}>
          Você não tem acesso à OS deste alerta (ela pode ter sido reprogramada para outra equipe).
        </Notice>
      )}

      {bloqueio && detalhe && <CausaDoBloqueio aprs={detalhe.aprs} execucoes={detalhe.execucoes} />}

      {os && !aberta && (
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
          <div className="decide" style={bloqueio ? undefined : { gridTemplateColumns: "1fr" }}>
            {bloqueio && (
              <CartaoApoio
                osId={os.id}
                numeroOrdem={os.numero_ordem}
                tituloDaOs={os.titulo}
                local={{ tipo: "existente", id: os.local_instalacao.id, codigo: os.local_instalacao.codigo, endereco: os.local_instalacao.endereco }}
                equipes={equipes}
                atividades={atividades}
                hoje={hojeDia}
                equipeDoSupervisor={usuario.perfil === "supervisor" ? usuario.equipe_id : null}
              />
            )}
            <CartaoReprogramar osId={os.id} dataAtual={os.data_inicio_prog} equipeAtualId={os.equipe_id} equipes={equipes} hoje={hojeDia} />
          </div>
        </>
      )}

      <div className="row between wrap" style={{ paddingTop: 4, borderTop: "1px solid var(--line2)" }}>
        <span className="muted">
          {podeAgir ? (naoLido ? "Ao marcar como lido, o contador do topo e do menu diminui." : "Alerta já lido.") : "Você acompanha os alertas em modo de leitura."}
        </span>
        {podeAgir && naoLido && <BotaoMarcarComoLido alertaId={alerta.id} />}
      </div>
    </Panel>
  );
}
