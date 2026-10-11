import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/conexao";
import {
  alerta,
  apr,
  aprParticipante,
  aprResposta,
  aprRisco,
  equipe,
  eventoCampo,
  evidencia,
  execucao,
  execucaoAssinatura,
  execucaoPausa,
  itemModeloApr,
  localInstalacao,
  modeloApr,
  os,
  reprogramacao,
  riscoModeloApr,
  usuario,
  type OsStatus,
  OS_STATUS,
} from "../db/schema";
import { podeVerEquipe, type UsuarioAutenticado } from "../http/autenticacao";
import { conflito, naoEncontrado } from "../http/erros";
import { limiteEDeslocamento, type Paginacao } from "../http/paginacao";
import { enfileirarTarefa } from "../servicos/fila";
import {
  condicaoEscopo,
  diaBr,
  diaNoFuso,
  emMinutos,
  estaAtrasada,
  intervaloDoMes,
  ordenarPorInstante,
  padraoContem,
  tempoDaExecucao,
  todas,
} from "./painel-comum";

/** Execução aberta há mais de 12 h é destacada no quadro (Execução, "esquecida em andamento"). */
const LIMITE_EXECUCAO_ABERTA_MS = 12 * 3_600_000;

export interface FiltrosOs extends Paginacao {
  equipe_id?: string;
  tipo?: "corretiva" | "preventiva";
  critica?: boolean;
  periodo?: string;
  status?: OsStatus;
  numero_ordem?: string;
  busca?: string;
}

/** Condições do quadro; `comStatus: false` serve à contagem por coluna (mesmo filtro, sem o status). */
function condicoesDoQuadro(eu: UsuarioAutenticado, f: FiltrosOs, comStatus: boolean): SQL | undefined {
  let periodo: SQL | undefined;
  if (f.periodo) {
    const { inicio, fim } = intervaloDoMes(f.periodo);
    periodo = and(gte(os.dataInicioProg, inicio), lt(os.dataInicioProg, fim));
  }
  const busca = f.busca?.trim();
  return todas(
    condicaoEscopo(eu),
    f.equipe_id ? eq(os.equipeId, f.equipe_id) : undefined,
    f.tipo ? eq(os.tipo, f.tipo) : undefined,
    f.critica === undefined ? undefined : eq(localInstalacao.critico, f.critica),
    periodo,
    comStatus && f.status ? eq(os.status, f.status) : undefined,
    f.numero_ordem ? eq(os.numeroOrdem, f.numero_ordem.trim()) : undefined,
    busca
      ? or(
          ilike(os.numeroOrdem, padraoContem(busca)),
          ilike(os.titulo, padraoContem(busca)),
          ilike(os.equipamento, padraoContem(busca)),
          ilike(localInstalacao.codigo, padraoContem(busca)),
        )
      : undefined,
  );
}

/** Há quantas horas a Execução em andamento mais antiga de cada OS está aberta, só as acima do limite. */
async function execucoesAbertas(db: Db, osIds: string[], agora: Date): Promise<Map<string, number>> {
  const horas = new Map<string, number>();
  if (osIds.length === 0) return horas;
  const linhas = await db
    .select({ osId: execucao.osId, inicio: execucao.inicio })
    .from(execucao)
    .where(and(inArray(execucao.osId, osIds), isNull(execucao.resultado)));
  const maisAntiga = new Map<string, Date>();
  for (const l of linhas) {
    const atual = maisAntiga.get(l.osId);
    if (!atual || l.inicio < atual) maisAntiga.set(l.osId, l.inicio);
  }
  for (const [osId, inicio] of maisAntiga) {
    const ms = agora.getTime() - inicio.getTime();
    if (ms > LIMITE_EXECUCAO_ABERTA_MS) horas.set(osId, Math.floor(ms / 3_600_000));
  }
  return horas;
}

/** O quadro de OS: ordenado com as de local crítico primeiro e depois por `data_inicio_prog`. */
export async function listarOs(db: Db, eu: UsuarioAutenticado, filtros: FiltrosOs, agora: Date) {
  const hoje = diaNoFuso(agora);
  const onde = condicoesDoQuadro(eu, filtros, true);
  const { limit, offset } = limiteEDeslocamento(filtros);

  const linhas = await db
    .select({
      id: os.id,
      numeroOrdem: os.numeroOrdem,
      tipo: os.tipo,
      titulo: os.titulo,
      status: os.status,
      equipeId: os.equipeId,
      equipeNome: equipe.nome,
      localId: localInstalacao.id,
      localCodigo: localInstalacao.codigo,
      localCritico: localInstalacao.critico,
      equipamento: os.equipamento,
      prioridade: os.prioridade,
      dataInicioProg: os.dataInicioProg,
      dataFimProg: os.dataFimProg,
      pdfPath: os.pdfPath,
      cienciaEm: os.cienciaEm,
    })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .where(onde)
    .orderBy(desc(localInstalacao.critico), asc(os.dataInicioProg), asc(os.numeroOrdem), asc(os.id))
    .limit(limit)
    .offset(offset);

  const abertas = await execucoesAbertas(db, linhas.map((l) => l.id), agora);

  const [{ n: total } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(onde);

  const porStatus = await db
    .select({ status: os.status, n: sql<number>`count(*)::int` })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(condicoesDoQuadro(eu, filtros, false))
    .groupBy(os.status);
  const contagem = Object.fromEntries(OS_STATUS.map((s) => [s, 0])) as Record<OsStatus, number>;
  for (const l of porStatus) contagem[l.status] = l.n;

  return {
    itens: linhas.map((l) => ({
      id: l.id,
      numeroOrdem: l.numeroOrdem,
      tipo: l.tipo,
      titulo: l.titulo,
      status: l.status,
      equipeId: l.equipeId,
      equipeNome: l.equipeNome,
      localInstalacao: { id: l.localId, codigo: l.localCodigo, critico: l.localCritico },
      equipamento: l.equipamento,
      prioridade: l.prioridade,
      dataInicioProg: l.dataInicioProg,
      dataFimProg: l.dataFimProg,
      pdfPronto: l.pdfPath !== null,
      cienciaEm: l.cienciaEm,
      execucaoAbertaHaHoras: abertas.get(l.id) ?? null,
      atrasada: estaAtrasada(l, hoje),
    })),
    total,
    contagemPorStatus: contagem,
  };
}

/** A OS e o que o usuário pode saber dela: quem não vê a equipe da OS recebe `404`, como se não existisse. */
async function osVisivel(db: Db, eu: UsuarioAutenticado, osId: string) {
  const cienciaPor = alias(usuario, "ciencia_por_usuario");
  const [linha] = await db
    .select({
      os,
      local: localInstalacao,
      equipeNome: equipe.nome,
      equipeCentro: equipe.centroTrabalho,
      equipeSupervisorId: equipe.supervisorId,
      cienciaPorNome: cienciaPor.nome,
    })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .leftJoin(cienciaPor, eq(cienciaPor.id, os.cienciaPor))
    .where(eq(os.id, osId));
  if (!linha || !podeVerEquipe(eu, linha.os.equipeId)) throw naoEncontrado("OS não encontrada");
  return linha;
}

type Resposta = "sim" | "nao" | "na";

/** Item reprovado: `eliminatorio` com a resposta igual à `resposta_bloqueante` (APR). */
const reprovado = (tipo: string, resposta: Resposta, bloqueante: string | null) => tipo === "eliminatorio" && bloqueante !== null && resposta === bloqueante;

/** Todas as APRs da OS (bloqueadas e aprovadas), da mais antiga para a mais recente, com tudo o que a auditoria precisa. */
async function carregarAprs(db: Db, osId: string) {
  const linhas = await db
    .select({
      id: apr.id,
      osId: apr.osId,
      resultado: apr.resultado,
      observacaoGeral: apr.observacaoGeral,
      concluidaEm: apr.concluidaEm,
      preenchidaPorId: apr.preenchidaPor,
      preenchidaPorNome: usuario.nome,
      modeloCodigo: modeloApr.codigo,
      modeloVersao: modeloApr.versao,
      modeloTitulo: modeloApr.titulo,
    })
    .from(apr)
    .innerJoin(modeloApr, eq(modeloApr.id, apr.modeloAprId))
    .innerJoin(usuario, eq(usuario.id, apr.preenchidaPor))
    .where(eq(apr.osId, osId))
    .orderBy(asc(apr.concluidaEm), asc(apr.id));
  if (linhas.length === 0) return [];
  const ids = linhas.map((l) => l.id);

  const [participantes, riscos, respostas, fotos] = await Promise.all([
    db
      .select({
        aprId: aprParticipante.aprId,
        usuarioId: aprParticipante.usuarioId,
        nome: usuario.nome,
        matricula: usuario.matricula,
        funcao: aprParticipante.funcao,
        assinaturaPath: aprParticipante.assinaturaPath,
        assinadaEm: aprParticipante.assinadaEm,
      })
      .from(aprParticipante)
      .innerJoin(usuario, eq(usuario.id, aprParticipante.usuarioId))
      .where(inArray(aprParticipante.aprId, ids))
      .orderBy(asc(aprParticipante.funcao), asc(usuario.nome)),
    db
      .select({ aprId: aprRisco.aprId, id: riscoModeloApr.id, classificacao: riscoModeloApr.classificacao, nome: riscoModeloApr.nome })
      .from(aprRisco)
      .innerJoin(riscoModeloApr, eq(riscoModeloApr.id, aprRisco.riscoId))
      .where(inArray(aprRisco.aprId, ids))
      .orderBy(asc(riscoModeloApr.ordem)),
    db
      .select({
        aprId: aprResposta.aprId,
        itemId: itemModeloApr.id,
        secao: itemModeloApr.secao,
        ordem: itemModeloApr.ordem,
        texto: itemModeloApr.texto,
        tipo: itemModeloApr.tipo,
        evidencia: itemModeloApr.evidencia,
        respostaBloqueante: itemModeloApr.respostaBloqueante,
        riscoId: itemModeloApr.riscoId,
        resposta: aprResposta.resposta,
        observacao: aprResposta.observacao,
        respondidaEm: aprResposta.respondidaEm,
      })
      .from(aprResposta)
      .innerJoin(itemModeloApr, eq(itemModeloApr.id, aprResposta.itemId))
      .where(inArray(aprResposta.aprId, ids))
      .orderBy(asc(itemModeloApr.ordem)),
    db
      .select({
        id: evidencia.id,
        aprId: evidencia.aprId,
        itemId: evidencia.itemId,
        fotoPath: evidencia.fotoPath,
        capturadaEm: evidencia.capturadaEm,
        latitude: evidencia.latitude,
        longitude: evidencia.longitude,
      })
      .from(evidencia)
      .where(inArray(evidencia.aprId, ids))
      .orderBy(asc(evidencia.capturadaEm), asc(evidencia.id)),
  ]);

  return linhas.map((l) => {
    const completas = respostas
      .filter((r) => r.aprId === l.id)
      .map((r) => {
        const reprov = reprovado(r.tipo, r.resposta, r.respostaBloqueante);
        return {
          itemId: r.itemId,
          secao: r.secao,
          ordem: r.ordem,
          texto: r.texto,
          tipo: r.tipo,
          evidencia: r.evidencia,
          respostaBloqueante: r.respostaBloqueante,
          riscoId: r.riscoId,
          resposta: r.resposta,
          observacao: r.observacao,
          respondidaEm: r.respondidaEm,
          reprovado: reprov,
          alertaMarcado: r.tipo === "alerta" && r.respostaBloqueante !== null && r.resposta === r.respostaBloqueante,
        };
      });
    return {
      id: l.id,
      osId: l.osId,
      resultado: l.resultado,
      observacaoGeral: l.observacaoGeral,
      concluidaEm: l.concluidaEm,
      preenchidaPor: { id: l.preenchidaPorId, nome: l.preenchidaPorNome },
      modelo: { codigo: l.modeloCodigo, versao: l.modeloVersao, titulo: l.modeloTitulo },
      participantes: participantes
        .filter((p) => p.aprId === l.id)
        .map(({ aprId: _a, ...p }) => p),
      riscos: riscos.filter((r) => r.aprId === l.id).map(({ aprId: _a, ...r }) => r),
      respostas: completas,
      itensReprovados: completas
        .filter((r) => r.reprovado)
        .map((r) => ({
          itemId: r.itemId,
          texto: r.texto,
          resposta: r.resposta,
          observacao: r.observacao,
          tipo: r.tipo,
          evidencia: r.evidencia,
          fotos: fotos
            .filter((f) => f.aprId === l.id && f.itemId === r.itemId)
            .map((f) => ({ id: f.id, fotoPath: f.fotoPath, capturadaEm: f.capturadaEm, latitude: f.latitude, longitude: f.longitude })),
        })),
    };
  });
}

/** Execuções da OS, da mais antiga para a mais recente, com pausas, assinaturas, fotos e tempos. */
async function carregarExecucoes(db: Db, osId: string) {
  const linhas = await db
    .select({
      id: execucao.id,
      aprId: execucao.aprId,
      executorId: execucao.executorId,
      executorNome: usuario.nome,
      executorMatricula: usuario.matricula,
      numeroPessoas: execucao.numeroPessoas,
      inicio: execucao.inicio,
      fim: execucao.fim,
      resultado: execucao.resultado,
      descricaoAtividade: execucao.descricaoAtividade,
      motivo: execucao.motivo,
      dadosInspecao: execucao.dadosInspecao,
    })
    .from(execucao)
    .innerJoin(usuario, eq(usuario.id, execucao.executorId))
    .where(eq(execucao.osId, osId))
    .orderBy(asc(execucao.inicio), asc(execucao.id));
  if (linhas.length === 0) return [];
  const ids = linhas.map((l) => l.id);

  const [pausas, assinaturas, fotos] = await Promise.all([
    db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, ids)).orderBy(asc(execucaoPausa.inicio)),
    db
      .select({
        execucaoId: execucaoAssinatura.execucaoId,
        usuarioId: execucaoAssinatura.usuarioId,
        nome: usuario.nome,
        matricula: usuario.matricula,
        assinaturaPath: execucaoAssinatura.assinaturaPath,
        assinadaEm: execucaoAssinatura.assinadaEm,
      })
      .from(execucaoAssinatura)
      .innerJoin(usuario, eq(usuario.id, execucaoAssinatura.usuarioId))
      .where(inArray(execucaoAssinatura.execucaoId, ids))
      .orderBy(asc(usuario.nome)),
    db
      .select({
        id: evidencia.id,
        execucaoId: evidencia.execucaoId,
        fotoPath: evidencia.fotoPath,
        capturadaEm: evidencia.capturadaEm,
        latitude: evidencia.latitude,
        longitude: evidencia.longitude,
      })
      .from(evidencia)
      .where(inArray(evidencia.execucaoId, ids))
      .orderBy(asc(evidencia.capturadaEm), asc(evidencia.id)),
  ]);

  return linhas.map((l) => {
    const dela = pausas.filter((p) => p.execucaoId === l.id);
    const tempo = tempoDaExecucao(l, dela);
    return {
      id: l.id,
      aprId: l.aprId,
      executor: { id: l.executorId, nome: l.executorNome, matricula: l.executorMatricula },
      numeroPessoas: l.numeroPessoas,
      inicio: l.inicio,
      fim: l.fim,
      resultado: l.resultado,
      descricaoAtividade: l.descricaoAtividade,
      motivo: l.motivo,
      dadosInspecao: l.dadosInspecao,
      tempoLiquidoMin: tempo ? emMinutos(tempo.liquidoMs) : null,
      pausaMin: tempo ? emMinutos(tempo.pausaMs) : null,
      pausas: dela.map((p) => ({ id: p.id, inicio: p.inicio, fim: p.fim, motivo: p.motivo })),
      assinaturas: assinaturas.filter((a) => a.execucaoId === l.id).map(({ execucaoId: _e, ...a }) => a),
      fotos: fotos.filter((f) => f.execucaoId === l.id).map(({ execucaoId: _e, ...f }) => f),
    };
  });
}

/** Detalhe da OS: dados do SAP, APRs, execuções, alertas, reprogramações e a linha do tempo que une tudo. */
export async function detalharOs(db: Db, eu: UsuarioAutenticado, osId: string, agora: Date) {
  const { os: o, local, equipeNome, equipeCentro, equipeSupervisorId, cienciaPorNome } = await osVisivel(db, eu, osId);

  const equipeAnterior = alias(equipe, "equipe_anterior");
  const equipeNova = alias(equipe, "equipe_nova");
  const [aprs, execucoes, alertas, reprogramacoes, abertas, [suspeitos]] = await Promise.all([
    carregarAprs(db, osId),
    carregarExecucoes(db, osId),
    db
      .select({
        id: alerta.id,
        tipo: alerta.tipo,
        detalhe: alerta.detalhe,
        destinatarioId: alerta.destinatarioId,
        destinatarioNome: usuario.nome,
        emailEnviadoEm: alerta.emailEnviadoEm,
        lidoEm: alerta.lidoEm,
        criadoEm: alerta.criadoEm,
      })
      .from(alerta)
      .innerJoin(usuario, eq(usuario.id, alerta.destinatarioId))
      .where(eq(alerta.osId, osId))
      .orderBy(asc(alerta.criadoEm), asc(alerta.id)),
    db
      .select({
        id: reprogramacao.id,
        usuarioId: reprogramacao.usuarioId,
        usuarioNome: usuario.nome,
        dataAnterior: reprogramacao.dataAnterior,
        dataNova: reprogramacao.dataNova,
        equipeAnteriorId: reprogramacao.equipeAnteriorId,
        equipeAnteriorNome: equipeAnterior.nome,
        equipeNovaId: reprogramacao.equipeNovaId,
        equipeNovaNome: equipeNova.nome,
        justificativa: reprogramacao.justificativa,
        criadaEm: reprogramacao.criadaEm,
      })
      .from(reprogramacao)
      .innerJoin(usuario, eq(usuario.id, reprogramacao.usuarioId))
      .leftJoin(equipeAnterior, eq(equipeAnterior.id, reprogramacao.equipeAnteriorId))
      .leftJoin(equipeNova, eq(equipeNova.id, reprogramacao.equipeNovaId))
      .where(eq(reprogramacao.osId, osId))
      .orderBy(asc(reprogramacao.criadaEm), asc(reprogramacao.id)),
    execucoesAbertas(db, [osId], agora),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(eventoCampo)
      .where(and(eq(eventoCampo.osId, osId), sql`${eventoCampo.ocorridoEm} > ${eventoCampo.recebidoEm}`)),
  ]);

  const linhaDoTempo = montarLinhaDoTempo({ aprs, execucoes, alertas, reprogramacoes, cienciaEm: o.cienciaEm, cienciaPorNome });

  return {
    os: {
      ...o,
      localInstalacao: local,
      equipe: { id: o.equipeId, nome: equipeNome, centroTrabalho: equipeCentro, supervisorId: equipeSupervisorId },
      cienciaPorNome,
      pdfPronto: o.pdfPath !== null,
      execucaoAbertaHaHoras: abertas.get(osId) ?? null,
      atrasada: estaAtrasada(o, diaNoFuso(agora)),
      eventosComRelogioSuspeito: suspeitos?.n ?? 0,
    },
    aprs,
    execucoes,
    alertas,
    reprogramacoes,
    linhaDoTempo,
  };
}

const ROTULO_RESULTADO: Record<string, string> = {
  encerrada: "encerrada",
  interrompida: "interrompida",
  suspensa: "suspensa",
  cancelada: "cancelada",
};

/** Une APRs concluídas, execuções (início, fim e pausas), alertas, reprogramações e a ciência, em ordem cronológica. */
function montarLinhaDoTempo(d: {
  aprs: Awaited<ReturnType<typeof carregarAprs>>;
  execucoes: Awaited<ReturnType<typeof carregarExecucoes>>;
  alertas: { tipo: string; detalhe: string; criadoEm: Date }[];
  reprogramacoes: {
    usuarioNome: string;
    dataAnterior: string;
    dataNova: string;
    equipeAnteriorId: string | null;
    equipeAnteriorNome: string | null;
    equipeNovaId: string | null;
    equipeNovaNome: string | null;
    justificativa: string;
    criadaEm: Date;
  }[];
  cienciaEm: Date | null;
  cienciaPorNome: string | null;
}) {
  const itens: { em: Date; tipo: string; descricao: string }[] = [];

  for (const a of d.aprs) {
    itens.push({
      em: a.concluidaEm,
      tipo: "apr_concluida",
      descricao: `APR ${a.resultado} (${a.modelo.codigo} v${a.modelo.versao}) por ${a.preenchidaPor.nome}`,
    });
  }
  for (const e of d.execucoes) {
    itens.push({ em: e.inicio, tipo: "execucao_iniciada", descricao: `Execução iniciada por ${e.executor.nome}` });
    for (const p of e.pausas) {
      itens.push({ em: p.inicio, tipo: "pausa_iniciada", descricao: `Pausa iniciada${p.motivo ? ` (${p.motivo})` : ""}` });
      if (p.fim) itens.push({ em: p.fim, tipo: "pausa_encerrada", descricao: "Pausa encerrada" });
    }
    if (e.fim && e.resultado) {
      itens.push({
        em: e.fim,
        tipo: `execucao_${ROTULO_RESULTADO[e.resultado]}`,
        descricao: `Execução ${e.resultado} por ${e.executor.nome}${e.resultado === "interrompida" && e.motivo ? `: ${e.motivo}` : ""}`,
      });
    }
  }
  for (const a of d.alertas) itens.push({ em: a.criadoEm, tipo: "alerta", descricao: `Alerta ${a.tipo}: ${a.detalhe}` });
  for (const r of d.reprogramacoes) {
    const trocaEquipe = r.equipeAnteriorId !== r.equipeNovaId ? `; equipe de ${r.equipeAnteriorNome ?? "—"} para ${r.equipeNovaNome ?? "—"}` : "";
    itens.push({
      em: r.criadaEm,
      tipo: "reprogramacao",
      descricao: `Reprogramada de ${diaBr(r.dataAnterior)} para ${diaBr(r.dataNova)} por ${r.usuarioNome}${trocaEquipe}: ${r.justificativa}`,
    });
  }
  if (d.cienciaEm) itens.push({ em: d.cienciaEm, tipo: "ciencia", descricao: `Ciência do supervisor${d.cienciaPorNome ? ` ${d.cienciaPorNome}` : ""}` });

  return ordenarPorInstante(itens);
}

/** O histórico de APRs da OS (`GET /os/{id}/aprs`). */
export async function listarAprsDaOs(db: Db, eu: UsuarioAutenticado, osId: string) {
  await osVisivel(db, eu, osId);
  return carregarAprs(db, osId);
}

/**
 * Ciência do supervisor da equipe da OS encerrada. Grava `ciencia_por` e `ciencia_em` e enfileira a nova geração do
 * PDF (agora com a ciência), na mesma transação. A condição no `update` fecha a corrida entre dois cliques.
 */
export async function darCiencia(db: Db, eu: UsuarioAutenticado, osId: string, agora: Date) {
  return db.transaction(async (tx) => {
    const [atual] = await tx.select({ equipeId: os.equipeId, status: os.status, cienciaEm: os.cienciaEm }).from(os).where(eq(os.id, osId)).for("update");
    if (!atual || !podeVerEquipe(eu, atual.equipeId)) throw naoEncontrado("OS não encontrada");
    if (atual.status !== "encerrada") throw conflito("os_nao_encerrada", "Só é possível dar ciência em OS encerrada");
    if (atual.cienciaEm !== null) throw conflito("ciencia_ja_dada", "A ciência desta OS já foi dada");

    await tx.update(os).set({ cienciaPor: eu.id, cienciaEm: agora }).where(eq(os.id, osId));
    await enfileirarTarefa(tx as unknown as Db, "pdf_os", osId, agora);
    return { cienciaEm: agora };
  });
}
