import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { itemModeloApr, modeloApr, riscoModeloApr } from "../db/schema";
import { codigoPostgres, conflito, naoEncontrado } from "../http/erros";
import type { ConteudoDoModelo, ItemEntrada, RiscoEntrada } from "./modelo-apr-esquema";

/** Traduz a recusa dos gatilhos do banco (modelo publicado é imutável) em um `409` legível, caso vaze das rotas. */
export async function traduzirImutabilidade<T>(operacao: () => Promise<T>): Promise<T> {
  try {
    return await operacao();
  } catch (erro) {
    if (codigoPostgres(erro) === "23514") {
      throw conflito("modelo_publicado", "Modelo publicado não pode ser alterado; crie uma nova versão");
    }
    throw erro;
  }
}

/** Grava os riscos e itens de um modelo (rascunho), ligando cada medida ao risco pela `ordem`. */
export async function gravarRiscosEItens(db: Db, modeloAprId: string, riscos: RiscoEntrada[], itens: ItemEntrada[]) {
  const riscoPorOrdem = new Map<number, string>();
  if (riscos.length > 0) {
    const criados = await db
      .insert(riscoModeloApr)
      .values(riscos.map((r) => ({ modeloAprId, classificacao: r.classificacao, nome: r.nome, ordem: r.ordem })))
      .returning({ id: riscoModeloApr.id, ordem: riscoModeloApr.ordem });
    for (const r of criados) riscoPorOrdem.set(r.ordem, r.id);
  }
  if (itens.length > 0) {
    await db.insert(itemModeloApr).values(
      itens.map((i) => ({
        modeloAprId,
        secao: i.secao,
        riscoId: i.risco_ordem === null || i.risco_ordem === undefined ? null : riscoPorOrdem.get(i.risco_ordem)!,
        ordem: i.ordem,
        texto: i.texto,
        respostaBloqueante: i.resposta_bloqueante ?? null,
        tipo: i.tipo,
        evidencia: i.evidencia,
        permiteNa: i.permite_na,
        mostrarClima: i.mostrar_clima,
      })),
    );
  }
}

/** Riscos e itens de um modelo, com a `ordem` do risco ao lado do id (as medidas apontam para ele). */
export async function lerRiscosEItens(db: Db, modeloAprId: string) {
  const riscos = await db.select().from(riscoModeloApr).where(eq(riscoModeloApr.modeloAprId, modeloAprId)).orderBy(asc(riscoModeloApr.ordem));
  const itens = await db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, modeloAprId)).orderBy(asc(itemModeloApr.ordem));
  const ordemDoRisco = new Map(riscos.map((r) => [r.id, r.ordem]));
  return {
    riscos: riscos.map((r) => ({ id: r.id, classificacao: r.classificacao, nome: r.nome, ordem: r.ordem })),
    itens: itens.map((i) => ({
      id: i.id,
      secao: i.secao,
      riscoId: i.riscoId,
      riscoOrdem: i.riscoId ? (ordemDoRisco.get(i.riscoId) ?? null) : null,
      ordem: i.ordem,
      texto: i.texto,
      respostaBloqueante: i.respostaBloqueante,
      tipo: i.tipo,
      evidencia: i.evidencia,
      permiteNa: i.permiteNa,
      mostrarClima: i.mostrarClima,
    })),
  };
}

/**
 * Tira do item o que diz se ele é eliminatório ou de alerta (tipo, resposta bloqueante e evidência). Só quem edita o
 * modelo (admin) vê isso: se o técnico soubesse, bastaria responder "certo" nesses itens para fazer o serviço.
 */
export function semClassificacao<T extends { tipo: unknown; respostaBloqueante: unknown; evidencia: unknown }>(item: T): Omit<T, "tipo" | "respostaBloqueante" | "evidencia"> {
  const { tipo: _t, respostaBloqueante: _r, evidencia: _e, ...resto } = item;
  return resto;
}

/** Modelo completo (dados, PAE, riscos e itens) como a API o entrega; `comClassificacao: false` esconde o que é eliminatório. */
export async function modeloCompleto(db: Db, linha: typeof modeloApr.$inferSelect, comClassificacao = true) {
  const lido = await lerRiscosEItens(db, linha.id);
  const riscos = lido.riscos;
  const itens = comClassificacao ? lido.itens : lido.itens.map(semClassificacao);
  return {
    id: linha.id,
    codigo: linha.codigo,
    versao: linha.versao,
    titulo: linha.titulo,
    dataDocumento: linha.dataDocumento,
    participantesComAssinatura: linha.participantesComAssinatura,
    pae: linha.pae,
    publicadoEm: linha.publicadoEm,
    arquivadoEm: linha.arquivadoEm,
    rascunho: linha.publicadoEm === null,
    riscos,
    itens,
  };
}

/** O conteúdo de um modelo já gravado, para copiar numa versão nova. */
export async function conteudoDe(db: Db, linha: typeof modeloApr.$inferSelect): Promise<ConteudoDoModelo> {
  const { riscos, itens } = await lerRiscosEItens(db, linha.id);
  return {
    titulo: linha.titulo,
    pae: (linha.pae as Record<string, unknown> | null) ?? null,
    dataDocumento: linha.dataDocumento,
    participantesComAssinatura: linha.participantesComAssinatura,
    riscos: riscos.map(({ classificacao, nome, ordem }) => ({ classificacao, nome, ordem })),
    itens: itens.map((i) => ({
      secao: i.secao,
      risco_ordem: i.riscoOrdem,
      ordem: i.ordem,
      texto: i.texto,
      resposta_bloqueante: i.respostaBloqueante,
      tipo: i.tipo,
      evidencia: i.evidencia,
      permite_na: i.permiteNa,
      mostrar_clima: i.mostrarClima,
    })),
  };
}

export async function versaoPublicadaMaisRecente(db: Db, codigo: string) {
  const [linha] = await db
    .select()
    .from(modeloApr)
    .where(and(eq(modeloApr.codigo, codigo), isNotNull(modeloApr.publicadoEm)))
    .orderBy(desc(modeloApr.versao))
    .limit(1);
  return linha;
}

export async function rascunhoDoCodigo(db: Db, codigo: string) {
  const [linha] = await db
    .select()
    .from(modeloApr)
    .where(and(eq(modeloApr.codigo, codigo), isNull(modeloApr.publicadoEm)))
    .limit(1);
  return linha;
}

export async function modeloPorVersao(db: Db, codigo: string, versao: number) {
  const [linha] = await db
    .select()
    .from(modeloApr)
    .where(and(eq(modeloApr.codigo, codigo), eq(modeloApr.versao, versao)))
    .limit(1);
  return linha;
}

/** Há uma versão publicada deste código e ele não foi excluído: pode ir para uma atividade ou ser o substituto de outro. */
export async function publicadoEmUso(db: Db, codigo: string) {
  const linha = await versaoPublicadaMaisRecente(db, codigo);
  return Boolean(linha && !linha.arquivadoEm);
}

/**
 * Versão pedida na URL: um número, ou `publicada` (a publicada mais recente, que um modelo excluído não tem mais).
 * Rascunho só para quem pode vê-lo. Uma versão numerada de um modelo excluído continua legível: é o histórico.
 */
export async function resolverVersao(db: Db, codigo: string, versao: string, veRascunho: boolean) {
  let linha: typeof modeloApr.$inferSelect | undefined;
  if (versao === "publicada") {
    linha = await versaoPublicadaMaisRecente(db, codigo);
    if (linha?.arquivadoEm) linha = undefined;
  } else if (/^[0-9]+$/.test(versao)) linha = await modeloPorVersao(db, codigo, Number(versao));
  if (!linha || (linha.publicadoEm === null && !veRascunho)) throw naoEncontrado("Modelo ou versão não encontrado");
  return linha;
}
