import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { LIMITE_DO_RESUMO_DA_ASSINATURA, LIMITE_DO_TITULO_DA_ASSINATURA, SITUACOES_DA_ASSINATURA_JURIDICA } from "../../../shared/api/assinatura-juridica";
import {
  assinaturasJuridicasDaOs,
  avisoDoProvedor,
  consultarAssinaturaJuridica,
  criarAssinaturaJuridica,
  enviarAssinaturaPendente,
  listarMinhasAssinaturasJuridicas,
  urlDoPdfAssinado,
} from "../dominio/assinatura-juridica";
import type { Deps } from "../deps";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { naoAutenticado } from "../http/erros";
import { responder } from "../http/resposta";
import { lerConsulta, lerCorpo, lerId, lerJson, uuid } from "../http/validacao";

const esquemaNova = z.object({
  titulo: z.string().trim().min(3).max(LIMITE_DO_TITULO_DA_ASSINATURA),
  resumo: z.string().trim().max(LIMITE_DO_RESUMO_DA_ASSINATURA).optional(),
  os_id: uuid.optional(),
});

/**
 * A assinatura com validade jurídica (`docs/pessoas-e-equipes.md`, seção 3.3): criar o documento no provedor, acompanhar a assinatura,
 * assinar o que ficou pendente do modo offline e baixar o PDF assinado. Todas valem também para o ausente: os atos da ausência são assinados
 * por ele, e é o ato (não esta rota) que confere se o ausente pode fazê-lo.
 */
export function rotasAssinaturasJuridicas(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const logado = autenticar({ permitirAusente: true });

  r.post("/assinaturas-juridicas", logado, async (c) => {
    const corpo = await lerCorpo(c, esquemaNova);
    return responder(c, await criarAssinaturaJuridica(deps, c.get("usuario"), { titulo: corpo.titulo, resumo: corpo.resumo || undefined, osId: corpo.os_id }), 201);
  });

  /** As da pessoa; `?situacao=pendente_offline` traz o que ficou por assinar do modo offline. */
  r.get("/assinaturas-juridicas", logado, async (c) => {
    const { situacao } = lerConsulta(c, z.object({ situacao: z.enum(SITUACOES_DA_ASSINATURA_JURIDICA).optional() }));
    return responder(c, { assinaturas: await listarMinhasAssinaturasJuridicas(deps, c.get("usuario"), situacao) });
  });

  /** A janela do ato consulta aqui até a pessoa assinar; a `api` confere com o provedor a cada consulta. */
  r.get("/assinaturas-juridicas/:id", logado, async (c) => responder(c, await consultarAssinaturaJuridica(deps, c.get("usuario"), lerId(c))));

  r.post("/assinaturas-juridicas/:id/enviar", logado, async (c) => responder(c, await enviarAssinaturaPendente(deps, c.get("usuario"), lerId(c))));

  r.get("/assinaturas-juridicas/:id/pdf", logado, async (c) => responder(c, { url: await urlDoPdfAssinado(deps, c.get("usuario"), lerId(c)) }));

  r.get("/os/:id/assinaturas-juridicas", logado, async (c) => responder(c, { assinaturas: await assinaturasJuridicasDaOs(deps, c.get("usuario"), lerId(c)) }));

  /**
   * O aviso do provedor de que um documento mudou (a ZapSign o chama na URL cadastrada no painel dela, com `?segredo=`). Não há assinatura do
   * aviso para conferir, então ele só diz qual documento reconsultar: o que vale é o que o provedor responde à `api`.
   */
  r.post("/webhooks/zapsign", async (c) => {
    const esperado = deps.config.assinaturaJuridica.segredoDoWebhook;
    const recebido = c.req.query("segredo") ?? "";
    const a = Buffer.from(esperado);
    const b = Buffer.from(recebido);
    if (!esperado || a.length !== b.length || !timingSafeEqual(a, b)) throw naoAutenticado("Segredo do webhook inválido");
    const corpo = await lerJson(c);
    const token = corpo && typeof corpo === "object" && "token" in corpo && typeof corpo.token === "string" ? corpo.token : null;
    if (token && deps.config.assinaturaJuridica.ligada) await avisoDoProvedor(deps, token);
    return c.json({ ok: true });
  });

  return r;
}
