import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { FUNCOES_DE_IA } from "../../../shared/ia/funcoes";
import { assinaturaJuridicaDoPedido } from "../dominio/assinatura-juridica";
import { alterarFuncaoDeIa, painelDaIa } from "../dominio/ia-funcoes";
import { diagnosticoDaVitoria, listarPerguntasSemResposta, marcarPerguntaTratada, registrarEventoDaVitoria, responderVitoria, sobreAVitoria } from "../dominio/vitoria";
import type { Deps } from "../deps";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { emSnakeCase, responder } from "../http/resposta";
import { esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { booleanoDaConsulta, lerConsulta, lerCorpo, lerId, textoObrigatorio, validar } from "../http/validacao";

const esquemaMensagemDoHistorico = z.object({ papel: z.enum(["usuario", "assistente"]), texto: textoObrigatorio.max(2000) });
const esquemaPedido = z.object({
  mensagem: textoObrigatorio.max(1000),
  /** Chave da tela atual (a mesma das sugestões fixas e do `data-treino`); nunca a URL inteira. */
  tela: textoObrigatorio.max(100),
  /** Valores da tela atual para ações `com_contexto` (ex.: `{os_id: "..."}`); a web monta, nunca a IA. */
  contexto: z.record(z.string(), z.string().max(200)).optional(),
  /** Até as últimas 10 mensagens da conversa (que não é guardada no servidor): o cliente manda de novo a cada pedido. */
  historico: z.array(esquemaMensagemDoHistorico).max(10).optional(),
  /** Quantas mensagens a conversa já tem, 1-based, contando esta; sem isso o limite por conversa não teria como ser conferido. */
  numero_mensagem: z.number().int().positive().max(1_000_000).optional(),
});

/** O estado que o admin quer para a função; passar a ler dados reais leva a versão do texto que ele viu e assinou (`docs/ia-e-vitoria.md`, seção 3.3). */
const esquemaAlteracaoDaIa = z.object({
  ligada: z.boolean(),
  com_dados: z.boolean().optional(),
  versao_do_texto: z.number().int().positive().optional(),
});

const esquemaEvento = z.object({ tipo: z.enum(["ida_a_tela", "sugestao"]) });

/** Agrupa o texto em pedaços de uns 20-30 caracteres (quebrando só em espaços) para simular a digitação em streaming. */
function dividirEmPedacos(texto: string): string[] {
  const partes = texto.split(/(\s+)/).filter((p) => p.length > 0);
  const pedacos: string[] = [];
  let atual = "";
  for (const parte of partes) {
    atual += parte;
    if (atual.trim().length >= 20) {
      pedacos.push(atual);
      atual = "";
    }
  }
  if (atual) pedacos.push(atual);
  return pedacos.length > 0 ? pedacos : [texto];
}

/**
 * A Vitória (`docs/ia-e-vitoria.md`, seção 4): ajuda contextual por perfil, streaming via SSE. `POST /vitoria/mensagens` atende
 * todos os perfis, inclusive quem aguarda liberação e quem está ausente — ela só consulta o manual e o manifesto de
 * destinos, nunca lê nem grava dado de OS. As perguntas sem resposta (seção 2.7) são só do admin.
 */
export function rotasVitoria(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const soAdmin = exigirPerfil("admin");

  r.post("/vitoria/mensagens", autenticar({ permitirPendente: true, permitirAusente: true }), async (c) => {
    const eu = c.get("usuario");
    const dados = await lerCorpo(c, esquemaPedido);
    const resultado = await responderVitoria(deps, {
      usuarioId: eu.id,
      usuario: eu,
      perfil: eu.perfil,
      tela: dados.tela,
      contexto: dados.contexto ?? {},
      historico: dados.historico ?? [],
      mensagem: dados.mensagem,
      numeroMensagem: dados.numero_mensagem ?? 1,
    });

    return streamSSE(c, async (stream) => {
      for (const pedaco of dividirEmPedacos(resultado.texto)) await stream.writeSSE({ event: "texto", data: pedaco });
      await stream.writeSSE({
        event: "final",
        data: JSON.stringify(emSnakeCase({ acao: resultado.acao, expressao: resultado.expressao, fonte: resultado.fonte, motivo: resultado.motivo, sugestoes: resultado.sugestoes })),
      });
    });
  });

  /** O perfil da Vitória (seção 2.8.7): o provedor e os modelos de agora, os limites e o uso do dia de quem pergunta. */
  r.get("/vitoria/sobre", autenticar({ permitirPendente: true, permitirAusente: true }), async (c) => responder(c, await sobreAVitoria(deps, c.get("usuario").id)));

  /** O que a web avisa sozinha, para os números do perfil (seção 2.8.7): o toque em "Me leve lá" e a sugestão fixa respondida. Só soma. */
  r.post("/vitoria/eventos", autenticar({ permitirPendente: true, permitirAusente: true }), async (c) => {
    const { tipo } = await lerCorpo(c, esquemaEvento);
    await registrarEventoDaVitoria(deps.db, deps.agora(), tipo);
    return c.body(null, 204);
  });

  /** O diagnóstico da IA da Vitória (ativa ou não, por quê, quando volta e quanto falta do limite do dia); só o admin. */
  r.get("/vitoria/diagnostico", autenticar(), soAdmin, async (c) => responder(c, await diagnosticoDaVitoria(deps)));

  /**
   * O controle da IA (só o admin): o estado das quatro funções e, por função, o que ela lê. `PUT` leva o estado desejado;
   * ligar a leitura de dados usa a assinatura do perfil de quem pede.
   */
  r.get("/vitoria/ia", autenticar(), soAdmin, async (c) => responder(c, await painelDaIa(deps)));

  r.put("/vitoria/ia/:funcao", autenticar(), soAdmin, async (c) => {
    const funcao = validar(z.enum(FUNCOES_DE_IA), c.req.param("funcao"));
    const dados = await lerCorpo(c, esquemaAlteracaoDaIa);
    await alterarFuncaoDeIa(deps, c.get("usuario"), funcao, { ligada: dados.ligada, comDados: dados.com_dados, versaoDoTexto: dados.versao_do_texto, exigirAssinaturaJuridica: assinaturaJuridicaDoPedido(deps, c) });
    return responder(c, await painelDaIa(deps));
  });

  r.get("/vitoria/sem-resposta", autenticar(), soAdmin, async (c) => {
    const filtros = lerConsulta(c, esquemaPaginacao.extend({ tratada: booleanoDaConsulta }));
    const { limit, offset } = limiteEDeslocamento(filtros);
    const { perguntas, total } = await listarPerguntasSemResposta(deps.db, { tratada: filtros.tratada, limit, offset });
    return responder(c, { perguntas, ...meta(filtros, total) });
  });

  r.patch("/vitoria/sem-resposta/:id", autenticar(), soAdmin, async (c) => {
    const eu = c.get("usuario");
    const tratada = await marcarPerguntaTratada(deps.db, lerId(c), eu.id, deps.agora());
    return responder(c, tratada);
  });

  return r;
}
