import { Panel } from "@/components/web/Panel";
import { descricaoDosPerfis } from "@/data/usuarios";
import { rotuloDoPerfil } from "@/lib/tipos";

/** O que cada perfil de acesso pode fazer. */
export function ListaPerfis() {
  return (
    <Panel style={{ gap: 8 }}>
      <h2>Perfis</h2>
      <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13.5, display: "flex", flexDirection: "column", gap: 4 }}>
        {descricaoDosPerfis.map((p) => (
          <li key={p.perfil}>
            <b>{rotuloDoPerfil[p.perfil]}</b>: {p.descricao}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
