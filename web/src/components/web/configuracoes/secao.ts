import type { AbaDaSecao } from "@/components/web/AbasSecao";
import { rotas } from "@/lib/rotas";
import { ehAdmin, type Usuario } from "@/lib/tipos";

/** O Sistema (cidade padrão da previsão, horários das rotinas e controle da IA) é do administrador: a `api` recusa os demais com `403`. */
export const veConfiguracoesDoSistema = (u: Pick<Usuario, "perfil">) => ehAdmin(u);

const conta: AbaDaSecao = { href: rotas.app.configuracoesConta, rotulo: "Minha conta", icone: "user", chave: "menu-config-conta" };
const sistema: AbaDaSecao = { href: rotas.app.configuracoesSistema, rotulo: "Sistema", icone: "engrenagem", chave: "menu-config-sistema" };

/** As abas de Configurações que a pessoa vê: todos, Minha conta; o admin, também Sistema. */
export const abasDasConfiguracoes = (u: Pick<Usuario, "perfil">): AbaDaSecao[] => (veConfiguracoesDoSistema(u) ? [conta, sistema] : [conta]);
