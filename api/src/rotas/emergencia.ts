import { Hono } from "hono";
import { z } from "zod";
import { CONTATOS_PUBLICOS } from "../../../shared/api/emergencia";
import type { Deps } from "../deps";
import { contatosDoPae } from "../dominio/configuracoes";
import { atenderEmergencia, emergenciasDaOs } from "../dominio/emergencia";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { responder } from "../http/resposta";
import { lerCorpo, lerId } from "../http/validacao";

/**
 * O botão de emergência (`docs/operacao-de-campo.md`, seção 5.9). O acionamento em si é o evento `emergencia_acionada` (`POST /eventos`),
 * que o aparelho sem sinal guarda na fila; aqui ficam os contatos para ligar e o atendimento.
 */
export function rotasEmergencia(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /**
   * Os contatos do PAE (cadastrados pelo admin em Configurações; vazio até ele cadastrar) e os números públicos. De quem está logado, inclusive
   * o ausente: ele só lê. O app guarda a última resposta para mostrar sem sinal.
   */
  r.get("/emergencia/contatos", autenticar(), async (c) => {
    return responder(c, { pae: await contatosDoPae(deps), publicos: CONTATOS_PUBLICOS });
  });

  /** Os acionamentos da OS, do mais recente ao mais antigo, com a posição e se já foram atendidos. */
  r.get("/os/:id/emergencias", autenticar(), async (c) => {
    return responder(c, { emergencias: await emergenciasDaOs(deps.db, c.get("usuario"), lerId(c)) });
  });

  /** O supervisor da equipe da OS ou o admin dá a emergência por atendida; quem acionou é avisado. */
  r.post("/emergencias/:id/atender", autenticar(), async (c) => {
    const id = lerId(c);
    const { nota } = await lerCorpo(c, z.object({ nota: z.string().trim().max(300).nullish() }));
    return responder(c, await atenderEmergencia(deps.db, c.get("usuario"), id, nota ?? null, deps.agora()));
  });

  return r;
}
