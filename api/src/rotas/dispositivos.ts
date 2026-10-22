import { Hono } from "hono";
import { z } from "zod";
import { ehTokenDeExpo, PLATAFORMAS_DE_PUSH } from "../../../shared/notificacoes/push";
import type { Deps } from "../deps";
import { aparelhosDe, registrarDispositivo, removerDispositivo } from "../dominio/push";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { responder } from "../http/resposta";
import { lerCorpo } from "../http/validacao";

const esquemaRegistro = z.object({
  token: z.string().trim().refine(ehTokenDeExpo, "Token de notificação inválido"),
  plataforma: z.enum(PLATAFORMAS_DE_PUSH),
});
const esquemaRemocao = z.object({ token: z.string().trim().min(1) });

/**
 * Os aparelhos que recebem notificação push (`docs/pessoas-e-equipes.md`, seção 8.6). Toda pessoa liberada registra o seu; o
 * ausente também (a notificação não muda o que ele pode fazer, só avisa).
 */
export function rotasDispositivos(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** Quantos aparelhos a pessoa tem e se o servidor tem o serviço de push (sem ele, nada toca no celular). */
  r.get("/me/dispositivos", autenticar(), async (c) => {
    return responder(c, { aparelhos: await aparelhosDe(deps.db, c.get("usuario").id), servico_ligado: deps.push.configurado });
  });

  /** O app registra (e confirma, a cada abertura) o token do aparelho. Idempotente. */
  r.post("/me/dispositivos", autenticar({ permitirAusente: true }), async (c) => {
    const corpo = await lerCorpo(c, esquemaRegistro);
    await registrarDispositivo(deps.db, c.get("usuario").id, corpo, deps.agora());
    return responder(c, { ok: true });
  });

  /** O app tira o token ao sair ou ao desligar as notificações. Só o da própria pessoa; o que não existe também é "ok". */
  r.delete("/me/dispositivos", autenticar({ permitirAusente: true, permitirDesativado: true }), async (c) => {
    const corpo = await lerCorpo(c, esquemaRemocao);
    await removerDispositivo(deps.db, c.get("usuario").id, corpo.token);
    return responder(c, { ok: true });
  });

  return r;
}
