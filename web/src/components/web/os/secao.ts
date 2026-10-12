import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Usuario } from "@/lib/tipos";

/**
 * Importação, e no dashboard de OS a entrada de OS e a baixa no SAP, são do administrador (a `api` recusa os
 * demais com `403`).
 */
export const veImportacao = (u: Pick<Usuario, "perfil">) => ehAdmin(u);

const abas: AbaDaSecao[] = [
  { href: rotas.web.quadro, rotulo: "Quadro", icone: "grid" },
  { href: rotas.web.importacao, rotulo: "Importação", icone: "upload" },
];

/** As abas da seção Ordem de Serviço que a pessoa vê: o supervisor, só o Quadro. */
export const abasDoPerfil = (u: Pick<Usuario, "perfil">): AbaDaSecao[] => (veImportacao(u) ? abas : abas.slice(0, 1));
