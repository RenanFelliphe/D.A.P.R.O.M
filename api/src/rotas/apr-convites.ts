import { Hono } from "hono";
import { z } from "zod";
import { LIMITE_DO_MOTIVO_DO_CONVITE, MAX_CONVIDADOS } from "../../../shared/api/apr-convite";
import type { Db } from "../db/conexao";
import type { Deps } from "../deps";
import { convidarParaApr, convitesDoResponsavel, convitesRecebidos, desfazerConvite, responderConvite } from "../dominio/apr-convites";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { responder } from "../http/resposta";
import { lerCorpo, lerId, uuid } from "../http/validacao";

const esquemaConvite = z.object({ usuarios: z.array(uuid).min(1).max(MAX_CONVIDADOS) });
const esquemaRecusa = z.object({ motivo: z.string().max(LIMITE_DO_MOTIVO_DO_CONVITE * 4) });

/**
 * O convite de participação na APR (`docs/operacao-de-campo.md`, seção 4.9). Só com sinal (o convite é do servidor, e o rascunho da APR não
 * é): sem sinal vale o presencial de sempre. O responsável convida, acompanha e desfaz; o convidado responde e vê o que recebeu.
 */
export function rotasConvitesDeApr(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** Os convites que o responsável fez hoje nesta OS, o último de cada pessoa, com a situação de agora. */
  r.get("/os/:id/apr-convites", autenticar(), exigirPerfil("tecnico"), async (c) => {
    return responder(c, { convites: await convitesDoResponsavel(deps.db, lerId(c), c.get("usuario").id, deps.agora()) });
  });

  /** Convida as pessoas marcadas como participantes. Repetir é seguro (o que ainda vale não se duplica). */
  r.post("/os/:id/apr-convites", autenticar(), exigirPerfil("tecnico"), async (c) => {
    const id = lerId(c);
    const { usuarios } = await lerCorpo(c, esquemaConvite);
    const eu = c.get("usuario");
    const agora = deps.agora();
    const convites = await deps.db.transaction((tx) => convidarParaApr(tx as unknown as Db, eu, id, usuarios, agora));
    return responder(c, { convites }, 201);
  });

  /** O responsável desfaz o convite (trocou a pessoa); ela é avisada. */
  r.delete("/apr-convites/:id", autenticar(), exigirPerfil("tecnico"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    await deps.db.transaction((tx) => desfazerConvite(tx as unknown as Db, eu, id, deps.agora()));
    return responder(c, { ok: true });
  });

  /** O que a pessoa recebeu e ainda vale: o que espera a resposta e o que ela aceitou e não virou APR. */
  r.get("/me/apr-convites", autenticar(), exigirPerfil("tecnico"), async (c) => {
    return responder(c, { convites: await convitesRecebidos(deps.db, c.get("usuario").id, deps.agora()) });
  });

  r.post("/apr-convites/:id/aceitar", autenticar(), exigirPerfil("tecnico"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    await deps.db.transaction((tx) => responderConvite(tx as unknown as Db, eu, id, { aceita: true }, deps.agora()));
    return responder(c, { ok: true });
  });

  r.post("/apr-convites/:id/recusar", autenticar(), exigirPerfil("tecnico"), async (c) => {
    const id = lerId(c);
    const { motivo } = await lerCorpo(c, esquemaRecusa);
    const eu = c.get("usuario");
    await deps.db.transaction((tx) => responderConvite(tx as unknown as Db, eu, id, { aceita: false, motivo }, deps.agora()));
    return responder(c, { ok: true });
  });

  return r;
}
