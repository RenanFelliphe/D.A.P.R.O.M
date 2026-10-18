import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { alerta, apr, aprParticipante, ausencia, equipe, execucao, os, treinamentoServico, treinamentoServicoReporte, treinamentoServicoVersao, usuario, vitoriaPerguntaSemResposta } from "../db/schema";
import type { Deps } from "../deps";
import { ausentesEm } from "../dominio/ausencia";
import { representacoesEmVigor } from "../dominio/representacao";
import { diaEHoraDeSaoPaulo } from "../dominio/rh";
import { dataBr, diaDe } from "../dominio/tempo";
import { montarEmail, type LinhaDaSecao, type SecaoDoEmail } from "./email-modelo";
import { enfileirarTarefa } from "./fila";
import { rodapeDoEmail } from "./email-alerta";

/** Quantas linhas cada seção do resumo mostra; o resto vira "e mais N". */
const LINHAS_POR_SECAO = 10;

/** O resumo diário é uma categoria de e-mail como as outras: a pessoa o desliga no perfil. */
const resumoLigado = (desligadas: readonly string[]) => !desligadas.includes("resumo_diario");

/**
 * Agenda o resumo diário: a partir de `EMAIL_RESUMO_HORA` (de São Paulo), uma vez por dia, para cada pessoa ativa e liberada que
 * não desligou o resumo. `usuario.resumo_email_dia` marca o dia já agendado, na mesma transação que enfileira as tarefas (duas
 * instâncias ou um reinício não repetem). Sem servidor de e-mail não agenda nada. Devolve quantos agendou.
 */
export async function agendarResumosDiarios(deps: Deps): Promise<number> {
  if (!deps.email.configurado) return 0;
  const agora = deps.agora();
  const { dia, hora } = diaEHoraDeSaoPaulo(agora);
  if (hora < deps.config.emailResumoHora) return 0;
  return deps.db.transaction(async (transacao) => {
    const tx = transacao as unknown as Db;
    const marcadas = await tx
      .update(usuario)
      .set({ resumoEmailDia: dia })
      .where(
        and(
          eq(usuario.ativo, true),
          eq(usuario.liberacao, "liberado"),
          or(isNull(usuario.resumoEmailDia), sql`${usuario.resumoEmailDia} < ${dia}`),
          sql`not ('resumo_diario' = any(${usuario.emailsDesligados}))`,
        ),
      )
      .returning({ id: usuario.id });
    for (const { id } of marcadas) await enfileirarTarefa(tx, "email_resumo", id, agora);
    return marcadas.length;
  });
}

const linhas = <T>(itens: T[], total: number, linha: (x: T) => LinhaDaSecao): Pick<SecaoDoEmail, "linhas" | "mais"> => ({
  linhas: itens.map(linha),
  ...(total > itens.length ? { mais: total - itens.length } : {}),
});

const periodo = (inicio: string, retorno: string) => `${dataBr(inicio)} a ${dataBr(retorno)}`;

/**
 * O que espera pela pessoa hoje, em seções (só as que têm alguma coisa):
 * - quem supervisiona (titular ou representante no comando): as OS encerradas aguardando a ciência dela (menos as que ela mesma
 *   executou ou assinou), os pedidos de ausência e de fim antecipado a responder e as ausências vencidas da equipe;
 * - o admin: os cadastros aguardando liberação, as equipes sem supervisor, as OS devolvidas que ainda não saíram na planilha de
 *   baixa, as perguntas à Vitória sem tratamento e os problemas reportados nos treinamentos;
 * - todo mundo: as OS reservadas para a pessoa e ainda não iniciadas e a ausência que espera a confirmação dela.
 */
export async function montarResumo(deps: Deps, pessoa: { id: string; perfil: "tecnico" | "admin" }): Promise<SecaoDoEmail[]> {
  const { db } = deps;
  const painel = deps.config.painelUrl;
  const agora = deps.agora();
  const hoje = diaEHoraDeSaoPaulo(agora).dia;
  const secoes: SecaoDoEmail[] = [];

  // ---- quem supervisiona ----
  const titulares = (await db.select({ id: equipe.id }).from(equipe).where(eq(equipe.supervisorId, pessoa.id))).map((e) => e.id);
  const representadas = (await representacoesEmVigor(db, agora, { representanteId: pessoa.id })).map((r) => r.equipeId);
  const supervisionadas = [...new Set([...titulares, ...representadas])];
  if (supervisionadas.length > 0) {
    // O supervisor assina por último mesmo que tenha participado do serviço (Reunião 3).
    const semCiencia = and(inArray(os.equipeId, supervisionadas), eq(os.status, "aguardando_supervisor"));
    const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(os).where(semCiencia);
    if (total > 0) {
      const encerradas = await db
        .select({ id: os.id, numero: os.numeroOrdem, titulo: os.titulo, fim: sql<Date | null>`(select max(${execucao.fim}) from ${execucao} where ${execucao.osId} = ${os.id} and ${execucao.resultado} = 'encerrada')` })
        .from(os)
        .where(semCiencia)
        .orderBy(asc(os.dataInicioProg), asc(os.id))
        .limit(LINHAS_POR_SECAO);
      secoes.push({
        titulo: `OS aguardando a sua assinatura (${total})`,
        ...linhas(encerradas, total, (o) => ({ texto: `OS ${o.numero ?? "de apoio"} — ${o.titulo}${o.fim ? ` (encerrada em ${dataBr(diaDe(new Date(o.fim)))})` : ""}`, url: `${painel}/app/os/${o.id}` })),
      });
    }

    const pessoaDaAusencia = sql<string>`(select ${usuario.nome} from ${usuario} where ${usuario.id} = ${ausencia.usuarioId})`;
    const daEquipe = and(inArray(ausencia.equipeId, supervisionadas), ne(ausencia.usuarioId, pessoa.id));
    const pedidos = await db
      .select({ nome: pessoaDaAusencia, inicio: ausencia.inicio, retorno: ausencia.retorno, equipeId: ausencia.equipeId, fim: ausencia.fimPedidoData, estado: ausencia.estado })
      .from(ausencia)
      .where(and(daEquipe, or(eq(ausencia.estado, "pedida"), and(eq(ausencia.estado, "confirmada"), isNotNull(ausencia.fimPedidoEm)))))
      .orderBy(asc(ausencia.criadaEm));
    if (pedidos.length > 0) {
      secoes.push({
        titulo: `Pedidos de ausência a responder (${pedidos.length})`,
        ...linhas(pedidos.slice(0, LINHAS_POR_SECAO), pedidos.length, (p) => ({
          texto: p.estado === "pedida" ? `${p.nome}: ausência de ${periodo(p.inicio, p.retorno)}` : `${p.nome}: fim antecipado para ${p.fim ? dataBr(p.fim) : "uma data mais cedo"}`,
          url: `${painel}/app/equipes/${p.equipeId}#ausencias`,
        })),
      });
    }
    const vencidas = await db
      .select({ nome: pessoaDaAusencia, retorno: ausencia.retorno, equipeId: ausencia.equipeId })
      .from(ausencia)
      .where(and(daEquipe, eq(ausencia.estado, "confirmada"), lte(ausencia.retorno, hoje)))
      .orderBy(asc(ausencia.retorno));
    if (vencidas.length > 0) {
      secoes.push({
        titulo: `Ausências vencidas, sem retorno confirmado (${vencidas.length})`,
        ...linhas(vencidas.slice(0, LINHAS_POR_SECAO), vencidas.length, (v) => ({ texto: `${v.nome}: retorno previsto para ${dataBr(v.retorno)}`, url: `${painel}/app/equipes/${v.equipeId}#ausencias` })),
      });
    }
  }

  // ---- o admin ----
  if (pessoa.perfil === "admin") {
    const pendentes = await db
      .select({ id: usuario.id, nome: usuario.nome, criadoEm: usuario.criadoEm })
      .from(usuario)
      .where(and(eq(usuario.liberacao, "pendente"), eq(usuario.ativo, true)))
      .orderBy(asc(usuario.criadoEm), asc(usuario.nome));
    if (pendentes.length > 0) {
      secoes.push({
        titulo: `Cadastros aguardando a liberação (${pendentes.length})`,
        ...linhas(pendentes.slice(0, LINHAS_POR_SECAO), pendentes.length, (u) => ({ texto: u.nome, url: `${painel}/app/perfil/${u.id}` })),
      });
    }
    const semSupervisor = await db.select({ id: equipe.id, nome: equipe.nome }).from(equipe).where(isNotNull(equipe.semSupervisorAvisadoEm)).orderBy(asc(equipe.nome));
    if (semSupervisor.length > 0) {
      secoes.push({
        titulo: `Equipes sem supervisor (${semSupervisor.length})`,
        ...linhas(semSupervisor.slice(0, LINHAS_POR_SECAO), semSupervisor.length, (e) => ({ texto: e.nome, url: `${painel}/app/equipes/${e.id}` })),
      });
    }
    const devolvidas = await db
      .select({ id: os.id, numero: os.numeroOrdem, titulo: os.titulo })
      .from(os)
      .where(and(eq(os.status, "devolvida"), isNull(os.devolucaoExportadaEm)))
      .orderBy(asc(os.devolvidaEm));
    if (devolvidas.length > 0) {
      secoes.push({
        titulo: `OS devolvidas que ainda não saíram na planilha de baixa (${devolvidas.length})`,
        ...linhas(devolvidas.slice(0, LINHAS_POR_SECAO), devolvidas.length, (o) => ({ texto: `OS ${o.numero ?? "de apoio"} — ${o.titulo}`, url: `${painel}/app/os/${o.id}` })),
      });
    }
    const [{ perguntas } = { perguntas: 0 }] = await db.select({ perguntas: count() }).from(vitoriaPerguntaSemResposta).where(isNull(vitoriaPerguntaSemResposta.tratadaEm));
    if (perguntas > 0) {
      secoes.push({ titulo: "Perguntas que a Vitória não soube responder", linhas: [{ texto: `${perguntas} sem tratamento`, url: `${painel}/app/vitoria/sem-resposta` }] });
    }
    const reportes = await db
      .select({ codigo: treinamentoServico.atividadeCodigo, n: count() })
      .from(treinamentoServicoReporte)
      .innerJoin(treinamentoServicoVersao, eq(treinamentoServicoVersao.id, treinamentoServicoReporte.versaoId))
      .innerJoin(treinamentoServico, eq(treinamentoServico.id, treinamentoServicoVersao.treinamentoId))
      .where(isNull(treinamentoServicoReporte.tratadoEm))
      .groupBy(treinamentoServico.atividadeCodigo)
      .orderBy(desc(count()), asc(treinamentoServico.atividadeCodigo));
    if (reportes.length > 0) {
      const total = reportes.reduce((s, r) => s + r.n, 0);
      secoes.push({
        titulo: `Problemas reportados nos treinamentos (${total})`,
        ...linhas(reportes.slice(0, LINHAS_POR_SECAO), reportes.length, (r) => ({
          texto: `Serviço ${r.codigo}: ${r.n} ${r.n === 1 ? "problema" : "problemas"}`,
          url: `${painel}/app/catalogo/servicos/${encodeURIComponent(r.codigo)}/treinamento`,
        })),
      });
    }
  }

  // ---- todo mundo ----
  const reservadas = await db
    .select({ id: os.id, numero: os.numeroOrdem, titulo: os.titulo, data: os.dataInicioProg })
    .from(os)
    .where(and(eq(os.responsavelId, pessoa.id), inArray(os.status, ["liberada", "pendente"])))
    .orderBy(asc(os.dataInicioProg), asc(os.id));
  if (reservadas.length > 0) {
    secoes.push({
      titulo: `OS reservadas para você (${reservadas.length})`,
      ...linhas(reservadas.slice(0, LINHAS_POR_SECAO), reservadas.length, (o) => ({ texto: `OS ${o.numero ?? "de apoio"} — ${o.titulo} (programada para ${dataBr(o.data)})`, url: `${painel}/app/os/${o.id}` })),
    });
  }
  const aConfirmar = await db
    .select({ inicio: ausencia.inicio, retorno: ausencia.retorno })
    .from(ausencia)
    .where(and(eq(ausencia.usuarioId, pessoa.id), eq(ausencia.estado, "aguardando_confirmacao")));
  if (aConfirmar.length > 0) {
    secoes.push({
      titulo: "Ausência aguardando a sua confirmação",
      linhas: aConfirmar.map((a) => ({ texto: `Ausência de ${periodo(a.inicio, a.retorno)}: confirme ou recuse as datas`, url: `${painel}/app/perfil#ausencias` })),
    });
  }
  return secoes;
}

/**
 * Tarefa `email_resumo`: `referenciaId` é o `usuario.id`. Monta o resumo do dia e envia, se houver alguma coisa esperando pela
 * pessoa. Não envia a quem está ausente (a pessoa de férias não precisa de um e-mail por dia), a quem desligou o resumo depois
 * do agendamento nem sem servidor de e-mail.
 */
export async function manipularEmailResumo(deps: Deps, tarefa: { id: string; referenciaId: string | null }): Promise<void> {
  if (!tarefa.referenciaId || !deps.email.configurado) return;
  const { db } = deps;
  const [pessoa] = await db
    .select({ id: usuario.id, email: usuario.email, perfil: usuario.perfil, ativo: usuario.ativo, liberacao: usuario.liberacao, emailsDesligados: usuario.emailsDesligados })
    .from(usuario)
    .where(eq(usuario.id, tarefa.referenciaId));
  if (!pessoa || !pessoa.ativo || pessoa.liberacao !== "liberado" || !resumoLigado(pessoa.emailsDesligados)) return;
  const hoje = diaEHoraDeSaoPaulo(deps.agora()).dia;
  if ((await ausentesEm(db, [pessoa.id], hoje)).has(pessoa.id)) return;

  const secoes = await montarResumo(deps, pessoa);
  if (secoes.length === 0) return;

  const [{ naoLidos } = { naoLidos: 0 }] = await db
    .select({ naoLidos: count() })
    .from(alerta)
    .where(and(eq(alerta.destinatarioId, pessoa.id), isNull(alerta.lidoEm)));
  const { texto, html } = montarEmail({
    titulo: `O que espera por você hoje, ${dataBr(hoje)}`,
    paragrafos: [naoLidos > 0 ? `Você também tem ${naoLidos} ${naoLidos === 1 ? "aviso não lido" : "avisos não lidos"} no sino.` : "Este é o resumo do dia; os avisos de cada coisa continuam no sino."],
    secoes,
    botao: { texto: "Abrir o SYNQ OS", url: `${deps.config.painelUrl}/app/lista` },
    rodape: rodapeDoEmail("resumo_diario", deps.config.painelUrl),
  });
  await deps.email.enviar({ para: pessoa.email, assunto: `[SYNQ OS] Resumo do dia ${dataBr(hoje)}`, texto, html });
}

