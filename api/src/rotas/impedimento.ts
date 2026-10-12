import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { ALERTA_TIPOS } from "../db/schema";
import { registrarAuditoria, rotuloDaOs } from "../dominio/auditoria";
import { listarAlertas, marcarComoLido } from "../dominio/impedimento-alertas";
import { cancelarOsDeApoio, reprogramarOs } from "../dominio/impedimento-os";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { invalido } from "../http/erros";
import { esquemaPaginacao, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, dataIso, lerConsulta, lerCorpo, lerId, uuid } from "../http/validacao";

/** Justificativa ausente ou só com espaços é um erro de negócio com mensagem própria, não de formato. */
const justificativa = z.string().optional();
function justificativaObrigatoria(texto: string | undefined): string {
  const limpa = texto?.trim();
  if (!limpa) throw invalido("justificativa_obrigatoria", "Justificativa obrigatória");
  return limpa;
}

/** `dataIso` aceita só o formato; aqui também recusa datas que não existem (2026-02-30). */
const dataValida = dataIso.refine((v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}, "Data inexistente");

/** Ações do supervisor sobre uma OS (reprogramar, cancelar a de apoio) e a caixa de alertas. */
export function rotasImpedimento(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.post("/os/:id/reprogramar", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const id = lerId(c);
    const dados = await lerCorpo(c, z.object({ data_inicio_prog: dataValida, equipe_id: uuid.optional(), justificativa }));
    const motivo = justificativaObrigatoria(dados.justificativa);
    const eu = c.get("usuario");
    const resultado = await reprogramarOs(deps.db, eu, id, {
      dataInicioProg: dados.data_inicio_prog,
      equipeId: dados.equipe_id,
      justificativa: motivo,
    });
    const rotulo = await rotuloDaOs(deps.db, id);
    await registrarAuditoria(deps.db, eu, {
      entidade: "os",
      verbo: "reprogramar",
      entidadeId: id,
      alvo: rotulo,
      resumo: `Reprogramou a ${rotulo} para ${dados.data_inicio_prog}`,
      detalhes: { data_inicio_prog: dados.data_inicio_prog, equipe_id: dados.equipe_id ?? null, justificativa: motivo },
    });
    return responder(c, resultado);
  });

  r.post("/os/:id/cancelar", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const dados = await lerCorpo(c, z.object({ justificativa }));
    const motivo = justificativaObrigatoria(dados.justificativa);
    const eu = c.get("usuario");
    const resultado = await cancelarOsDeApoio(deps.db, eu, id, motivo, deps.agora());
    const rotulo = await rotuloDaOs(deps.db, id);
    await registrarAuditoria(deps.db, eu, { entidade: "os", verbo: "cancelar", entidadeId: id, alvo: rotulo, resumo: `Cancelou a ${rotulo}`, detalhes: { justificativa: motivo } });
    return responder(c, resultado);
  });

  r.get("/alertas", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const filtros = lerConsulta(c, esquemaPaginacao.extend({ lido: booleanoDaConsulta, equipe_id: uuid.optional(), tipo: z.enum(ALERTA_TIPOS).optional() }));
    const { linhas, total } = await listarAlertas(deps.db, c.get("usuario"), filtros);
    return responder(c, { alertas: linhas, ...meta(filtros, total) });
  });

  r.patch("/alertas/:id", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const id = lerId(c);
    await lerCorpo(c, z.object({ lido: z.literal(true, { error: "Só é possível marcar o alerta como lido" }) }));
    await marcarComoLido(deps.db, c.get("usuario"), id, deps.agora());
    return responder(c, {});
  });

  return r;
}
