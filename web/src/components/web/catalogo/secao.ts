import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Usuario } from "@/lib/tipos";

/** Quem cadastra materiais e define a lista de cada serviço: o administrador (a `api` recusa os demais com `403`). Todos leem. */
export const editaCatalogo = (u: Pick<Usuario, "perfil">) => ehAdmin(u);

/** As abas da seção Catálogo, também listadas como dropdown no menu. */
export const abasDoCatalogo: AbaDaSecao[] = [
  { href: rotas.app.catalogo, rotulo: "Serviços", icone: "list" },
  { href: rotas.app.catalogoMateriais, rotulo: "Materiais", icone: "box" },
];
