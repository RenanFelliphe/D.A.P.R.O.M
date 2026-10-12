import { rotas } from "./rotas";
import { estaPendente, type Usuario } from "./tipos";

/** Início de cada papel: o quadro de OS (a mesma tela para todos); o técnico ainda pendente de liberação cai em "Aguardando liberação". */
export const inicioDoUsuario = (u: Pick<Usuario, "liberacao">) => (estaPendente(u) ? rotas.app.aguardando : rotas.app.lista);
