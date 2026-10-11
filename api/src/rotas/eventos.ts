import { Hono } from "hono";
import type { Deps } from "../deps";
import { processarEventos, esquemaEnvio } from "../dominio/eventos";
import { montarSnapshot } from "../dominio/sync";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { proibido } from "../http/erros";
import { responder } from "../http/resposta";
import { lerCorpo } from "../http/validacao";

/**
 * `POST /eventos`: o canal único de escrita de campo, igual para web, app online e fila offline. Só o perfil
 * `tecnico` aplica APR e executa OS (questão 56). Sempre `200`: o que cada evento teve (confirmado, rejeitado,
 * pendente) vem no corpo.
 */
export function rotasEventos(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  // Usuário desativado ainda envia a fila pendente; depois a sessão é revogada ("Acesso revogado").
  r.post("/eventos", autenticar({ permitirDesativado: true }), async (c) => {
    const eu = c.get("usuario");
    if (eu.perfil !== "tecnico") throw proibido("Só o perfil técnico aplica APR e executa OS");
    const { eventos } = await lerCorpo(c, esquemaEnvio);

    const resultado = await processarEventos(deps, eu, eventos);
    let acessoRevogado = false;
    if (!eu.ativo && resultado.confirmados.length > 0) {
      await deps.auth.revogar(eu.id);
      acessoRevogado = true;
    }
    return responder(c, { ...resultado, ...(acessoRevogado ? { acessoRevogado } : {}) });
  });

  /** Só do modo offline: baixa a cópia local da equipe. O `cursor` é opcional e, por ora, ignorado (snapshot completo). */
  r.post("/sync/pull", autenticar(), async (c) => {
    const eu = c.get("usuario");
    if ((eu.perfil !== "tecnico" && eu.perfil !== "supervisor") || !eu.equipeId) throw proibido("O modo offline é das equipes de campo");
    return responder(c, await montarSnapshot(deps.db, { id: eu.id, equipeId: eu.equipeId }, deps.agora()));
  });

  return r;
}
