import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Usuario } from "@/lib/tipos";

/**
 * Importação, e no dashboard de OS a entrada de OS e a baixa no SAP, são do administrador (a `api` recusa os
 * demais com `403`).
 */
export const veImportacao = (u: Pick<Usuario, "perfil">) => ehAdmin(u);

const quadro: AbaDaSecao = { href: rotas.app.lista, rotulo: "Quadro", icone: "grid" };
const importacao: AbaDaSecao = { href: rotas.web.importacao, rotulo: "Importação", icone: "upload", chave: "menu-importacao" };
const mapaDeCalor: AbaDaSecao = { href: rotas.app.mapaCalor, rotulo: "Mapa de Calor", icone: "pin", chave: "menu-mapa-calor" };

/**
 * As abas da seção Ordem de Serviço que a pessoa vê: o admin, Quadro, Importação e Mapa de Calor; os demais (supervisor e
 * técnico comum), Quadro e Mapa de Calor — cada um no escopo de sempre (a `api` já limita o que cada um enxerga).
 */
export const abasDoPerfil = (u: Pick<Usuario, "perfil">): AbaDaSecao[] => (veImportacao(u) ? [quadro, importacao, mapaDeCalor] : [quadro, mapaDeCalor]);
