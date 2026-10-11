import { Assinatura } from "@/components/ui/Assinatura";
import { assinaturasExecucao } from "@/data/detalhe";

const colunaAssinatura = { maxWidth: 260, flex: 1 } as const;
const rotulo = { color: "var(--ink4)" } as const;

/** Assinaturas dos executantes e ciência pendente do supervisor. */
export function AssinaturasOs() {
  return (
    <div className="row g12 wrap">
      {assinaturasExecucao.map((item) => (
        <div key={item.pessoa} className="stack g4" style={colunaAssinatura}>
          <div className="small" style={rotulo}>
            {item.papel}
          </div>
          <div className="sig-box" style={{ background: "#fff" }}>
            <Assinatura pessoa={item.pessoa} espessura={2} />
          </div>
          <div className="small">{item.legenda}</div>
        </div>
      ))}
      <div className="stack g4" style={colunaAssinatura}>
        <div className="small" style={rotulo}>
          Ciência do supervisor
        </div>
        <div
          className="sig-box"
          style={{ background: "#fff", color: "var(--ink4)", fontSize: 12.5, justifyContent: "center" }}
        >
          Pendente · assina no painel
        </div>
        <div className="small">Marcos Tavares</div>
      </div>
    </div>
  );
}
