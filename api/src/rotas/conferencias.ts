import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { assinarConferencia, decidirConferencia, fecharConferencia, lerConferencia, minhasConferencias } from "../dominio/conferencia-execucao";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { responder } from "../http/resposta";
import { lerCorpo, lerId } from "../http/validacao";

const esquemaDecisao = z.object({
  escolhas: z.array(z.object({ campo: z.string().trim().min(1).max(40), escolha: z.string().trim().min(1).max(60) })).min(1).max(50),
});
const esquemaAssinatura = z.object({ ressalva: z.string().trim().max(1000).nullable().optional() });

/**
 * A conferência da execução registrada sem sinal em aparelhos diferentes (`funcionalidades/execucao-compartilhada.md`, etapa 3). Só os
 * participantes da execução e a supervisão da equipe leem; cada ação confere o papel de quem a faz (responsável, supervisor, participante).
 */
export function rotasConferencias(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** "Para conferir": as conferências em aberto de quem pergunta, com o que falta dele. */
  r.get("/me/conferencias", autenticar(), async (c) => {
    return responder(c, { conferencias: await minhasConferencias(deps.db, c.get("usuario"), deps.agora()) });
  });

  r.get("/conferencias/:id", autenticar(), async (c) => {
    return responder(c, await lerConferencia(deps.db, c.get("usuario"), lerId(c), deps.agora()));
  });

  /** O responsável (horários e pausas) e o supervisor (o resultado) escolhem a versão certa de cada diferença. */
  r.post("/conferencias/:id/decidir", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const { escolhas } = await lerCorpo(c, esquemaDecisao);
    const agora = deps.agora();
    await decidirConferencia(deps.db, eu, id, escolhas, agora);
    return responder(c, await lerConferencia(deps.db, eu, id, agora));
  });

  /** A ciência (resumo) ou a assinatura (com divergência), com ressalva opcional. */
  r.post("/conferencias/:id/assinar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const { ressalva } = await lerCorpo(c, esquemaAssinatura);
    const agora = deps.agora();
    await assinarConferencia(deps.db, eu, id, ressalva ?? null, agora);
    return responder(c, await lerConferencia(deps.db, eu, id, agora));
  });

  /** "Fechar com o que existe": a partir de 72 horas, o responsável ou o supervisor segue sem quem falta. */
  r.post("/conferencias/:id/fechar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const agora = deps.agora();
    await fecharConferencia(deps.db, eu, id, agora);
    return responder(c, await lerConferencia(deps.db, eu, id, agora));
  });

  return r;
}
