import { rotas } from "./rotas";
import type { Perfil } from "./tipos";

/** Onde cada perfil começa: o técnico na área de campo, os demais no painel de gestão. */
export const inicioDoPerfil = (perfil: Perfil) => (perfil === "tecnico" ? rotas.app.lista : rotas.web.quadro);
