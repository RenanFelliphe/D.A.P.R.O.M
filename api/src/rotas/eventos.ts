import { Hono } from "hono";
import type { Deps } from "../deps";
import { processarEventos, esquemaEnvio } from "../dominio/eventos";
import { avaliarApr } from "../dominio/avaliacao-apr";
import { montarSnapshot } from "../dominio/sync";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { proibido } from "../http/erros";
import { responder } from "../http/resposta";
import { lerCorpo, lerJson } from "../http/validacao";

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

  /**
   * `POST /aprs/avaliar`: o resultado da APR (`aprovada` ou `bloqueada`) e, se bloqueada, os itens reprovados com a
   * evidência que cada um pede. O modelo que o técnico recebe não diz o que é eliminatório; é aqui, depois de responder
   * tudo, que ele fica sabendo, e por isso a APR bloqueada já fica registrada (ver `avaliarApr`).
   */
  r.post("/aprs/avaliar", autenticar(), async (c) => {
    const eu = c.get("usuario");
    if (eu.perfil !== "tecnico") throw proibido("Só o perfil técnico aplica APR e executa OS");
    return responder(c, await avaliarApr(deps, eu, await lerJson(c)));
  });

  /** Só do modo offline: baixa a cópia local da equipe. O `cursor` é opcional e, por ora, ignorado (snapshot completo). */
  r.post("/sync/pull", autenticar(), async (c) => {
    const eu = c.get("usuario");
    if (eu.perfil !== "tecnico" || !eu.equipeId) throw proibido("O modo offline é das equipes de campo");
    return responder(c, await montarSnapshot(deps.db, { id: eu.id, equipeId: eu.equipeId }, deps.agora()));
  });

  return r;
}
