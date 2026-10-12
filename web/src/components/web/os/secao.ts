import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import type { Perfil } from "@/lib/tipos";

/**
 * Importação, e no dashboard de OS a entrada de OS e a baixa no SAP, são do analista e do administrador (a `api` recusa os
 * demais perfis com `403`).
 */
export const veImportacao = (perfil: Perfil) => perfil === "analista" || perfil === "admin";

const abas: AbaDaSecao[] = [
  { href: rotas.web.quadro, rotulo: "Quadro", icone: "grid" },
  { href: rotas.web.importacao, rotulo: "Importação", icone: "upload" },
];

/** As abas da seção Ordem de Serviço que o perfil vê: supervisor e Segurança do Trabalho, só o Quadro. */
export const abasDoPerfil = (perfil: Perfil): AbaDaSecao[] => (veImportacao(perfil) ? abas : abas.slice(0, 1));
