import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { listarPerguntasSemResposta, marcarPerguntaTratada, responderVitoria } from "../dominio/vitoria";
import type { Deps } from "../deps";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { emSnakeCase, responder } from "../http/resposta";
import { esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { booleanoDaConsulta, lerConsulta, lerCorpo, lerId, textoObrigatorio } from "../http/validacao";

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
 * A Vitória (`vitoria.md`, seção 2): ajuda contextual por perfil, streaming via SSE. `POST /vitoria/mensagens` atende
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
        data: JSON.stringify(emSnakeCase({ acao: resultado.acao, expressao: resultado.expressao, motivo: resultado.motivo, sugestoes: resultado.sugestoes })),
      });
    });
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
