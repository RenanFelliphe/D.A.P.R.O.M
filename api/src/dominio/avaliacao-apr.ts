import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { apr } from "../db/schema";
import type { Deps } from "../deps";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { validar } from "../http/validacao";
import { processarEventos } from "./eventos";
import { conferirApr, esquemaAvaliacaoApr, reprovadosDaAprGravada } from "./eventos-apr";
import { RejeicaoEvento, type Contexto } from "./eventos-base";

/** A recusa da APR como erro HTTP: a OS que o técnico não vê não existe para ele, e o conflito de estado é `409`. */
function comoErroHttp(codigo: string, mensagem: string) {
  if (codigo === "os_inexistente" || codigo === "fora_da_equipe") return naoEncontrado("OS não encontrada");
  if (codigo === "os_em_execucao" || codigo === "os_encerrada") return conflito(codigo, mensagem);
  return invalido(codigo, mensagem);
}

/** O que o técnico fica sabendo: o resultado e, se bloqueada, cada item reprovado com a evidência que ele pede. */
const resultadoDe = (reprovados: { id: string; texto: string; evidencia: string }[]) => ({
  resultado: reprovados.length > 0 ? ("bloqueada" as const) : ("aprovada" as const),
  reprovados: reprovados.map((i) => ({ itemId: i.id, texto: i.texto, evidencia: i.evidencia })),
});

/**
 * `POST /aprs/avaliar`: confere a APR inteira, com as mesmas regras do registro e antes do resultado, e diz se ela passa.
 * É a única hora em que o técnico fica sabendo quais itens são eliminatórios, por isso descobrir sempre deixa registro:
 * - aprovada: nada é gravado; segue para as assinaturas e o evento `apr_concluida`;
 * - bloqueada: vale na hora. A APR é registrada já aqui, pelo canal dos eventos (OS pendente, alerta e e-mail ao
 *   supervisor), e a evidência dos itens reprovados chega depois, no `apr_concluida` da mesma APR. Descartar o rascunho e
 *   refazer a APR não apaga a bloqueada.
 */
export async function avaliarApr(deps: Deps, usuario: UsuarioAutenticado, bruto: unknown) {
  const p = validar(esquemaAvaliacaoApr, bruto);
  const agora = deps.agora();

  // A resposta anterior se perdeu e o técnico validou de novo: vale o que ficou gravado.
  const [existente] = await deps.db.select({ osId: apr.osId, preenchidaPor: apr.preenchidaPor }).from(apr).where(eq(apr.id, p.id));
  if (existente) {
    if (existente.osId !== p.os_id || existente.preenchidaPor !== usuario.id) throw conflito("apr_existente", "Esta APR já foi registrada");
    return resultadoDe(await reprovadosDaAprGravada(deps.db, p.id));
  }

  const ctx: Contexto = {
    tx: deps.db,
    deps,
    usuario,
    evento: { id: randomUUID(), tipo: "apr_concluida", osId: p.os_id, ocorridoEm: agora },
    recebidoEm: agora,
    offline: false,
    saida: { alertas: [], aprs: [], osAfetadas: new Set(), ganhos: [] },
  };
  let reprovados: Awaited<ReturnType<typeof conferirApr>>["reprovados"];
  try {
    ({ reprovados } = await conferirApr(ctx, p.os_id, p));
  } catch (erro) {
    if (erro instanceof RejeicaoEvento) throw comoErroHttp(erro.codigo, erro.message);
    throw erro;
  }
  if (reprovados.length === 0) return resultadoDe([]);

  const envio = await processarEventos(
    deps,
    usuario,
    [{ id: randomUUID(), tipo: "apr_concluida", os_id: p.os_id, payload: { ...(bruto as Record<string, unknown>), evidencias: [] }, ocorrido_em: agora }],
    { evidenciaDepois: true },
  );
  const recusa = envio.rejeitados[0] ?? envio.pendentes[0];
  if (recusa) throw comoErroHttp(recusa.codigo, recusa.mensagem);
  return resultadoDe(reprovados);
}
