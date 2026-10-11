import { desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { equipe, execucao, execucaoPausa, os, reprogramacao, usuario } from "../db/schema";
import { equipeDoEscopo, type UsuarioAutenticado } from "../http/autenticacao";
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
 * Supervisor só vê a própria equipe: pedir os indicadores de outra é `403` (nos demais perfis, `equipe_id` é só
 * um filtro). Devolve a equipe a que a consulta deve se limitar, ou `undefined` para todas.
 */
function equipeDoIndicador(eu: UsuarioAutenticado, equipeId: string | undefined): string | undefined {
  const escopo = equipeDoEscopo(eu);
  if (escopo !== null && equipeId !== undefined && equipeId !== escopo) throw proibido("Você só vê os indicadores da sua equipe");
  return equipeId ?? escopo ?? undefined;
}

/**
 * Indicador mensal de preventivas (por `data_inicio_prog` no mês). Encerradas: status `encerrada`. Atrasada
 * justificada: não encerrada nem cancelada, `pendente` ou com reprogramação, e com a data de referência
 * (`data_fim_prog`, senão `data_inicio_prog`) anterior a hoje. Atrasada sem justificativa: `liberada`, sem
 * reprogramação, também depois da data de referência.
 */
export async function indicadoresMensais(db: Db, eu: UsuarioAutenticado, f: { mes: string; equipe_id?: string }, agora: Date) {
  const equipeId = equipeDoIndicador(eu, f.equipe_id);
  const { inicio, fim } = intervaloDoMes(f.mes);
  const hoje = diaNoFuso(agora);

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

interface MedidaDeTempo {
  execucoes: number;
  tempoLiquidoMedioMin: number | null;
  pausaMediaMin: number | null;
  proporcaoPausa: number | null;
}

/** Médias de um grupo de Execuções; a proporção é a pausa total sobre o tempo total (`fim − inicio`). */
function medir(tempos: TempoDaExecucao[]): MedidaDeTempo {
  const n = tempos.length;
  if (n === 0) return { execucoes: 0, tempoLiquidoMedioMin: null, pausaMediaMin: null, proporcaoPausa: null };
  const liquido = tempos.reduce((t, x) => t + x.liquidoMs, 0);
  const pausa = tempos.reduce((t, x) => t + x.pausaMs, 0);
  const total = tempos.reduce((t, x) => t + x.totalMs, 0);
  return {
    execucoes: n,
    tempoLiquidoMedioMin: arredondar(liquido / n / 60_000),
    pausaMediaMin: arredondar(pausa / n / 60_000),
    proporcaoPausa: total > 0 ? arredondar(pausa / total, 4) : null,
  };
}

/** Indicador de tempo: só Execuções `encerrada` iniciadas no mês (fuso de São Paulo). */
export async function indicadoresDeTempo(db: Db, eu: UsuarioAutenticado, f: { mes: string; equipe_id?: string; usuario_id?: string }) {
  const equipeId = equipeDoIndicador(eu, f.equipe_id);
  const { inicio, fim } = intervaloDoMes(f.mes);

  const execucoes = await db
    .select({
      id: execucao.id,
      inicio: execucao.inicio,
      fim: execucao.fim,
      executorId: execucao.executorId,
      executorNome: usuario.nome,
      equipeId: os.equipeId,
      equipeNome: equipe.nome,
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
        condicaoEscopo(eu),
        equipeId ? eq(os.equipeId, equipeId) : undefined,
        f.usuario_id ? eq(execucao.executorId, f.usuario_id) : undefined,
      ),
    );

  const pausas = execucoes.length
    ? await db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, execucoes.map((e) => e.id)))
    : [];

  const medidas = execucoes.map((e) => ({
    e,
    tempo: tempoDaExecucao(e, pausas.filter((p) => p.execucaoId === e.id))!,
  }));

  const agrupar = <K extends string>(chave: (m: (typeof medidas)[number]) => { id: string; nome: string }, nomeId: K) => {
    const grupos = new Map<string, { nome: string; tempos: TempoDaExecucao[] }>();
    for (const m of medidas) {
      const { id, nome } = chave(m);
      const g = grupos.get(id) ?? { nome, tempos: [] };
      g.tempos.push(m.tempo);
      grupos.set(id, g);
    }
    return [...grupos.entries()]
      .map(([id, g]) => ({ [nomeId]: id, nome: g.nome, ...medir(g.tempos) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  };

  const geral = medir(medidas.map((m) => m.tempo));
  return {
    execucoes: geral.execucoes,
    tempoLiquidoMedioMin: geral.tempoLiquidoMedioMin,
    pausaMediaMin: geral.pausaMediaMin,
    proporcaoPausa: geral.proporcaoPausa,
    porEquipe: agrupar((m) => ({ id: m.e.equipeId, nome: m.e.equipeNome }), "equipeId").map(({ nome, ...r }) => ({ ...r, equipeNome: nome })),
    porUsuario: agrupar((m) => ({ id: m.e.executorId, nome: m.e.executorNome }), "usuarioId").map(({ nome, ...r }) => ({ ...r, usuarioNome: nome })),
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

