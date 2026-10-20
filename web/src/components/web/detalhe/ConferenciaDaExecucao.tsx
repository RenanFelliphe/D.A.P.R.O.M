import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Panel } from "@/components/web/Panel";
import { apiOuNulo } from "@/lib/api";
import {
  ROTULO_DO_ESTADO_DA_CONFERENCIA,
  ROTULO_DO_TIPO_DA_CONFERENCIA,
  descreverEscolha,
  passoDaConferencia,
  quemFalta,
  ressalvasDaConferencia,
  type ConferenciaDaApi,
  type ConferenciaDaOs,
} from "@/lib/conferencia";
import { dataHora } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

const seloDoEstado = { aguardando_sincronizacao: "al", aguardando_responsavel: "al", aguardando_assinaturas: "lib", concluida: "enc", fechada_sem_todos: "neu" } as const;

/** A conferência lida da `api`; `null` quando quem olha não a enxerga (a `api` responde 404) ou a leitura falha: o painel mostra só o estado. */
async function lerConferencia(id: string): Promise<ConferenciaDaApi | null> {
  try {
    return await apiOuNulo<ConferenciaDaApi>(`/conferencias/${id}`);
  } catch {
    return null;
  }
}

/**
 * A conferência da execução na gestão (supervisor e admin), no resumo da OS: o estado, o tipo, quem ainda falta, as escolhas feitas de cada
 * diferença e as ressalvas de quem assinou. A escolha e a assinatura são feitas na tela da conferência (`/app/os/{id}/conferencia`), que serve
 * também ao supervisor (ele escolhe o resultado). Sem conferência, não desenha nada.
 */
export async function ConferenciaDaExecucao({ osId, conferencias }: { osId: string; conferencias: ConferenciaDaOs[] | undefined }) {
  if (!conferencias || conferencias.length === 0) return null;
  const completas = await Promise.all(conferencias.map((c) => lerConferencia(c.id)));
  return (
    <>
      {conferencias.map((resumo, i) => {
        const c = completas[i];
        const falta = c ? quemFalta(c) : null;
        const ressalvas = c ? ressalvasDaConferencia(c) : [];
        const passo = c ? passoDaConferencia(c) : null;
        return (
          <Panel key={resumo.id} style={{ gap: 10 }}>
            <div className="row between wrap g8">
              <h2>Conferência da execução{conferencias.length > 1 ? ` ${i + 1}` : ""}</h2>
              <div className="row g6 wrap">
                <Badge tone={seloDoEstado[resumo.estado]}>{ROTULO_DO_ESTADO_DA_CONFERENCIA[resumo.estado]}</Badge>
                {resumo.tipo && <Badge tone="neu">{ROTULO_DO_TIPO_DA_CONFERENCIA[resumo.tipo]}</Badge>}
              </div>
            </div>
            {passo ? <p className="muted">{passo.texto}</p> : <p className="muted">Parte da execução foi registrada sem sinal, em aparelhos diferentes.</p>}
            {c && (
              <div className="stack g8">
                {c.responsavel && (
                  <span className="small">
                    Responsável pela conferência: <strong>{c.responsavel.nome}</strong> · aberta em {dataHora(c.criada_em)}
                  </span>
                )}
                {falta && falta.sincronizar.length > 0 && (
                  <span className="small">
                    Faltam sincronizar: <strong>{falta.sincronizar.join(", ")}</strong>
                  </span>
                )}
                {falta && falta.assinar.length > 0 && c.estado === "aguardando_assinaturas" && (
                  <span className="small">
                    Faltam a ciência ou a assinatura de: <strong>{falta.assinar.join(", ")}</strong>
                  </span>
                )}
                {c.decisoes.length > 0 && (
                  <div className="stack g4">
                    <span className="lbl">Escolhas</span>
                    {c.decisoes.map((d) => (
                      <span key={d.campo} className="small">
                        {c.campos.find((campo) => campo.campo === d.campo)?.rotulo ?? d.campo}: <strong>{descreverEscolha(c, d.escolha)}</strong>
                        {d.decidida_por ? ` · ${d.decidida_por.nome}` : ""}
                      </span>
                    ))}
                  </div>
                )}
                {ressalvas.length > 0 && (
                  <div className="stack g6">
                    <span className="lbl">Ressalvas</span>
                    {ressalvas.map((r) => (
                      <p key={`${r.nome}-${r.quando}`} className="cf-ressalva">
                        <strong>{r.nome}</strong> ({dataHora(r.quando)}): {r.ressalva}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="row g8 wrap">
              <LinkButton variant="line" sm href={rotas.app.conferencia(osId, resumo.id)}>
                {c?.eu.pode_decidir.length ? "Escolher as versões" : "Abrir a conferência"}
              </LinkButton>
            </div>
          </Panel>
        );
      })}
    </>
  );
}
