import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { apiOuNulo } from "@/lib/api";
import { enderecoDoMapa, type EmergenciaDaOs } from "@/lib/emergencia";
import { dataHora } from "@/lib/formatar";
import { AtenderEmergencia } from "./AtenderEmergencia";

/**
 * As emergências acionadas na OS do alerta (`GET /os/{id}/emergencias`): quem acionou, quando (e quando a `api` recebeu, se o aparelho esperou o sinal),
 * a posição no mapa, a observação e o atendimento. A que ainda está aberta tem o botão de dar por atendida, para quem supervisiona a equipe ou é admin.
 */
export async function DetalheDaEmergencia({ osId, podeAtender }: { osId: string; podeAtender: boolean }) {
  const dados = await apiOuNulo<{ emergencias: EmergenciaDaOs[] }>(`/os/${osId}/emergencias`);
  const lista = dados?.emergencias ?? [];
  if (lista.length === 0) return null;
  return (
    <div className="stack g12" data-treino="emergencias-da-os">
      <h3 style={{ fontSize: 16, fontWeight: 600 }}>Emergências desta OS</h3>
      {lista.map((e) => {
        const atrasada = new Date(e.recebida_em).getTime() - new Date(e.acionada_em).getTime() > 60_000;
        return (
          <div key={e.id} className="stack g8" style={{ padding: 12, border: "1px solid var(--line2)", borderRadius: 10 }}>
            <div className="row wrap g8">
              <Badge tone={e.atendida_em ? "enc" : "blq"}>{e.atendida_em ? "Atendida" : "Aberta"}</Badge>
              <strong>{e.acionada_por.nome}</strong>
              <span className="mono small">mat. {e.acionada_por.matricula}</span>
            </div>
            <p className="small">
              Acionada em {dataHora(e.acionada_em)}
              {atrasada ? ` (o aparelho estava sem sinal; chegou em ${dataHora(e.recebida_em)})` : ""}.
              {e.latitude !== null && e.longitude !== null ? (
                <>
                  {" "}
                  <a href={enderecoDoMapa(e.latitude, e.longitude)} target="_blank" rel="noreferrer">
                    Ver a posição no mapa
                  </a>
                  .
                </>
              ) : (
                " Sem posição: o aparelho não conseguiu o GPS."
              )}
            </p>
            {e.observacao && <p>“{e.observacao}”</p>}
            {e.atendida_em && e.atendida_por ? (
              <Notice tone="ok" icon="check">
                Atendida por {e.atendida_por.nome} em {dataHora(e.atendida_em)}
                {e.nota_do_atendimento ? `: “${e.nota_do_atendimento}”` : "."}
              </Notice>
            ) : (
              podeAtender && <AtenderEmergencia emergenciaId={e.id} />
            )}
          </div>
        );
      })}
    </div>
  );
}
