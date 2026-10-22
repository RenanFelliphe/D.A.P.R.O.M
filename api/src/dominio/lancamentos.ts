import { eq, inArray } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { conquistaUsuario, equipe, lancamentoEquipe, lancamentoPontos, regraPontuacao, temporadaUsuario, usuario, type RegraCodigo } from "../db/schema";
import { REGRAS } from "./regras-de-pontuacao";
import { temporadaParaLancar } from "./temporadas";

/**
 * O extrato de pontos (seção 2.6 do `docs/gamificacao-e-treinamentos.md`). `lancar` é a única porta de escrita: cada pontuação é uma linha de
 * `lancamento_pontos` com a chave única por pessoa (`apr:<os>`, `assinatura`, `conquista:<id>`…), então o limite de cada tarefa e
 * a proteção contra reenvio são a mesma restrição (`on conflict do nothing`). Só o servidor chama isto, dentro da transação do que
 * gerou a pontuação.
 */

export interface ContextoDePontos {
  /** A transação de quem gerou a pontuação (a APR, a execução, a ciência…). */
  tx: Db;
  /** O relógio da `api`: o lançamento de uma data futura (relógio errado no aparelho) é trazido para cá. */
  agora: Date;
  /** Preenchimento da implantação: o lançamento fica no trimestre real, e as conquistas são conferidas só no fim. */
  historico?: boolean;
}

export interface Entrada {
  usuarioId: string;
  regra: RegraCodigo;
  /** Única por pessoa: `apr:<os>`, `responsavel:<os>`, `assinatura`, `conquista:<id>`… */
  chave: string;
  osId?: string | null;
  /** Quando a tarefa aconteceu (define a temporada). */
  ocorridoEm: Date;
  /** O valor, quando não é o da tarefa (os pontos de uma conquista vêm da própria conquista). */
  pontos?: number;
  /** O nome mostrado ao autor ("+25 pontos"), quando não é o da tarefa. */
  nome?: string;
}

/** Um lançamento novo (o que já existia não volta aqui). */
export interface Ganho {
  lancamentoId: string;
  usuarioId: string;
  regra: RegraCodigo;
  nome: string;
  pontos: number;
  osId: string | null;
  /** As equipes creditadas. */
  equipes: string[];
}

/** O valor e o estado de cada tarefa, como o admin os deixou. */
export async function regrasDoBanco(db: Db): Promise<Map<RegraCodigo, { pontos: number; ativa: boolean }>> {
  const linhas = await db.select().from(regraPontuacao);
  return new Map(linhas.map((r) => [r.codigo as RegraCodigo, { pontos: r.pontos, ativa: r.ativa }]));
}

/**
 * Grava os lançamentos que ainda não existem. Pula a tarefa desativada e quem não joga (só o técnico pontua; o admin não).
 * Credita cada lançamento à equipe da pessoa naquele momento e a todas as equipes que ela supervisiona. Devolve só os novos.
 */
export async function lancar(c: ContextoDePontos, entradas: Entrada[]): Promise<Ganho[]> {
  if (entradas.length === 0) return [];
  const regras = await regrasDoBanco(c.tx);
  const validas = entradas.filter((e) => regras.get(e.regra)?.ativa);
  if (validas.length === 0) return [];

  const ids = [...new Set(validas.map((e) => e.usuarioId))];
  const pessoas = await c.tx.select({ id: usuario.id, perfil: usuario.perfil, equipeId: usuario.equipeId }).from(usuario).where(inArray(usuario.id, ids));
  const pessoaPorId = new Map(pessoas.map((p) => [p.id, p]));
  const supervisionadas = await c.tx.select({ id: equipe.id, supervisorId: equipe.supervisorId }).from(equipe).where(inArray(equipe.supervisorId, ids));

  const ganhos: Ganho[] = [];
  for (const e of validas) {
    const pessoa = pessoaPorId.get(e.usuarioId);
    if (!pessoa || pessoa.perfil !== "tecnico") continue;
    const ocorridoEm = e.ocorridoEm.getTime() > c.agora.getTime() ? c.agora : e.ocorridoEm;
    const temporada = await temporadaParaLancar(c.tx, ocorridoEm, c.agora, c.historico);
    const pontos = e.pontos ?? regras.get(e.regra)!.pontos;
    const [novo] = await c.tx
      .insert(lancamentoPontos)
      .values({ usuarioId: e.usuarioId, regra: e.regra, pontos, chave: e.chave, osId: e.osId ?? null, ocorridoEm, temporada })
      .onConflictDoNothing()
      .returning({ id: lancamentoPontos.id });
    if (!novo) continue;

    const equipes = [...new Set([pessoa.equipeId, ...supervisionadas.filter((s) => s.supervisorId === e.usuarioId).map((s) => s.id)].filter((id): id is string => id !== null))];
    if (equipes.length > 0) await c.tx.insert(lancamentoEquipe).values(equipes.map((equipeId) => ({ lancamentoId: novo.id, equipeId })));
    ganhos.push({ lancamentoId: novo.id, usuarioId: e.usuarioId, regra: e.regra, nome: e.nome ?? REGRAS[e.regra].nome, pontos, osId: e.osId ?? null, equipes });
  }
  return ganhos;
}

/**
 * Apaga tudo o que a gamificação guarda de uma pessoa (extrato, conquistas e resultados de temporada). Quem remove um usuário
 * chama isto na mesma transação: os pontos são dado derivado e somem com a pessoa, e o que a impede de ser removida continua
 * sendo o histórico de campo (APR, execução, alerta); se a remoção falhar, a transação desfaz tudo, inclusive isto.
 */
export async function apagarGamificacaoDaPessoa(tx: Db, usuarioId: string): Promise<void> {
  const lancamentos = (await tx.select({ id: lancamentoPontos.id }).from(lancamentoPontos).where(eq(lancamentoPontos.usuarioId, usuarioId))).map((l) => l.id);
  if (lancamentos.length > 0) await tx.delete(lancamentoEquipe).where(inArray(lancamentoEquipe.lancamentoId, lancamentos));
  await tx.delete(lancamentoPontos).where(eq(lancamentoPontos.usuarioId, usuarioId));
  await tx.delete(conquistaUsuario).where(eq(conquistaUsuario.usuarioId, usuarioId));
  await tx.delete(temporadaUsuario).where(eq(temporadaUsuario.usuarioId, usuarioId));
}

/** O que a `api` devolve de um ganho ao próprio autor ("+10 pontos"): a regra, o nome e os pontos. */
export const ganhoParaApi = (g: Ganho) => ({ regra: g.regra, nome: g.nome, pontos: g.pontos, osId: g.osId });

/** Os ganhos de uma pessoa e o total deles. */
export function ganhosDe(ganhos: Ganho[], usuarioId: string) {
  const dela = ganhos.filter((g) => g.usuarioId === usuarioId);
  return { pontosGanhos: dela.reduce((t, g) => t + g.pontos, 0), ganhos: dela.map(ganhoParaApi) };
}
