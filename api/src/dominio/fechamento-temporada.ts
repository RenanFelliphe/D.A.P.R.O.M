import { and, asc, between, eq, inArray, isNull, ne } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { os, reprogramacao, temporada, temporadaEquipe, temporadaUsuario } from "../db/schema";
import { conferirTodos } from "./conquistas";
import { escadaDePatentes, patenteDosPontos } from "./patentes";
import { rankingDeEquipes, rankingDePessoas } from "./ranking";
import { diaDe } from "./tempo";
import { dadosDaTemporada, passouATolerancia } from "./temporadas";

/**
 * Fechamento da temporada (seção 4 do `gameficacao.md`): 7 dias depois do último dia do trimestre (tolerância para a fila
 * offline), grava os pontos, a patente e a posição de cada pessoa e de cada equipe; esse registro forma o histórico. Depois
 * confere as conquistas de temporada (posição, patente, pontos numa temporada, temporadas impecáveis…). O que chegar com
 * data da temporada fechada entra na aberta (`temporadaParaLancar`).
 */

/**
 * A equipe teve preventivas programadas no trimestre e nenhuma ficou atrasada sem justificativa: sem execução encerrada, sem
 * reprogramação e já depois da data limite (a mesma definição do indicador de preventivas).
 */
async function equipeImpecavel(db: Db, equipeId: string, inicio: string, fim: string, hoje: string): Promise<boolean> {
  const preventivas = await db
    .select({ id: os.id, status: os.status, inicio: os.dataInicioProg, fim: os.dataFimProg })
    .from(os)
    .where(and(eq(os.tipo, "preventiva"), eq(os.equipeId, equipeId), ne(os.status, "cancelada"), between(os.dataInicioProg, inicio, fim)));
  if (preventivas.length === 0) return false;
  const reprogramadas = new Set(
    (await db.select({ osId: reprogramacao.osId }).from(reprogramacao).where(inArray(reprogramacao.osId, preventivas.map((p) => p.id)))).map((r) => r.osId),
  );
  return !preventivas.some((p) => p.status === "liberada" && !reprogramadas.has(p.id) && (p.fim ?? p.inicio) < hoje);
}

/** Fecha uma temporada: grava o resultado de pessoas e equipes e confere as conquistas. Devolve se fechou agora (`false`: já estava fechada). */
export async function fecharTemporada(db: Db, codigo: string, agora: Date): Promise<boolean> {
  return db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const [t] = await tx.select().from(temporada).where(eq(temporada.codigo, codigo)).for("update");
    if (!t || t.fechadaEm) return false;
    const { inicio, fim } = dadosDaTemporada(codigo);
    const escada = await escadaDePatentes(tx);
    const hoje = diaDe(agora);

    const pessoas = (await rankingDePessoas(tx, codigo)).filter((p) => p.pontos > 0);
    if (pessoas.length > 0) {
      await tx.insert(temporadaUsuario).values(pessoas.map((p) => ({ temporada: codigo, usuarioId: p.usuarioId, pontos: p.pontos, patenteId: p.patente?.id ?? null, posicao: p.posicao })));
    }

    const equipes = await rankingDeEquipes(tx, codigo);
    if (equipes.length > 0) {
      const linhas = [];
      for (const e of equipes) {
        linhas.push({
          temporada: codigo,
          equipeId: e.equipeId,
          pontos: e.pontos,
          membros: e.membros,
          media: e.media,
          patenteId: patenteDosPontos(e.media, escada)?.id ?? null,
          posicao: e.posicao,
          impecavel: await equipeImpecavel(tx, e.equipeId, inicio, fim, hoje),
        });
      }
      await tx.insert(temporadaEquipe).values(linhas);
    }

    await tx.update(temporada).set({ fechadaEm: agora }).where(eq(temporada.codigo, codigo));
    await conferirTodos({ tx, agora });
    return true;
  });
}

/** Fecha as temporadas abertas que já passaram da tolerância (o executor de tarefas chama a cada hora). Devolve os códigos fechados. */
export async function fecharTemporadasVencidas(db: Db, agora: Date): Promise<string[]> {
  const abertas = await db.select({ codigo: temporada.codigo }).from(temporada).where(isNull(temporada.fechadaEm)).orderBy(asc(temporada.codigo));
  const fechadas: string[] = [];
  for (const { codigo } of abertas) {
    if (passouATolerancia(codigo, agora) && (await fecharTemporada(db, codigo, agora))) fechadas.push(codigo);
  }
  return fechadas;
}
