import { Hono } from "hono";
import { exigirAssinaturaJuridica } from "../dominio/assinatura-juridica";
import { z } from "zod";
import type { Deps } from "../deps";
import { ALERTA_TIPOS } from "../db/schema";
import { criarAviso } from "../dominio/alertas";
import { registrarAuditoria, rotuloDaOs } from "../dominio/auditoria";
import { listarAlertas, marcarComoLido } from "../dominio/impedimento-alertas";
import { devolverOs, liberarReserva, reservarOs } from "../dominio/atribuicao-os";
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

/** Ações do supervisor sobre uma OS (reprogramar, reservar a uma pessoa, devolver ao SAP, cancelar a de apoio) e a caixa de alertas. */
export function rotasImpedimento(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.post("/os/:id/reprogramar", autenticar(), exigirPerfil("supervisor", "admin"), exigirAssinaturaJuridica(deps), async (c) => {
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

  r.post("/os/:id/cancelar", autenticar(), exigirPerfil("admin"), exigirAssinaturaJuridica(deps), async (c) => {
    const id = lerId(c);
    const dados = await lerCorpo(c, z.object({ justificativa }));
    const motivo = justificativaObrigatoria(dados.justificativa);
    const eu = c.get("usuario");
    const resultado = await cancelarOsDeApoio(deps.db, eu, id, motivo, deps.agora());
    const rotulo = await rotuloDaOs(deps.db, id);
    await registrarAuditoria(deps.db, eu, { entidade: "os", verbo: "cancelar", entidadeId: id, alvo: rotulo, resumo: `Cancelou a ${rotulo}`, detalhes: { justificativa: motivo } });
    return responder(c, resultado);
  });

  /**
   * Atribuição individual: o supervisor da equipe reserva a OS a uma pessoa (ou troca o responsável). A OS continua no
   * quadro da equipe, com a marca, e só o responsável inicia a APR e a execução.
   */
  r.put("/os/:id/responsavel", autenticar(), async (c) => {
    const id = lerId(c);
    const dados = await lerCorpo(c, z.object({ usuario_id: uuid }));
    const eu = c.get("usuario");
    const agora = deps.agora();
    const { mudou, anteriorId, ...resultado } = await reservarOs(deps.db, eu, id, dados.usuario_id, agora);
    if (mudou) {
      const rotulo = await rotuloDaOs(deps.db, id);
      // Quem recebe a OS e quem a perdeu ficam sabendo (o supervisor que reserva para si mesmo não se avisa).
      if (dados.usuario_id !== eu.id) {
        await criarAviso(deps.db, [dados.usuario_id], { tipo: "os_reservada", osId: id, detalhe: `${eu.nome} reservou a ${rotulo} para você: só você inicia a APR e a execução dela.`, agora });
      }
      if (anteriorId && anteriorId !== eu.id) {
        await criarAviso(deps.db, [anteriorId], { tipo: "os_reserva_desfeita", osId: id, detalhe: `${eu.nome} passou a ${rotulo}, que estava reservada para você, para ${resultado.responsavel.nome}.`, agora });
      }
      await registrarAuditoria(deps.db, eu, {
        entidade: "os",
        verbo: "reservar",
        entidadeId: id,
        alvo: rotulo,
        resumo: `Reservou a ${rotulo} para ${resultado.responsavel.nome}`,
        detalhes: { responsavel_id: dados.usuario_id, responsavel_anterior_id: anteriorId },
      });
    }
    return responder(c, resultado);
  });

  /** Tira a reserva: a OS volta a ser da equipe toda. */
  r.delete("/os/:id/responsavel", autenticar(), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    const { responsavelAnteriorId, ...resultado } = await liberarReserva(deps.db, eu, id);
    const rotulo = await rotuloDaOs(deps.db, id);
    if (responsavelAnteriorId !== eu.id) {
      await criarAviso(deps.db, [responsavelAnteriorId], {
        tipo: "os_reserva_desfeita",
        osId: id,
        detalhe: `${eu.nome} liberou a ${rotulo}, que estava reservada para você, para a equipe toda.`,
        agora: deps.agora(),
      });
    }
    await registrarAuditoria(deps.db, eu, {
      entidade: "os",
      verbo: "liberar_reserva",
      entidadeId: id,
      alvo: rotulo,
      resumo: `Liberou a ${rotulo} para a equipe toda`,
      detalhes: { responsavel_anterior_id: responsavelAnteriorId },
    });
    return responder(c, resultado);
  });

  /** Devolve a OS ao SAP com a justificativa do supervisor da equipe; ela vai na próxima planilha de baixa. */
  r.post("/os/:id/devolver", autenticar(), exigirAssinaturaJuridica(deps), async (c) => {
    const id = lerId(c);
    const dados = await lerCorpo(c, z.object({ justificativa }));
    const motivo = justificativaObrigatoria(dados.justificativa);
    const eu = c.get("usuario");
    const resultado = await devolverOs(deps.db, eu, id, motivo, deps.agora());
    const rotulo = await rotuloDaOs(deps.db, id);
    await registrarAuditoria(deps.db, eu, { entidade: "os", verbo: "devolver", entidadeId: id, alvo: rotulo, resumo: `Devolveu a ${rotulo} ao SAP`, detalhes: { justificativa: motivo } });
    return responder(c, resultado);
  });

  /** O sino: cada pessoa lê os alertas endereçados a ela (o técnico, os da própria ausência); o admin lê os de todos. */
  r.get("/alertas", autenticar(), async (c) => {
    const filtros = lerConsulta(c, esquemaPaginacao.extend({ lido: booleanoDaConsulta, equipe_id: uuid.optional(), tipo: z.enum(ALERTA_TIPOS).optional() }));
    const { linhas, total } = await listarAlertas(deps.db, c.get("usuario"), filtros);
    return responder(c, { alertas: linhas, ...meta(filtros, total) });
  });

  r.patch("/alertas/:id", autenticar({ permitirAusente: true }), async (c) => {
    const id = lerId(c);
    await lerCorpo(c, z.object({ lido: z.literal(true, { error: "Só é possível marcar o alerta como lido" }) }));
    await marcarComoLido(deps.db, c.get("usuario"), id, deps.agora());
    return responder(c, {});
  });

  return r;
}
