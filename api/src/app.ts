import { Hono } from "hono";
import type { Deps } from "./deps";
import { criarAutenticacao } from "./http/autenticacao";
import { tratarErro } from "./http/erros";
import { rotasArquivos } from "./rotas/arquivos";
import { rotasAusencias } from "./rotas/ausencias";
import { rotasAuditoria } from "./rotas/auditoria";
import { rotasAuth } from "./rotas/auth";
import { rotasBusca } from "./rotas/busca";
import { rotasCatalogo } from "./rotas/catalogo";
import { rotasEquipes } from "./rotas/equipes";
import { rotasEventos } from "./rotas/eventos";
import { rotasGamificacao } from "./rotas/gamificacao";
import { rotasImpedimento } from "./rotas/impedimento";
import { rotasMe } from "./rotas/me";
import { rotasModelosApr } from "./rotas/modelos-apr";
import { rotasPainel } from "./rotas/painel";
import { rotasPdf } from "./rotas/pdf";
import { rotasPreventivas } from "./rotas/preventivas";
import { rotasRh } from "./rotas/rh";
import { avisoPorHttp, rotasRhSimulado, type EnviarAvisoRh } from "./rotas/rh-simulado";
import { rotasSap } from "./rotas/sap";
import { rotasSapSimulado } from "./rotas/sap-simulado";
import { rotasSaude } from "./rotas/saude";
import { rotasTreinamentos } from "./rotas/treinamentos";
import { rotasUsuarios } from "./rotas/usuarios";
import { rotasVitoria } from "./rotas/vitoria";

/**
 * Monta a aplicação HTTP. Toda rota, menos `GET /saude`, `/auth/login`, `/auth/refresh`, `POST /rh/avisos` (token do registro),
 * o simulador do SAP e o contrato do simulador do RH, passa por
 * `autenticar()` (JWT do Supabase + usuário ativo) e, quando preciso, por `exigirPerfil(...)`: sem token é `401`, com
 * perfil sem permissão é `403`. Cada fatia da especificação é um módulo em `rotas/`.
 */
export function criarApp(deps: Deps, opcoes: { /** Como o simulador do RH avisa o DAPROM; os testes trocam. */ enviarAvisoRh?: EnviarAvisoRh } = {}) {
  const auth = criarAutenticacao(deps);
  const app = new Hono();

  app.onError((erro, c) => tratarErro(erro, c));
  app.notFound((c) => c.json({ erro: { codigo: "rota_inexistente", mensagem: "Rota não encontrada" } }, 404));

  app.route("/", rotasSaude(deps));
  app.route("/", rotasAuth(deps, auth));
  app.route("/", rotasMe(deps, auth));
  app.route("/", rotasUsuarios(deps, auth));
  app.route("/", rotasEquipes(deps, auth));
  app.route("/", rotasAusencias(deps, auth));
  app.route("/", rotasBusca(deps, auth));
  app.route("/", rotasArquivos(deps, auth));
  app.route("/", rotasSap(deps, auth));
  app.route("/", rotasModelosApr(deps, auth));
  app.route("/", rotasCatalogo(deps, auth));
  app.route("/", rotasEventos(deps, auth));
  app.route("/", rotasImpedimento(deps, auth));
  app.route("/", rotasPainel(deps, auth));
  app.route("/", rotasPreventivas(deps, auth));
  app.route("/", rotasPdf(deps, auth));
  app.route("/", rotasAuditoria(deps, auth));
  app.route("/", rotasGamificacao(deps, auth));
  app.route("/", rotasTreinamentos(deps, auth));
  app.route("/", rotasVitoria(deps, auth));
  app.route("/", rotasRh(deps, auth));
  if (deps.config.sapSimulado) app.route("/sap-simulado", rotasSapSimulado(deps, auth));
  if (deps.config.rhSimulado) app.route("/rh-simulado", rotasRhSimulado(deps, auth, opcoes.enviarAvisoRh ?? avisoPorHttp(deps)));

  return app;
}
