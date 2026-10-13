import { and, desc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { apr, atividade, equipe, execucao, localInstalacao, os, PERFIS, reprogramacao, usuario, type Perfil } from "../db/schema";
import { ehSupervisor, veTodasAsEquipes, type UsuarioAutenticado } from "../http/autenticacao";
import { condicaoEscopo, diaNoFuso, noEscopo, todas } from "./painel-comum";
import { situacaoDasPreventivas, temposDeExecucao, type MedidaDeTempo } from "./painel-indicadores";
import { diaDoInstante, diaEntre, faixaDoDia, instanteEntre, resolverPeriodo, type Periodo } from "./periodo";

/**
 * Dashboards de Indicadores e exportação (geral, OS, equipes e usuários; o de APR fica em `apr-resumo.ts`). Todos
 * recebem o mesmo filtro: o período (`periodo.ts`) e a equipe, já resolvida por `equipeDoIndicador` (o supervisor só
 * vê a dele). "Agora" é a foto do momento (não depende do período); o resto conta dentro do período.
 */
export interface FiltroDoDashboard {
  periodo: Periodo;
  equipeId?: string;
}

const contagem = sql<number>`count(*)::int`;
const contarSe = (condicao: SQL) => sql<number>`(count(*) filter (where ${condicao}))::int`;
const ABERTAS = sql`${os.status} in ('liberada', 'pendente', 'em_execucao')`;
const HORAS_DE_EXECUCAO_ESQUECIDA = 12;
const INTERRUPCOES_RECENTES = 5;
const LOCAIS_NO_RANKING = 6;

/** A equipe da OS dentro do escopo e do filtro. */
/**
 * Quem acompanha a equipe (admin e supervisor) vê também os dados de cada pessoa e as pendências de gestão. O técnico que não
 * supervisiona vê só o que é da equipe como um todo: nada que revele o desempenho de um colega.
 */
export const acompanhaAEquipe = (eu: UsuarioAutenticado) => veTodasAsEquipes(eu) || ehSupervisor(eu);

const daEquipe = (eu: UsuarioAutenticado, equipeId?: string) => todas(condicaoEscopo(eu), equipeId ? eq(os.equipeId, equipeId) : undefined);

/** Foto da carteira: OS abertas por status, as atrasadas, as de local crítico e as de apoio ainda abertas. */
async function carteira(db: Db, filtroOs: SQL | undefined, hoje: string) {
  const [linha] = await db
    .select({
      liberadas: contarSe(sql`${os.status} = 'liberada'`),
      pendentes: contarSe(sql`${os.status} = 'pendente'`),
      emExecucao: contarSe(sql`${os.status} = 'em_execucao'`),
      atrasadas: contarSe(sql`${os.status} in ('liberada', 'pendente') and coalesce(${os.dataFimProg}, ${os.dataInicioProg}) < ${hoje}::date`),
      criticas: contarSe(sql`${ABERTAS} and ${localInstalacao.critico}`),
      apoioAbertas: contarSe(sql`${ABERTAS} and ${os.origem} = 'apoio'`),
    })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(filtroOs);
  return linha!;
}

/**
 * OS encerradas por faixa e por tipo, pelo fim da Execução que as encerrou, mais o total do período anterior. Uma OS
 * só tem uma Execução `encerrada`, então cada linha é uma OS.
 */
export async function encerradas(db: Db, filtroOs: SQL | undefined, p: ReturnType<typeof resolverPeriodo>) {
  const dia = diaDoInstante(execucao.fim);
  const linhas = await db
    .select({ dia, tipo: os.tipo, total: contagem })
    .from(execucao)
    .innerJoin(os, eq(os.id, execucao.osId))
    .where(todas(eq(execucao.resultado, "encerrada"), instanteEntre(execucao.fim, p.anterior.inicio, p.fim), filtroOs))
    .groupBy(dia, os.tipo);
  const serie = p.faixas.map((f) => ({ ...f, corretivas: 0, preventivas: 0 }));
  const totais = { total: 0, anterior: 0, corretivas: 0, preventivas: 0 };
  for (const l of linhas) {
    if (l.dia < p.inicio) {
      totais.anterior += l.total;
      continue;
    }
    const ponto = faixaDoDia(serie, l.dia);
    if (!ponto) continue;
    const chave = l.tipo === "preventiva" ? "preventivas" : "corretivas";
    ponto[chave] += l.total;
    totais[chave] += l.total;
    totais.total += l.total;
  }
  return { ...totais, serie };
}

/** APRs concluídas no período e no anterior, com as bloqueadas. */
export async function contarAprs(db: Db, filtroOs: SQL | undefined, p: ReturnType<typeof resolverPeriodo>) {
  const noAtual = instanteEntre(apr.concluidaEm, p.inicio, p.fim);
  const [linha] = await db
    .select({
      total: contarSe(noAtual),
      bloqueadas: contarSe(sql`${noAtual} and ${apr.resultado} = 'bloqueada'`),
      anterior: contarSe(sql`not (${noAtual})`),
      bloqueadasAnterior: contarSe(sql`not (${noAtual}) and ${apr.resultado} = 'bloqueada'`),
    })
    .from(apr)
    .innerJoin(os, eq(os.id, apr.osId))
    .where(todas(instanteEntre(apr.concluidaEm, p.anterior.inicio, p.fim), filtroOs));
  return linha!;
}

/** Execuções interrompidas por risco no período: o total e as mais recentes, com o motivo. */
export async function interrupcoes(db: Db, filtroOs: SQL | undefined, p: ReturnType<typeof resolverPeriodo>, comExecutor = true) {
  const onde = todas(eq(execucao.resultado, "interrompida"), instanteEntre(execucao.fim, p.inicio, p.fim), filtroOs);
  const [total, recentes] = await Promise.all([
    db.select({ total: contagem }).from(execucao).innerJoin(os, eq(os.id, execucao.osId)).where(onde),
    db
      .select({ osId: os.id, numeroOrdem: os.numeroOrdem, titulo: os.titulo, motivo: execucao.motivo, fim: execucao.fim, executor: usuario.nome })
      .from(execucao)
      .innerJoin(os, eq(os.id, execucao.osId))
      .innerJoin(usuario, eq(usuario.id, execucao.executorId))
      .where(onde)
      .orderBy(desc(execucao.fim))
      .limit(INTERRUPCOES_RECENTES),
  ]);
  // Para quem não acompanha a equipe a lista não diz quem interrompeu.
  return { total: total[0]?.total ?? 0, recentes: recentes.map((r) => ({ ...r, executor: comExecutor ? r.executor : null })) };
}

/**
 * O que pede ação agora: baixa no SAP, ciência do supervisor, execução esquecida aberta e atividade sem modelo. Quem não
 * acompanha a equipe recebe só a execução esquecida (as demais são de gestão: `null`).
 */
async function pendencias(db: Db, filtroOs: SQL | undefined, agora: Date, gestao: boolean) {
  const esquecida = new Date(agora.getTime() - HORAS_DE_EXECUCAO_ESQUECIDA * 3_600_000);
  const [osPendentes, [abertas], semModelo] = await Promise.all([
    gestao
      ? db
          .select({
            aExportar: contarSe(sql`${os.status} = 'encerrada' and ${os.exportadaSapEm} is null`),
            semCiencia: contarSe(sql`${os.status} = 'encerrada' and ${os.cienciaEm} is null`),
          })
          .from(os)
          .where(filtroOs)
          .then(([l]) => l!)
      : null,
    db
      .select({ total: contagem })
      .from(execucao)
      .innerJoin(os, eq(os.id, execucao.osId))
      .where(todas(isNull(execucao.resultado), sql`${execucao.inicio} < ${esquecida}`, filtroOs)),
    gestao ? db.select({ total: contagem }).from(atividade).where(isNull(atividade.modeloAprCodigo)).then(([l]) => l!.total) : null,
  ]);
  return { aExportar: osPendentes?.aExportar ?? null, semCiencia: osPendentes?.semCiencia ?? null, execucoesEsquecidas: abertas!.total, atividadesSemModelo: semModelo };
}

/** Dashboard geral: a carteira de agora, o resumo do período (OS, preventivas, APRs, tempo, interrupções) e as pendências. */
export async function dashboardGeral(db: Db, eu: UsuarioAutenticado, f: FiltroDoDashboard, agora: Date) {
  const hoje = diaNoFuso(agora);
  const p = resolverPeriodo(f.periodo, hoje);
  const filtroOs = daEquipe(eu, f.equipeId);
  const [agoraOs, fechadas, preventivas, tempo, aprs, interrompidas, aFazer] = await Promise.all([
    carteira(db, filtroOs, hoje),
    encerradas(db, filtroOs, p),
    situacaoDasPreventivas(db, eu, { inicio: p.inicio, fim: p.fim, equipeId: f.equipeId }, hoje),
    temposDeExecucao(db, eu, { inicio: p.inicio, fim: p.fim, equipeId: f.equipeId }),
    contarAprs(db, filtroOs, p),
    interrupcoes(db, filtroOs, p),
    pendencias(db, filtroOs, agora, acompanhaAEquipe(eu)),
  ]);
  return {
    periodo: p.periodo,
    agrupamento: p.agrupamento,
    de: p.de,
    ate: p.ate,
    carteira: agoraOs,
    encerradas: { total: fechadas.total, anterior: fechadas.anterior, corretivas: fechadas.corretivas, preventivas: fechadas.preventivas },
    preventivas: { encerradas: preventivas.encerradas, atrasadasJustificadas: preventivas.atrasadasJustificadas, atrasadasSemJustificativa: preventivas.atrasadasSemJustificativa },
    aprs,
    tempo: { execucoes: tempo.execucoes, tempoLiquidoMedioMin: tempo.tempoLiquidoMedioMin, pausaMediaMin: tempo.pausaMediaMin, proporcaoPausa: tempo.proporcaoPausa },
    interrupcoes: interrompidas.total,
    pendencias: aFazer,
  };
}

/**
 * Dashboard de OS: a carteira de agora, as OS programadas e encerradas no período (por tipo e por faixa), a situação
 * das preventivas, o tempo de execução, as interrupções por risco, as reprogramações e os locais com mais OS encerradas.
 */
export async function dashboardDeOs(db: Db, eu: UsuarioAutenticado, f: FiltroDoDashboard, agora: Date) {
  const hoje = diaNoFuso(agora);
  const p = resolverPeriodo(f.periodo, hoje);
  const filtroOs = daEquipe(eu, f.equipeId);
  const [agoraOs, fechadas, [programadas], preventivas, tempo, interrompidas, [reprogramadas], locais] = await Promise.all([
    carteira(db, filtroOs, hoje),
    encerradas(db, filtroOs, p),
    db
      .select({
        total: contarSe(sql`${os.status} <> 'cancelada'`),
        corretivas: contarSe(sql`${os.status} <> 'cancelada' and ${os.tipo} = 'corretiva'`),
        preventivas: contarSe(sql`${os.status} <> 'cancelada' and ${os.tipo} = 'preventiva'`),
        canceladas: contarSe(sql`${os.status} = 'cancelada'`),
      })
      .from(os)
      .where(todas(diaEntre(os.dataInicioProg, p.inicio, p.fim), filtroOs)),
    situacaoDasPreventivas(db, eu, { inicio: p.inicio, fim: p.fim, equipeId: f.equipeId }, hoje),
    temposDeExecucao(db, eu, { inicio: p.inicio, fim: p.fim, equipeId: f.equipeId, comExecutor: acompanhaAEquipe(eu) }),
    interrupcoes(db, filtroOs, p, acompanhaAEquipe(eu)),
    db.select({ total: contagem }).from(reprogramacao).innerJoin(os, eq(os.id, reprogramacao.osId)).where(todas(instanteEntre(reprogramacao.criadaEm, p.inicio, p.fim), filtroOs)),
    db
      .select({ id: localInstalacao.id, codigo: localInstalacao.codigo, critico: localInstalacao.critico, encerradas: contagem })
      .from(execucao)
      .innerJoin(os, eq(os.id, execucao.osId))
      .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
      .where(todas(eq(execucao.resultado, "encerrada"), instanteEntre(execucao.fim, p.inicio, p.fim), filtroOs))
      .groupBy(localInstalacao.id, localInstalacao.codigo, localInstalacao.critico)
      .orderBy(sql`count(*) desc`, localInstalacao.codigo)
      .limit(LOCAIS_NO_RANKING),
  ]);
  const { serie, ...osEncerradas } = fechadas;
  return {
    periodo: p.periodo,
    agrupamento: p.agrupamento,
    de: p.de,
    ate: p.ate,
    carteira: agoraOs,
    programadas: programadas!,
    encerradas: osEncerradas,
    serie,
    preventivas: { encerradas: preventivas.encerradas, atrasadasJustificadas: preventivas.atrasadasJustificadas, atrasadasSemJustificativa: preventivas.atrasadasSemJustificativa },
    tempo: semGrupos(tempo),
    interrupcoes: interrompidas,
    reprogramacoes: reprogramadas?.total ?? 0,
    locais,
  };
}

const mapaPor = <T extends Record<string, unknown>>(linhas: T[], chave: keyof T) => new Map(linhas.map((l) => [l[chave] as string, l]));

/** O indicador de tempo sem as quebras por equipe e por técnico (que os dashboards entregam nas próprias linhas). */
function semGrupos({ porEquipe: _e, porUsuario: _u, ...resto }: Awaited<ReturnType<typeof temposDeExecucao>>) {
  return resto;
}

const SEM_MEDIDA: MedidaDeTempo = { execucoes: 0, tempoTotalMedioMin: null, tempoLiquidoMedioMin: null, pausaMediaMin: null, proporcaoPausa: null, execucoesComPausa: 0, pausasPorExecucao: null };

/** As medidas de tempo de uma equipe ou técnico; quem não encerrou execução no período fica zerado. */
function medidaOuVazia(t: MedidaDeTempo | undefined): MedidaDeTempo {
  if (!t) return SEM_MEDIDA;
  const { execucoes, tempoTotalMedioMin, tempoLiquidoMedioMin, pausaMediaMin, proporcaoPausa, execucoesComPausa, pausasPorExecucao } = t;
  return { execucoes, tempoTotalMedioMin, tempoLiquidoMedioMin, pausaMediaMin, proporcaoPausa, execucoesComPausa, pausasPorExecucao };
}

/**
 * Dashboard de equipes e usuários: por equipe (técnicos ativos, preventivas, execuções e tempo, APRs e bloqueios,
 * interrupções) e por técnico (execuções e tempo, APRs que preencheu, interrupções). Com `comCadastro` (admin), traz
 * também o estado do cadastro: usuários ativos por perfil e os que ainda não conseguem trabalhar.
 */
export async function dashboardDeEquipes(db: Db, eu: UsuarioAutenticado, f: FiltroDoDashboard & { comCadastro: boolean }, agora: Date) {
  const hoje = diaNoFuso(agora);
  const p = resolverPeriodo(f.periodo, hoje);
  const filtroOs = daEquipe(eu, f.equipeId);
  // Equipes que a pessoa vê: todas, ou só as do escopo dela (sem nenhuma, nenhuma).
  const equipeVisivel = todas(
    noEscopo(eu, equipe.id),
    f.equipeId ? eq(equipe.id, f.equipeId) : undefined,
  );
  const pessoal = acompanhaAEquipe(eu);
  const aprNoPeriodo = todas(instanteEntre(apr.concluidaEm, p.inicio, p.fim), filtroOs);
  const interrompida = todas(eq(execucao.resultado, "interrompida"), instanteEntre(execucao.fim, p.inicio, p.fim), filtroOs);
  const bloqueadas = contarSe(sql`${apr.resultado} = 'bloqueada'`);

  const [equipes, tecnicosAtivos, preventivas, tempo, aprsPorEquipe, aprsPorTecnico, interrupcoesPorEquipe, interrupcoesPorTecnico] = await Promise.all([
    db
      .select({ id: equipe.id, nome: equipe.nome, supervisorNome: usuario.nome })
      .from(equipe)
      .leftJoin(usuario, eq(usuario.id, equipe.supervisorId))
      .where(equipeVisivel)
      .orderBy(equipe.nome),
    db
      .select({ id: usuario.id, nome: usuario.nome, equipeId: usuario.equipeId })
      .from(usuario)
      .innerJoin(equipe, eq(equipe.id, usuario.equipeId))
      .where(todas(eq(usuario.ativo, true), eq(usuario.liberacao, "liberado"), eq(usuario.perfil, "tecnico"), equipeVisivel)),
    situacaoDasPreventivas(db, eu, { inicio: p.inicio, fim: p.fim, equipeId: f.equipeId }, hoje),
    temposDeExecucao(db, eu, { inicio: p.inicio, fim: p.fim, equipeId: f.equipeId }),
    db.select({ equipeId: os.equipeId, aprs: contagem, bloqueadas }).from(apr).innerJoin(os, eq(os.id, apr.osId)).where(aprNoPeriodo).groupBy(os.equipeId),
    db.select({ usuarioId: apr.preenchidaPor, aprs: contagem, bloqueadas }).from(apr).innerJoin(os, eq(os.id, apr.osId)).where(aprNoPeriodo).groupBy(apr.preenchidaPor),
    db.select({ equipeId: os.equipeId, total: contagem }).from(execucao).innerJoin(os, eq(os.id, execucao.osId)).where(interrompida).groupBy(os.equipeId),
    db.select({ usuarioId: execucao.executorId, total: contagem }).from(execucao).innerJoin(os, eq(os.id, execucao.osId)).where(interrompida).groupBy(execucao.executorId),
  ]);

  const preventivasDa = mapaPor(preventivas.porEquipe, "equipeId");
  const tempoDaEquipe = mapaPor(tempo.porEquipe, "equipeId");
  const aprsDaEquipe = mapaPor(aprsPorEquipe, "equipeId");
  const interrupcoesDaEquipe = mapaPor(interrupcoesPorEquipe, "equipeId");
  const membros = new Map<string, number>();
  for (const t of tecnicosAtivos) membros.set(t.equipeId!, (membros.get(t.equipeId!) ?? 0) + 1);

  const linhasDeEquipe = equipes.map((e) => {
    const prev = preventivasDa.get(e.id);
    const t = tempoDaEquipe.get(e.id);
    return {
      id: e.id,
      nome: e.nome,
      supervisorNome: e.supervisorNome,
      tecnicos: membros.get(e.id) ?? 0,
      preventivas: {
        encerradas: prev?.encerradas ?? 0,
        atrasadasJustificadas: prev?.atrasadasJustificadas ?? 0,
        atrasadasSemJustificativa: prev?.atrasadasSemJustificativa ?? 0,
      },
      ...medidaOuVazia(t),
      aprs: aprsDaEquipe.get(e.id)?.aprs ?? 0,
      aprsBloqueadas: aprsDaEquipe.get(e.id)?.bloqueadas ?? 0,
      interrompidas: interrupcoesDaEquipe.get(e.id)?.total ?? 0,
    };
  });

  // Técnicos: os ativos das equipes visíveis e quem teve atividade nas OS delas no período (mesmo que tenha mudado de equipe).
  const tempoDoTecnico = mapaPor(tempo.porUsuario, "usuarioId");
  const aprsDoTecnico = mapaPor(aprsPorTecnico, "usuarioId");
  const interrupcoesDoTecnico = mapaPor(interrupcoesPorTecnico, "usuarioId");
  const ids = new Set([...tecnicosAtivos.map((t) => t.id), ...tempoDoTecnico.keys(), ...aprsDoTecnico.keys(), ...interrupcoesDoTecnico.keys()]);
  const pessoas = ids.size
    ? await db
        .select({ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, ativo: usuario.ativo, equipeNome: equipe.nome })
        .from(usuario)
        .leftJoin(equipe, eq(equipe.id, usuario.equipeId))
        .where(inArray(usuario.id, [...ids]))
    : [];
  const tecnicos = pessoas
    .map((u) => {
      const t = tempoDoTecnico.get(u.id);
      return {
        id: u.id,
        nome: u.nome,
        matricula: u.matricula,
        ativo: u.ativo,
        equipeNome: u.equipeNome,
        ...medidaOuVazia(t),
        aprs: aprsDoTecnico.get(u.id)?.aprs ?? 0,
        aprsBloqueadas: aprsDoTecnico.get(u.id)?.bloqueadas ?? 0,
        interrompidas: interrupcoesDoTecnico.get(u.id)?.total ?? 0,
      };
    })
    .sort((a, b) => b.execucoes - a.execucoes || b.aprs - a.aprs || a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    periodo: p.periodo,
    agrupamento: p.agrupamento,
    de: p.de,
    ate: p.ate,
    totais: {
      equipes: equipes.length,
      tecnicosAtivos: tecnicosAtivos.length,
      // O desempenho de cada colega não aparece para quem não acompanha a equipe.
      tecnicosComExecucao: pessoal ? tempo.porUsuario.length : null,
      execucoes: tempo.execucoes,
      tempoLiquidoMedioMin: tempo.tempoLiquidoMedioMin,
    },
    /** O tempo de execução do conjunto, com a pausa por motivo (a lista das OS com mais pausa fica no dashboard de OS). */
    tempo: (({ osComMaisPausa: _os, ...resto }) => resto)(semGrupos(tempo)),
    equipes: linhasDeEquipe,
    tecnicos: pessoal ? tecnicos : [],
    cadastro: f.comCadastro ? await estadoDoCadastro(db, f.equipeId) : null,
  };
}

/** Usuários ativos por perfil e os que ainda não conseguem trabalhar (sem assinatura, com senha provisória, sem equipe). */
async function estadoDoCadastro(db: Db, equipeId: string | undefined) {
  const daEquipeFiltrada = equipeId ? eq(usuario.equipeId, equipeId) : undefined;
  const ativo = eq(usuario.ativo, true);
  const [porPerfil, [contas], [equipesSemSupervisor]] = await Promise.all([
    db.select({ perfil: usuario.perfil, total: contagem }).from(usuario).where(and(ativo, daEquipeFiltrada)).groupBy(usuario.perfil),
    db
      .select({
        tecnicosSemAssinatura: contarSe(sql`${usuario.ativo} and ${usuario.perfil} = 'tecnico' and ${usuario.assinaturaPath} is null`),
        senhaProvisoria: contarSe(sql`${usuario.ativo} and ${usuario.senhaProvisoria}`),
        semEquipe: contarSe(sql`${usuario.ativo} and ${usuario.perfil} = 'tecnico' and ${usuario.equipeId} is null`),
        inativos: contarSe(sql`not ${usuario.ativo}`),
      })
      .from(usuario)
      .where(daEquipeFiltrada),
    db
      .select({ total: contagem })
      .from(equipe)
      .where(todas(isNull(equipe.supervisorId), equipeId ? eq(equipe.id, equipeId) : undefined)),
  ]);
  const perfis = Object.fromEntries(PERFIS.map((perfil) => [perfil, 0])) as Record<Perfil, number>;
  for (const l of porPerfil) perfis[l.perfil] = l.total;
  return { ativosPorPerfil: perfis, ...contas!, equipesSemSupervisor: equipesSemSupervisor!.total };
}

