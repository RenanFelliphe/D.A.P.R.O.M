import ExcelJS from "exceljs";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "../db/conexao";
import { alerta, apr, equipe, execucao, execucaoAssinatura, execucaoPausa, os, usuario } from "../db/schema";
import { dataBr, dataHoraBr, emMinutos, horaBr, tempoDaExecucao } from "./painel-comum";

export const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const MENSAGEM_SEM_NOVAS = "Nenhuma OS nova para exportar";

const COLUNAS_EXECUCAO = [
  "data_inicio",
  "hora_inicio",
  "data_fim",
  "hora_fim",
  "tempo_liquido_min",
  "pausa_min",
  "numero_pessoas",
  "executantes",
  "descricao_atividade",
  "link_pdf",
  "ciencia_supervisor",
] as const;

const COLUNAS_ENCERRADAS = ["numero_ordem", ...COLUNAS_EXECUCAO] as const;
const COLUNAS_SEM_ORDEM = ["titulo", "equipe", ...COLUNAS_EXECUCAO] as const;
const COLUNAS_IMPEDIMENTOS = ["numero_ordem", "titulo", "equipe", "motivo", "desde"] as const;
const COLUNAS_DEVOLVIDAS = ["numero_ordem", "titulo", "equipe", "justificativa", "devolvida_por", "devolvida_em"] as const;

type Linha = Record<string, string | number | null>;

function adicionarAba(livro: ExcelJS.Workbook, nome: string, colunas: readonly string[], linhas: Linha[]) {
  const aba = livro.addWorksheet(nome);
  aba.columns = colunas.map((c) => ({ header: c, key: c, width: Math.max(14, c.length + 2) }));
  aba.getRow(1).font = { bold: true };
  for (const l of linhas) aba.addRow(l);
}

/** Resultado de `exportarParaSap`: o arquivo, e quantas OS novas havia (nas abas `Encerradas`, `Sem ordem SAP` e `Devolvidas`). */
export interface Exportacao {
  planilha: Buffer;
  novas: number;
}

/**
 * Planilha de baixa do SAP, com 4 abas. Numa só transação: lê as encerradas e as devolvidas ainda não exportadas, monta a
 * planilha e as marca (`exportada_sap_em` e `devolucao_exportada_em`; um erro ao montar o arquivo desfaz a marcação). A
 * ciência não segura nada. A aba `Devolvidas` leva a justificativa que o supervisor escreveu: é por ela que o SAP corrige a ordem.
 */
export async function exportarParaSap(db: Db, painelUrl: string, agora: Date): Promise<Exportacao> {
  return db.transaction(async (tx) => {
    const tdb = tx as unknown as Db;
    const cienciaPor = alias(usuario, "ciencia_por_usuario");

    const candidatas = await tdb
      .select({
        id: os.id,
        numeroOrdem: os.numeroOrdem,
        titulo: os.titulo,
        equipeNome: equipe.nome,
        cienciaEm: os.cienciaEm,
        cienciaPorNome: cienciaPor.nome,
      })
      .from(os)
      .innerJoin(equipe, eq(equipe.id, os.equipeId))
      .leftJoin(cienciaPor, eq(cienciaPor.id, os.cienciaPor))
      .where(and(eq(os.status, "encerrada"), isNull(os.exportadaSapEm)))
      .orderBy(asc(os.numeroOrdem), asc(os.dataInicioProg), asc(os.id))
      .for("update", { of: os });

    // Só o que a marcação confirmar entra na planilha (duas exportações simultâneas não repetem OS).
    const marcadas = candidatas.length
      ? await tdb
          .update(os)
          .set({ exportadaSapEm: agora })
          .where(and(inArray(os.id, candidatas.map((c) => c.id)), isNull(os.exportadaSapEm), eq(os.status, "encerrada")))
          .returning({ id: os.id })
      : [];
    const confirmadas = new Set(marcadas.map((m) => m.id));
    const encerradas = candidatas.filter((c) => confirmadas.has(c.id));
    const ids = encerradas.map((c) => c.id);

    // A Execução considerada é a `encerrada`; havendo mais de uma, vale a primeira a encerrar.
    const execucoes = ids.length
      ? await tdb.select().from(execucao).where(and(inArray(execucao.osId, ids), eq(execucao.resultado, "encerrada"))).orderBy(asc(execucao.fim), asc(execucao.id))
      : [];
    const execIds = execucoes.map((e) => e.id);
    const pausas = execIds.length ? await tdb.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, execIds)) : [];
    const assinaturas = execIds.length
      ? await tdb
          .select({ execucaoId: execucaoAssinatura.execucaoId, matricula: usuario.matricula })
          .from(execucaoAssinatura)
          .innerJoin(usuario, eq(usuario.id, execucaoAssinatura.usuarioId))
          .where(inArray(execucaoAssinatura.execucaoId, execIds))
      : [];

    const comNumero: Linha[] = [];
    const semNumero: Linha[] = [];
    for (const o of encerradas) {
      const e = execucoes.find((x) => x.osId === o.id);
      const tempo = e ? tempoDaExecucao(e, pausas.filter((p) => p.execucaoId === e.id)) : null;
      const comuns: Linha = {
        data_inicio: e ? dataBr(e.inicio) : null,
        hora_inicio: e ? horaBr(e.inicio) : null,
        data_fim: e?.fim ? dataBr(e.fim) : null,
        hora_fim: e?.fim ? horaBr(e.fim) : null,
        tempo_liquido_min: tempo ? emMinutos(tempo.liquidoMs) : null,
        pausa_min: tempo ? emMinutos(tempo.pausaMs) : null,
        numero_pessoas: e?.numeroPessoas ?? null,
        executantes: e
          ? assinaturas
              .filter((a) => a.execucaoId === e.id)
              .map((a) => a.matricula)
              .sort()
              .join(",")
          : null,
        descricao_atividade: e?.descricaoAtividade ?? null,
        link_pdf: `${painelUrl}/doc/os/${o.id}`,
        ciencia_supervisor: o.cienciaEm ? `${o.cienciaPorNome ?? ""} ${dataHoraBr(o.cienciaEm)}`.trim() : null,
      };
      if (o.numeroOrdem !== null) comNumero.push({ numero_ordem: o.numeroOrdem, ...comuns });
      else semNumero.push({ titulo: o.titulo, equipe: o.equipeNome, ...comuns });
    }

    const impedimentos = await linhasDeImpedimento(tdb);
    const devolvidas = await linhasDeDevolvida(tdb, agora);

    const livro = new ExcelJS.Workbook();
    adicionarAba(livro, "Encerradas", COLUNAS_ENCERRADAS, comNumero);
    adicionarAba(livro, "Sem ordem SAP", COLUNAS_SEM_ORDEM, semNumero);
    adicionarAba(livro, "Impedimentos", COLUNAS_IMPEDIMENTOS, impedimentos);
    adicionarAba(livro, "Devolvidas", COLUNAS_DEVOLVIDAS, devolvidas);
    const planilha = Buffer.from(await livro.xlsx.writeBuffer());
    return { planilha, novas: encerradas.length + devolvidas.length };
  });
}

/**
 * As OS `devolvida` que ainda não saíram na planilha, com a justificativa do supervisor. Cada uma sai uma vez: a mesma
 * transação as marca como exportadas (duas exportações simultâneas não repetem a devolução).
 */
async function linhasDeDevolvida(db: Db, agora: Date): Promise<Linha[]> {
  const devolvidaPor = alias(usuario, "devolvida_por_usuario");
  const candidatas = await db
    .select({
      id: os.id,
      numeroOrdem: os.numeroOrdem,
      titulo: os.titulo,
      equipeNome: equipe.nome,
      justificativa: os.justificativaDevolucao,
      devolvidaEm: os.devolvidaEm,
      devolvidaPorNome: devolvidaPor.nome,
    })
    .from(os)
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .leftJoin(devolvidaPor, eq(devolvidaPor.id, os.devolvidaPor))
    .where(and(eq(os.status, "devolvida"), isNull(os.devolucaoExportadaEm)))
    .orderBy(asc(os.numeroOrdem), asc(os.id))
    .for("update", { of: os });
  if (candidatas.length === 0) return [];
  const marcadas = await db
    .update(os)
    .set({ devolucaoExportadaEm: agora })
    .where(and(inArray(os.id, candidatas.map((c) => c.id)), isNull(os.devolucaoExportadaEm), eq(os.status, "devolvida")))
    .returning({ id: os.id });
  const confirmadas = new Set(marcadas.map((m) => m.id));
  return candidatas
    .filter((c) => confirmadas.has(c.id))
    .map((c) => ({
      numero_ordem: c.numeroOrdem,
      titulo: c.titulo,
      equipe: c.equipeNome,
      justificativa: c.justificativa ?? "",
      devolvida_por: c.devolvidaPorNome ?? "",
      devolvida_em: c.devolvidaEm ? dataHoraBr(c.devolvidaEm) : "",
    }));
}

/**
 * OS `pendente` com o motivo. O motivo é o do evento mais recente entre os alertas `bloqueio` (o detalhe do alerta)
 * e as Execuções interrompidas ou suspensas (o motivo informado; suspensa não tem motivo). `desde` é o instante da
 * última APR bloqueada ou Execução interrompida/suspensa, a que deixou a OS pendente.
 */
async function linhasDeImpedimento(db: Db): Promise<Linha[]> {
  const pendentes = await db
    .select({ id: os.id, numeroOrdem: os.numeroOrdem, titulo: os.titulo, equipeNome: equipe.nome, atualizadaEm: os.atualizadaEm })
    .from(os)
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .where(eq(os.status, "pendente"))
    .orderBy(asc(os.numeroOrdem), asc(os.dataInicioProg), asc(os.id));
  if (pendentes.length === 0) return [];
  const ids = pendentes.map((p) => p.id);

  const [alertas, paradas, bloqueadas] = await Promise.all([
    db.select({ osId: alerta.osId, detalhe: alerta.detalhe, em: alerta.criadoEm }).from(alerta).where(and(inArray(alerta.osId, ids), eq(alerta.tipo, "bloqueio"))),
    db
      .select({ osId: execucao.osId, resultado: execucao.resultado, motivo: execucao.motivo, em: execucao.fim })
      .from(execucao)
      .where(and(inArray(execucao.osId, ids), inArray(execucao.resultado, ["interrompida", "suspensa"]))),
    db.select({ osId: apr.osId, em: apr.concluidaEm }).from(apr).where(and(inArray(apr.osId, ids), eq(apr.resultado, "bloqueada"))),
  ]);

  return pendentes.map((p) => {
    // Em empate de instante, o alerta (texto mais completo) vem primeiro.
    const candidatos = [
      ...alertas.filter((a) => a.osId === p.id).map((a) => ({ em: a.em, texto: a.detalhe, prioridade: 0 })),
      ...paradas
        .filter((x) => x.osId === p.id && x.em)
        .map((x) => ({ em: x.em!, texto: x.motivo ?? "Execução suspensa", prioridade: 1 })),
    ].sort((a, b) => b.em.getTime() - a.em.getTime() || a.prioridade - b.prioridade);

    const marcos = [...bloqueadas.filter((b) => b.osId === p.id).map((b) => b.em), ...paradas.filter((x) => x.osId === p.id && x.em).map((x) => x.em!)];
    const desde = marcos.length ? new Date(Math.max(...marcos.map((m) => m.getTime()))) : (candidatos[0]?.em ?? p.atualizadaEm);

    return { numero_ordem: p.numeroOrdem, titulo: p.titulo, equipe: p.equipeNome, motivo: candidatos[0]?.texto ?? "", desde: dataHoraBr(desde) };
  });
}

/** Nome do arquivo baixado: `exportacao-sap-AAAAMMDD-HHMM.xlsx`, no horário de São Paulo. */
export function nomeDoArquivo(agora: Date): string {
  const data = dataBr(agora).split("/").reverse().join("");
  const hora = horaBr(agora).replace(":", "");
  return `exportacao-sap-${data}-${hora}.xlsx`;
}
