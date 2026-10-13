import { desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { equipe, execucao, execucaoPausa, os, reprogramacao, usuario } from "../db/schema";
import { equipesDoEscopo, type UsuarioAutenticado } from "../http/autenticacao";
import { proibido } from "../http/erros";
import { limiteEDeslocamento, type Paginacao } from "../http/paginacao";
import {
  arredondar,
  condicaoEscopo,
  diaNoFuso,
  emMinutos,
  intervaloDoMes,
  tempoDaExecucao,
  todas,
  type TempoDaExecucao,
} from "./painel-comum";

/**
 * Supervisor só vê as equipes do próprio escopo (a dele e as que supervisiona): pedir os indicadores de outra é `403`
 * (nos demais perfis, `equipe_id` é só um filtro). Devolve a equipe pedida, ou `undefined` para todas as do escopo, que
 * as consultas já limitam por `condicaoEscopo`.
 */
export function equipeDoIndicador(eu: UsuarioAutenticado, equipeId: string | undefined): string | undefined {
  const escopo = equipesDoEscopo(eu);
  if (escopo !== null && equipeId !== undefined && !escopo.includes(equipeId)) throw proibido("Você só vê os indicadores das suas equipes");
  return equipeId;
}

/** Indicador mensal de preventivas (`GET /indicadores?mes=`): a situação das preventivas programadas no mês. */
export async function indicadoresMensais(db: Db, eu: UsuarioAutenticado, f: { mes: string; equipe_id?: string }, agora: Date) {
  const equipeId = equipeDoIndicador(eu, f.equipe_id);
  return situacaoDasPreventivas(db, eu, { ...intervaloDoMes(f.mes), equipeId }, diaNoFuso(agora));
}

/**
 * Situação das preventivas com `data_inicio_prog` em `[inicio, fim)`. Encerradas: status `encerrada`. Atrasada
 * justificada: não encerrada nem cancelada, `pendente` ou com reprogramação, e com a data de referência
 * (`data_fim_prog`, senão `data_inicio_prog`) anterior a hoje. Atrasada sem justificativa: `liberada`, sem
 * reprogramação, também depois da data de referência. A equipe já vem resolvida (`equipeDoIndicador`).
 */
export async function situacaoDasPreventivas(db: Db, eu: UsuarioAutenticado, f: { inicio: string; fim: string; equipeId?: string }, hoje: string) {
  const { inicio, fim, equipeId } = f;

  const jaPassou = sql`coalesce(${os.dataFimProg}, ${os.dataInicioProg}) < ${hoje}::date`;
  const comReprogramacao = sql`exists (select 1 from ${reprogramacao} where ${reprogramacao.osId} = ${os.id})`;

  const linhas = await db
    .select({
      equipeId: equipe.id,
      equipeNome: equipe.nome,
      encerradas: sql<number>`(count(*) filter (where ${os.status} = 'encerrada'))::int`,
      atrasadasJustificadas: sql<number>`(count(*) filter (where ${os.status} in ('liberada', 'pendente', 'em_execucao') and (${os.status} = 'pendente' or ${comReprogramacao}) and ${jaPassou}))::int`,
      atrasadasSemJustificativa: sql<number>`(count(*) filter (where ${os.status} = 'liberada' and not ${comReprogramacao} and ${jaPassou}))::int`,
    })
    .from(os)
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .where(
      todas(
        eq(os.tipo, "preventiva"),
        sql`${os.dataInicioProg} >= ${inicio}::date and ${os.dataInicioProg} < ${fim}::date`,
        condicaoEscopo(eu),
        equipeId ? eq(os.equipeId, equipeId) : undefined,
      ),
    )
    .groupBy(equipe.id, equipe.nome)
    .orderBy(equipe.nome);

  const soma = (campo: "encerradas" | "atrasadasJustificadas" | "atrasadasSemJustificativa") => linhas.reduce((t, l) => t + l[campo], 0);
  return {
    encerradas: soma("encerradas"),
    atrasadasJustificadas: soma("atrasadasJustificadas"),
    atrasadasSemJustificativa: soma("atrasadasSemJustificativa"),
    porEquipe: linhas,
  };
}

export interface MedidaDeTempo {
  execucoes: number;
  /** Média de `fim − inicio`, com as pausas. */
  tempoTotalMedioMin: number | null;
  tempoLiquidoMedioMin: number | null;
  pausaMediaMin: number | null;
  /** Pausa total sobre o tempo total, de 0 a 1. */
  proporcaoPausa: number | null;
  /** Execuções com ao menos uma pausa. */
  execucoesComPausa: number;
  /** Pausas registradas por execução, em média. */
  pausasPorExecucao: number | null;
}

/** Tempo de uma Execução com quantas pausas caíram dentro dela. */
type TempoMedido = TempoDaExecucao & { pausas: number };

/** Médias de um grupo de Execuções; a proporção é a pausa total sobre o tempo total (`fim − inicio`). */
function medir(tempos: TempoMedido[]): MedidaDeTempo {
  const n = tempos.length;
  if (n === 0) {
    return { execucoes: 0, tempoTotalMedioMin: null, tempoLiquidoMedioMin: null, pausaMediaMin: null, proporcaoPausa: null, execucoesComPausa: 0, pausasPorExecucao: null };
  }
  const liquido = tempos.reduce((t, x) => t + x.liquidoMs, 0);
  const pausa = tempos.reduce((t, x) => t + x.pausaMs, 0);
  const total = tempos.reduce((t, x) => t + x.totalMs, 0);
  return {
    execucoes: n,
    tempoTotalMedioMin: arredondar(total / n / 60_000),
    tempoLiquidoMedioMin: arredondar(liquido / n / 60_000),
    pausaMediaMin: arredondar(pausa / n / 60_000),
    proporcaoPausa: total > 0 ? arredondar(pausa / total, 4) : null,
    execucoesComPausa: tempos.filter((x) => x.pausaMs > 0).length,
    pausasPorExecucao: arredondar(tempos.reduce((t, x) => t + x.pausas, 0) / n),
  };
}

/** Os motivos de pausa do app, na ordem em que aparecem; `sem_motivo` é a pausa registrada sem escolher um. */
const MOTIVOS_DE_PAUSA = ["almoco", "descanso", "outro", "sem_motivo"] as const;
type MotivoDaPausa = (typeof MOTIVOS_DE_PAUSA)[number];
const OS_COM_MAIS_PAUSA = 5;

/** Indicador de tempo do mês (`GET /indicadores/tempo?mes=`). */
export async function indicadoresDeTempo(db: Db, eu: UsuarioAutenticado, f: { mes: string; equipe_id?: string; usuario_id?: string }) {
  const equipeId = equipeDoIndicador(eu, f.equipe_id);
  return temposDeExecucao(db, eu, { ...intervaloDoMes(f.mes), equipeId, usuarioId: f.usuario_id });
}

/** Milissegundos de uma pausa dentro da janela da Execução (a pausa que ficou aberta vale até o `fim`), como `tempoDaExecucao`. */
function pausaNaJanela(e: { inicio: Date; fim: Date }, p: { inicio: Date; fim: Date | null }): number {
  const de = Math.max(p.inicio.getTime(), e.inicio.getTime());
  const ate = Math.min((p.fim ?? e.fim).getTime(), e.fim.getTime());
  return Math.max(0, ate - de);
}

/**
 * Indicador de tempo: só Execuções `encerrada` iniciadas em `[inicio, fim)` (dias no fuso de São Paulo). Além das médias
 * (geral, por equipe e por técnico), traz a pausa por motivo e as OS com mais tempo em pausa; `comExecutor: false` tira o
 * nome de quem executou dessa lista (quem não acompanha a equipe não vê o desempenho de um colega).
 */
export async function temposDeExecucao(
  db: Db,
  eu: UsuarioAutenticado,
  f: { inicio: string; fim: string; equipeId?: string; usuarioId?: string; comExecutor?: boolean },
) {
  const { inicio, fim, equipeId } = f;

  const execucoes = await db
    .select({
      id: execucao.id,
      inicio: execucao.inicio,
      fim: execucao.fim,
      executorId: execucao.executorId,
      executorNome: usuario.nome,
      equipeId: os.equipeId,
      equipeNome: equipe.nome,
      osId: os.id,
      numeroOrdem: os.numeroOrdem,
      titulo: os.titulo,
    })
    .from(execucao)
    .innerJoin(os, eq(os.id, execucao.osId))
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .innerJoin(usuario, eq(usuario.id, execucao.executorId))
    .where(
      todas(
        eq(execucao.resultado, "encerrada"),
        sql`${execucao.fim} is not null`,
        sql`${execucao.inicio} >= (${inicio}::timestamp at time zone 'America/Sao_Paulo') and ${execucao.inicio} < (${fim}::timestamp at time zone 'America/Sao_Paulo')`,
        // O trabalho da própria pessoa conta mesmo em OS de uma equipe fora do escopo atual dela (mudou de equipe).
        f.usuarioId === eu.id ? undefined : condicaoEscopo(eu),
        equipeId ? eq(os.equipeId, equipeId) : undefined,
        f.usuarioId ? eq(execucao.executorId, f.usuarioId) : undefined,
      ),
    );

  const pausas = execucoes.length
    ? await db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, execucoes.map((e) => e.id)))
    : [];

  const porMotivo = new Map<MotivoDaPausa, { pausas: number; ms: number }>();
  const medidas = execucoes.map((e) => {
    const janela = { inicio: e.inicio, fim: e.fim! };
    const dela = pausas.filter((p) => p.execucaoId === e.id && pausaNaJanela(janela, p) > 0);
    for (const p of dela) {
      const motivo: MotivoDaPausa = p.motivo ?? "sem_motivo";
      const soma = porMotivo.get(motivo) ?? { pausas: 0, ms: 0 };
      porMotivo.set(motivo, { pausas: soma.pausas + 1, ms: soma.ms + pausaNaJanela(janela, p) });
    }
    return { e, tempo: { ...tempoDaExecucao(e, dela)!, pausas: dela.length } };
  });

  const agrupar = <K extends string>(chave: (m: (typeof medidas)[number]) => { id: string; nome: string }, nomeId: K) => {
    const grupos = new Map<string, { nome: string; tempos: TempoMedido[] }>();
    for (const m of medidas) {
      const { id, nome } = chave(m);
      const g = grupos.get(id) ?? { nome, tempos: [] };
      g.tempos.push(m.tempo);
      grupos.set(id, g);
    }
    return [...grupos.entries()]
      .map(([id, g]) => ({ [nomeId]: id, nome: g.nome, ...medir(g.tempos) }) as Record<K, string> & { nome: string } & MedidaDeTempo)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  };

  // A OS só tem uma Execução encerrada: cada medida é uma OS. Entram as que tiveram pausa, da maior pausa para a menor.
  const osComMaisPausa = medidas
    .filter((m) => m.tempo.pausaMs > 0)
    .sort((a, b) => b.tempo.pausaMs - a.tempo.pausaMs || b.e.fim!.getTime() - a.e.fim!.getTime())
    .slice(0, OS_COM_MAIS_PAUSA)
    .map((m) => ({
      osId: m.e.osId,
      numeroOrdem: m.e.numeroOrdem,
      titulo: m.e.titulo,
      executor: f.comExecutor === false ? null : m.e.executorNome,
      fim: m.e.fim!,
      tempoTotalMin: emMinutos(m.tempo.totalMs),
      tempoLiquidoMin: emMinutos(m.tempo.liquidoMs),
      pausaMin: emMinutos(m.tempo.pausaMs),
      pausas: m.tempo.pausas,
      proporcaoPausa: m.tempo.totalMs > 0 ? arredondar(m.tempo.pausaMs / m.tempo.totalMs, 4) : null,
    }));

  return {
    ...medir(medidas.map((m) => m.tempo)),
    porEquipe: agrupar((m) => ({ id: m.e.equipeId, nome: m.e.equipeNome }), "equipeId").map(({ nome, ...r }) => ({ ...r, equipeNome: nome })),
    porUsuario: agrupar((m) => ({ id: m.e.executorId, nome: m.e.executorNome }), "usuarioId").map(({ nome, ...r }) => ({ ...r, usuarioNome: nome })),
    /** Tempo em pausa por motivo, só os motivos que aparecem, na ordem do app. */
    porMotivo: MOTIVOS_DE_PAUSA.filter((m) => porMotivo.has(m)).map((motivo) => ({ motivo, pausas: porMotivo.get(motivo)!.pausas, minutos: emMinutos(porMotivo.get(motivo)!.ms) })),
    osComMaisPausa,
  };
}

/** Execuções `encerrada` de um local (e equipamento), da mais recente para a mais antiga, no escopo de equipe da OS. */
export async function historicoDoLocal(
  db: Db,
  eu: UsuarioAutenticado,
  f: Paginacao & { local_instalacao_id: string; equipamento?: string },
) {
  const onde = todas(
    eq(execucao.resultado, "encerrada"),
    eq(os.localInstalacaoId, f.local_instalacao_id),
    f.equipamento ? sql`lower(${os.equipamento}) = lower(${f.equipamento.trim()})` : undefined,
    condicaoEscopo(eu),
  );
  const { limit, offset } = limiteEDeslocamento(f);

  const linhas = await db
    .select({
      id: execucao.id,
      osId: os.id,
      numeroOrdem: os.numeroOrdem,
      titulo: os.titulo,
      equipamento: os.equipamento,
      executorId: execucao.executorId,
      executorNome: usuario.nome,
      inicio: execucao.inicio,
      fim: execucao.fim,
      descricaoAtividade: execucao.descricaoAtividade,
    })
    .from(execucao)
    .innerJoin(os, eq(os.id, execucao.osId))
    .innerJoin(usuario, eq(usuario.id, execucao.executorId))
    .where(onde)
    .orderBy(desc(execucao.fim), desc(execucao.id))
    .limit(limit)
    .offset(offset);

  const [{ n: total } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(execucao)
    .innerJoin(os, eq(os.id, execucao.osId))
    .where(onde);

  const pausas = linhas.length
    ? await db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, linhas.map((l) => l.id)))
    : [];

  return {
    itens: linhas.map((l) => {
      const tempo = tempoDaExecucao(l, pausas.filter((p) => p.execucaoId === l.id));
      return {
        id: l.id,
        os: { id: l.osId, numeroOrdem: l.numeroOrdem, titulo: l.titulo, equipamento: l.equipamento },
        executor: { id: l.executorId, nome: l.executorNome },
        inicio: l.inicio,
        fim: l.fim,
        descricaoAtividade: l.descricaoAtividade,
        tempoLiquidoMin: tempo ? emMinutos(tempo.liquidoMs) : null,
      };
    }),
    total,
  };
}

