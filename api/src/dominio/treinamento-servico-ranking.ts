import { and, eq, isNotNull, ne, sql } from "drizzle-orm";
import { notaMaxima } from "../../../shared/treinamento-servico/nota";
import type { Db } from "../db/conexao";
import { equipe, treinamentoServicoTentativa, treinamentoServicoVersao, usuario } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { naoEncontrado } from "../http/erros";
import { mascararPessoa } from "./ranking";
import { treinamentoDoCodigo, versaoPublicadaDoTreinamento } from "./treinamento-servico";

/**
 * O ranking de um treinamento de serviço (seções 9 e 12 do `treinamentos-de-servico.md`): quem já concluiu, pela **melhor
 * nota** entre as suas tentativas (acertos, tempo e número de fases). Jogar de novo pode melhorar a posição aqui, mas não dá
 * pontos na gamificação, que conta só a primeira conclusão. No empate, quem chegou à nota primeiro (a mesma regra do ranking
 * da gamificação, "quem chegou primeiro").
 *
 * Quem aparece: técnicos ativos que já concluíram, inclusive quem aguarda liberação (eles treinam e pontuam); quem foi recusado
 * ou desativado sai. O admin não joga e não aparece, mas vê. O anonimato é o mesmo da gamificação (`mascararPessoa`).
 */

export const LINHAS_DO_RANKING = 10;

export interface LinhaDoRankingDoTreinamento {
  posicao: number;
  usuarioId: string | null;
  nome: string;
  equipeId: string | null;
  equipeNome: string | null;
  anonimo: boolean;
  /** A melhor nota da pessoa neste treinamento e a nota máxima da versão em que ela a fez. */
  nota: number;
  notaMaxima: number;
  /** As fases certas e o total de fases na tentativa da melhor nota. */
  fasesCertas: number;
  totalFases: number;
  /** A nota ÷ a nota máxima, de 0 a 100, arredondado. */
  aproveitamento: number;
  concluidoEm: Date;
  voce: boolean;
}

export interface RankingDoTreinamento {
  /** Quantas pessoas já concluíram (o tamanho do ranking inteiro, não só das linhas devolvidas). */
  participantes: number;
  /** As primeiras `limite` posições. */
  linhas: LinhaDoRankingDoTreinamento[];
  /** A linha de quem pede, mesmo fora das primeiras; nula se ainda não concluiu (ou se é o admin). */
  minha: LinhaDoRankingDoTreinamento | null;
}

export async function rankingDoTreinamento(db: Db, eu: Pick<UsuarioAutenticado, "id" | "perfil">, atividadeCodigo: string, limite = LINHAS_DO_RANKING): Promise<RankingDoTreinamento> {
  const treinamento = await treinamentoDoCodigo(db, atividadeCodigo);
  if (!treinamento || !(await versaoPublicadaDoTreinamento(db, treinamento.id))) throw naoEncontrado("Treinamento não encontrado ou ainda não publicado");

  const concluidas = await db
    .select({
      usuarioId: usuario.id,
      nome: usuario.nome,
      equipeId: usuario.equipeId,
      equipeNome: equipe.nome,
      anonimo: usuario.rankingAnonimo,
      nota: treinamentoServicoTentativa.nota,
      fasesCertas: treinamentoServicoTentativa.fasesCertas,
      totalFases: sql<number>`jsonb_array_length(${treinamentoServicoVersao.fases})::int`,
      concluidoEm: treinamentoServicoTentativa.concluidaEm,
    })
    .from(treinamentoServicoTentativa)
    .innerJoin(treinamentoServicoVersao, eq(treinamentoServicoVersao.id, treinamentoServicoTentativa.versaoId))
    .innerJoin(usuario, eq(usuario.id, treinamentoServicoTentativa.usuarioId))
    .leftJoin(equipe, eq(equipe.id, usuario.equipeId))
    .where(
      and(
        eq(treinamentoServicoTentativa.treinamentoId, treinamento.id),
        isNotNull(treinamentoServicoTentativa.concluidaEm),
        eq(treinamentoServicoTentativa.preVisualizacao, false),
        eq(usuario.perfil, "tecnico"),
        eq(usuario.ativo, true),
        ne(usuario.liberacao, "recusado"),
      ),
    );

  // A melhor tentativa de cada pessoa: a maior nota e, empatando, a que chegou a ela primeiro.
  const melhor = (a: (typeof concluidas)[number], b: (typeof concluidas)[number]) => (b.nota ?? 0) - (a.nota ?? 0) || a.concluidoEm!.getTime() - b.concluidoEm!.getTime();
  const porPessoa = new Map<string, (typeof concluidas)[number]>();
  for (const l of concluidas) {
    const atual = porPessoa.get(l.usuarioId);
    if (!atual || melhor(l, atual) < 0) porPessoa.set(l.usuarioId, l);
  }
  const ordenadas = [...porPessoa.values()].sort((a, b) => melhor(a, b) || a.nome.localeCompare(b.nome, "pt-BR"));

  const linhas: LinhaDoRankingDoTreinamento[] = ordenadas.map((l, i) => {
    const nota = l.nota ?? 0;
    const maxima = notaMaxima(l.totalFases);
    return mascararPessoa(
      { ...l, nota, notaMaxima: maxima, concluidoEm: l.concluidoEm!, posicao: i + 1, aproveitamento: maxima > 0 ? Math.round((nota / maxima) * 100) : 0, voce: l.usuarioId === eu.id },
      eu,
    );
  });
  return {
    participantes: linhas.length,
    linhas: linhas.slice(0, limite),
    minha: linhas.find((l) => l.voce) ?? null,
  };
}
