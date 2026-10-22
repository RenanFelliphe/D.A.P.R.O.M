import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
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
  climaRegistro,
  evidencia,
  execucao,
  execucaoAssinatura,
  execucaoPausa,
  execucaoPedido,
  execucaoPedidoApoio,
  itemModeloApr,
  localInstalacao,
  modeloApr,
  os,
  osDigitalizacao,
  osDigitalizacaoApr,
  reprogramacao,
  riscoModeloApr,
  usuario,
  type OsStatus,
  OS_STATUS,
} from "../db/schema";
import { podeSupervisionarEquipe, podeVerEquipe, type UsuarioAutenticado } from "../http/autenticacao";
import { conflito, naoEncontrado, proibido } from "../http/erros";
import { limiteEDeslocamento, type Paginacao } from "../http/paginacao";
import { enfileirarTarefa } from "../servicos/fila";
import { reservasDesfeitasPorAusencia } from "./ausencia";
import { buscaDeOs } from "./busca";
import { checklistsDasOs } from "./checklist-inspecao";
import { conferenciaEsperandoDados, conferenciasDaOs } from "./conferencia-execucao";
import { servicoDaAtividade } from "./catalogo";
import { climaParaApi } from "./clima-registro";
import { colunasDeEvidencia, separarEvidencias } from "./evidencias";
import { ganhosDe } from "./lancamentos";
import { assinaturaDoAto } from "./assinatura";
import { ROTULO_DA_PAUSA, ROTULO_DA_SUSPENSAO, descreverMotivo } from "./motivos-de-parada";
import { fecharPedidosVencidos } from "./pedidos-execucao";
import { pontuarCiencia } from "./pontuacao";
import { recalcularStatusOs } from "./status-os";
import {
  condicaoEscopo,
  diaBr,
  diaNoFuso,
  emMinutos,
  estaAtrasada,
  intervaloDoMes,
  ordenarPorInstante,
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
  /** `true`: já exportada para o SAP; `false`: ainda não (a pré-visualização da exportação). */
  exportada?: boolean;
  numero_ordem?: string;
  /** Número, título, código do local, nota ou cliente (ver `dominio/busca.ts`). */
  busca?: string;
  /** `prioridade` (padrão): da mais alta à mais baixa; `data_limite`: do prazo mais próximo ao mais distante. */
  ordem?: "prioridade" | "data_limite";
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
    f.exportada === undefined ? undefined : f.exportada ? isNotNull(os.exportadaSapEm) : isNull(os.exportadaSapEm),
    f.numero_ordem ? eq(os.numeroOrdem, f.numero_ordem.trim()) : undefined,
    busca ? buscaDeOs(busca) : undefined,
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

/** Peso da prioridade do SAP (texto livre): Muito alto 4, Alto 3, Médio 2, Baixo 1; sem prioridade ou desconhecida, 0. */
const pesoDaPrioridade = sql`case lower(${os.prioridade}) when 'muito alto' then 4 when 'alto' then 3 when 'médio' then 2 when 'medio' then 2 when 'baixo' then 1 else 0 end`;

/** O quadro de OS, por prioridade (padrão) ou por data limite; em ambos, local crítico, número e id desempatam. */
export async function listarOs(db: Db, eu: UsuarioAutenticado, filtros: FiltrosOs, agora: Date) {
  const hoje = diaNoFuso(agora);
  const responsavel = alias(usuario, "responsavel_usuario");
  const onde = condicoesDoQuadro(eu, filtros, true);
  const { limit, offset } = limiteEDeslocamento(filtros);

  const linhas = await db
    .select({
      id: os.id,
      numeroOrdem: os.numeroOrdem,
      numeroNota: os.numeroNota,
      tipo: os.tipo,
      titulo: os.titulo,
      status: os.status,
      equipeId: os.equipeId,
      equipeNome: equipe.nome,
      localId: localInstalacao.id,
      localCodigo: localInstalacao.codigo,
      localCliente: localInstalacao.cliente,
      localCritico: localInstalacao.critico,
      equipamento: os.equipamento,
      prioridade: os.prioridade,
      dataInicioProg: os.dataInicioProg,
      dataFimProg: os.dataFimProg,
      pdfPath: os.pdfPath,
      cienciaEm: os.cienciaEm,
      responsavelId: os.responsavelId,
      responsavelNome: responsavel.nome,
    })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .leftJoin(responsavel, eq(responsavel.id, os.responsavelId))
    .where(onde)
    .orderBy(
      ...(filtros.ordem === "data_limite"
        ? [asc(sql`coalesce(${os.dataFimProg}, ${os.dataInicioProg})`), desc(pesoDaPrioridade)]
        : [desc(pesoDaPrioridade), asc(sql`coalesce(${os.dataFimProg}, ${os.dataInicioProg})`)]),
      desc(localInstalacao.critico),
      asc(os.numeroOrdem),
      asc(os.id),
    )
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
      numeroNota: l.numeroNota,
      tipo: l.tipo,
      titulo: l.titulo,
      status: l.status,
      equipeId: l.equipeId,
      equipeNome: l.equipeNome,
      localInstalacao: { id: l.localId, codigo: l.localCodigo, cliente: l.localCliente, critico: l.localCritico },
      equipamento: l.equipamento,
      prioridade: l.prioridade,
      dataInicioProg: l.dataInicioProg,
      dataFimProg: l.dataFimProg,
      pdfPronto: l.pdfPath !== null,
      cienciaEm: l.cienciaEm,
      /** A pessoa para quem o supervisor reservou a OS (atribuição individual); `null` = a OS é da equipe toda. */
      responsavel: l.responsavelId && l.responsavelNome ? { id: l.responsavelId, nome: l.responsavelNome } : null,
      execucaoAbertaHaHoras: abertas.get(l.id) ?? null,
      atrasada: estaAtrasada(l, hoje),
    })),
    total,
    contagemPorStatus: contagem,
  };
}

/** A OS e o que o usuário pode saber dela: quem não vê a equipe da OS recebe `404`, como se não existisse. */
export async function osVisivel(db: Db, eu: UsuarioAutenticado, osId: string) {
  const cienciaPor = alias(usuario, "ciencia_por_usuario");
  const responsavel = alias(usuario, "responsavel_usuario");
  const reservadaPor = alias(usuario, "reservada_por_usuario");
  const devolvidaPor = alias(usuario, "devolvida_por_usuario");
  const [linha] = await db
    .select({
      os,
      local: localInstalacao,
      equipeNome: equipe.nome,
      equipeCentro: equipe.centroTrabalho,
      equipeSupervisorId: equipe.supervisorId,
      cienciaPorNome: cienciaPor.nome,
      responsavelNome: responsavel.nome,
      reservadaPorNome: reservadaPor.nome,
      devolvidaPorNome: devolvidaPor.nome,
    })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .leftJoin(cienciaPor, eq(cienciaPor.id, os.cienciaPor))
    .leftJoin(responsavel, eq(responsavel.id, os.responsavelId))
    .leftJoin(reservadaPor, eq(reservadaPor.id, os.reservadaPor))
    .leftJoin(devolvidaPor, eq(devolvidaPor.id, os.devolvidaPor))
    .where(eq(os.id, osId));
  if (!linha || !podeVerEquipe(eu, linha.os.equipeId)) throw naoEncontrado("OS não encontrada");
  return linha;
}

type Resposta = "sim" | "nao" | "na";

/** Item reprovado: `eliminatorio` com a resposta igual à `resposta_bloqueante` (APR). */
const reprovado = (tipo: string, resposta: Resposta, bloqueante: string | null) => tipo === "eliminatorio" && bloqueante !== null && resposta === bloqueante;

/**
 * Todas as APRs da OS (bloqueadas e aprovadas), da mais antiga para a mais recente, com tudo o que a auditoria precisa.
 * Só o admin vê o que é eliminatório ou de alerta (`tipo`, `evidencia`, `resposta_bloqueante`, `alerta_marcado`); o
 * técnico fica sabendo apenas quais itens reprovaram, depois que a APR é validada.
 */
async function carregarAprs(db: Db, osId: string, comClassificacao: boolean) {
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

  const climas = await db.select().from(climaRegistro).where(inArray(climaRegistro.aprId, ids));
  const [participantes, riscos, respostas, arquivos] = await Promise.all([
    db
      .select({
        aprId: aprParticipante.aprId,
        usuarioId: aprParticipante.usuarioId,
        nome: usuario.nome,
        matricula: usuario.matricula,
        funcao: aprParticipante.funcao,
        /** Nulos enquanto o participante não assinou a APR na própria conta (e em quem recusou). */
        assinaturaPath: aprParticipante.assinaturaPath,
        assinadaEm: aprParticipante.assinadaEm,
        /** A assinatura foi dada no aparelho do responsável (contingência offline). */
        assinaturaPresencial: aprParticipante.assinaturaPresencial,
        /** Direito de recusa: o participante saiu da APR e deixou o motivo. */
        recusouEm: aprParticipante.recusouEm,
        recusaMotivo: aprParticipante.recusaMotivo,
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
      .select({ ...colunasDeEvidencia, aprId: evidencia.aprId, itemId: evidencia.itemId })
      .from(evidencia)
      .where(inArray(evidencia.aprId, ids))
      .orderBy(asc(evidencia.capturadaEm), asc(evidencia.id)),
  ]);

  return linhas.map((l) => {
    const completas = respostas
      .filter((r) => r.aprId === l.id)
      .map((r) => {
        const reprov = reprovado(r.tipo, r.resposta, r.respostaBloqueante);
        const comum = {
          itemId: r.itemId,
          secao: r.secao,
          ordem: r.ordem,
          texto: r.texto,
          riscoId: r.riscoId,
          resposta: r.resposta,
          observacao: r.observacao,
          respondidaEm: r.respondidaEm,
          reprovado: reprov,
        };
        return comClassificacao
          ? {
              ...comum,
              tipo: r.tipo,
              evidencia: r.evidencia,
              respostaBloqueante: r.respostaBloqueante,
              alertaMarcado: r.tipo === "alerta" && r.respostaBloqueante !== null && r.resposta === r.respostaBloqueante,
            }
          : comum;
      });
    return {
      id: l.id,
      osId: l.osId,
      resultado: l.resultado,
      observacaoGeral: l.observacaoGeral,
      concluidaEm: l.concluidaEm,
      preenchidaPor: { id: l.preenchidaPorId, nome: l.preenchidaPorNome },
      modelo: { codigo: l.modeloCodigo, versao: l.modeloVersao, titulo: l.modeloTitulo },
      /** A previsão do tempo que a pessoa viu na pergunta de clima (`previsao-do-tempo.md`); nula quando não houve. */
      clima: ((c) => (c ? climaParaApi(c) : null))(climas.find((c) => c.aprId === l.id)),
      participantes: participantes
        .filter((p) => p.aprId === l.id)
        .map(({ aprId: _a, ...p }) => p),
      riscos: riscos.filter((r) => r.aprId === l.id).map(({ aprId: _a, ...r }) => r),
      respostas: completas,
      itensReprovados: respostas
        .filter((r) => r.aprId === l.id && reprovado(r.tipo, r.resposta, r.respostaBloqueante))
        .map((r) => ({
          itemId: r.itemId,
          texto: r.texto,
          resposta: r.resposta,
          observacao: r.observacao,
          ...(comClassificacao ? { tipo: r.tipo, evidencia: r.evidencia } : {}),
          ...separarEvidencias(arquivos.filter((f) => f.aprId === l.id && f.itemId === r.itemId)),
        })),
    };
  });
}

/** Execuções da OS, da mais antiga para a mais recente, com pausas, assinaturas, fotos e tempos. */
async function carregarExecucoes(db: Db, osId: string, agora: Date) {
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
      suspensaoMotivo: execucao.suspensaoMotivo,
      suspensaoComplemento: execucao.suspensaoComplemento,
      encerramentoAssinadoEm: execucao.encerramentoAssinadoEm,
      finalizadaPor: execucao.finalizadaPor,
      inicioLatitude: execucao.inicioLatitude,
      inicioLongitude: execucao.inicioLongitude,
      fimLatitude: execucao.fimLatitude,
      fimLongitude: execucao.fimLongitude,
    })
    .from(execucao)
    .innerJoin(usuario, eq(usuario.id, execucao.executorId))
    .where(eq(execucao.osId, osId))
    .orderBy(asc(execucao.inicio), asc(execucao.id));
  if (linhas.length === 0) return [];
  const ids = linhas.map((l) => l.id);

  const climas = await db.select().from(climaRegistro).where(inArray(climaRegistro.execucaoId, ids));
  const [pausas, assinaturas, arquivos, pedidos] = await Promise.all([
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
      .select({ ...colunasDeEvidencia, execucaoId: evidencia.execucaoId })
      .from(evidencia)
      .where(inArray(evidencia.execucaoId, ids))
      .orderBy(asc(evidencia.capturadaEm), asc(evidencia.id)),
    db.select().from(execucaoPedido).where(inArray(execucaoPedido.execucaoId, ids)).orderBy(asc(execucaoPedido.criadoEm), asc(execucaoPedido.id)),
  ]);

  // Execução compartilhada: quem pausou, retomou, encerrou, pediu, decidiu e apoiou (qualquer participante da APR pode agir).
  const apoios = pedidos.length ? await db.select().from(execucaoPedidoApoio).where(inArray(execucaoPedidoApoio.pedidoId, pedidos.map((p) => p.id))).orderBy(asc(execucaoPedidoApoio.apoiadoEm)) : [];
  const quemIds = new Set(
    [...linhas.map((l) => l.finalizadaPor), ...pausas.flatMap((p) => [p.iniciadaPor, p.encerradaPor]), ...pedidos.flatMap((p) => [p.solicitanteId, p.decididoPor]), ...apoios.map((a) => a.usuarioId)].filter((x): x is string => !!x),
  );
  const nomes = new Map((quemIds.size ? await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, [...quemIds])) : []).map((u) => [u.id, u.nome]));
  const quem = (id: string | null) => (id ? { id, nome: nomes.get(id) ?? "—" } : null);

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
      /** Só na suspensa: por que o serviço não continua hoje (com o complemento de "outro"). */
      suspensaoMotivo: l.suspensaoMotivo,
      suspensaoComplemento: l.suspensaoComplemento,
      /** Quando o responsável assinou o encerramento; nulo na encerrada = a OS está `encerrando`. */
      encerramentoAssinadoEm: l.encerramentoAssinadoEm,
      /** Quem encerrou, interrompeu ou suspendeu (e, se encerrou, assina o encerramento); nulo nas execuções anteriores: vale o responsável. */
      finalizadaPor: quem(l.finalizadaPor),
      /** Os pedidos de participantes ao responsável (encerrar ou suspender), do mais antigo ao mais novo; o aberto traz quanto falta. */
      pedidos: pedidos
        .filter((p) => p.execucaoId === l.id)
        .map((p) => ({
          id: p.id,
          tipo: p.tipo,
          estado: p.estado,
          solicitante: quem(p.solicitanteId)!,
          instante: p.instante,
          motivo: p.motivo,
          complemento: p.complemento,
          criadoEm: p.criadoEm,
          expiraEm: p.expiraEm,
          decididoEm: p.decididoEm,
          decididoPor: quem(p.decididoPor),
          motivoRecusa: p.motivoRecusa,
          apoios: apoios.filter((a) => a.pedidoId === p.id).map((a) => quem(a.usuarioId)!),
          ...(p.estado === "aberto" ? { restanteMs: Math.max(0, p.expiraEm.getTime() - agora.getTime()) } : {}),
        })),
      /** Onde a pessoa estava ao iniciar e ao terminar (encerrar, suspender ou interromper); `null` = sem localização. */
      localizacaoInicio: l.inicioLatitude !== null && l.inicioLongitude !== null ? { latitude: l.inicioLatitude, longitude: l.inicioLongitude } : null,
      localizacaoFim: l.fimLatitude !== null && l.fimLongitude !== null ? { latitude: l.fimLatitude, longitude: l.fimLongitude } : null,
      dadosInspecao: l.dadosInspecao,
      /** As condições do tempo no encerramento (`previsao-do-tempo.md`); nulas quando não houve. */
      clima: ((c) => (c ? climaParaApi(c) : null))(climas.find((c) => c.execucaoId === l.id)),
      tempoLiquidoMin: tempo ? emMinutos(tempo.liquidoMs) : null,
      pausaMin: tempo ? emMinutos(tempo.pausaMs) : null,
      pausas: dela.map((p) => ({
        id: p.id,
        inicio: p.inicio,
        fim: p.fim,
        motivo: p.motivo,
        complemento: p.complemento,
        localizacao: p.latitude !== null && p.longitude !== null ? { latitude: p.latitude, longitude: p.longitude } : null,
        iniciadaPor: quem(p.iniciadaPor),
        encerradaPor: quem(p.encerradaPor),
      })),
      assinaturas: assinaturas.filter((a) => a.execucaoId === l.id).map(({ execucaoId: _e, ...a }) => a),
      ...separarEvidencias(arquivos.filter((f) => f.execucaoId === l.id)),
    };
  });
}

/** Detalhe da OS: dados do SAP, o serviço do catálogo, APRs, execuções, alertas, reprogramações e a linha do tempo que une tudo. */
export async function detalharOs(db: Db, eu: UsuarioAutenticado, osId: string, agora: Date) {
  // O pedido que passou dos 2 minutos já foi aprovado (e a OS mudou de status): a leitura não o mostra como aberto.
  await fecharPedidosVencidos(db, agora, { osId });
  const { os: o, local, equipeNome, equipeCentro, equipeSupervisorId, cienciaPorNome, responsavelNome, reservadaPorNome, devolvidaPorNome } = await osVisivel(db, eu, osId);

  const equipeAnterior = alias(equipe, "equipe_anterior");
  const equipeNova = alias(equipe, "equipe_nova");
  const [servico, aprs, execucoes, alertas, reprogramacoes, abertas, [suspeitos], checklists, reservasDesfeitas] = await Promise.all([
    o.codigoAtividade ? servicoDaAtividade(db, o.codigoAtividade) : null,
    carregarAprs(db, osId, eu.perfil === "admin"),
    carregarExecucoes(db, osId, agora),
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
    checklistsDasOs(db, [o]),
    reservasDesfeitasPorAusencia(db, osId),
  ]);

  // A OS que a Digitalização trouxe como encerrada: o que a folha em papel diz da execução (não há `execucao`).
  const [emPapel] =
    o.origem === "digitalizacao" || o.status === "encerrada"
      ? await db
          .select({
            inicioReal: osDigitalizacao.inicioReal,
            fimReal: osDigitalizacao.fimReal,
            numeroPessoas: osDigitalizacao.numeroPessoas,
            textoManuscrito: osDigitalizacao.textoManuscrito,
            fonte: osDigitalizacao.manuscritoFonte,
            folhas: sql<number>`jsonb_array_length(${osDigitalizacao.paginas})::int`,
            registradaEm: osDigitalizacao.registradaEm,
            registradaPorNome: usuario.nome,
          })
          .from(osDigitalizacao)
          .innerJoin(usuario, eq(usuario.id, osDigitalizacao.registradaPor))
          .where(eq(osDigitalizacao.osId, osId))
      : [];
  const aprEmPapel = emPapel ? await aprEmPapelDaOs(db, osId) : null;

  const linhaDoTempo = montarLinhaDoTempo({
    reservasDesfeitas,
    aprs,
    execucoes,
    alertas,
    reprogramacoes,
    cienciaEm: o.cienciaEm,
    cienciaPorNome,
    reserva: o.reservadaEm && responsavelNome ? { em: o.reservadaEm, responsavelNome, porNome: reservadaPorNome } : null,
    devolucao: o.devolvidaEm ? { em: o.devolvidaEm, porNome: devolvidaPorNome, justificativa: o.justificativaDevolucao } : null,
  });

  return {
    os: {
      ...o,
      localInstalacao: local,
      equipe: { id: o.equipeId, nome: equipeNome, centroTrabalho: equipeCentro, supervisorId: equipeSupervisorId },
      cienciaPorNome,
      /** Atribuição individual: a pessoa para quem a OS está reservada e quem a reservou; `null` = a OS é da equipe toda. */
      responsavel: o.responsavelId && responsavelNome ? { id: o.responsavelId, nome: responsavelNome, reservadaPorNome, reservadaEm: o.reservadaEm } : null,
      /** O apêndice da OS devolvida: quem devolveu, quando e a justificativa (que vai na planilha de baixa). */
      devolucao: o.devolvidaEm
        ? { em: o.devolvidaEm, porNome: devolvidaPorNome, justificativa: o.justificativaDevolucao, exportadaEm: o.devolucaoExportadaEm }
        : null,
      pdfPronto: o.pdfPath !== null,
      /** A execução em papel das OS digitalizadas (origem `digitalizacao`, ou uma OS liberada que a folha encerrou); `null` nas demais. */
      emPapel: emPapel ? { ...emPapel, apr: aprEmPapel } : null,
      execucaoAbertaHaHoras: abertas.get(osId) ?? null,
      atrasada: estaAtrasada(o, diaNoFuso(agora)),
      eventosComRelogioSuspeito: suspeitos?.n ?? 0,
    },
    /**
     * O serviço do catálogo (a atividade da OS) com os materiais, ferramentas e EPIs que ele usa; `null` quando a OS não
     * tem atividade. O modelo de APR fica de fora: o técnico o escolhe a cada APR (`GET /os/{id}/modelos-apr`).
     */
    servico: servico ? { codigo: servico.codigo, descricao: servico.descricao, materiais: servico.materiais } : null,
    /** O checklist de inspeção do plano da OS preventiva, na ordem; vazio quando a OS não tem (corretiva, plano sem perguntas). */
    checklistInspecao: checklists.get(o.id) ?? [],
    aprs,
    execucoes,
    /** A conferência do que a equipe registrou sem sinal em aparelhos diferentes (execução compartilhada, etapa 3); vazio quando não houve. */
    conferencias: await conferenciasDaOs(db, osId),
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
  reserva: { em: Date; responsavelNome: string; porNome: string | null } | null;
  /** As ausências que desfizeram a reserva da OS (a pessoa ficou ausente e a OS voltou para a equipe toda). */
  reservasDesfeitas: { em: Date; usuarioNome: string }[];
  devolucao: { em: Date; porNome: string | null; justificativa: string | null } | null;
}) {
  const itens: { em: Date; tipo: string; descricao: string }[] = [];

  for (const a of d.aprs) {
    itens.push({
      em: a.concluidaEm,
      tipo: "apr_concluida",
      descricao: `APR ${a.resultado} (${a.modelo.codigo} v${a.modelo.versao}) por ${a.preenchidaPor.nome}`,
    });
    for (const x of a.participantes) {
      if (x.assinadaEm && !x.assinaturaPresencial) itens.push({ em: x.assinadaEm, tipo: "apr_assinada", descricao: `${x.nome} assinou a APR` });
      if (x.recusouEm) itens.push({ em: x.recusouEm, tipo: "apr_recusada", descricao: `${x.nome} recusou a APR (direito de recusa)${x.recusaMotivo ? `: ${x.recusaMotivo}` : ""}` });
    }
  }
  for (const e of d.execucoes) {
    itens.push({ em: e.inicio, tipo: "execucao_iniciada", descricao: `Execução iniciada por ${e.executor.nome}` });
    for (const p of e.pausas) {
      itens.push({ em: p.inicio, tipo: "pausa_iniciada", descricao: `Pausa iniciada (${descreverMotivo(ROTULO_DA_PAUSA, p.motivo, p.complemento)})` });
      if (p.fim) itens.push({ em: p.fim, tipo: "pausa_encerrada", descricao: "Pausa encerrada" });
    }
    if (e.fim && e.resultado) {
      itens.push({
        em: e.fim,
        tipo: `execucao_${ROTULO_RESULTADO[e.resultado]}`,
        descricao: `Execução ${e.resultado} por ${e.executor.nome}${e.resultado === "interrompida" && e.motivo ? `: ${e.motivo}` : ""}${e.resultado === "suspensa" && e.suspensaoMotivo ? `: ${descreverMotivo(ROTULO_DA_SUSPENSAO, e.suspensaoMotivo, e.suspensaoComplemento)}` : ""}`,
      });
    }
    if (e.encerramentoAssinadoEm) itens.push({ em: e.encerramentoAssinadoEm, tipo: "encerramento_assinado", descricao: `Encerramento assinado por ${e.executor.nome}` });
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
  if (d.reserva) {
    itens.push({ em: d.reserva.em, tipo: "reserva", descricao: `Reservada para ${d.reserva.responsavelNome}${d.reserva.porNome ? ` por ${d.reserva.porNome}` : ""}` });
  }
  for (const r of d.reservasDesfeitas) itens.push({ em: r.em, tipo: "reserva_desfeita", descricao: `Reserva desfeita: ausência de ${r.usuarioNome}` });
  if (d.devolucao) {
    itens.push({
      em: d.devolucao.em,
      tipo: "devolucao",
      descricao: `Devolvida ao SAP${d.devolucao.porNome ? ` por ${d.devolucao.porNome}` : ""}${d.devolucao.justificativa ? `: ${d.devolucao.justificativa}` : ""}`,
    });
  }
  if (d.cienciaEm) itens.push({ em: d.cienciaEm, tipo: "ciencia", descricao: `Assinatura final do supervisor${d.cienciaPorNome ? ` ${d.cienciaPorNome}` : ""}: OS concluída` });

  return ordenarPorInstante(itens);
}

/** O histórico de APRs da OS (`GET /os/{id}/aprs`). */
export async function listarAprsDaOs(db: Db, eu: UsuarioAutenticado, osId: string) {
  await osVisivel(db, eu, osId);
  return carregarAprs(db, osId, eu.perfil === "admin");
}

/** Quem executou a OS: o responsável pela execução encerrada e quem a encerrou, se for outra pessoa (mais de uma execução só na duplicada vinda do modo offline). */
export async function executoresDaOs(db: Db, osId: string): Promise<string[]> {
  const linhas = await db.select({ executor: execucao.executorId, encerrou: execucao.finalizadaPor }).from(execucao).where(and(eq(execucao.osId, osId), eq(execucao.resultado, "encerrada")));
  return [...new Set(linhas.flatMap((l) => [l.executor, l.encerrou]).filter((x): x is string => !!x))];
}

/**
 * A assinatura final do supervisor da equipe da OS, depois de ler o relatório da execução (a "ciência" de antes): quem assina por
 * último, mesmo que tenha participado do serviço. Só a OS `aguardando_supervisor` (o responsável já assinou o encerramento) é
 * assinada. Grava `ciencia_por` e `ciencia_em`, a OS passa a `encerrada` (concluída) e a geração do PDF é enfileirada, tudo na
 * mesma transação. A condição no `select ... for update` fecha a corrida entre dois cliques.
 */
export async function darCiencia(db: Db, eu: UsuarioAutenticado, osId: string, agora: Date) {
  return db.transaction(async (tx) => {
    const [atual] = await tx.select({ equipeId: os.equipeId, status: os.status, cienciaEm: os.cienciaEm }).from(os).where(eq(os.id, osId)).for("update");
    if (!atual || !podeVerEquipe(eu, atual.equipeId)) throw naoEncontrado("OS não encontrada");
    if (!podeSupervisionarEquipe(eu, atual.equipeId)) throw proibido("Só o supervisor da equipe da OS assina por último");
    if (atual.cienciaEm !== null) throw conflito("ciencia_ja_dada", "A assinatura do supervisor nesta OS já foi dada");
    if (atual.status !== "aguardando_supervisor") {
      throw conflito(
        "os_nao_aguardando_supervisor",
        atual.status === "encerrando" ? "O responsável ainda não assinou o encerramento da OS" : "A OS ainda não chegou à assinatura do supervisor",
      );
    }

    // O relatório da execução inclui a conferência: com os registros de aparelhos diferentes ainda por comparar, o supervisor espera.
    if (await conferenciaEsperandoDados(tx as unknown as Db, osId)) {
      throw conflito("conferencia_pendente", "A conferência da execução ainda não terminou: os registros dos aparelhos da equipe estão sendo comparados. Assine quando ela chegar às assinaturas");
    }
    await tx.update(os).set({ cienciaPor: eu.id, cienciaEm: agora, cienciaAssinaturaPath: assinaturaDoAto(eu) }).where(eq(os.id, osId));
    const status = await recalcularStatusOs(tx as unknown as Db, osId);
    // O PDF só sai agora: ele leva a assinatura final do supervisor.
    await enfileirarTarefa(tx as unknown as Db, "pdf_os", osId, agora);
    // A assinatura no prazo (até 72 h depois do encerramento) pontua o supervisor, na mesma transação.
    const ganhos = eu.perfil === "tecnico" ? await pontuarCiencia({ tx: tx as unknown as Db, agora }, osId, eu.id, agora) : [];
    return { cienciaEm: agora, status, ...ganhosDe(ganhos, eu.id) };
  });
}

/**
 * A APR em papel que a Digitalização registrou junto com a folha da OS: o modelo, o que a folha diz e a resposta de cada item
 * marcado, na ordem do formulário. Não diz o que é eliminatório (só o admin sabe): mostra a marca como está no papel.
 */
async function aprEmPapelDaOs(db: Db, osId: string) {
  const [a] = await db
    .select({
      modeloCodigo: modeloApr.codigo,
      modeloVersao: modeloApr.versao,
      modeloTitulo: modeloApr.titulo,
      dataHora: osDigitalizacaoApr.dataHora,
      servico: osDigitalizacaoApr.servico,
      participantes: osDigitalizacaoApr.participantes,
      respostas: osDigitalizacaoApr.respostas,
      folhas: sql<number>`jsonb_array_length(${osDigitalizacaoApr.paginas})::int`,
      fonte: osDigitalizacaoApr.manuscritoFonte,
    })
    .from(osDigitalizacaoApr)
    .innerJoin(modeloApr, eq(modeloApr.id, osDigitalizacaoApr.modeloAprId))
    .where(eq(osDigitalizacaoApr.osId, osId));
  if (!a) return null;
  const respostas = a.respostas as { item_id: string; resposta: "sim" | "nao" | "na" }[];
  const itens = respostas.length
    ? await db
        .select({ id: itemModeloApr.id, ordem: itemModeloApr.ordem, secao: itemModeloApr.secao, texto: itemModeloApr.texto, risco: riscoModeloApr.nome })
        .from(itemModeloApr)
        .leftJoin(riscoModeloApr, eq(riscoModeloApr.id, itemModeloApr.riscoId))
        .where(inArray(itemModeloApr.id, respostas.map((r) => r.item_id)))
        .orderBy(asc(itemModeloApr.ordem))
    : [];
  const resposta = new Map(respostas.map((r) => [r.item_id, r.resposta]));
  return {
    modelo: { codigo: a.modeloCodigo, versao: a.modeloVersao, titulo: a.modeloTitulo },
    dataHora: a.dataHora,
    servico: a.servico,
    participantes: a.participantes as { nome: string; matricula: string | null; funcao: "responsavel" | "executor"; usuario_id: string | null }[],
    respostas: itens.map((i) => ({ ordem: i.ordem, secao: i.secao, risco: i.risco, texto: i.texto, resposta: resposta.get(i.id)! })),
    folhas: a.folhas,
    fonte: a.fonte,
  };
}
