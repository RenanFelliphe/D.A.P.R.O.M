import { Panel } from "@/components/web/Panel";
import { versoesApr03 } from "@/data/modelos";

/** Histórico de versões do modelo aberto. */
export function VersoesModelo() {
  return (
    <Panel style={{ padding: 16, gap: 10 }}>
      <h2 style={{ fontSize: 15 }}>Versões da APR 03</h2>
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
        {versoesApr03.map((v) => (
          <li key={v.titulo} className="stack" style={{ lineHeight: 1.35 }}>
            <strong style={{ fontSize: 13.5 }}>{v.titulo}</strong>
            <span className="small">{v.detalhe}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
