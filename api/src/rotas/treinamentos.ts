import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { registrarAuditoria } from "../dominio/auditoria";
import { ganhosDe } from "../dominio/lancamentos";
import {
  abrirPreVisualizacao,
  abrirTentativa,
  concluirTentativa,
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
  executarRascunhoIA,
  LIMITE_TEXTO_PROCEDIMENTO,
  prepararRascunhoIA,
  situacaoDaIA,
  type ChamadaDeRascunhoIA,
  type ProgressoDoRascunho,
} from "../dominio/treinamento-servico-ia";
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
const esquemaPublicar = z.object({ arquivo_id: uuid });
const esquemaReporte = z.object({ fase: z.number().int().min(0).nullable().optional(), texto: textoObrigatorio.max(500) });
const esquemaGerar = z.object({
  texto: z.string().trim().min(40, "Cole o texto do procedimento (ao menos algumas frases)").max(LIMITE_TEXTO_PROCEDIMENTO),
});
/** Sem `fase`, um pedido no chat ("encurte a explicação"); com `fase`, regera só aquela (o pedido é opcional). */
const esquemaAjustar = z.object({ pedido: z.string().trim().max(1000).optional(), fase: z.number().int().min(0).max(9).optional() });

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
  r.post("/treinamentos/:atividade{.+}/rascunho/pre-visualizar/tentativas", autenticar(), soAdmin, async (c) => {
    const tentativa = await abrirPreVisualizacao(deps.db, c.get("usuario").id, codigoDoServico(c.req.param("atividade")));
    return responder(c, tentativa, 201);
  });

  r.post("/treinamentos/:atividade{.+}/tentativas", ...quemTreina, async (c) => {
    const tentativa = await abrirTentativa(deps.db, c.get("usuario").id, codigoDoServico(c.req.param("atividade")));
    return responder(c, tentativa, 201);
  });

  // Responder e concluir servem tanto a tentativa real (técnico) quanto a pré-visualização do admin; a posse da
  // tentativa (conferida no domínio) é quem decide, não o perfil.
  r.post("/treinamentos/tentativas/:id/fases/:fase", autenticar({ permitirPendente: true }), async (c) => {
    const resposta = await lerJson(c);
    const resultado = await responderFase(deps.db, c.get("usuario").id, lerId(c), indiceDaFase(c.req.param("fase")), resposta);
    return responder(c, resultado);
  });

  r.post("/treinamentos/tentativas/:id/concluir", autenticar({ permitirPendente: true }), async (c) => {
    const eu = c.get("usuario");
    const resultado = await deps.db.transaction(async (transacao) => {
      const tx = transacao as unknown as Db;
      return concluirTentativa({ tx, agora: deps.agora() }, eu.id, lerId(c));
    });
    return responder(c, { fases_certas: resultado.fasesCertas, total_fases: resultado.totalFases, ...ganhosDe(resultado.ganhos, eu.id) });
  });

  r.post("/treinamentos/:atividade{.+}/reportes", ...quemTreina, async (c) => {
    const dados = await lerCorpo(c, esquemaReporte);
    const reporte = await reportarProblema(deps.db, c.get("usuario").id, codigoDoServico(c.req.param("atividade")), { fase: dados.fase ?? null, texto: dados.texto });
    return responder(c, reporte, 201);
  });

  // ---- Admin: editor, publicação e reportes -------------------------------------------------------------------------

  r.get("/treinamentos/:atividade{.+}/rascunho", autenticar(), soAdmin, async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    const rascunho = await obterOuCriarRascunho(deps.db, codigo, c.get("usuario").id);
    return responder(c, { ...rascunho, ia: await situacaoDaIA(deps, codigo) });
  });

  // O rascunho pela IA: `503` sem IA configurada, `409` com o limite esgotado (antes do streaming); depois, os eventos SSE.
  r.post("/treinamentos/:atividade{.+}/rascunho/gerar", autenticar(), soAdmin, async (c) => {
    const { texto } = await lerCorpo(c, esquemaGerar);
    const chamada = await prepararRascunhoIA(deps, codigoDoServico(c.req.param("atividade")), c.get("usuario").id, { tipo: "gerar", texto });
    return responderRascunhoIA(c, deps, chamada);
  });

  r.post("/treinamentos/:atividade{.+}/rascunho/ajustar", autenticar(), soAdmin, async (c) => {
    const { pedido, fase } = await lerCorpo(c, esquemaAjustar);
    const chamada = await prepararRascunhoIA(deps, codigoDoServico(c.req.param("atividade")), c.get("usuario").id, { tipo: "ajustar", pedido, fase });
    return responderRascunhoIA(c, deps, chamada);
  });

  r.put("/treinamentos/:atividade{.+}/rascunho", autenticar(), soAdmin, async (c) => {
    const dados = await lerCorpo(c, esquemaRascunho);
    const salvo = await salvarRascunho(deps.db, codigoDoServico(c.req.param("atividade")), { explicacao: dados.explicacao, fases: dados.fases, cenarioPath: dados.cenario_path });
    return responder(c, salvo);
  });

  r.post("/treinamentos/:atividade{.+}/publicar", autenticar(), soAdmin, async (c) => {
    const codigo = codigoDoServico(c.req.param("atividade"));
    const eu = c.get("usuario");
    const { arquivo_id } = await lerCorpo(c, esquemaPublicar);
    if (!(await deps.armazenamento.existe("assinaturas", arquivo_id))) {
      throw invalido("arquivo_inexistente", "Envie a imagem da assinatura antes (PUT /arquivos/{id})");
    }
    const publicado = await publicarVersao(deps.db, codigo, eu.id, arquivo_id, deps.agora());
    await registrarAuditoria(deps.db, eu, {
      entidade: "treinamento",
      verbo: "publicar",
      entidadeId: codigo,
      alvo: codigo,
      resumo: `Publicou a versão ${publicado.versao} do treinamento de serviço ${codigo}${publicado.geradoComIa ? " (rascunho feito com a IA)" : ""}`,
      detalhes: { versao: publicado.versao, gerado_com_ia: publicado.geradoComIa, ...(publicado.textoOrigem ? { texto_origem: publicado.textoOrigem } : {}) },
    });
    return responder(c, { versaoId: publicado.versaoId, versao: publicado.versao, publicadaEm: publicado.publicadaEm });
  });

  r.get("/treinamentos/:atividade{.+}/versoes", autenticar(), soAdmin, async (c) => {
    const versoes = await versoesAnteriores(deps.db, codigoDoServico(c.req.param("atividade")));
    return responder(c, { versoes });
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
   * `/rascunho` e `/versoes` antes de chegarem às rotas acima.
   */
  r.get("/treinamentos/:atividade{.+}", autenticar({ permitirPendente: true }), async (c) => {
    const treinamento = await treinamentoParaJogador(deps.db, codigoDoServico(c.req.param("atividade")));
    if (!treinamento) throw naoEncontrado("Treinamento não encontrado ou ainda não publicado");
    return responder(c, treinamento);
  });

  return r;
}
