import PDFDocument from "pdfkit";
import { and, asc, eq, inArray, isNotNull, ne, or } from "drizzle-orm";
import {
  apr,
  aprParticipante,
  climaRegistro,
  equipe,
  evidencia,
  execucao,
  execucaoAssinatura,
  execucaoPausa,
  execucaoPedido,
  execucaoPedidoApoio,
  localInstalacao,
  modeloApr,
  os,
  usuario,
} from "../db/schema";
import { ROTULO_DO_NIVEL, type ClimaRegistrado } from "../../../shared/api/clima";
import { ESCOLHA_DESCARTAR, ROTULO_DO_ESTADO_DA_CONFERENCIA, ROTULO_DO_TIPO_DA_CONFERENCIA, TOLERANCIA_MS } from "../../../shared/api/conferencia-execucao";
import { PRAZO_DO_PEDIDO_MS, ROTULO_DO_ESTADO_DO_PEDIDO, ROTULO_DO_PEDIDO } from "../../../shared/api/execucao-pedidos";
import { climaParaApi } from "../dominio/clima-registro";
import { dadosDaConferenciaParaRelatorio, type DadosDaConferencia } from "../dominio/conferencia-execucao";
import type { Deps } from "../deps";
import { ROTULO_DA_PAUSA, ROTULO_DA_SUSPENSAO, descreverMotivo, ehMotivoDeSaude } from "../dominio/motivos-de-parada";
import { tempoDaExecucao } from "../dominio/painel-comum";
import { conflito, naoEncontrado } from "../http/erros";
import { chaveImagem, lerImagens } from "./pdf-dados";
import { dataBr, dataHoraBr, duracao, horaBr } from "./pdf-formato";
import { COR, MARGEM, abrirEscala, desenharImagem, escrever, faixa, fecharEscala, garantirEspaco, linhaDeCelulas, linhaDeTabela, novoCursor, type Cursor } from "./pdf-layout";

/**
 * Relatório da execução (Reunião 3, item 13): o documento à parte, anexo do PDF da OS, que o supervisor lê antes de assinar. Traz
 * tudo o que o SYNQ OS acrescenta ao papel (o PDF da OS reproduz só a folha do SAP e a APR): o tempo, as pausas, as suspensões e
 * interrupções, a localização, as fotos e os PDFs da execução, o checklist de inspeção, as assinaturas e recusas da APR e as
 * ocorrências de saúde. Considera todas as execuções da OS, não só a que encerrou, e é gerado na hora (nada fica guardado).
 */

const STATUS_DA_OS: Record<string, string> = {
  liberada: "Liberada",
  pendente: "Pendente",
  em_execucao: "Em execução",
  encerrando: "Encerrando (falta a assinatura do responsável)",
  aguardando_supervisor: "Aguardando a assinatura do supervisor",
  encerrada: "Concluída",
  cancelada: "Cancelada",
  devolvida: "Devolvida ao SAP",
};
const RESULTADO: Record<string, string> = { encerrada: "Encerrada", suspensa: "Suspensa", interrompida: "Interrompida por risco" };
const FUNCOES: Record<string, string> = { responsavel: "Supervisor da Atividade", executor: "Executante" };

type Ponto = { latitude: number | null; longitude: number | null };

export interface DadosDoRelatorio {
  os: typeof os.$inferSelect;
  local: typeof localInstalacao.$inferSelect;
  equipe: typeof equipe.$inferSelect;
  /** As execuções finalizadas (qualquer resultado, menos a cancelada), da mais antiga à mais nova. */
  execucoes: {
    numero: number;
    e: typeof execucao.$inferSelect;
    fim: Date;
    responsavel: string;
    totalMs: number;
    pausaMs: number;
    liquidoMs: number;
    modelo: { codigo: string; versao: number; participantesComAssinatura: boolean };
    aprConcluidaEm: Date;
    participantes: {
      usuarioId: string;
      nome: string;
      matricula: string;
      funcao: string;
      assinaturaPath: string | null;
      assinadaEm: Date | null;
      presencial: boolean;
      recusouEm: Date | null;
      recusaMotivo: string | null;
    }[];
    /** A assinatura do responsável no encerramento (só a execução que encerrou tem). */
    assinaturaDoEncerramento: { nome: string; cargo: string | null; assinaturaPath: string; em: Date } | null;
    /** A previsão do tempo que valia na APR e no encerramento (`docs/operacao-de-campo.md`, seção 8.1); nula quando não houve (provedor fora do ar, sem sinal). */
    clima: { apr: ClimaRegistrado | null; encerramento: ClimaRegistrado | null };
  }[];
  pausas: (typeof execucaoPausa.$inferSelect & { numeroDaExecucao: number; fimEfetivo: Date })[];
  /** O que os participantes que não iniciaram a execução fizeram nela (execução compartilhada), em ordem: pausas, retomadas, o fim e os pedidos ao responsável. */
  acoes: { numeroDaExecucao: number; quando: Date; quem: string; oQue: string; resultado: string }[];
  /** A conferência do que a equipe registrou sem sinal em aparelhos diferentes (execução compartilhada, etapa 3), por execução; vazia quando não houve. */
  conferencias: { numeroDaExecucao: number; dados: DadosDaConferencia }[];
  fotos: { numeroDaExecucao: number; fotoPath: string; capturadaEm: Date; latitude: number | null; longitude: number | null }[];
  documentos: { numeroDaExecucao: number; nome: string | null; capturadaEm: Date }[];
  ciencia: { nome: string; cargo: string | null; assinaturaPath: string | null; em: Date } | null;
  imagens: Map<string, Uint8Array | null>;
}

/** A OS tem alguma execução finalizada (resultado diferente de nulo e de `cancelada`)? É o que dá direito ao relatório. */
export async function osTemExecucaoFinalizada(deps: Deps, osId: string): Promise<boolean> {
  const linhas = await deps.db
    .select({ id: execucao.id })
    .from(execucao)
    .where(and(eq(execucao.osId, osId), isNotNull(execucao.resultado), ne(execucao.resultado, "cancelada")))
    .limit(1);
  return linhas.length > 0;
}

/** Lê do banco e do armazenamento tudo o que o relatório mostra. */
export async function carregarDadosDoRelatorio(deps: Deps, osId: string): Promise<DadosDoRelatorio> {
  const { db } = deps;
  const [base] = await db
    .select({ os, local: localInstalacao, equipe })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .where(eq(os.id, osId));
  if (!base) throw naoEncontrado("OS não encontrada");

  const execucoes = await db
    .select()
    .from(execucao)
    .where(and(eq(execucao.osId, osId), isNotNull(execucao.resultado), ne(execucao.resultado, "cancelada")))
    .orderBy(asc(execucao.inicio), asc(execucao.id));
  if (execucoes.length === 0) throw conflito("os_sem_execucao", "A OS ainda não tem execução finalizada");
  const ids = execucoes.map((e) => e.id);
  const numeroDe = new Map(execucoes.map((e, i) => [e.id, i + 1]));

  const pausasBrutas = await db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, ids)).orderBy(asc(execucaoPausa.inicio));
  const nomes = new Map(
    (await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, execucoes.map((e) => e.executorId)))).map((u) => [u.id, u.nome]),
  );

  const modelosPorApr = await db
    .select({ aprId: apr.id, concluidaEm: apr.concluidaEm, codigo: modeloApr.codigo, versao: modeloApr.versao, participantesComAssinatura: modeloApr.participantesComAssinatura })
    .from(apr)
    .innerJoin(modeloApr, eq(modeloApr.id, apr.modeloAprId))
    .where(inArray(apr.id, execucoes.map((e) => e.aprId)));
  const participantes = await db
    .select({
      aprId: aprParticipante.aprId,
      usuarioId: aprParticipante.usuarioId,
      nome: usuario.nome,
      matricula: usuario.matricula,
      funcao: aprParticipante.funcao,
      assinaturaPath: aprParticipante.assinaturaPath,
      assinadaEm: aprParticipante.assinadaEm,
      presencial: aprParticipante.assinaturaPresencial,
      recusouEm: aprParticipante.recusouEm,
      recusaMotivo: aprParticipante.recusaMotivo,
    })
    .from(aprParticipante)
    .innerJoin(usuario, eq(usuario.id, aprParticipante.usuarioId))
    .where(inArray(aprParticipante.aprId, execucoes.map((e) => e.aprId)))
    .orderBy(asc(aprParticipante.funcao), asc(usuario.nome));

  const assinaturasDoEncerramento = await db
    .select({
      execucaoId: execucaoAssinatura.execucaoId,
      usuarioId: execucaoAssinatura.usuarioId,
      nome: usuario.nome,
      cargo: usuario.cargo,
      assinaturaPath: execucaoAssinatura.assinaturaPath,
      em: execucaoAssinatura.assinadaEm,
    })
    .from(execucaoAssinatura)
    .innerJoin(usuario, eq(usuario.id, execucaoAssinatura.usuarioId))
    .where(inArray(execucaoAssinatura.execucaoId, ids))
    .orderBy(asc(execucaoAssinatura.assinadaEm));

  const linhasDeClima = await db
    .select()
    .from(climaRegistro)
    .where(or(inArray(climaRegistro.aprId, execucoes.map((e) => e.aprId)), inArray(climaRegistro.execucaoId, ids)));
  const climaDe = (l: (typeof linhasDeClima)[number] | undefined): ClimaRegistrado | null => {
    if (!l) return null;
    const { momento: _momento, ...clima } = climaParaApi(l);
    return clima;
  };
  const lista = execucoes.map((e) => {
    const fim = e.fim ?? e.inicio;
    const pausas = pausasBrutas.filter((p) => p.execucaoId === e.id);
    const tempo = tempoDaExecucao({ inicio: e.inicio, fim }, pausas) ?? { totalMs: 0, pausaMs: 0, liquidoMs: 0 };
    const modelo = modelosPorApr.find((m) => m.aprId === e.aprId)!;
    const doEncerramento = assinaturasDoEncerramento.filter((a) => a.execucaoId === e.id);
    const assinante = doEncerramento.find((a) => a.usuarioId === (e.finalizadaPor ?? e.executorId)) ?? doEncerramento[0];
    return {
      numero: numeroDe.get(e.id)!,
      e,
      fim,
      responsavel: nomes.get(e.executorId) ?? "—",
      ...tempo,
      modelo: { codigo: modelo.codigo, versao: modelo.versao, participantesComAssinatura: modelo.participantesComAssinatura },
      aprConcluidaEm: modelo.concluidaEm,
      participantes: participantes.filter((p) => p.aprId === e.aprId),
      assinaturaDoEncerramento: assinante ? { nome: assinante.nome, cargo: assinante.cargo, assinaturaPath: assinante.assinaturaPath, em: assinante.em } : null,
      clima: { apr: climaDe(linhasDeClima.find((l) => l.aprId === e.aprId)), encerramento: climaDe(linhasDeClima.find((l) => l.execucaoId === e.id)) },
    };
  });
  const fimDe = new Map(lista.map((x) => [x.e.id, x.fim]));
  const acoes = await acoesDosParticipantes(db, execucoes, pausasBrutas, numeroDe);
  const conferencias: DadosDoRelatorio["conferencias"] = [];
  for (const e of execucoes) {
    const dados = await dadosDaConferenciaParaRelatorio(db, e.id);
    if (dados) conferencias.push({ numeroDaExecucao: numeroDe.get(e.id)!, dados });
  }

  const evidencias = await db
    .select({ execucaoId: evidencia.execucaoId, tipo: evidencia.tipo, fotoPath: evidencia.fotoPath, nomeArquivo: evidencia.nomeArquivo, capturadaEm: evidencia.capturadaEm, latitude: evidencia.latitude, longitude: evidencia.longitude })
    .from(evidencia)
    .where(inArray(evidencia.execucaoId, ids))
    .orderBy(asc(evidencia.capturadaEm), asc(evidencia.id));
  const fotos = evidencias
    .filter((x) => x.tipo === "foto")
    .map((x) => ({ numeroDaExecucao: numeroDe.get(x.execucaoId!)!, fotoPath: x.fotoPath, capturadaEm: x.capturadaEm, latitude: x.latitude, longitude: x.longitude }));
  const documentos = evidencias.filter((x) => x.tipo === "pdf").map((x) => ({ numeroDaExecucao: numeroDe.get(x.execucaoId!)!, nome: x.nomeArquivo, capturadaEm: x.capturadaEm }));

  let ciencia: DadosDoRelatorio["ciencia"] = null;
  if (base.os.cienciaPor && base.os.cienciaEm) {
    const [u] = await db.select({ nome: usuario.nome, cargo: usuario.cargo, assinaturaPath: usuario.assinaturaPath }).from(usuario).where(eq(usuario.id, base.os.cienciaPor));
    if (u) ciencia = { nome: u.nome, cargo: u.cargo, assinaturaPath: base.os.cienciaAssinaturaPath ?? u.assinaturaPath, em: base.os.cienciaEm };
  }

  const imagens = await lerImagens(deps, [
    ...lista.flatMap((x) => x.participantes.map((p) => ({ bucket: "assinaturas" as const, caminho: p.assinaturaPath }))),
    ...lista.map((x) => ({ bucket: "assinaturas" as const, caminho: x.assinaturaDoEncerramento?.assinaturaPath ?? null })),
    { bucket: "assinaturas", caminho: ciencia?.assinaturaPath ?? null },
    ...fotos.map((f) => ({ bucket: "fotos" as const, caminho: f.fotoPath })),
  ]);

  return {
    os: base.os,
    local: base.local,
    equipe: base.equipe,
    execucoes: lista,
    pausas: pausasBrutas.map((p) => ({ ...p, numeroDaExecucao: numeroDe.get(p.execucaoId)!, fimEfetivo: p.fim ?? fimDe.get(p.execucaoId)! })),
    acoes,
    conferencias,
    fotos,
    documentos,
    ciencia,
    imagens,
  };
}

const emMinutosESegundos = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min${String(s % 60).padStart(2, "0")}s`;
};

/**
 * O que os participantes que não iniciaram a execução fizeram nela: pausas e retomadas, o fim (encerrar, suspender, interromper) e os
 * pedidos ao responsável, com o resultado de cada um e quanto ele esperou. O que o responsável fez já está nas outras seções.
 */
async function acoesDosParticipantes(
  db: Deps["db"],
  execucoes: (typeof execucao.$inferSelect)[],
  pausas: (typeof execucaoPausa.$inferSelect)[],
  numeroDe: Map<string, number>,
): Promise<DadosDoRelatorio["acoes"]> {
  const ids = execucoes.map((e) => e.id);
  const pedidos = await db.select().from(execucaoPedido).where(inArray(execucaoPedido.execucaoId, ids)).orderBy(asc(execucaoPedido.criadoEm));
  const apoios = pedidos.length ? await db.select().from(execucaoPedidoApoio).where(inArray(execucaoPedidoApoio.pedidoId, pedidos.map((p) => p.id))) : [];
  const quemIds = new Set(
    [...execucoes.map((e) => e.finalizadaPor), ...pausas.flatMap((p) => [p.iniciadaPor, p.encerradaPor]), ...pedidos.flatMap((p) => [p.solicitanteId, p.decididoPor]), ...apoios.map((a) => a.usuarioId)].filter((x): x is string => !!x),
  );
  const nomes = new Map((quemIds.size ? await db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, [...quemIds])) : []).map((u) => [u.id, u.nome]));
  const nome = (id: string | null) => (id ? (nomes.get(id) ?? "—") : "—");
  const executorDe = new Map(execucoes.map((e) => [e.id, e.executorId]));
  const fimDe = new Map(execucoes.map((e) => [e.id, e.fim]));

  const acoes: DadosDoRelatorio["acoes"] = [];
  for (const p of pausas) {
    const numero = numeroDe.get(p.execucaoId)!;
    if (p.iniciadaPor && p.iniciadaPor !== executorDe.get(p.execucaoId)) {
      acoes.push({ numeroDaExecucao: numero, quando: p.inicio, quem: nome(p.iniciadaPor), oQue: `Pausou a execução (${descreverMotivo(ROTULO_DA_PAUSA, p.motivo, p.complemento)})`, resultado: "Vale na hora; o responsável foi avisado" });
    }
    const retomou = p.fim && p.encerradaPor && p.fim.getTime() !== fimDe.get(p.execucaoId)?.getTime();
    if (retomou && p.encerradaPor !== executorDe.get(p.execucaoId)) acoes.push({ numeroDaExecucao: numero, quando: p.fim!, quem: nome(p.encerradaPor), oQue: "Retomou a execução", resultado: "Vale na hora; o responsável foi avisado" });
  }
  for (const e of execucoes) {
    if (!e.finalizadaPor || e.finalizadaPor === e.executorId || !e.fim) continue;
    const oQue = e.resultado === "suspensa" ? "Suspendeu a execução" : e.resultado === "interrompida" ? "Interrompeu a execução por risco" : "Encerrou a OS";
    const porPedido = pedidos.some((p) => p.execucaoId === e.id && (p.estado === "aprovado" || p.estado === "aprovado_por_prazo") && p.solicitanteId === e.finalizadaPor);
    acoes.push({ numeroDaExecucao: numeroDe.get(e.id)!, quando: e.fim, quem: nome(e.finalizadaPor), oQue, resultado: porPedido ? "Por pedido aprovado (ver o pedido abaixo)" : "Vale na hora (saúde, risco ou sem sinal)" });
  }
  for (const p of pedidos) {
    const apoiaram = apoios.filter((a) => a.pedidoId === p.id).map((a) => nome(a.usuarioId));
    const decisao =
      p.estado === "aprovado" || p.estado === "recusado"
        ? `${ROTULO_DO_ESTADO_DO_PEDIDO[p.estado]} (${nome(p.decididoPor)}) em ${emMinutosESegundos(p.decididoEm!.getTime() - p.criadoEm.getTime())}`
        : p.estado === "aprovado_por_prazo"
          ? `Aprovado sozinho: sem resposta em ${emMinutosESegundos(PRAZO_DO_PEDIDO_MS)}`
          : ROTULO_DO_ESTADO_DO_PEDIDO[p.estado];
    acoes.push({
      numeroDaExecucao: numeroDe.get(p.execucaoId)!,
      quando: p.criadoEm,
      quem: nome(p.solicitanteId),
      oQue: `Pediu ao responsável para ${ROTULO_DO_PEDIDO[p.tipo]}${p.tipo === "suspender" ? ` (${descreverMotivo(ROTULO_DA_SUSPENSAO, p.motivo, p.complemento)})` : ""}`,
      resultado: `${decisao}${p.motivoRecusa ? `: "${p.motivoRecusa}"` : ""}${apoiaram.length > 0 ? `. Apoiado por ${apoiaram.join(", ")}` : ""}`,
    });
  }
  return acoes.sort((a, b) => a.numeroDaExecucao - b.numeroDaExecucao || a.quando.getTime() - b.quando.getTime());
}

/** O valor de uma opção da conferência como o relatório o mostra: um horário, o resultado ou a pausa com o início e o fim. */
function valorDaOpcao(campo: string, o: { instante: string | null; fim: string | null; texto: string | null }): string {
  if (campo === "resultado") return o.texto ?? "—";
  const hora = (iso: string | null) => (iso ? horaBr(new Date(iso)) : "—");
  if (campo.startsWith("pausa:")) return `${o.texto ?? "Pausa"} (${hora(o.instante)} às ${hora(o.fim)})`;
  return o.instante ? dataHoraBr(new Date(o.instante)) : "—";
}

/**
 * A seção "Conferência da execução": quando e por quê ela existiu, o que cada aparelho registrou em cada campo, o que valeu e por quem,
 * as ciências e assinaturas (com as ressalvas) e quem não sincronizou ou não assinou. Não vai no PDF da OS (a APR e a folha do SAP).
 */
function conferenciaDaExecucao(c: Cursor, numero: number, x: DadosDaConferencia) {
  const { conf, snapshot } = x;
  secao(c, `CONFERÊNCIA DA EXECUÇÃO ${numero}`);
  linhaDeCelulas(c, [
    { fracao: 0.3, rotulo: "SITUAÇÃO", valor: ROTULO_DO_ESTADO_DA_CONFERENCIA[conf.estado], negrito: true },
    { fracao: 0.3, rotulo: "TIPO", valor: conf.tipo ? ROTULO_DO_TIPO_DA_CONFERENCIA[conf.tipo] : "Ainda não comparada" },
    { fracao: 0.2, rotulo: "ABERTA EM", valor: dataHoraBr(conf.criadaEm) },
    { fracao: 0.2, rotulo: "RESPONSÁVEL", valor: x.responsavel ?? "—" },
  ]);
  const escolhaDe = new Map(x.decisoes.map((d) => [d.campo, d]));
  if (snapshot && snapshot.campos.length > 0) {
    const f = [0.14, 0.5, 0.36];
    const lp = larguras(c, f);
    linhaDeCabecalho(c, ["Campo", `O que cada aparelho registrou (tolerância de ${TOLERANCIA_MS / 60_000} min)`, "O que valeu"], f);
    for (const campo of snapshot.campos) {
      const versoes = campo.opcoes.map((o) => `${o.autor_nome}: ${valorDaOpcao(campo.campo, o)}`).join("\n");
      const decisao = escolhaDe.get(campo.campo);
      const escolhido = decisao?.escolha ?? (campo.divergente ? campo.sugerido : null);
      const valeu = !campo.divergente
        ? campo.so_um ? "Registrado por um aparelho só (aparelho com sinal)" : "Sem divergência"
        : escolhido === ESCOLHA_DESCARTAR
          ? `Descartada${decisao?.por ? ` por ${decisao.por}` : ""}`
          : `${x.nomeDoAutor(escolhido!)}${decisao ? ` (escolha de ${decisao.por ?? "—"})` : " (padrão sugerido: ninguém escolheu a tempo)"}`;
      linhaDeTabela(c, [{ largura: lp[0]!, texto: campo.rotulo, negrito: true }, { largura: lp[1]!, texto: versoes }, { largura: lp[2]!, texto: valeu }], { respiro: 4, minimo: 12 });
    }
  }
  if (x.assinaturas.length > 0) {
    const f = [0.22, 0.14, 0.2, 0.44];
    const lp = larguras(c, f);
    linhaDeCabecalho(c, ["Quem", "Registro", "Quando", "Ressalva"], f);
    for (const a of x.assinaturas) {
      linhaDeTabela(c, [{ largura: lp[0]!, texto: a.nome }, { largura: lp[1]!, texto: a.tipo === "ciencia" ? "Ciência" : "Assinatura" }, { largura: lp[2]!, texto: dataHoraBr(a.em) }, { largura: lp[3]!, texto: a.ressalva ?? "—", negrito: !!a.ressalva }], { respiro: 4, minimo: 12 });
    }
  }
  const faltas: string[] = [];
  if (x.faltaramSincronizar.length > 0) faltas.push(`Não sincronizaram até o fechamento: ${x.faltaramSincronizar.join(", ")}.`);
  if (x.faltaramAssinar.length > 0) faltas.push(`Não deram ciência ou não assinaram: ${x.faltaramAssinar.join(", ")}.`);
  if (conf.estado === "fechada_sem_todos" || faltas.length > 0) faltas.push(x.fechadaPor ? `Fechada com o que existia por ${x.fechadaPor}.` : "Fechada sozinha, ao fim de 7 dias.");
  if (faltas.length > 0) linhaDeCelulas(c, [{ fracao: 1, rotulo: "O QUE FALTOU", valor: faltas.join("\n") }]);
  c.y += 4;
}

const coordenadas = (p: Ponto) => (p.latitude === null || p.longitude === null ? null : `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`);
/** O ponto no mapa (Google Maps): a OS só tem o endereço em texto, então o relatório mostra o ponto ao lado dele, sem converter endereço em coordenadas. */
const linkDoMapa = (p: Ponto) => (p.latitude === null || p.longitude === null ? undefined : `https://www.google.com/maps?q=${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`);
const semLocalizacao = "sem localização";

interface ItemDaInspecao {
  pergunta: string;
  marcado: boolean | null;
  observacao: string | null;
}

/** Os itens do checklist de inspeção (`{ itens: [...] }`), ou `null` quando o dado não tem esse formato (a inspeção sem estrutura, de antes do checklist). */
function itensDaInspecao(bruto: unknown): ItemDaInspecao[] | null {
  const itens = (bruto as { itens?: unknown } | null)?.itens;
  if (!Array.isArray(itens)) return null;
  return itens.filter((i): i is ItemDaInspecao => Boolean(i) && typeof i === "object" && typeof (i as ItemDaInspecao).pergunta === "string");
}

/**
 * O checklist de inspeção da preventiva: uma linha por pergunta, com a caixa marcada ou vazia (a fonte do PDF não tem "☑", então
 * a caixa é "[X]" e "[  ]"; "[?]" é a pergunta que ficou sem resposta) e a observação; o item não marcado sai em destaque. A
 * inspeção sem estrutura (de antes do checklist) continua saindo como pares de campo e valor.
 */
function inspecao(c: Cursor, bruto: unknown) {
  if (!bruto || typeof bruto !== "object" || Object.keys(bruto).length === 0) return;
  const itens = itensDaInspecao(bruto);
  if (!itens) {
    const texto = Object.entries(bruto as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
      .join("\n");
    linhaDeCelulas(c, [{ fracao: 1, rotulo: "FORMULÁRIO DE INSPEÇÃO", valor: texto }], 7);
    return;
  }
  if (itens.length === 0) return;
  faixa(c, "CHECKLIST DE INSPEÇÃO", 7.5);
  const caixa = 26;
  for (const item of itens) {
    const observacao = item.observacao?.trim();
    linhaDeTabela(
      c,
      [
        { largura: caixa, texto: item.marcado === null ? "[?]" : item.marcado ? "[X]" : "[  ]", negrito: true },
        { largura: c.largura - caixa, texto: [item.pergunta, item.marcado === null ? "Não respondida." : null, observacao ? `Obs.: ${observacao}` : null].filter(Boolean).join("\n") },
      ],
      { fundo: item.marcado === false ? COR.reprovado : item.marcado === null ? COR.alerta : undefined, respiro: 3, minimo: 9.5 },
    );
  }
}

/** Título de seção que não fica sozinho no fim da folha: se não couber o começo da tabela, abre outra. */
function secao(c: Cursor, titulo: string, tamanho?: number) {
  garantirEspaco(c, 64);
  faixa(c, titulo, tamanho);
}

/** Larguras (em pontos) a partir de frações da largura útil. */
const larguras = (c: Cursor, fracoes: number[]) => fracoes.map((f) => f * c.largura);

function linhaDeCabecalho(c: Cursor, titulos: string[], fracoes: number[]) {
  const l = larguras(c, fracoes);
  linhaDeTabela(c, titulos.map((texto, i) => ({ largura: l[i]!, texto, negrito: true })), { fundo: COR.cinza, tamanho: 6.5, respiro: 4, minimo: 11 });
}

/** Caixas de assinatura (imagem, nome, detalhe e data), três por linha. */
function caixasDeAssinatura(c: Cursor, d: DadosDoRelatorio, lista: { titulo: string; nome: string | null; detalhe: string; caminho: string | null; quando: Date | null; aviso?: string }[]) {
  const colunas = 3;
  const l = c.largura / colunas;
  const altura = 74;
  for (let i = 0; i < lista.length; i += colunas) {
    garantirEspaco(c, altura);
    lista.slice(i, i + colunas).forEach((a, k) => {
      const x = MARGEM + k * l;
      c.doc.lineWidth(0.5).strokeColor(COR.borda).rect(x, c.y, l, altura).stroke();
      escrever(c.doc.font("Helvetica").fontSize(5.5).fillColor(COR.rotulo), a.titulo.toUpperCase(), x + 3, c.y + 2, { width: l - 6, lineBreak: false });
      if (a.caminho) desenharImagem(c, d.imagens.get(chaveImagem("assinaturas", a.caminho)), x + 4, c.y + 10, l - 8, 34);
      else escrever(c.doc.font("Helvetica-Oblique").fontSize(7).fillColor(COR.rotulo), a.aviso ?? "Sem assinatura", x + 4, c.y + 22, { width: l - 8, align: "center", lineBreak: false });
      if (a.nome) escrever(c.doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COR.texto), a.nome, x + 3, c.y + 47, { width: l - 6, lineBreak: false });
      escrever(c.doc.font("Helvetica").fontSize(6).fillColor(COR.texto), a.detalhe, x + 3, c.y + 57, { width: l - 6, lineBreak: false });
      if (a.quando) escrever(c.doc.font("Helvetica").fontSize(6).fillColor(COR.rotulo), `Data: ${dataHoraBr(a.quando)}`, x + 3, c.y + 65, { width: l - 6, lineBreak: false });
    });
    c.y += altura;
  }
}

/** A previsão do tempo guardada (a da APR e a do encerramento), como a seção do relatório a mostra. Só informativa: sem registro, a seção diz que não houve. */
function climaDaExecucao(c: Cursor, d: DadosDoRelatorio) {
  secao(c, "CONDIÇÕES CLIMÁTICAS");
  const linhas = d.execucoes.flatMap((x) => [
    ...(x.clima.apr ? [{ numero: x.numero, momento: `APR (${horaBr(new Date(x.clima.apr.consultada_em))})`, clima: x.clima.apr }] : []),
    ...(x.clima.encerramento ? [{ numero: x.numero, momento: `Encerramento (${horaBr(new Date(x.clima.encerramento.consultada_em))})`, clima: x.clima.encerramento }] : []),
  ]);
  if (linhas.length === 0) {
    linhaDeCelulas(c, [{ fracao: 1, valor: "Sem registro do clima: a previsão estava indisponível ou o aparelho estava sem sinal." }]);
    c.y += 4;
    return;
  }
  const f = [0.05, 0.16, 0.16, 0.43, 0.2];
  const lp = larguras(c, f);
  linhaDeCabecalho(c, ["Exec.", "Momento", "Situação", "Previsão e orientação", "Local"], f);
  for (const { numero, momento, clima } of linhas) {
    const ponto = { latitude: clima.local.latitude, longitude: clima.local.longitude };
    const confirmou = clima.confirmou_apesar_do_aviso ? "A pessoa respondeu que o clima estava favorável e confirmou o aviso." : null;
    linhaDeTabela(
      c,
      [
        { largura: lp[0]!, texto: String(numero) },
        { largura: lp[1]!, texto: momento },
        { largura: lp[2]!, texto: ROTULO_DO_NIVEL[clima.nivel], negrito: clima.nivel !== "sem_risco" },
        { largura: lp[3]!, texto: [clima.titulo, clima.orientacao, confirmou].filter(Boolean).join("\n") },
        { largura: lp[4]!, texto: `${clima.local.nome}\n${coordenadas(ponto)}`, link: linkDoMapa(ponto) },
      ],
      { fundo: clima.nivel === "extremo" ? COR.reprovado : clima.nivel === "atencao" ? COR.alerta : undefined, respiro: 4, minimo: 12 },
    );
  }
  c.y += 4;
}

/** Desenha o relatório no cursor e devolve o texto do rodapé (sem o número da página). */
function desenharRelatorio(c: Cursor, d: DadosDoRelatorio, geradoEm: Date): string {
  const o = d.os;
  const numeroDaOs = o.numeroOrdem ?? "OS de apoio (sem ordem SAP)";
  linhaDeCelulas(
    c,
    [
      { fracao: 0.2, valor: "SYNQ OS", negrito: true },
      { fracao: 0.55, valor: `RELATÓRIO DA EXECUÇÃO\nOS ${numeroDaOs}`, negrito: true },
      { fracao: 0.25, valor: `Gerado em: ${dataHoraBr(geradoEm)}\nHorário de Brasília` },
    ],
    9,
  );
  linhaDeCelulas(c, [
    { fracao: 0.25, rotulo: "ORDEM", valor: numeroDaOs, negrito: true },
    { fracao: 0.75, rotulo: "TÍTULO", valor: o.titulo },
  ]);
  linhaDeCelulas(c, [
    { fracao: 0.3, rotulo: "LOCAL DE INSTALAÇÃO", valor: d.local.codigo },
    { fracao: 0.25, rotulo: "EQUIPE", valor: `${d.equipe.nome} (${d.equipe.centroTrabalho})` },
    { fracao: 0.45, rotulo: "SITUAÇÃO DA OS", valor: STATUS_DA_OS[o.status] ?? o.status, negrito: true },
  ]);
  c.y += 4;

  // Ocorrências de saúde: em destaque, logo no começo (a lesão no trabalho, mesmo leve, é acidente de trabalho).
  const saude: { quando: Date; titulo: string; quem: string; ponto: Ponto }[] = [];
  for (const p of d.pausas) {
    if (ehMotivoDeSaude(p.motivo)) saude.push({ quando: p.inicio, titulo: `Pausa por ${ROTULO_DA_PAUSA[p.motivo].toLowerCase()}`, quem: d.execucoes.find((x) => x.numero === p.numeroDaExecucao)!.responsavel, ponto: p });
  }
  for (const x of d.execucoes) {
    const m = x.e.suspensaoMotivo;
    if (x.e.resultado === "suspensa" && ehMotivoDeSaude(m)) {
      saude.push({ quando: x.fim, titulo: `Suspensão por ${ROTULO_DA_SUSPENSAO[m].toLowerCase()}`, quem: x.responsavel, ponto: { latitude: x.e.fimLatitude, longitude: x.e.fimLongitude } });
    }
  }
  saude.sort((a, b) => a.quando.getTime() - b.quando.getTime());
  if (saude.length > 0) {
    secao(c, "OCORRÊNCIAS DE SAÚDE (LESÃO OU ENFERMIDADE)");
    const l = larguras(c, [0.3, 0.2, 0.25, 0.25]);
    linhaDeCabecalho(c, ["Ocorrência", "Quando", "Registrada na execução de", "Onde"], [0.3, 0.2, 0.25, 0.25]);
    for (const s of saude) {
      const coord = coordenadas(s.ponto);
      linhaDeTabela(
        c,
        [
          { largura: l[0]!, texto: s.titulo, negrito: true },
          { largura: l[1]!, texto: dataHoraBr(s.quando) },
          { largura: l[2]!, texto: s.quem },
          { largura: l[3]!, texto: coord ?? semLocalizacao, link: linkDoMapa(s.ponto) },
        ],
        { fundo: COR.saude, respiro: 4, minimo: 12 },
      );
    }
    c.y += 4;
  }

  // Tempo: soma de todos os trechos da OS.
  secao(c, "TEMPO");
  const total = d.execucoes.reduce((s, x) => s + x.totalMs, 0);
  const pausado = d.execucoes.reduce((s, x) => s + x.pausaMs, 0);
  const liquido = d.execucoes.reduce((s, x) => s + x.liquidoMs, 0);
  linhaDeCelulas(c, [
    { fracao: 0.25, rotulo: "TEMPO TOTAL (COM AS PAUSAS)", valor: duracao(total) },
    { fracao: 0.25, rotulo: "TEMPO PAUSADO", valor: duracao(pausado) },
    { fracao: 0.25, rotulo: "TEMPO LÍQUIDO", valor: duracao(liquido), negrito: true },
    { fracao: 0.25, rotulo: "EXECUÇÕES / PAUSAS", valor: `${d.execucoes.length} / ${d.pausas.length}` },
  ]);
  const fr = [0.04, 0.15, 0.15, 0.15, 0.09, 0.09, 0.09, 0.08, 0.16];
  const l = larguras(c, fr);
  linhaDeCabecalho(c, ["Nº", "Início", "Fim", "Resultado", "Total", "Pausado", "Líquido", "Pessoas", "Responsável"], fr);
  for (const x of d.execucoes) {
    linhaDeTabela(
      c,
      [
        String(x.numero),
        dataHoraBr(x.e.inicio),
        dataHoraBr(x.fim),
        RESULTADO[x.e.resultado ?? ""] ?? x.e.resultado ?? "—",
        duracao(x.totalMs),
        duracao(x.pausaMs),
        duracao(x.liquidoMs),
        String(x.e.numeroPessoas),
        x.responsavel,
      ].map((texto, i) => ({ largura: l[i]!, texto })),
      { respiro: 4, minimo: 12 },
    );
  }
  c.y += 4;

  // Condições climáticas: a previsão que valia na APR e a do encerramento, uma linha para cada, por execução.
  climaDaExecucao(c, d);

  // Pausas.
  secao(c, `PAUSAS (${d.pausas.length})`);
  if (d.pausas.length === 0) linhaDeCelulas(c, [{ fracao: 1, valor: "Nenhuma pausa." }]);
  else {
    const f = [0.05, 0.14, 0.14, 0.09, 0.38, 0.2];
    const lp = larguras(c, f);
    linhaDeCabecalho(c, ["Exec.", "Início", "Fim", "Duração", "Motivo", "Localização"], f);
    for (const p of d.pausas) {
      const coord = coordenadas(p);
      linhaDeTabela(
        c,
        [
          { largura: lp[0]!, texto: String(p.numeroDaExecucao) },
          { largura: lp[1]!, texto: dataHoraBr(p.inicio) },
          { largura: lp[2]!, texto: p.fim ? dataHoraBr(p.fim) : `${dataHoraBr(p.fimEfetivo)} (com o encerramento)` },
          { largura: lp[3]!, texto: duracao(p.fimEfetivo.getTime() - p.inicio.getTime()) },
          { largura: lp[4]!, texto: descreverMotivo(ROTULO_DA_PAUSA, p.motivo, p.complemento), negrito: ehMotivoDeSaude(p.motivo) },
          { largura: lp[5]!, texto: coord ?? semLocalizacao, link: linkDoMapa(p) },
        ],
        { fundo: ehMotivoDeSaude(p.motivo) ? COR.saude : undefined, respiro: 4, minimo: 12 },
      );
    }
  }
  c.y += 4;

  // Suspensões e interrupções.
  const paradas = d.execucoes.filter((x) => x.e.resultado === "suspensa" || x.e.resultado === "interrompida");
  secao(c, "SUSPENSÕES E INTERRUPÇÕES");
  if (paradas.length === 0) linhaDeCelulas(c, [{ fracao: 1, valor: "Nenhuma suspensão ou interrupção." }]);
  else {
    const f = [0.05, 0.14, 0.17, 0.44, 0.2];
    const lp = larguras(c, f);
    linhaDeCabecalho(c, ["Exec.", "Quando", "Tipo", "Motivo", "Localização"], f);
    for (const x of paradas) {
      const ponto = { latitude: x.e.fimLatitude, longitude: x.e.fimLongitude };
      const coord = coordenadas(ponto);
      const suspensa = x.e.resultado === "suspensa";
      const saudeNaSuspensao = suspensa && ehMotivoDeSaude(x.e.suspensaoMotivo);
      linhaDeTabela(
        c,
        [
          { largura: lp[0]!, texto: String(x.numero) },
          { largura: lp[1]!, texto: dataHoraBr(x.fim) },
          { largura: lp[2]!, texto: suspensa ? "Suspensão" : "Interrupção por risco", negrito: true },
          { largura: lp[3]!, texto: suspensa ? descreverMotivo(ROTULO_DA_SUSPENSAO, x.e.suspensaoMotivo, x.e.suspensaoComplemento) : x.e.motivo?.trim() || "sem motivo informado" },
          { largura: lp[4]!, texto: coord ?? semLocalizacao, link: linkDoMapa(ponto) },
        ],
        { fundo: saudeNaSuspensao ? COR.saude : undefined, respiro: 4, minimo: 12 },
      );
    }
  }
  c.y += 4;

  // Execução compartilhada: o que os participantes que não iniciaram a execução fizeram nela.
  if (d.acoes.length > 0) {
    secao(c, "AÇÕES DOS PARTICIPANTES");
    const f = [0.05, 0.14, 0.18, 0.28, 0.35];
    const lp = larguras(c, f);
    linhaDeCabecalho(c, ["Exec.", "Quando", "Quem", "O que fez", "Como valeu"], f);
    for (const a of d.acoes) {
      linhaDeTabela(
        c,
        [
          { largura: lp[0]!, texto: String(a.numeroDaExecucao) },
          { largura: lp[1]!, texto: dataHoraBr(a.quando) },
          { largura: lp[2]!, texto: a.quem },
          { largura: lp[3]!, texto: a.oQue, negrito: true },
          { largura: lp[4]!, texto: a.resultado },
        ],
        { respiro: 4, minimo: 12 },
      );
    }
    c.y += 4;
  }

  // Execução compartilhada, etapa 3: o que a equipe registrou sem sinal, a escolha e as assinaturas.
  for (const x of d.conferencias) conferenciaDaExecucao(c, x.numeroDaExecucao, x.dados);

  // Localização: o endereço da OS ao lado dos pontos registrados (início, cada parada e o fim de cada execução).
  secao(c, "LOCALIZAÇÃO");
  linhaDeCelulas(c, [
    { fracao: 1, rotulo: "ENDEREÇO DA OS (SÓ EM TEXTO: O SISTEMA NÃO CONVERTE O ENDEREÇO EM COORDENADAS)", valor: [d.local.endereco ?? "sem endereço cadastrado", d.local.plusCode ? `Plus Code: ${d.local.plusCode}` : null].filter(Boolean).join("\n") },
  ]);
  {
    const f = [0.05, 0.22, 0.14, 0.2, 0.39];
    const lp = larguras(c, f);
    linhaDeCabecalho(c, ["Exec.", "Momento", "Quando", "Coordenadas", "Ponto no mapa"], f);
    const momentos: { numero: number; momento: string; quando: Date; ponto: Ponto }[] = [];
    for (const x of d.execucoes) {
      momentos.push({ numero: x.numero, momento: "Início da execução", quando: x.e.inicio, ponto: { latitude: x.e.inicioLatitude, longitude: x.e.inicioLongitude } });
      for (const p of d.pausas.filter((p) => p.numeroDaExecucao === x.numero)) {
        momentos.push({ numero: x.numero, momento: `Pausa (${ROTULO_DA_PAUSA[p.motivo ?? "outro"] ?? "sem motivo"})`, quando: p.inicio, ponto: p });
      }
      const fimDa = x.e.resultado === "suspensa" ? "Suspensão" : x.e.resultado === "interrompida" ? "Interrupção por risco" : "Encerramento da OS";
      momentos.push({ numero: x.numero, momento: fimDa, quando: x.fim, ponto: { latitude: x.e.fimLatitude, longitude: x.e.fimLongitude } });
    }
    momentos.sort((a, b) => a.numero - b.numero || a.quando.getTime() - b.quando.getTime());
    for (const m of momentos) {
      const coord = coordenadas(m.ponto);
      const url = linkDoMapa(m.ponto);
      linhaDeTabela(
        c,
        [
          { largura: lp[0]!, texto: String(m.numero) },
          { largura: lp[1]!, texto: m.momento },
          { largura: lp[2]!, texto: dataHoraBr(m.quando) },
          { largura: lp[3]!, texto: coord ?? semLocalizacao },
          { largura: lp[4]!, texto: url ?? "—", link: url },
        ],
        { tamanho: 6.5, respiro: 4, minimo: 12 },
      );
    }
  }
  c.y += 4;

  // Fotos.
  if (d.fotos.length > 0) {
    secao(c, `FOTOS (${d.fotos.length})`);
    const colunas = 3;
    const largura = c.largura / colunas;
    const altura = 112;
    for (let i = 0; i < d.fotos.length; i += colunas) {
      garantirEspaco(c, altura);
      d.fotos.slice(i, i + colunas).forEach((f, k) => {
        const x = MARGEM + k * largura;
        c.doc.lineWidth(0.5).strokeColor(COR.borda).rect(x, c.y, largura, altura).stroke();
        desenharImagem(c, d.imagens.get(chaveImagem("fotos", f.fotoPath)), x + 3, c.y + 3, largura - 6, altura - 22);
        const posicao = coordenadas(f);
        escrever(c.doc.font("Helvetica").fontSize(6).fillColor(COR.texto), `${dataBr(f.capturadaEm)} ${horaBr(f.capturadaEm)}`, x + 3, c.y + altura - 17, { width: largura - 6, lineBreak: false });
        escrever(c.doc, posicao ? `Posição: ${posicao}` : "Posição: não informada", x + 3, c.y + altura - 9, { width: largura - 6, lineBreak: false });
      });
      c.y += altura;
    }
    c.y += 4;
  }

  if (d.documentos.length > 0) {
    secao(c, "DOCUMENTOS ANEXADOS (PDF)");
    const itens = d.documentos.map((doc, i) => `${i + 1}. ${doc.nome ?? "Documento em PDF"} — anexado em ${dataHoraBr(doc.capturadaEm)}`).join("\n");
    linhaDeCelulas(c, [{ fracao: 1, rotulo: "OS ARQUIVOS FICAM NO SISTEMA, NO DETALHE DA OS", valor: itens }], 7);
    c.y += 4;
  }

  // Checklist de inspeção das preventivas.
  for (const x of d.execucoes) {
    if (!x.e.dadosInspecao) continue;
    const antes = c.y;
    inspecao(c, x.e.dadosInspecao);
    if (c.y !== antes) c.y += 4;
  }

  // Assinaturas da APR (sempre listadas aqui, com a hora de cada uma) e o direito de recusa.
  secao(c, "ASSINATURAS DA APR");
  for (const x of d.execucoes) {
    garantirEspaco(c, 90);
    linhaDeCelulas(c, [
      {
        fracao: 1,
        rotulo: `EXECUÇÃO ${x.numero}`,
        valor: `${x.modelo.codigo} · Versão ${String(x.modelo.versao).padStart(2, "0")} · APR concluída em ${dataHoraBr(x.aprConcluidaEm)}${x.modelo.participantesComAssinatura ? "" : " · a folha deste modelo não tem coluna de assinatura: elas aparecem só aqui"}`,
      },
    ]);
    const f = [0.2, 0.27, 0.13, 0.28, 0.12];
    const lp = larguras(c, f);
    linhaDeCabecalho(c, ["Função", "Nome", "Matrícula", "Situação", "Assinatura"], f);
    for (const p of x.participantes) {
      const situacao = p.recusouEm
        ? `RECUSOU em ${dataHoraBr(p.recusouEm)} (direito de recusa): ${p.recusaMotivo ?? "sem motivo informado"}`
        : p.assinadaEm
          ? `Assinou em ${dataHoraBr(p.assinadaEm)}${p.presencial ? " (presencial)" : ""}`
          : "Ainda não assinou";
      const altura = 26;
      garantirEspaco(c, altura + 20);
      const topo = c.y;
      linhaDeTabela(
        c,
        [FUNCOES[p.funcao] ?? p.funcao, p.nome, p.matricula, situacao, ""].map((texto, i) => ({ largura: lp[i]!, texto, negrito: i === 3 && Boolean(p.recusouEm) })),
        { fundo: p.recusouEm ? COR.alerta : undefined, respiro: 4, minimo: altura },
      );
      if (p.assinaturaPath) desenharImagem(c, d.imagens.get(chaveImagem("assinaturas", p.assinaturaPath)), MARGEM + lp[0]! + lp[1]! + lp[2]! + lp[3]! + 3, topo + 2, lp[4]! - 6, altura - 4);
    }
  }
  c.y += 4;

  // Assinaturas do encerramento: o responsável e, por último, o supervisor.
  secao(c, "ASSINATURAS DO ENCERRAMENTO");
  const encerradas = d.execucoes.filter((x) => x.e.resultado === "encerrada");
  const caixas: Parameters<typeof caixasDeAssinatura>[2] = encerradas.map((x) => ({
    titulo: encerradas.length > 1 ? `Responsável - execução ${x.numero}` : "Responsável - Manutenção",
    nome: x.assinaturaDoEncerramento?.nome ?? x.responsavel,
    detalhe: x.assinaturaDoEncerramento?.cargo ?? "",
    caminho: x.assinaturaDoEncerramento?.assinaturaPath ?? null,
    quando: x.assinaturaDoEncerramento?.em ?? null,
    aviso: "Aguardando a assinatura do responsável",
  }));
  caixas.push({
    titulo: "Supervisor",
    nome: d.ciencia?.nome ?? null,
    detalhe: d.ciencia?.cargo ?? "",
    caminho: d.ciencia?.assinaturaPath ?? null,
    quando: d.ciencia?.em ?? null,
    aviso: "Ainda não assinou",
  });
  caixasDeAssinatura(c, d, caixas);

  return `OS ${o.numeroOrdem ?? o.id} · relatório da execução gerado em ${dataHoraBr(geradoEm)} (horário de Brasília)`;
}

/** Gera o relatório da execução em PDF, na hora, a partir do banco. 409 `os_sem_execucao` se a OS não tem execução finalizada. */
export async function gerarRelatorioDaExecucao(deps: Deps, osId: string, opcoes: { comprimir?: boolean } = {}): Promise<Uint8Array> {
  const dados = await carregarDadosDoRelatorio(deps, osId);
  const geradoEm = deps.agora();

  const doc = new PDFDocument({
    size: "A4",
    compress: opcoes.comprimir ?? true,
    bufferPages: true,
    margins: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
    info: { Title: `Relatório da execução — OS ${dados.os.numeroOrdem ?? dados.os.id}`, Author: "SYNQ OS", CreationDate: geradoEm },
  });
  const pedacos: Buffer[] = [];
  doc.on("data", (p: Buffer) => pedacos.push(p));
  const pronto = new Promise<void>((resolver, rejeitar) => {
    doc.on("end", resolver);
    doc.on("error", rejeitar);
  });

  const c = novoCursor(doc);
  abrirEscala(c);
  const rodapeDoRelatorio = desenharRelatorio(c, dados, geradoEm);
  fecharEscala(c);

  // Rodapé com o número da página, em todas as folhas.
  const { start, count } = doc.bufferedPageRange();
  for (let i = 0; i < count; i++) {
    doc.switchToPage(start + i);
    doc.font("Helvetica").fontSize(6.5).fillColor(COR.rotulo);
    escrever(doc, `${rodapeDoRelatorio} · página ${i + 1} de ${count}`, MARGEM, 800, { width: 595.28 - 2 * MARGEM, align: "center", lineBreak: false });
  }
  doc.end();
  await pronto;
  return new Uint8Array(Buffer.concat(pedacos));
}
