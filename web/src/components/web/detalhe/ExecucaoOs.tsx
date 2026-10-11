import { Icon } from "@/components/ui/Icon";
import { Panel } from "@/components/web/Panel";
import { fotosExecucao, medidasExecucao } from "@/data/detalhe";
import { AssinaturasOs } from "./AssinaturasOs";

const rotuloMedida = { color: "var(--ink4)" } as const;

/** Painel de execução: tempos, descrição, fotos e assinaturas. */
export function ExecucaoOs() {
  return (
    <Panel>
      <h2>Execução</h2>
      <div className="medidas">
        {medidasExecucao.map((medida) => (
          <div key={medida.rotulo}>
            <div className="small" style={rotuloMedida}>
              {medida.rotulo}
            </div>
            <strong style={{ fontSize: 14 }}>{medida.valor}</strong>
          </div>
        ))}
      </div>
      <div>
        <div className="small" style={rotuloMedida}>
          Descrição da atividade
        </div>
        <p style={{ fontSize: 14.5 }}>
          Inspecionadas as 12 válvulas. Corrosão superficial em V-104 e V-109, tratada com inibidor. Demais válvulas sem
          anomalias.
        </p>
      </div>
      <div className="row g12">
        {fotosExecucao.map((foto) => (
          <figure key={foto.hora} className="stack g6" style={{ margin: 0, flex: 1 }}>
            <div
              className="photo"
              role="img"
              aria-label={`Foto das ${foto.hora}`}
              style={{ height: 110, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="image" size={24} />
            </div>
            <figcaption className="small">
              <span className="mono">{foto.hora}</span> · {foto.legenda}
            </figcaption>
          </figure>
        ))}
      </div>
      <AssinaturasOs />
    </Panel>
  );
}
