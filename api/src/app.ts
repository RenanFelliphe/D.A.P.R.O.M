import { Hono } from "hono";
import type { Deps } from "./deps";
import { criarAutenticacao } from "./http/autenticacao";
import { tratarErro } from "./http/erros";
import { ProvedorDeAssinaturaSimulado } from "./servicos/assinatura-juridica";
import { rotasArquivos } from "./rotas/arquivos";
import { rotasAssinaturasJuridicas } from "./rotas/assinaturas-juridicas";
import { rotasAssinaturaSimulada } from "./rotas/assinatura-simulada";
import { rotasAusencias } from "./rotas/ausencias";
import { rotasConvitesDeApr } from "./rotas/apr-convites";
import { rotasAuditoria } from "./rotas/auditoria";
import { rotasClima } from "./rotas/clima";
import { rotasConfiguracoes } from "./rotas/configuracoes";
import { rotasAuth } from "./rotas/auth";
import { rotasBusca } from "./rotas/busca";
import { rotasCatalogo } from "./rotas/catalogo";
import { rotasConferencias } from "./rotas/conferencias";
import { rotasDispositivos } from "./rotas/dispositivos";
import { rotasEmergencia } from "./rotas/emergencia";
import { rotasValidacoes } from "./rotas/validacoes";
import { rotasSolicitacoesConta } from "./rotas/solicitacoes-conta";
import { rotasSugestoesMateriais } from "./rotas/sugestoes-materiais";
import { rotasEquipes } from "./rotas/equipes";
import { rotasEventos } from "./rotas/eventos";
import { rotasGamificacao } from "./rotas/gamificacao";
import { rotasImpedimento } from "./rotas/impedimento";
import { rotasMe } from "./rotas/me";
import { rotasModelosApr } from "./rotas/modelos-apr";
import { rotasPainel } from "./rotas/painel";
import { rotasDigitalizacoes } from "./rotas/digitalizacoes";
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
 * perfil sem permissão é `403`. Cada fatia da especificação (`docs/especificacao.md`, seção 10) é um módulo em `rotas/`.
 */
export function criarApp(deps: Deps, opcoes: { /** Como o simulador do RH avisa o SYNQ OS; os testes trocam. */ enviarAvisoRh?: EnviarAvisoRh } = {}) {
  const auth = criarAutenticacao(deps);
  const app = new Hono();

  app.onError((erro, c) => tratarErro(erro, c));
  app.notFound((c) => c.json({ erro: { codigo: "rota_inexistente", mensagem: "Rota não encontrada" } }, 404));

  app.route("/", rotasSaude(deps));
  app.route("/", rotasAuth(deps, auth));
  app.route("/", rotasMe(deps, auth));
  app.route("/", rotasDispositivos(deps, auth));
  app.route("/", rotasUsuarios(deps, auth));
  app.route("/", rotasSolicitacoesConta(deps, auth));
  app.route("/", rotasEquipes(deps, auth));
  app.route("/", rotasAusencias(deps, auth));
  app.route("/", rotasBusca(deps, auth));
  app.route("/", rotasArquivos(deps, auth));
  app.route("/", rotasSap(deps, auth));
  app.route("/", rotasDigitalizacoes(deps, auth));
  app.route("/", rotasModelosApr(deps, auth));
  app.route("/", rotasCatalogo(deps, auth));
  app.route("/", rotasSugestoesMateriais(deps, auth));
  app.route("/", rotasEventos(deps, auth));
  app.route("/", rotasConvitesDeApr(deps, auth));
  app.route("/", rotasEmergencia(deps, auth));
  app.route("/", rotasConferencias(deps, auth));
  app.route("/", rotasValidacoes(deps, auth));
  app.route("/", rotasImpedimento(deps, auth));
  app.route("/", rotasPainel(deps, auth));
  app.route("/", rotasPreventivas(deps, auth));
  app.route("/", rotasPdf(deps, auth));
  app.route("/", rotasAuditoria(deps, auth));
  app.route("/", rotasGamificacao(deps, auth));
  app.route("/", rotasTreinamentos(deps, auth));
  app.route("/", rotasVitoria(deps, auth));
  app.route("/", rotasRh(deps, auth));
  app.route("/", rotasClima(deps, auth));
  app.route("/", rotasConfiguracoes(deps, auth));
  app.route("/", rotasAssinaturasJuridicas(deps, auth));
  // A página de assinatura do provedor simulado é da própria api (a da ZapSign fica no site dela).
  if (deps.provedorDeAssinatura instanceof ProvedorDeAssinaturaSimulado) app.route("/assinatura-simulada", rotasAssinaturaSimulada(deps.provedorDeAssinatura));
  if (deps.config.sapSimulado) app.route("/sap-simulado", rotasSapSimulado(deps, auth));
  if (deps.config.rhSimulado) app.route("/rh-simulado", rotasRhSimulado(deps, auth, opcoes.enviarAvisoRh ?? avisoPorHttp(deps)));

  return app;
}
