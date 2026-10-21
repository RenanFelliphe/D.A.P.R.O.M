import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { usuario } from "../db/schema";
import { registrarAuditoria } from "../dominio/auditoria";
import { ganhosDe } from "../dominio/lancamentos";
import {
  abrirPreVisualizacao,
  abrirTentativa,
  avisarProblemaReportado,
  avisarTreinamentoPublicado,
  concluirTentativa,
  entrarNaFase,
  guardarProgresso,
  listarReportes,
  listarTreinamentosPublicados,
  marcarReporteTratado,
  obterOuCriarRascunho,
  publicarVersao,
  reportarProblema,
  responderFase,
  salvarRascunho,
  treinamentoParaJogador,
  versoesAnteriores,
} from "../dominio/treinamento-servico";
import { esquemaConteudo } from "../dominio/treinamento-servico-esquema";
import {
  decidirValidacao,
  enviarParaValidacao,
  exigirPodeEditar,
  exigirPodePreVisualizar,
  exigirPodeVer,
  justificativaExigida,
  retirarDaValidacao,
  servicosDoSupervisor,
  situacaoDaValidacao,
  treinamentosParaValidar,
} from "../dominio/treinamento-servico-validacao";
import { LINHAS_DO_RANKING, rankingDoTreinamento } from "../dominio/treinamento-servico-ranking";
import {
  executarRascunhoIA,
  LIMITE_TEXTO_PROCEDIMENTO,
  prepararRascunhoIA,
  situacaoDaIA,
  PEDIDOS_DO_PLANO,
  type ChamadaDeRascunhoIA,
  type ProgressoDoRascunho,
} from "../dominio/treinamento-servico-ia";
import { TETO_DE_FASES } from "../../../shared/treinamento-servico/jogos";
import type { Deps } from "../deps";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { ErroApi, invalido, naoEncontrado } from "../http/erros";
import { esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { emSnakeCase, responder } from "../http/resposta";
import { booleanoDaConsulta, lerConsulta, lerCorpo, lerId, lerJson, textoObrigatorio, uuid } from "../http/validacao";

/** O código do serviço na URL (pode ter pontos e barras, como em `/atividades/{codigo}`). */
function codigoDoServico(bruto: string) {
  const codigo = bruto.trim();
  if (!codigo || codigo.length > 200) throw naoEncontrado("Serviço não encontrado");
  return codigo;
}

function indiceDaFase(bruto: string): number {
  if (!/^[0-9]+$/.test(bruto)) throw naoEncontrado("Fase não encontrada");
  return Number(bruto);
}

const esquemaRascunho = esquemaConteudo.extend({ cenario_path: z.string().trim().min(1).max(200).nullable().optional() });
const esquemaPublicar = z.object({ arquivo_id: uuid, justificativa: z.string().trim().max(1000).optional() });
const esquemaRecusa = z.object({ motivo: textoObrigatorio.max(1000) });
const esquemaReporte = z.object({ fase: z.number().int().min(0).nullable().optional(), texto: textoObrigatorio.max(500) });
const esquemaGerar = z.object({
  texto: z.string().trim().min(40, "Cole o texto do procedimento (ao menos algumas frases)").max(LIMITE_TEXTO_PROCEDIMENTO),
  /** O plano do jogo: ao menos 3 fases, cada uma com o minijogo pedido ou `null` (a Vitória escolhe). Sem ele, ela decide tudo. */
  plano: z.array(z.enum(PEDIDOS_DO_PLANO).nullable()).min(3).max(TETO_DE_FASES).nullable().optional(),
});
/** Sem `fase`, um pedido no chat ("encurte a explicação"); com `fase`, regera só aquela (o pedido é opcional). */
const esquemaAjustar = z.object({ pedido: z.string().trim().max(1000).optional(), fase: z.number().int().min(0).max(TETO_DE_FASES - 1).optional() });
/** O progresso de uma fase não confirmada: a resposta pela metade, no mesmo formato da resposta (conferido ao finalizar). */
const esquemaProgresso = z.object({ resposta: z.unknown() });
const esquemaRanking = z.object({ limite: z.coerce.number().int().min(1).max(100).default(LINHAS_DO_RANKING) });

/**
 * A resposta do rascunho pela IA (seção 3.6 do `vitoria.md`), em SSE: `progresso` a cada item que a IA termina ("montando a
 * fase 5 de 10…") e, a cada 5 s, o mesmo progresso com o tempo corrido (a IA pode pensar alguns minutos antes do
 * primeiro item, e a tela não pode parecer travada); no fim, `final` com o rascunho gravado, ou `erro`. Se o admin fechar a
 * tela no meio, a geração continua e é gravada: a chamada já foi paga.
 */
function responderRascunhoIA(c: Context, deps: Deps, chamada: ChamadaDeRascunhoIA) {
  return streamSSE(c, async (stream) => {
    let aberta = true;
    stream.onAbort(() => {
      aberta = false;
    });
    const escrever = async (event: string, dados: unknown) => {
      if (!aberta) return;
      try {
        await stream.writeSSE({ event, data: JSON.stringify(emSnakeCase(dados)) });
      } catch {
        aberta = false;
      }
    };
    const inicio = Date.now();
    let ultimo: ProgressoDoRascunho = { mensagem: chamada.mensagemInicial, passosProntos: 0, fasesProntas: 0, totalPassos: null, totalFases: null };
    const progresso = () => escrever("progresso", { ...ultimo, segundos: Math.round((Date.now() - inicio) / 1000) });
    await progresso();
    const batimento = setInterval(() => void progresso(), 5000);
    try {
      const resultado = await executarRascunhoIA(deps, chamada, (p) => {
        ultimo = p;
        void progresso();
      });
      // `ia`, como no `GET` do rascunho: a situação dos limites depois desta chamada.
      await escrever("final", { rascunho: resultado.rascunho, ia: resultado.situacao, resumo: resultado.resumo, descartados: resultado.descartados });
    } catch (erro) {
      if (!(erro instanceof ErroApi)) console.error("Rascunho de treinamento: erro inesperado", erro);
      const e = erro instanceof ErroApi ? erro : null;
      await escrever("erro", { codigo: e?.codigo ?? "erro_interno", mensagem: e?.message ?? "Erro interno; nada foi gravado." });
    } finally {
      clearInterval(batimento);
    }
  });
}

/**
 * Treinamentos de serviço (seção 3 do `vitoria.md`): o jogo por serviço do catálogo. Quem treina (inclusive pendente, que
 * ainda aguarda liberação) joga as rotas de jogo; só o admin edita, publica e trata reportes. O admin não joga (não abre
 * tentativas reais), só pré-visualiza o rascunho.
 */
export function rotasTreinamentos(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const quemTreina = [autenticar({ permitirPendente: true }), exigirPerfil("tecnico")] as const;
  const soAdmin = exigirPerfil("admin");

  // ---- Quem treina -------------------------------------------------------------------------------------------------

  r.get("/treinamentos", autenticar({ permitirPendente: true }), async (c) => {
    const treinamentos = await listarTreinamentosPublicados(deps.db, c.get("usuario").id);
    return responder(c, { treinamentos });
  });

  /**
   * A pré-visualização do admin também termina em `/tentativas`, então precisa ser registrada antes da rota de baixo
   * (`:atividade{.+}/tentativas`): como o código do serviço casa com qualquer caminho, a mais específica tem que vir primeiro.
   */
  r.post("/treinamentos/:atividade{.+}/rascunho/pre-visualizar/tentativas", autenticar(), async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    await exigirPodePreVisualizar(deps.db, c.get("usuario"), codigo);
    const tentativa = await abrirPreVisualizacao(deps.db, c.get("usuario").id, codigo, deps.agora());
    return responder(c, tentativa, 201);
  });

  r.post("/treinamentos/:atividade{.+}/tentativas", ...quemTreina, async (c) => {
    const tentativa = await abrirTentativa(deps.db, c.get("usuario").id, codigoDoServico(c.req.param("atividade")), deps.agora());
    return responder(c, tentativa, 201);
  });

  // Entrar, guardar o progresso, responder e concluir servem tanto a tentativa real (técnico) quanto a pré-visualização do
  // admin; a posse da tentativa (conferida no domínio) é quem decide, não o perfil. O tempo de cada fase é pelo relógio do
  // servidor (seção 12 do `treinamentos-de-servico.md`).
  r.post("/treinamentos/tentativas/:id/fases/:fase/entrar", autenticar({ permitirPendente: true }), async (c) => {
    return responder(c, await entrarNaFase(deps.db, c.get("usuario").id, lerId(c), indiceDaFase(c.req.param("fase")), deps.agora()));
  });

  r.put("/treinamentos/tentativas/:id/fases/:fase/progresso", autenticar({ permitirPendente: true }), async (c) => {
    const { resposta } = await lerCorpo(c, esquemaProgresso);
    await guardarProgresso(deps.db, c.get("usuario").id, lerId(c), indiceDaFase(c.req.param("fase")), resposta, deps.agora());
    return c.body(null, 204);
  });

  r.post("/treinamentos/tentativas/:id/fases/:fase", autenticar({ permitirPendente: true }), async (c) => {
    const resposta = await lerJson(c);
    const resultado = await responderFase(deps.db, c.get("usuario").id, lerId(c), indiceDaFase(c.req.param("fase")), resposta, deps.agora());
    return responder(c, resultado);
  });

  r.post("/treinamentos/tentativas/:id/concluir", autenticar({ permitirPendente: true }), async (c) => {
    const eu = c.get("usuario");
    const resultado = await deps.db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      return concluirTentativa({ tx, agora: deps.agora() }, eu.id, lerId(c));
    });
    return responder(c, {
      fases_certas: resultado.fasesCertas,
      total_fases: resultado.totalFases,
      nota: resultado.nota,
      nota_maxima: resultado.notaMaxima,
      melhor_anterior: resultado.melhorAnterior,
      fases: resultado.fases,
      ...ganhosDe(resultado.ganhos, eu.id),
    });
  });

  /**
   * O ranking do treinamento (quem já concluiu, pela nota da primeira conclusão), com a linha de quem pede mesmo fora das
   * primeiras. Todos veem, inclusive o admin (que não aparece) e quem aguarda liberação. Antes da rota "nua" lá embaixo.
   */
  r.get("/treinamentos/:atividade{.+}/ranking", autenticar({ permitirPendente: true }), async (c) => {
    const { limite } = lerConsulta(c, esquemaRanking);
    return responder(c, await rankingDoTreinamento(deps.db, c.get("usuario"), codigoDoServico(c.req.param("atividade")), limite));
  });

  r.post("/treinamentos/:atividade{.+}/reportes", ...quemTreina, async (c) => {
    const dados = await lerCorpo(c, esquemaReporte);
    const eu = c.get("usuario");
    const codigo = codigoDoServico(c.req.param("atividade"));
    const reporte = await reportarProblema(deps.db, eu.id, codigo, { fase: dados.fase ?? null, texto: dados.texto });
    await avisarProblemaReportado(deps.db, codigo, { quem: eu.nome, fase: dados.fase ?? null, texto: dados.texto }, deps.agora());
    return responder(c, reporte, 201);
  });

  // ---- Admin: editor, publicação e reportes -------------------------------------------------------------------------

  r.get("/treinamentos/:atividade{.+}/rascunho", autenticar(), async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    const eu = c.get("usuario");
    await exigirPodeEditar(deps.db, eu, codigo);
    const rascunho = await obterOuCriarRascunho(deps.db, codigo, eu.id);
    const [autor] = rascunho.autorId ? await deps.db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(eq(usuario.id, rascunho.autorId)) : [];
    return responder(c, { ...rascunho, autor: autor ?? null, podeEditar: !rascunho.emValidacao, ia: await situacaoDaIA(deps, codigo) });
  });

  // O rascunho pela IA: `503` sem IA configurada, `409` com o limite esgotado (antes do streaming); depois, os eventos SSE.
  r.post("/treinamentos/:atividade{.+}/rascunho/gerar", autenticar(), async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    await exigirPodeEditar(deps.db, c.get("usuario"), codigo);
    const { texto, plano } = await lerCorpo(c, esquemaGerar);
    const chamada = await prepararRascunhoIA(deps, codigo, c.get("usuario").id, { tipo: "gerar", texto, plano });
    return responderRascunhoIA(c, deps, chamada);
  });

  r.post("/treinamentos/:atividade{.+}/rascunho/ajustar", autenticar(), async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    await exigirPodeEditar(deps.db, c.get("usuario"), codigo);
    const { pedido, fase } = await lerCorpo(c, esquemaAjustar);
    const chamada = await prepararRascunhoIA(deps, codigo, c.get("usuario").id, { tipo: "ajustar", pedido, fase });
    return responderRascunhoIA(c, deps, chamada);
  });

  r.put("/treinamentos/:atividade{.+}/rascunho", autenticar(), async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    await exigirPodeEditar(deps.db, c.get("usuario"), codigo);
    const dados = await lerCorpo(c, esquemaRascunho);
    const salvo = await salvarRascunho(deps.db, codigo, { explicacao: dados.explicacao, fases: dados.fases, cenarioPath: dados.cenario_path });
    return responder(c, salvo);
  });

  r.post("/treinamentos/:atividade{.+}/publicar", autenticar(), soAdmin, async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    const eu = c.get("usuario");
    const { arquivo_id, justificativa } = await lerCorpo(c, esquemaPublicar);
    if (!(await deps.armazenamento.existe("assinaturas", arquivo_id))) {
      throw invalido("arquivo_inexistente", "Envie a imagem da assinatura antes (PUT /arquivos/{id})");
    }
    // A exceção do admin: com a validação possível, publicar direto exige dizer por quê (fica na versão e na auditoria).
    const exigida = await justificativaExigida(deps.db, codigo);
    if (exigida && !justificativa) throw invalido("justificativa_obrigatoria", "Publicar sem a validação dos supervisores exige uma justificativa");
    const publicado = await publicarVersao(deps.db, codigo, eu.id, arquivo_id, deps.agora(), exigida ? justificativa : undefined);
    // Só a primeira publicação avisa os técnicos: as seguintes corrigem o que já está lá.
    if (publicado.versao === 1) await avisarTreinamentoPublicado(deps.db, codigo, deps.agora());
    await registrarAuditoria(deps.db, eu, {
      entidade: "treinamento",
      verbo: "publicar",
      entidadeId: codigo,
      alvo: codigo,
      resumo: `Publicou a versão ${publicado.versao} do treinamento de serviço ${codigo}${publicado.geradoComIa ? " (rascunho feito com a IA)" : ""}`,
      detalhes: {
        versao: publicado.versao,
        gerado_com_ia: publicado.geradoComIa,
        ...(publicado.textoOrigem ? { texto_origem: publicado.textoOrigem } : {}),
        ...(exigida ? { publicacao_direta: true, justificativa } : {}),
      },
    });
    return responder(c, { versaoId: publicado.versaoId, versao: publicado.versao, publicadaEm: publicado.publicadaEm });
  });

  r.get("/treinamentos/:atividade{.+}/versoes", autenticar(), async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    await exigirPodeVer(deps.db, c.get("usuario"), codigo);
    const versoes = await versoesAnteriores(deps.db, codigo);
    return responder(c, { versoes });
  });

  // ---- A validação pelos supervisores -----------------------------------------------------------------------------------------

  /** Os serviços que a pessoa monta: o admin todos (`admin: true`); o supervisor, os das equipes que supervisiona. */
  r.get("/treinamentos/meus-servicos", autenticar(), async (c) => {
    const eu = c.get("usuario");
    if (eu.perfil === "admin") return responder(c, { admin: true, servicos: [] });
    return responder(c, { admin: false, servicos: await servicosDoSupervisor(deps.db, eu) });
  });

  /** Os treinamentos que esperam a decisão de quem pede (vaga de equipe que supervisiona, sem decisão dela). */
  r.get("/treinamentos/para-validar", autenticar(), async (c) => responder(c, { treinamentos: await treinamentosParaValidar(deps.db, c.get("usuario")) }));

  r.get("/treinamentos/:atividade{.+}/validacao", autenticar(), async (c) => responder(c, await situacaoDaValidacao(deps.db, c.get("usuario"), codigoDoServico(c.req.param("atividade")))));

  r.post("/treinamentos/:atividade{.+}/validacao/enviar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const codigo = codigoDoServico(c.req.param("atividade"));
    await exigirPodeEditar(deps.db, eu, codigo);
    await enviarParaValidacao(deps, eu, codigo);
    return responder(c, await situacaoDaValidacao(deps.db, eu, codigo));
  });

  r.post("/treinamentos/:atividade{.+}/validacao/retirar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const codigo = codigoDoServico(c.req.param("atividade"));
    await retirarDaValidacao(deps, eu, codigo);
    return responder(c, await situacaoDaValidacao(deps.db, eu, codigo));
  });

  r.post("/treinamentos/:atividade{.+}/validacao/aprovar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const codigo = codigoDoServico(c.req.param("atividade"));
    const resultado = await decidirValidacao(deps, eu, codigo, { aprovar: true });
    // Publicado, o rascunho virou a versão no ar: não há mais situação de validação para mostrar.
    if (resultado.publicada) return responder(c, { publicada: true, versao: resultado.versao });
    return responder(c, { ...(await situacaoDaValidacao(deps.db, eu, codigo)), publicada: false });
  });

  r.post("/treinamentos/:atividade{.+}/validacao/recusar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const codigo = codigoDoServico(c.req.param("atividade"));
    const { motivo } = await lerCorpo(c, esquemaRecusa);
    await decidirValidacao(deps, eu, codigo, { aprovar: false, motivo });
    // Devolvido ao autor: quem recusou não vê mais o rascunho; a resposta só confirma.
    return responder(c, { devolvido: true });
  });

  r.get("/treinamentos/reportes", autenticar(), soAdmin, async (c) => {
    const filtros = lerConsulta(c, esquemaPaginacao.extend({ tratado: booleanoDaConsulta }));
    const { limit, offset } = limiteEDeslocamento(filtros);
    const { reportes, total } = await listarReportes(deps.db, { tratado: filtros.tratado, limit, offset });
    return responder(c, { reportes, ...meta(filtros, total) });
  });

  r.patch("/treinamentos/reportes/:id", autenticar(), soAdmin, async (c) => {
    const eu = c.get("usuario");
    const tratado = await marcarReporteTratado(deps.db, lerId(c), eu.id, deps.agora());
    return responder(c, tratado);
  });

  /**
   * `:atividade{.+}` não tem sufixo fixo, então casa com qualquer caminho sob `/treinamentos/` (o código pode ter pontos e
   * barras, como em `/atividades/{codigo}`): precisa ser o último `GET` registrado, senão engoliria `/reportes`,
   * `/rascunho`, `/versoes` e `/ranking` antes de chegarem às rotas acima.
   */
  r.get("/treinamentos/:atividade{.+}", autenticar({ permitirPendente: true }), async (c) => {
    const treinamento = await treinamentoParaJogador(deps.db, codigoDoServico(c.req.param("atividade")));
    if (!treinamento) throw naoEncontrado("Treinamento não encontrado ou ainda não publicado");
    return responder(c, treinamento);
  });

  return r;
}
