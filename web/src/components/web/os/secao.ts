import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, type Usuario } from "@/lib/tipos";

/**
 * Importação, e no dashboard de OS a entrada de OS e a baixa no SAP, são do administrador (a `api` recusa os
 * demais com `403`).
 */
export const veImportacao = (u: Pick<Usuario, "perfil">) => ehAdmin(u);

const quadro: AbaDaSecao = { href: rotas.app.lista, rotulo: "Quadro", icone: "grid" };
const importacao: AbaDaSecao = { href: rotas.web.importacao, rotulo: "Importação", icone: "upload", chave: "menu-importacao" };
const mapaDeCalor: AbaDaSecao = { href: rotas.web.mapaCalor, rotulo: "Mapa de Calor", icone: "pin", chave: "menu-mapa-calor" };

/**
 * As abas da seção Ordem de Serviço que a pessoa vê: o admin, Quadro, Importação e Mapa de Calor; o supervisor, Quadro e
 * Mapa de Calor; o técnico, só o Quadro (e por isso fica sem a barra de abas).
 */
export const abasDoPerfil = (u: Pick<Usuario, "perfil" | "equipes_supervisionadas">): AbaDaSecao[] => {
  if (veImportacao(u)) return [quadro, importacao, mapaDeCalor];
  if (ehSupervisor(u)) return [quadro, mapaDeCalor];
  return [quadro];
};
