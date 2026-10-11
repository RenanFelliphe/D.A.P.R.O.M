import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { atividade, equipe, execucao, localInstalacao, os, reprogramacao, alerta } from "../db/schema";
import { codigoPostgres } from "../http/erros";
import { criarAlertas } from "./alertas";

/**
 * Processamento das ordens do SAP, o mesmo para a leitura pela API e para a planilha (Integração SAP, tabela de
 * estados). Cada ordem é independente: uma ordem inválida vira linha ignorada, não derruba as outras. Quem chama passa a
 * transação da leitura inteira; cada ordem roda num ponto de salvamento próprio (transação aninhada), então um erro do
 * banco numa ordem desfaz só aquela ordem.
 */

/** Uma ordem para processar. `linha` só existe na planilha (número da linha na aba). `ordem` é o objeto ainda não validado. */
export interface EntradaOrdem {
  linha?: number;
  ordem: unknown;
}

/** Linha ignorada: na leitura pela API vem identificada por `numero_ordem`; na planilha, por `linha`. */
export interface DetalheIgnorada {
  linha?: number;
  numero_ordem?: string;
  centro_trabalho?: string;
  motivo: string;
}

/** O que não impede a ordem de entrar, mas merece atenção (ex.: "Atividade sem modelo de APR"). */
export interface AvisoOrdem {
  linha?: number;
  numero_ordem: string;
  motivo: string;
}

export interface ResultadoProcessamento {
  criadas: number;
  atualizadas: number;
  ignoradas: DetalheIgnorada[];
  avisos: AvisoOrdem[];
}

export const MOTIVO_SEM_NUMERO = "Linha sem número de ordem";
export const MOTIVO_STATUS_DIFERENTE = "Status SAP diferente de liberada";
export const MOTIVO_REPROGRAMADA = "Reprogramada no sistema";
export const MOTIVO_SEM_EQUIPE = "Centro de trabalho sem equipe cadastrada";
export const AVISO_SEM_MODELO = "Atividade sem modelo de APR";

const TIPOS_DA_ORDEM = { YBA1: "corretiva", YBA2: "preventiva" } as const;

/** O status do sistema no SAP é uma lista de códigos separados por espaço (`LIB IMPR CAPC`); a `api` procura o `LIB`. */
export const statusLiberada = (statusSap: string | null | undefined) => (statusSap ?? "").toUpperCase().split(/\s+/).includes("LIB");

function dataReal(iso: string): boolean {
  const [a, m, d] = iso.split("-").map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

/** Texto (ou número) aparado; vazio vira `null`. */
const texto = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .transform((v) => (v === "" ? null : v));
const textoOpcional = texto.nullish();
const textoObrigatorio = z.unknown().transform((v, ctx) => {
  const r = texto.safeParse(v);
  if (!r.success || r.data === null) {
    ctx.addIssue({ code: "custom", message: "Campo obrigatório" });
    return z.NEVER;
  }
  return r.data;
});

/** `AAAA-MM-DD`, ou um instante ISO do qual só a data interessa. */
const data = z.string({ error: "Campo obrigatório" }).transform((v, ctx) => {
  const m = /^(\d{4}-\d{2}-\d{2})(?:[T ].*)?$/.exec(v.trim());
  if (!m || !dataReal(m[1]!)) {
    ctx.addIssue({ code: "custom", message: "Data inválida (use AAAA-MM-DD)" });
    return z.NEVER;
  }
  return m[1]!;
});
const dataOpcional = z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), data.nullish());

/** Quando a emissão não vem como data válida, o campo é só descartado. */
const dataBranda = z.unknown().transform((v) => {
  const r = data.safeParse(v);
  return r.success ? r.data : null;
});

/** A ordem como a API do SAP a entrega (`OrdemSap`), já validada e com texto vazio como `null`. */
export const esquemaOrdem = z
  .object({
    numero_ordem: textoObrigatorio,
    numero_nota: textoOpcional,
    tipo_ordem: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.enum(["YBA1", "YBA2"], { error: "Tipo de ordem inválido (use YBA1 ou YBA2)" })),
    tipo_atividade: textoOpcional,
    codigo_atividade: textoOpcional,
    titulo: textoObrigatorio,
    descricao: textoOpcional,
    centro_trabalho: textoObrigatorio,
    local_instalacao: z.object({
      codigo: textoObrigatorio,
      endereco: textoOpcional,
      plus_code: textoOpcional,
      cliente: textoOpcional,
    }),
    equipamento: textoOpcional,
    prioridade: textoOpcional,
    data_inicio_prog: data,
    data_fim_prog: dataOpcional,
    status_sap: textoOpcional,
    solicitante: textoOpcional,
    criado_por: textoOpcional,
    criada_em: dataBranda.optional(),
    plano_manutencao: textoOpcional,
    item_manutencao: textoOpcional,
  })
  .superRefine((o, ctx) => {
    if (o.data_fim_prog && o.data_fim_prog < o.data_inicio_prog) {
      ctx.addIssue({ code: "custom", path: ["data_fim_prog"], message: "A data fim programada é anterior ao início" });
    }
  });
export type OrdemNormalizada = z.output<typeof esquemaOrdem>;

/** Interrompe o processamento de uma ordem, desfazendo o que ela tivesse gravado, e a registra como ignorada. */
class Ignorada extends Error {
  constructor(
    readonly motivo: string,
    readonly centroTrabalho?: string,
  ) {
    super(motivo);
  }
}

interface Contexto {
  agora: Date;
  origem: "sap" | "planilha";
  equipes: Map<string, string | null>;
  locais: Map<string, string>;
  atividades: Map<string, { modeloAprCodigo: string | null } | null>;
}

const textoSimples = (v: unknown): string | null => {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).trim();
  return t === "" ? null : t;
};

async function equipeDoCentro(db: Db, ctx: Contexto, centro: string): Promise<string | null> {
  if (!ctx.equipes.has(centro)) {
    const [e] = await db.select({ id: equipe.id }).from(equipe).where(eq(equipe.centroTrabalho, centro));
    ctx.equipes.set(centro, e?.id ?? null);
  }
  return ctx.equipes.get(centro)!;
}

/** Id do local pelo código; cria o local se ainda não existe (a leitura cria locais automaticamente). */
async function localDaOrdem(db: Db, ctx: Contexto, l: OrdemNormalizada["local_instalacao"]): Promise<string> {
  const guardado = ctx.locais.get(l.codigo);
  if (guardado) return guardado;
  const [existente] = await db.select({ id: localInstalacao.id }).from(localInstalacao).where(eq(localInstalacao.codigo, l.codigo));
  let id = existente?.id;
  if (!id) {
    const [criado] = await db
      .insert(localInstalacao)
      .values({ codigo: l.codigo, endereco: l.endereco ?? null, plusCode: l.plus_code ?? null, cliente: l.cliente ?? null })
      .returning({ id: localInstalacao.id });
    id = criado!.id;
  }
  ctx.locais.set(l.codigo, id);
  return id;
}

/**
 * Situação da atividade da ordem. Código desconhecido é cadastrado em `atividade` sem modelo, para a Segurança do
 * Trabalho mapear. Só um código com modelo ligado vai para a OS; sem ele o técnico escolhe o modelo ao iniciar a APR.
 */
async function atividadeDaOrdem(db: Db, ctx: Contexto, ordem: OrdemNormalizada): Promise<{ codigo: string | null; comModelo: boolean }> {
  const codigo = ordem.codigo_atividade;
  if (!codigo) return { codigo: null, comModelo: false };
  if (!ctx.atividades.has(codigo)) {
    const [existente] = await db.select({ modeloAprCodigo: atividade.modeloAprCodigo }).from(atividade).where(eq(atividade.codigo, codigo));
    if (!existente) {
      await db.insert(atividade).values({ codigo, descricao: ordem.titulo, modeloAprCodigo: null, provisorio: false }).onConflictDoNothing();
    }
    ctx.atividades.set(codigo, existente ?? { modeloAprCodigo: null });
  }
  const a = ctx.atividades.get(codigo)!;
  return a.modeloAprCodigo ? { codigo, comModelo: true } : { codigo: null, comModelo: false };
}

function validar(bruto: unknown): OrdemNormalizada {
  const r = esquemaOrdem.safeParse(bruto);
  if (r.success) return r.data;
  const primeira = r.error.issues[0];
  const campo = primeira?.path.join(".");
  throw new Ignorada(`Ordem inválida: ${campo ? `${campo}: ` : ""}${primeira?.message ?? "formato inesperado"}`);
}

type Resultado = { tipo: "criada"; aviso?: string } | { tipo: "atualizada" };

async function cancelarNoSap(db: Db, ctx: Contexto, existente: typeof os.$inferSelect, statusSap: string | null): Promise<Resultado> {
  // OS já finalizada no app (encerrada ou cancelada): o SAP só a acompanha; status e execução ficam como estão.
  if (existente.status === "encerrada" || existente.status === "cancelada") {
    await db.update(os).set({ statusSap }).where(eq(os.id, existente.id));
    return { tipo: "atualizada" };
  }

  const [emAndamento] = await db
    .select({ id: execucao.id })
    .from(execucao)
    .where(and(eq(execucao.osId, existente.id), isNull(execucao.resultado)))
    .limit(1);

  if (emAndamento) {
    // A execução segue; conflito vira alerta, nunca sobrescrita (Decisão-chave 2).
    await db.update(os).set({ statusSap }).where(eq(os.id, existente.id));
    const detalhe = `A ordem ${existente.numeroOrdem} foi cancelada ou encerrada no SAP (status ${statusSap ?? "vazio"}), mas tem execução em andamento; a execução segue`;
    const [repetido] = await db
      .select({ id: alerta.id })
      .from(alerta)
      .where(and(eq(alerta.osId, existente.id), eq(alerta.tipo, "conflito_planejamento"), eq(alerta.detalhe, detalhe)))
      .limit(1);
    if (!repetido) await criarAlertas(db, { tipo: "conflito_planejamento", osId: existente.id, equipeId: existente.equipeId, detalhe });
    return { tipo: "atualizada" };
  }

  await db.update(os).set({ status: "cancelada", canceladaEm: ctx.agora, statusSap }).where(eq(os.id, existente.id));
  return { tipo: "atualizada" };
}

async function atualizarOrdem(db: Db, ctx: Contexto, existente: typeof os.$inferSelect, bruto: unknown): Promise<Resultado> {
  const ordem = validar(bruto);

  // A reprogramação feita no sistema vence a data do SAP (questão 14).
  if (existente.dataInicioProg !== ordem.data_inicio_prog) {
    const [reprogramada] = await db.select({ id: reprogramacao.id }).from(reprogramacao).where(eq(reprogramacao.osId, existente.id)).limit(1);
    if (reprogramada) throw new Ignorada(MOTIVO_REPROGRAMADA);
  }

  const dataFim = ordem.data_fim_prog === undefined ? existente.dataFimProg : ordem.data_fim_prog;
  if (dataFim && dataFim < ordem.data_inicio_prog) throw new Ignorada("Ordem inválida: data_fim_prog: A data fim programada é anterior ao início");

  const localId = await localDaOrdem(db, ctx, ordem.local_instalacao);
  const ativ = existente.codigoAtividade ? null : await atividadeDaOrdem(db, ctx, ordem);

  // Só colunas de planejamento: nunca status, execução, equipe, ciência nem PDF.
  await db
    .update(os)
    .set({
      titulo: ordem.titulo,
      ...(ordem.descricao !== undefined && { descricao: ordem.descricao }),
      ...(ordem.equipamento !== undefined && { equipamento: ordem.equipamento }),
      localInstalacaoId: localId,
      ...(ordem.prioridade !== undefined && { prioridade: ordem.prioridade }),
      dataInicioProg: ordem.data_inicio_prog,
      ...(ordem.data_fim_prog !== undefined && { dataFimProg: ordem.data_fim_prog }),
      ...(ordem.plano_manutencao !== undefined && { planoManutencao: ordem.plano_manutencao }),
      ...(ordem.item_manutencao !== undefined && { itemManutencao: ordem.item_manutencao }),
      ...(ordem.tipo_atividade !== undefined && { tipoAtividade: ordem.tipo_atividade }),
      ...(ordem.solicitante !== undefined && { solicitante: ordem.solicitante }),
      ...(ordem.numero_nota !== undefined && { numeroNota: ordem.numero_nota }),
      ...(ordem.criada_em !== undefined && { dataOrdem: ordem.criada_em }),
      ...(ordem.criado_por !== undefined && { criadoPorSap: ordem.criado_por }),
      statusSap: ordem.status_sap ?? null,
      ...(ativ?.codigo && { codigoAtividade: ativ.codigo }),
    })
    .where(eq(os.id, existente.id));
  return { tipo: "atualizada" };
}

async function criarOrdem(db: Db, ctx: Contexto, bruto: unknown): Promise<Resultado> {
  const ordem = validar(bruto);
  const equipeId = await equipeDoCentro(db, ctx, ordem.centro_trabalho);
  if (!equipeId) throw new Ignorada(MOTIVO_SEM_EQUIPE, ordem.centro_trabalho);

  const localId = await localDaOrdem(db, ctx, ordem.local_instalacao);
  const ativ = await atividadeDaOrdem(db, ctx, ordem);

  await db.insert(os).values({
    numeroOrdem: ordem.numero_ordem,
    numeroNota: ordem.numero_nota ?? null,
    tipo: TIPOS_DA_ORDEM[ordem.tipo_ordem],
    tipoAtividade: ordem.tipo_atividade ?? null,
    codigoAtividade: ativ.codigo,
    titulo: ordem.titulo,
    descricao: ordem.descricao ?? null,
    equipamento: ordem.equipamento ?? null,
    localInstalacaoId: localId,
    equipeId,
    planoManutencao: ordem.plano_manutencao ?? null,
    itemManutencao: ordem.item_manutencao ?? null,
    prioridade: ordem.prioridade ?? null,
    dataInicioProg: ordem.data_inicio_prog,
    dataFimProg: ordem.data_fim_prog ?? null,
    status: "liberada",
    dataOrdem: ordem.criada_em ?? null,
    criadoPorSap: ordem.criado_por ?? null,
    statusSap: ordem.status_sap ?? null,
    solicitante: ordem.solicitante ?? null,
    origem: ctx.origem === "planilha" ? "planilha" : "sap",
  });
  return { tipo: "criada", ...(ativ.comModelo ? {} : { aviso: AVISO_SEM_MODELO }) };
}

async function processarUma(db: Db, ctx: Contexto, bruto: unknown): Promise<Resultado> {
  if (!bruto || typeof bruto !== "object") throw new Ignorada("Ordem inválida: formato inesperado");
  const numero = textoSimples((bruto as Record<string, unknown>).numero_ordem);
  if (!numero) throw new Ignorada(MOTIVO_SEM_NUMERO);

  const statusSap = textoSimples((bruto as Record<string, unknown>).status_sap);
  const [existente] = await db.select().from(os).where(eq(os.numeroOrdem, numero));

  if (existente) {
    return statusLiberada(statusSap) ? atualizarOrdem(db, ctx, existente, bruto) : cancelarNoSap(db, ctx, existente, statusSap);
  }
  if (!statusLiberada(statusSap)) throw new Ignorada(MOTIVO_STATUS_DIFERENTE);
  return criarOrdem(db, ctx, bruto);
}

/** Resultado de uma tentativa que o próprio código interrompeu de propósito, para desfazer o ponto de salvamento. */
class Desfeita extends Error {
  constructor(readonly ignorada: Ignorada) {
    super(ignorada.motivo);
  }
}

export async function processarOrdens(
  db: Db,
  entradas: EntradaOrdem[],
  opcoes: { origem: "sap" | "planilha"; agora: Date },
): Promise<ResultadoProcessamento> {
  const ctx: Contexto = { agora: opcoes.agora, origem: opcoes.origem, equipes: new Map(), locais: new Map(), atividades: new Map() };
  const resultado: ResultadoProcessamento = { criadas: 0, atualizadas: 0, ignoradas: [], avisos: [] };

  for (const [indice, entrada] of entradas.entries()) {
    const numero = entrada.ordem && typeof entrada.ordem === "object" ? textoSimples((entrada.ordem as Record<string, unknown>).numero_ordem) : null;
    const identificacao = (): Pick<DetalheIgnorada, "linha" | "numero_ordem"> => ({
      ...(entrada.linha !== undefined ? { linha: entrada.linha } : numero ? {} : { linha: indice + 1 }),
      ...(numero ? { numero_ordem: numero } : {}),
    });

    try {
      const r = await db.transaction(async (tx) => {
        try {
          return await processarUma(tx as unknown as Db, ctx, entrada.ordem);
        } catch (erro) {
          if (erro instanceof Ignorada) throw new Desfeita(erro);
          throw erro;
        }
      });
      if (r.tipo === "criada") {
        resultado.criadas++;
        if (r.aviso) resultado.avisos.push({ ...identificacao(), numero_ordem: numero!, motivo: r.aviso });
      } else resultado.atualizadas++;
    } catch (erro) {
      // O ponto de salvamento foi desfeito: o que a ordem deixou em cache (local ou atividade novos) já não existe.
      ctx.locais.clear();
      ctx.atividades.clear();
      if (erro instanceof Desfeita) {
        const { ignorada } = erro;
        resultado.ignoradas.push({ ...identificacao(), ...(ignorada.centroTrabalho ? { centro_trabalho: ignorada.centroTrabalho } : {}), motivo: ignorada.motivo });
      } else if (codigoPostgres(erro)) {
        resultado.ignoradas.push({ ...identificacao(), motivo: "Dado recusado pelas regras do banco" });
      } else {
        throw erro;
      }
    }
  }
  return resultado;
}
