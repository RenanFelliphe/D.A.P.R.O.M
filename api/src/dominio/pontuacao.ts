import { and, eq, inArray, lt, lte, ne } from "drizzle-orm";
import { apr, aprParticipante, execucao, localInstalacao, os, planoPreventiva, reprogramacao, usuario } from "../db/schema";
import { concederConquistas } from "./conquistas";
import { lancar, type ContextoDePontos, type Entrada, type Ganho } from "./lancamentos";
import { diaDe } from "./tempo";

/**
 * As regras de pontuação (seção 2 do `gameficacao.md`), calculadas só no servidor a partir dos registros gravados e na mesma
 * transação que os grava. Cada função lê o que precisa do banco e lança no extrato; reenviar um evento não pontua de novo
 * (a chave de cada lançamento é única por pessoa).
 *
 * A regra central: a segurança nunca custa pontos. A APR bloqueada vale o mesmo que a aprovada (com a evidência) e a execução
 * interrompida por risco vale o mesmo que a encerrada, com os mesmos bônus; nenhuma regra olha a resposta de um item da APR.
 */

export const HORAS_DA_CIENCIA = 72;
/** Conta com menos que isto é de um "técnico novo" (bônus de quem o acompanha). */
export const DIAS_DO_TECNICO_NOVO = 60;
const DIA_MS = 86_400_000;

/** Depois de lançar: confere as conquistas de quem pontuou e das equipes creditadas (no preenchimento do histórico, só no fim). */
async function concluir(c: ContextoDePontos, ganhos: Ganho[]): Promise<Ganho[]> {
  if (ganhos.length === 0 || c.historico) return ganhos;
  const conquistas = await concederConquistas(c, { usuarios: ganhos.map((g) => g.usuarioId), equipes: ganhos.flatMap((g) => g.equipes) });
  return [...ganhos, ...conquistas.ganhos];
}

/** Quem participou da APR e joga: os técnicos (o admin não pontua). */
async function participantesDaApr(c: ContextoDePontos, aprId: string) {
  return c.tx
    .select({ usuarioId: aprParticipante.usuarioId, funcao: aprParticipante.funcao, criadoEm: usuario.criadoEm })
    .from(aprParticipante)
    .innerJoin(usuario, eq(usuario.id, aprParticipante.usuarioId))
    .where(and(eq(aprParticipante.aprId, aprId), eq(usuario.perfil, "tecnico")));
}

/**
 * APR completa, responsável pela APR e técnico novo acompanhado. A aprovada pontua ao chegar com as assinaturas; a bloqueada,
 * quando chega a evidência dos itens reprovados (`evidenciaCompleta`): sem ela não pontua, o que também incentiva enviá-la.
 * `quando` é o evento que completou a APR.
 */
export async function pontuarApr(c: ContextoDePontos, aprId: string, quando: Date, opcoes: { evidenciaCompleta?: boolean } = {}): Promise<Ganho[]> {
  const [a] = await c.tx.select({ id: apr.id, osId: apr.osId, resultado: apr.resultado, concluidaEm: apr.concluidaEm }).from(apr).where(eq(apr.id, aprId));
  if (!a) return [];
  if (a.resultado === "bloqueada" && !opcoes.evidenciaCompleta) return [];

  const participantes = await participantesDaApr(c, aprId);
  const entradas: Entrada[] = participantes.map((p) => ({ usuarioId: p.usuarioId, regra: "apr_completa", chave: `apr:${a.osId}`, osId: a.osId, ocorridoEm: quando }));

  const responsavel = participantes.find((p) => p.funcao === "responsavel");
  if (responsavel) {
    entradas.push({ usuarioId: responsavel.usuarioId, regra: "responsavel_apr", chave: `responsavel:${a.osId}`, osId: a.osId, ocorridoEm: quando });
    // Outro participante com a conta há menos de 60 dias (contas anteriores ao registro da criação não contam como novas).
    const limite = a.concluidaEm.getTime() - DIAS_DO_TECNICO_NOVO * DIA_MS;
    const temNovo = participantes.some((p) => p.usuarioId !== responsavel.usuarioId && p.criadoEm !== null && p.criadoEm.getTime() > limite);
    if (temNovo) entradas.push({ usuarioId: responsavel.usuarioId, regra: "tecnico_novo", chave: `tecnico_novo:${a.osId}`, osId: a.osId, ocorridoEm: quando });
  }
  return concluir(c, await lancar(c, entradas));
}

/**
 * Preventiva encerrada em dia: até a data limite (o fim programado, senão o início, como no indicador de preventivas) ou
 * depois dela com atraso justificado (a OS ficou pendente antes da data, ou foi reprogramada).
 */
async function preventivaEmDia(c: ContextoDePontos, ordem: { id: string; dataInicioProg: string; dataFimProg: string | null }, fim: Date): Promise<boolean> {
  const limite = ordem.dataFimProg ?? ordem.dataInicioProg;
  if (diaDe(fim) <= limite) return true;
  const [reprogramada] = await c.tx.select({ id: reprogramacao.id }).from(reprogramacao).where(eq(reprogramacao.osId, ordem.id)).limit(1);
  if (reprogramada) return true;
  const bloqueadas = await c.tx.select({ em: apr.concluidaEm }).from(apr).where(and(eq(apr.osId, ordem.id), eq(apr.resultado, "bloqueada")));
  if (bloqueadas.some((b) => diaDe(b.em) <= limite)) return true;
  const paradas = await c.tx
    .select({ fim: execucao.fim })
    .from(execucao)
    .where(and(eq(execucao.osId, ordem.id), inArray(execucao.resultado, ["interrompida", "suspensa"])));
  return paradas.some((p) => p.fim !== null && diaDe(p.fim) <= limite);
}

/**
 * Quem participou das tentativas anteriores da OS (as APRs concluídas antes da que amparou esta execução), e se alguma
 * delas deixou a OS pendente por bloqueio ou por interrupção: é o que o resgate exige.
 */
async function tentativasAnteriores(c: ContextoDePontos, e: { id: string; osId: string; aprId: string; inicio: Date }, concluidaEm: Date) {
  const anteriores = await c.tx
    .select({ aprId: apr.id, resultado: apr.resultado })
    .from(apr)
    .where(and(eq(apr.osId, e.osId), ne(apr.id, e.aprId), lt(apr.concluidaEm, concluidaEm)));
  const participaram = new Set<string>();
  if (anteriores.length > 0) {
    const linhas = await c.tx.select({ usuarioId: aprParticipante.usuarioId }).from(aprParticipante).where(inArray(aprParticipante.aprId, anteriores.map((x) => x.aprId)));
    for (const l of linhas) participaram.add(l.usuarioId);
  }
  const interrompidas = await c.tx
    .select({ id: execucao.id })
    .from(execucao)
    .where(and(eq(execucao.osId, e.osId), ne(execucao.id, e.id), eq(execucao.resultado, "interrompida"), lte(execucao.fim, e.inicio)))
    .limit(1);
  const pendente = anteriores.some((x) => x.resultado === "bloqueada") || interrompidas.length > 0;
  return { pendente, participaram };
}

/**
 * Execução concluída (encerrada com as assinaturas ou interrompida por risco), com os bônus da OS: preventiva concluída (a
 * preventiva vale o dobro da corretiva, também para quem interrompeu por risco), local crítico, resgate, apoio a outra equipe e,
 * quando a preventiva fecha em dia, preventiva em dia (que vai também a quem interrompeu por risco).
 * Quem recebe é todo participante da APR que amparou a execução. `quando` é o fim da execução.
 */
export async function pontuarExecucao(c: ContextoDePontos, execucaoId: string, quando: Date): Promise<Ganho[]> {
  const [e] = await c.tx
    .select({
      id: execucao.id,
      osId: execucao.osId,
      aprId: execucao.aprId,
      resultado: execucao.resultado,
      inicio: execucao.inicio,
      fim: execucao.fim,
      tipo: os.tipo,
      origem: os.origem,
      dataInicioProg: os.dataInicioProg,
      dataFimProg: os.dataFimProg,
      critico: localInstalacao.critico,
      aprConcluidaEm: apr.concluidaEm,
    })
    .from(execucao)
    .innerJoin(os, eq(os.id, execucao.osId))
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .innerJoin(apr, eq(apr.id, execucao.aprId))
    .where(eq(execucao.id, execucaoId));
  if (!e || (e.resultado !== "encerrada" && e.resultado !== "interrompida")) return [];

  const participantes = await participantesDaApr(c, e.aprId);
  const entradas: Entrada[] = [];
  const dar = (usuarioId: string, regra: Entrada["regra"], chave: string) => entradas.push({ usuarioId, regra, chave: `${chave}:${e.osId}`, osId: e.osId, ocorridoEm: quando });

  for (const p of participantes) {
    dar(p.usuarioId, "execucao_concluida", "execucao");
    if (e.tipo === "preventiva") dar(p.usuarioId, "preventiva_concluida", "preventiva_concluida");
    if (e.critico) dar(p.usuarioId, "local_critico", "local_critico");
    if (e.origem === "apoio") dar(p.usuarioId, "apoio", "apoio");
  }

  const { pendente, participaram } = await tentativasAnteriores(c, e, e.aprConcluidaEm);
  if (pendente) for (const p of participantes) if (!participaram.has(p.usuarioId)) dar(p.usuarioId, "resgate", "resgate");

  if (e.resultado === "encerrada" && e.tipo === "preventiva" && e.fim && (await preventivaEmDia(c, { id: e.osId, dataInicioProg: e.dataInicioProg, dataFimProg: e.dataFimProg }, e.fim))) {
    // Todos os que concluíram a execução na OS, também quem interrompeu por risco antes: parar não custa pontos.
    const execucoes = await c.tx
      .select({ aprId: execucao.aprId })
      .from(execucao)
      .where(and(eq(execucao.osId, e.osId), inArray(execucao.resultado, ["encerrada", "interrompida"])));
    const doGrupo = new Set<string>();
    for (const x of execucoes) for (const p of await participantesDaApr(c, x.aprId)) doGrupo.add(p.usuarioId);
    for (const usuarioId of doGrupo) dar(usuarioId, "preventiva_em_dia", "preventiva");
  }
  return concluir(c, await lancar(c, entradas));
}

/** Ciência no prazo (supervisor): até 72 horas depois do encerramento da OS; uma por OS. */
export async function pontuarCiencia(c: ContextoDePontos, osId: string, usuarioId: string, cienciaEm: Date): Promise<Ganho[]> {
  const encerradas = await c.tx
    .select({ fim: execucao.fim })
    .from(execucao)
    .where(and(eq(execucao.osId, osId), eq(execucao.resultado, "encerrada")))
    .orderBy(execucao.fim)
    .limit(1);
  const fim = encerradas[0]?.fim;
  if (!fim || cienciaEm.getTime() - fim.getTime() > HORAS_DA_CIENCIA * 3_600_000) return [];
  return concluir(c, await lancar(c, [{ usuarioId, regra: "ciencia_no_prazo", chave: `ciencia:${osId}`, osId, ocorridoEm: cienciaEm }]));
}

/** Intervalo de preventiva definido (supervisor), num plano que estava sem; uma por plano. */
export async function pontuarIntervalo(c: ContextoDePontos, planoId: string, usuarioId: string, quando: Date): Promise<Ganho[]> {
  const [p] = await c.tx.select({ id: planoPreventiva.id }).from(planoPreventiva).where(eq(planoPreventiva.id, planoId));
  if (!p) return [];
  return concluir(c, await lancar(c, [{ usuarioId, regra: "intervalo_definido", chave: `intervalo:${planoId}`, ocorridoEm: quando }]));
}

/** Boas-vindas: a assinatura cadastrada no perfil (uma por conta). */
export const pontuarAssinatura = async (c: ContextoDePontos, usuarioId: string, quando: Date): Promise<Ganho[]> =>
  concluir(c, await lancar(c, [{ usuarioId, regra: "assinatura_cadastrada", chave: "assinatura", ocorridoEm: quando }]));

/** Boas-vindas: o Campo de treino concluído (um por conta). */
export const pontuarTreinamento = async (c: ContextoDePontos, usuarioId: string, quando: Date): Promise<Ganho[]> =>
  concluir(c, await lancar(c, [{ usuarioId, regra: "treinamento_concluido", chave: "treinamento", ocorridoEm: quando }]));

/**
 * Treinamento de serviço concluído, com as fases certas (até 10, pela primeira resposta de cada uma): no máximo 15 pontos
 * por treinamento. Só a primeira conclusão de cada treinamento chega aqui (o domínio do jogo confere antes de chamar).
 */
export async function pontuarTreinamentoServico(c: ContextoDePontos, usuarioId: string, treinamentoId: string, fasesCertas: number, quando: Date): Promise<Ganho[]> {
  const entradas: Entrada[] = [{ usuarioId, regra: "treinamento_servico_concluido", chave: `treinamento_servico:${treinamentoId}`, ocorridoEm: quando }];
  if (fasesCertas > 0) {
    const pontos = Math.min(fasesCertas, 10);
    entradas.push({ usuarioId, regra: "treinamento_servico_fases", chave: `treinamento_servico_fases:${treinamentoId}`, pontos, nome: `${pontos} fase(s) certa(s)`, ocorridoEm: quando });
  }
  return concluir(c, await lancar(c, entradas));
}
