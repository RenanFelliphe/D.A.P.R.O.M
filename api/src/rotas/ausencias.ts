import { Hono, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import {
  aprovarAusencia,
  cancelarAusencia,
  confirmarAusencia,
  confirmarRetornoDaAusencia,
  detalharAusencia,
  encerrarAusencia,
  listarAusencias,
  pedirFimDaAusencia,
  pedirOuRegistrarAusencia,
  prorrogarAusencia,
  recusarAjusteDaAusencia,
  recusarAusencia,
  responderFimDaAusencia,
} from "../dominio/ausencia-atos";
import { sincronizarRepresentacao } from "../dominio/representacao";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { esquemaPaginacao, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, dataExistente, lerConsulta, lerCorpo, lerId, textoObrigatorio, uuid } from "../http/validacao";

const SITUACOES = ["pedida", "aguardando_confirmacao", "agendada", "em_curso", "vencida", "encerrada", "recusada", "cancelada"] as const;

const motivo = textoObrigatorio.max(500);
const dias = z.number().int().min(1).max(365);
/** Toda ação assinada confirma a assinatura do perfil (a imagem usada fica no ato). */
const assinado = z.object({ assinar: z.literal(true, { error: "Confirme a assinatura para continuar" }) });

/**
 * O estado "ausente" do usuário: ele continua ativo e vê o sistema, mas não altera nada, não recebe reserva de OS e não entra
 * em APR (ver `ausencia.md`). O técnico pede, o supervisor da equipe aprova, ajusta, recusa, registra, prorroga e encerra, e o
 * ausente confirma o retorno. Toda ação, menos o pedido inicial, é assinada com a assinatura do perfil. O admin só consulta.
 */
export function rotasAusencias(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  // A ausência do supervisor é o que faz o representante assumir (e o retorno dele é o que devolve a equipe): depois de qualquer
  // ato que deu certo, a representação é conferida na hora, sem esperar a tarefa de hora em hora.
  const conferirRepresentacao: MiddlewareHandler<Ambiente> = async (c, proximo) => {
    await proximo();
    if (c.req.method !== "GET" && c.res.status < 400) await sincronizarRepresentacao(deps.db, deps.agora());
  };
  r.use("/ausencias", conferirRepresentacao);
  r.use("/ausencias/*", conferirRepresentacao);

  /**
   * As minhas ausências e as das equipes que supervisiono (o admin vê todas). Filtros: `usuario_id`, `equipe_id`, `situacao`
   * (`pedida`, `aguardando_confirmacao`, `agendada`, `em_curso`, `vencida`, `encerrada`, `recusada`, `cancelada`) e `abertas`.
   */
  r.get("/ausencias", autenticar(), async (c) => {
    const f = lerConsulta(
      c,
      esquemaPaginacao.extend({ usuario_id: uuid.optional(), equipe_id: uuid.optional(), situacao: z.enum(SITUACOES).optional(), abertas: booleanoDaConsulta }),
    );
    const { ausencias, total } = await listarAusencias(deps.db, c.get("usuario"), f, deps.agora());
    return responder(c, { ausencias, ...meta(f, total) });
  });

  r.get("/ausencias/:id", autenticar(), async (c) => {
    return responder(c, { ausencia: await detalharAusencia(deps.db, c.get("usuario"), lerId(c), deps.agora(), { comAtos: true }) });
  });

  /**
   * O técnico pede a ausência (sem assinatura: ele assina ao confirmar). O supervisor da equipe registra a de alguém, com
   * `usuario_id`, ou a própria, e assina (`assinar: true`): vale na hora. O período é o `inicio` mais os `dias` corridos
   * ou a data de `retorno` (um dos dois).
   */
  r.post("/ausencias", autenticar(), async (c) => {
    const dados = await lerCorpo(
      c,
      z.object({ motivo, inicio: dataExistente, dias: dias.optional(), retorno: dataExistente.optional(), usuario_id: uuid.optional(), assinar: z.boolean().optional() }),
    );
    const resultado = await pedirOuRegistrarAusencia(deps, c.get("usuario"), {
      motivo: dados.motivo,
      inicio: dados.inicio,
      dias: dados.dias,
      retorno: dados.retorno,
      usuarioId: dados.usuario_id,
      assinar: dados.assinar,
    });
    return responder(c, resultado, 201);
  });

  /** O supervisor aprova o pedido, com ou sem ajuste das datas (`inicio`, `dias` ou `retorno`); o técnico ainda confirma. */
  r.post("/ausencias/:id/aprovar", autenticar(), async (c) => {
    const dados = await lerCorpo(c, assinado.extend({ inicio: dataExistente.optional(), dias: dias.optional(), retorno: dataExistente.optional() }));
    return responder(c, await aprovarAusencia(deps, c.get("usuario"), lerId(c), { inicio: dados.inicio, dias: dados.dias, retorno: dados.retorno }));
  });

  r.post("/ausencias/:id/recusar", autenticar(), async (c) => {
    const dados = await lerCorpo(c, assinado.extend({ motivo }));
    return responder(c, await recusarAusencia(deps, c.get("usuario"), lerId(c), dados.motivo));
  });

  /** O técnico confirma a ausência aprovada: ela passa a valer. */
  r.post("/ausencias/:id/confirmar", autenticar(), async (c) => {
    await lerCorpo(c, assinado);
    return responder(c, await confirmarAusencia(deps, c.get("usuario"), lerId(c)));
  });

  r.post("/ausencias/:id/recusar-ajuste", autenticar(), async (c) => {
    const dados = await lerCorpo(c, assinado.extend({ motivo: motivo.optional() }));
    return responder(c, await recusarAjusteDaAusencia(deps, c.get("usuario"), lerId(c), dados.motivo));
  });

  r.post("/ausencias/:id/cancelar", autenticar(), async (c) => {
    await lerCorpo(c, assinado);
    return responder(c, await cancelarAusencia(deps, c.get("usuario"), lerId(c)));
  });

  /** O ausente pede o fim antecipado: a data de retorno que ele quer. Passa pelo bloqueio do ausente. */
  r.post("/ausencias/:id/pedir-fim", autenticar({ permitirAusente: true }), async (c) => {
    const dados = await lerCorpo(c, assinado.extend({ data: dataExistente }));
    return responder(c, await pedirFimDaAusencia(deps, c.get("usuario"), lerId(c), dados.data));
  });

  r.post("/ausencias/:id/responder-fim", autenticar(), async (c) => {
    const dados = await lerCorpo(c, assinado.extend({ aprovar: z.boolean(), motivo: motivo.optional() }));
    return responder(c, await responderFimDaAusencia(deps, c.get("usuario"), lerId(c), { aprovar: dados.aprovar, motivo: dados.motivo }));
  });

  /** O supervisor muda a data de retorno (inclusive a da ausência vencida). O supervisor ausente só altera a própria. */
  r.post("/ausencias/:id/prorrogar", autenticar({ permitirAusente: true }), async (c) => {
    const dados = await lerCorpo(c, assinado.extend({ retorno: dataExistente, motivo: motivo.optional() }));
    return responder(c, await prorrogarAusencia(deps, c.get("usuario"), lerId(c), dados.retorno, dados.motivo));
  });

  /** O supervisor encerra a ausência a qualquer momento; o supervisor ausente encerra a própria, em emergência. */
  r.post("/ausencias/:id/encerrar", autenticar({ permitirAusente: true }), async (c) => {
    const dados = await lerCorpo(c, assinado.extend({ motivo: motivo.optional() }));
    return responder(c, await encerrarAusencia(deps, c.get("usuario"), lerId(c), dados.motivo));
  });

  /** O ausente confirma o retorno, depois da data: a conta volta ao normal na hora. */
  r.post("/ausencias/:id/confirmar-retorno", autenticar({ permitirAusente: true }), async (c) => {
    await lerCorpo(c, assinado);
    return responder(c, await confirmarRetornoDaAusencia(deps, c.get("usuario"), lerId(c)));
  });

  return r;
}
