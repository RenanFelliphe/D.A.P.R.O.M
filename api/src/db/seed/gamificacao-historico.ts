import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "../conexao";
import { apr, conquistaEquipe, conquistaUsuario, evidencia, execucao, lancamentoPontos, os, planoPreventiva, temporada, usuario } from "../schema";
import { participantesDaApr, situacaoDasAssinaturas } from "../../dominio/apr-assinaturas";
import { conferirTodos } from "../../dominio/conquistas";
import { fecharTemporada } from "../../dominio/fechamento-temporada";
import { aprEstaCompleta } from "../../dominio/eventos-apr";
import type { ContextoDePontos } from "../../dominio/lancamentos";
import { pontuarApr, pontuarAssinatura, pontuarCiencia, pontuarExecucao, pontuarIntervalo, pontuarTreinamento } from "../../dominio/pontuacao";
import { passouATolerancia } from "../../dominio/temporadas";

/**
 * Implantação da gamificação (seção 2.4 do `gameficacao.md`): preenche o extrato a partir do histórico já gravado (APRs,
 * execuções, ciências, treinos, assinaturas e planos de preventiva), com as mesmas regras de hoje, e fecha as temporadas
 * passadas. Roda na subida da `api`, só quando o extrato está vazio, numa transação só: ou o histórico entra inteiro, ou nada
 * muda. As conquistas são concedidas no fim (com a data em que cada meta foi batida), e os pontos delas entram na temporada
 * aberta, então a primeira temporada real fica inflada pelo histórico (o planner já registra isso).
 */

export interface ResultadoDoHistorico {
  lancamentos: number;
  temporadasFechadas: number;
  conquistas: number;
}

/**
 * `forcar` ignora a trava do extrato vazio (a demonstração acrescenta ciências, treinos e planos por fora do canal de
 * eventos): o que já foi lançado não duplica, porque a chave de cada lançamento é única por pessoa.
 */
export async function preencherHistoricoDaGamificacao(db: Db, agora: Date, opcoes: { forcar?: boolean } = {}): Promise<ResultadoDoHistorico | null> {
  if (!opcoes.forcar) {
    const [existe] = await db.select({ id: lancamentoPontos.id }).from(lancamentoPontos).limit(1);
    if (existe) return null;
  }

  return db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const c: ContextoDePontos = { tx, agora, historico: true };

    // APRs, na ordem em que foram concluídas. A aprovada só pontua quando todos os que ficaram nela assinaram (a data é a da última
    // assinatura); a bloqueada, com a evidência completa (a data é a da última evidência).
    const aprs = await tx.select({ id: apr.id, resultado: apr.resultado, concluidaEm: apr.concluidaEm }).from(apr).orderBy(asc(apr.concluidaEm), asc(apr.id));
    for (const a of aprs) {
      let quando = a.concluidaEm;
      if (a.resultado === "aprovada") {
        const situacao = situacaoDasAssinaturas(await participantesDaApr(tx, a.id));
        if (!situacao.pronta) continue;
        const ultima = Math.max(...situacao.ativos.map((p) => p.assinadaEm!.getTime()));
        if (ultima > quando.getTime()) quando = new Date(ultima);
      }
      if (a.resultado === "bloqueada") {
        if (!(await aprEstaCompleta(tx, a.id))) continue;
        const [ultima] = await tx.select({ em: sql<Date | string>`max(${evidencia.capturadaEm})` }).from(evidencia).where(eq(evidencia.aprId, a.id));
        const em = ultima?.em ? new Date(ultima.em) : null;
        if (em && em.getTime() > quando.getTime()) quando = em;
      }
      await pontuarApr(c, a.id, quando, { evidenciaCompleta: true });
    }

    // Execuções concluídas (encerradas ou interrompidas por risco), na ordem do fim; vale a primeira encerrada de cada OS.
    const execucoes = await tx
      .select({ id: execucao.id, osId: execucao.osId, resultado: execucao.resultado, fim: execucao.fim })
      .from(execucao)
      // A encerrada só pontua depois que o responsável assinou o encerramento.
      .where(and(isNotNull(execucao.fim), sql`${execucao.resultado} in ('encerrada', 'interrompida')`, sql`(${execucao.resultado} <> 'encerrada' or ${execucao.encerramentoAssinadoEm} is not null)`))
      .orderBy(asc(execucao.fim), asc(execucao.id));
    const encerradas = new Set<string>();
    for (const e of execucoes) {
      if (e.resultado === "encerrada") {
        if (encerradas.has(e.osId)) continue;
        encerradas.add(e.osId);
      }
      await pontuarExecucao(c, e.id, e.fim!);
    }

    // Ciência no prazo.
    const ciencias = await tx.select({ id: os.id, por: os.cienciaPor, em: os.cienciaEm }).from(os).where(and(isNotNull(os.cienciaPor), isNotNull(os.cienciaEm)));
    for (const x of ciencias) await pontuarCiencia(c, x.id, x.por!, x.em!);

    // Boas-vindas: assinatura e Campo de treino.
    const pessoas = await tx
      .select({ id: usuario.id, assinaturaEm: usuario.assinaturaEm, treinamentoEstado: usuario.treinamentoEstado, treinamentoEm: usuario.treinamentoEm })
      .from(usuario)
      .where(eq(usuario.perfil, "tecnico"));
    for (const p of pessoas) {
      if (p.assinaturaEm) await pontuarAssinatura(c, p.id, p.assinaturaEm);
      if (p.treinamentoEstado === "concluido" && p.treinamentoEm) await pontuarTreinamento(c, p.id, p.treinamentoEm);
    }

    // Intervalo de preventiva definido por um supervisor.
    const planos = await tx
      .select({ id: planoPreventiva.id, por: planoPreventiva.atualizadoPor, em: planoPreventiva.atualizadoEm })
      .from(planoPreventiva)
      .where(and(isNotNull(planoPreventiva.intervaloQuantidade), isNotNull(planoPreventiva.atualizadoPor)));
    for (const p of planos) await pontuarIntervalo(c, p.id, p.por!, p.em);

    // As temporadas passadas já nascem fechadas (o resultado de cada uma fica gravado) e só então as conquistas são conferidas.
    let temporadasFechadas = 0;
    const abertas = await tx.select({ codigo: temporada.codigo }).from(temporada).where(isNull(temporada.fechadaEm)).orderBy(asc(temporada.codigo));
    for (const { codigo } of abertas) {
      if (passouATolerancia(codigo, agora) && (await fecharTemporada(tx, codigo, agora))) temporadasFechadas++;
    }
    await conferirTodos({ tx, agora });

    const contar = async (tabela: typeof lancamentoPontos | typeof conquistaUsuario | typeof conquistaEquipe) => ((await tx.select({ n: sql<number>`count(*)::int` }).from(tabela)) as [{ n: number }])[0].n;
    return { lancamentos: await contar(lancamentoPontos), temporadasFechadas, conquistas: (await contar(conquistaUsuario)) + (await contar(conquistaEquipe)) };
  });
}
