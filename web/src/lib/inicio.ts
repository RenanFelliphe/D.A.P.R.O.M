import { rotas } from "./rotas";
import { ehAdmin, ehSupervisor, estaPendente, type Usuario } from "./tipos";

/**
 * Início de cada papel: o admin e o supervisor (técnico que supervisiona equipes) caem no painel de gestão; o técnico comum, na
 * área de campo; o técnico ainda pendente de liberação, na tela "Aguardando liberação".
 */
export const inicioDoUsuario = (u: Pick<Usuario, "perfil" | "equipes_supervisionadas" | "liberacao">) =>
  estaPendente(u) ? rotas.app.aguardando : ehAdmin(u) || ehSupervisor(u) ? rotas.web.quadro : rotas.app.lista;
