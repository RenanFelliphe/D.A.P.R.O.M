import { Hono } from "hono";
import type { Deps } from "./deps";
import { criarAutenticacao } from "./http/autenticacao";
import { tratarErro } from "./http/erros";
import { rotasArquivos } from "./rotas/arquivos";
import { rotasAuth } from "./rotas/auth";
import { rotasBusca } from "./rotas/busca";
import { rotasEquipes } from "./rotas/equipes";
import { rotasEventos } from "./rotas/eventos";
import { rotasImpedimento } from "./rotas/impedimento";
import { rotasMe } from "./rotas/me";
import { rotasModelosApr } from "./rotas/modelos-apr";
import { rotasPainel } from "./rotas/painel";
import { rotasPdf } from "./rotas/pdf";
import { rotasSap } from "./rotas/sap";
import { rotasSapSimulado } from "./rotas/sap-simulado";
import { rotasSaude } from "./rotas/saude";
import { rotasUsuarios } from "./rotas/usuarios";

/**
 * Monta a aplicação HTTP. Toda rota, menos `GET /saude`, `/auth/login`, `/auth/refresh` e o simulador do SAP, passa por
 * `autenticar()` (JWT do Supabase + usuário ativo) e, quando preciso, por `exigirPerfil(...)`: sem token é `401`, com
 * perfil sem permissão é `403`. Cada fatia da especificação é um módulo em `rotas/`.
 */
export function criarApp(deps: Deps) {
  const auth = criarAutenticacao(deps);
  const app = new Hono();

  app.onError((erro, c) => tratarErro(erro, c));
  app.notFound((c) => c.json({ erro: { codigo: "rota_inexistente", mensagem: "Rota não encontrada" } }, 404));

  app.route("/", rotasSaude(deps));
  app.route("/", rotasAuth(deps, auth));
  app.route("/", rotasMe(deps, auth));
  app.route("/", rotasUsuarios(deps, auth));
  app.route("/", rotasEquipes(deps, auth));
  app.route("/", rotasBusca(deps, auth));
  app.route("/", rotasArquivos(deps, auth));
  app.route("/", rotasSap(deps, auth));
  app.route("/", rotasModelosApr(deps, auth));
  app.route("/", rotasEventos(deps, auth));
  app.route("/", rotasImpedimento(deps, auth));
  app.route("/", rotasPainel(deps, auth));
  app.route("/", rotasPdf(deps, auth));
  if (deps.config.sapSimulado) app.route("/sap-simulado", rotasSapSimulado(deps));

  return app;
}
