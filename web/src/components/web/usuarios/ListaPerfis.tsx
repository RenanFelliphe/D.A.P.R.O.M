import { Panel } from "@/components/web/Panel";
import { perfis } from "@/data/usuarios";

/** O que cada perfil de acesso pode fazer. */
export function ListaPerfis() {
  return (
    <Panel style={{ gap: 8 }}>
      <h2>Perfis</h2>
      <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13.5, display: "flex", flexDirection: "column", gap: 4 }}>
        {perfis.map((p) => (
          <li key={p.nome}>
            <b>{p.nome}</b>: {p.descricao}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
