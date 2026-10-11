import { LinkAviso } from "@/components/ui/Aviso";
import { Assinatura } from "@/components/ui/Assinatura";
import { Req } from "@/components/ui/Field";
import { executantes } from "@/data/execucao";

/** Assinaturas de todos os executantes da OS. */
export function AssinaturasExecutantes() {
  return (
    <div className="field">
      <div className="row between">
        <label>
          Assinaturas dos executantes <Req style={{ color: "var(--exe)" }}>· de todos</Req>
        </label>
        <LinkAviso aviso="Limparia a assinatura para assinar de novo." style={{ fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          Limpar
        </LinkAviso>
      </div>
      {executantes.map((executante) => (
        <div key={executante.pessoa} className="sig">
          <Assinatura pessoa={executante.pessoa} width="100%" height={64} />
          <div className="who">{executante.identificacao}</div>
        </div>
      ))}
    </div>
  );
}
