import { rotuloDoCampo } from "@/data/auditoria";

const texto = (valor: unknown): string => {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
};

const ehMudanca = (valor: unknown): valor is { de: unknown; para: unknown } =>
  typeof valor === "object" && valor !== null && "de" in valor && "para" in valor;

/** O que mudou (de → para) ou os dados extras de um registro da trilha, em lista curta. */
export function DetalhesDoRegistro({ detalhes }: { detalhes: Record<string, unknown> | null }) {
  const campos = Object.entries(detalhes ?? {});
  if (campos.length === 0) return <span className="muted">—</span>;
  return (
    <details>
      <summary className="small" style={{ cursor: "pointer" }}>
        {campos.length === 1 ? "1 detalhe" : `${campos.length} detalhes`}
      </summary>
      <ul className="small" style={{ margin: "6px 0 0", paddingLeft: 16 }}>
        {campos.map(([campo, valor]) => (
          <li key={campo}>
            <strong>{rotuloDoCampo[campo] ?? campo}:</strong> {ehMudanca(valor) ? `${texto(valor.de)} → ${texto(valor.para)}` : texto(valor)}
          </li>
        ))}
      </ul>
    </details>
  );
}
