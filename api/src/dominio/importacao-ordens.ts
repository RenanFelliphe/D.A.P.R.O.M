import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { atividade, equipe, execucao, localInstalacao, os, osDigitalizacao, reprogramacao, alerta, type MANUSCRITO_FONTES } from "../db/schema";
import { codigoPostgres } from "../http/erros";
import { criarAlertas } from "./alertas";
import { chaveDoPlano, garantirPlano, lerIntervalo } from "./preventivas";

/**
 * Processamento das ordens do SAP, o mesmo para a leitura pela API, a planilha e o PDF da OS (Integração SAP, tabela de
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

/** Plano de preventiva que a importação tocou e que ainda está sem intervalo entre ciclos. */
export interface PlanoSemIntervalo {
  planoId: string;
  planoManutencao: string;
  itemManutencao: string | null;
  titulo: string;
  numeroOrdem: string;
}

/**
 * O que a Digitalização acrescenta a uma OS antiga (`origem = 'digitalizacao'`): o id e o PDF das folhas, que o registro já
 * preparou, e o que a folha diz da execução. A OS entra encerrada, de histórico: sem `execucao`, sem APR, sem pontos.
 */
export interface DadosDoHistorico {
  osId: string;
  digitalizacaoId: string;
  usuarioId: string;
  /** Caminho do PDF das folhas desta OS no bucket `pdfs`. */
  pdfPath: string;
  paginas: number[];
  inicioReal: Date | null;
  fimReal: Date | null;
  numeroPessoas: number | null;
  textoManuscrito: string | null;
  fonte: (typeof MANUSCRITO_FONTES)[number];
}

export interface ResultadoProcessamento {
  /** As OS que a Digitalização encerrou (criadas ou já existentes), com o id de cada uma. */
  registradas: { numero_ordem: string; osId: string }[];
  criadas: number;
  atualizadas: number;
  ignoradas: DetalheIgnorada[];
  avisos: AvisoOrdem[];
  /** Planos de preventiva que as ordens criaram ou atualizaram (para conferir os alertas do ciclo depois). */
  planos: string[];
  /** Desses, os que seguem sem intervalo: a tela de importação pede para defini-lo. */
  planosSemIntervalo: PlanoSemIntervalo[];
}

export const MOTIVO_SEM_NUMERO = "Linha sem número de ordem";
export const MOTIVO_STATUS_DIFERENTE = "Status SAP diferente de liberada";
export const MOTIVO_REPROGRAMADA = "Reprogramada no sistema";
export const MOTIVO_SEM_EQUIPE = "Centro de trabalho sem equipe cadastrada";
export const AVISO_INTERVALO_INVALIDO = "Intervalo entre ciclos não reconhecido (use, por exemplo, 30 dias, 3 meses ou trimestral); o plano ficou como estava";

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
    /**
     * Intervalo entre ciclos da preventiva: `{quantidade, unidade}` ou texto ("3 meses", "trimestral", "30 dias"). Opcional; só
     * vale na preventiva com plano. Lido à parte (`lerIntervalo`): um valor que não dá para entender não recusa a ordem.
     */
    intervalo_ciclo: z.unknown().optional(),
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

/** De onde vêm as ordens: a leitura da API do SAP, a planilha exportada ou o PDF da OS impressa. */
export type OrigemDasOrdens = "sap" | "planilha" | "pdf" | "digitalizacao";

interface Contexto {
  agora: Date;
  origem: OrigemDasOrdens;
  equipes: Map<string, string | null>;
  locais: Map<string, string>;
  /** Códigos de atividade que já se sabe existirem (ou que esta importação cadastrou). */
  atividades: Set<string>;
  /** Só na Digitalização: o que registrar de cada OS, pelo número da ordem. */
  historico: Map<string, DadosDoHistorico>;
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
 * O código da atividade da ordem (o serviço do catálogo), ou `null` se ela não traz um. Código desconhecido é cadastrado
 * em `atividade`, com o título da ordem como descrição, para o admin montar a lista de materiais. A atividade não escolhe
 * o modelo da APR: o técnico escolhe a cada APR.
 */
async function atividadeDaOrdem(db: Db, ctx: Contexto, ordem: OrdemNormalizada): Promise<string | null> {
  const codigo = ordem.codigo_atividade;
  if (!codigo) return null;
  if (!ctx.atividades.has(codigo)) {
    await db.insert(atividade).values({ codigo, descricao: ordem.titulo, provisorio: false }).onConflictDoNothing();
    ctx.atividades.add(codigo);
  }
  return codigo;
}

function validar(bruto: unknown): OrdemNormalizada {
  const r = esquemaOrdem.safeParse(bruto);
  if (r.success) return r.data;
  const primeira = r.error.issues[0];
  const campo = primeira?.path.join(".");
  throw new Ignorada(`Ordem inválida: ${campo ? `${campo}: ` : ""}${primeira?.message ?? "formato inesperado"}`);
}

interface PlanoTocado {
  id: string;
  semIntervalo: boolean;
  chave: { plano: string; item: string | null };
  titulo: string;
}
type Resultado = { tipo: "criada" | "atualizada" } & { plano?: PlanoTocado; intervaloInvalido?: boolean; osId?: string };

/**
 * O plano da OS preventiva (criado na primeira OS dele) e, se a ordem trouxe, o intervalo entre ciclos. Um intervalo que não
 * dá para entender não muda o plano e vira aviso.
 */
async function planoDaOrdem(db: Db, ctx: Contexto, tipo: string, plano: string | null, item: string | null, titulo: string, bruto: unknown) {
  const chave = tipo === "preventiva" ? chaveDoPlano(plano, item) : null;
  if (!chave) return {};
  const intervalo = lerIntervalo((bruto as Record<string, unknown>).intervalo_ciclo);
  const p = await garantirPlano(db, chave, intervalo ?? undefined, ctx.agora);
  return { plano: { id: p.id, semIntervalo: p.semIntervalo, chave, titulo }, ...(intervalo === undefined ? { intervaloInvalido: true } : {}) };
}

async function cancelarNoSap(db: Db, ctx: Contexto, existente: typeof os.$inferSelect, statusSap: string | null): Promise<Resultado> {
  // OS já finalizada no app (encerrada ou cancelada): o SAP só a acompanha; status e execução ficam como estão.
  if (existente.status === "encerrada" || existente.status === "cancelada" || existente.status === "encerrando" || existente.status === "aguardando_supervisor") {
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

  // A OS devolvida volta ao quadro quando o SAP a traz de novo (o planejador corrigiu a ordem): é a resposta à devolução. O PDF
  // é a foto de quando a OS foi impressa e não a traz de volta. A justificativa antiga fica na trilha de auditoria.
  const volta = existente.status === "devolvida" && ctx.origem !== "pdf";

  // Só colunas de planejamento: nunca execução, equipe, ciência, PDF nem a reserva; o status só muda para trazer de volta a devolvida.
  await db
    .update(os)
    .set({
      ...(volta && { status: "liberada" as const, devolvidaEm: null, devolvidaPor: null, justificativaDevolucao: null, devolucaoExportadaEm: null }),
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
      ...(ativ && { codigoAtividade: ativ }),
    })
    .where(eq(os.id, existente.id));
  const plano = ordem.plano_manutencao === undefined ? existente.planoManutencao : ordem.plano_manutencao;
  const item = ordem.item_manutencao === undefined ? existente.itemManutencao : ordem.item_manutencao;
  return { tipo: "atualizada", ...(await planoDaOrdem(db, ctx, existente.tipo, plano, item, ordem.titulo, bruto)) };
}

async function criarOrdem(db: Db, ctx: Contexto, bruto: unknown, extras: Partial<typeof os.$inferInsert> = {}): Promise<Resultado> {
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
    codigoAtividade: ativ,
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
    origem: ctx.origem,
    ...extras,
  });
  const plano = await planoDaOrdem(db, ctx, TIPOS_DA_ORDEM[ordem.tipo_ordem], ordem.plano_manutencao ?? null, ordem.item_manutencao ?? null, ordem.titulo, bruto);
  return { tipo: "criada", ...plano };
}

/** O histórico da folha em papel: guardado junto com a OS, no mesmo ponto de salvamento. */
async function guardarHistorico(db: Db, ctx: Contexto, h: DadosDoHistorico) {
  await db.insert(osDigitalizacao).values({
    osId: h.osId,
    digitalizacaoId: h.digitalizacaoId,
    paginas: h.paginas,
    inicioReal: h.inicioReal,
    fimReal: h.fimReal,
    numeroPessoas: h.numeroPessoas,
    textoManuscrito: h.textoManuscrito,
    manuscritoFonte: h.fonte,
    registradaPor: h.usuarioId,
    registradaEm: ctx.agora,
  });
}

/**
 * Digitalização: a OS da folha já foi executada no papel, então entra `encerrada`, como histórico, e já "exportada" (o SAP a
 * baixou no papel: ela não entra na planilha de baixa). Uma OS que já existe só é encerrada se ainda está `liberada` e sem
 * execução; qualquer outra situação é da operação do sistema e a folha é recusada. O status do SAP impresso não importa.
 */
async function registrarDigitalizada(db: Db, ctx: Contexto, numero: string, bruto: unknown): Promise<Resultado> {
  const h = ctx.historico.get(numero);
  if (!h) throw new Ignorada("Folha sem os dados do histórico");
  const [existente] = await db.select().from(os).where(eq(os.numeroOrdem, numero));
  if (existente) {
    if (existente.status !== "liberada") throw new Ignorada(`A OS já está no sistema com o status "${existente.status}": a folha em papel não foi registrada`);
    const [comExecucao] = await db.select({ id: execucao.id }).from(execucao).where(eq(execucao.osId, existente.id)).limit(1);
    if (comExecucao) throw new Ignorada("A OS já tem execução no sistema: a folha em papel não foi registrada");
    await db.update(os).set({ status: "encerrada", exportadaSapEm: ctx.agora, pdfPath: h.pdfPath, pdfEm: ctx.agora }).where(eq(os.id, existente.id));
    await guardarHistorico(db, ctx, { ...h, osId: existente.id });
    return { tipo: "atualizada", osId: existente.id };
  }
  const criada = await criarOrdem(db, ctx, bruto, { id: h.osId, status: "encerrada", exportadaSapEm: ctx.agora, pdfPath: h.pdfPath, pdfEm: ctx.agora });
  await guardarHistorico(db, ctx, h);
  return { ...criada, osId: h.osId };
}

async function processarUma(db: Db, ctx: Contexto, bruto: unknown): Promise<Resultado> {
  if (!bruto || typeof bruto !== "object") throw new Ignorada("Ordem inválida: formato inesperado");
  const numero = textoSimples((bruto as Record<string, unknown>).numero_ordem);
  if (!numero) throw new Ignorada(MOTIVO_SEM_NUMERO);

  if (ctx.origem === "digitalizacao") return registrarDigitalizada(db, ctx, numero, bruto);

  const statusSap = textoSimples((bruto as Record<string, unknown>).status_sap);
  const [existente] = await db.select().from(os).where(eq(os.numeroOrdem, numero));

  if (existente) {
    if (statusLiberada(statusSap)) return atualizarOrdem(db, ctx, existente, bruto);
    // O PDF é a foto de quando a OS foi impressa (pode ser antiga): não cancela uma OS que o SAP pode ter liberado de novo.
    if (ctx.origem === "pdf") throw new Ignorada(MOTIVO_STATUS_DIFERENTE);
    return cancelarNoSap(db, ctx, existente, statusSap);
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
  opcoes: { origem: OrigemDasOrdens; agora: Date; historico?: Map<string, DadosDoHistorico> },
): Promise<ResultadoProcessamento> {
  const ctx: Contexto = { agora: opcoes.agora, origem: opcoes.origem, equipes: new Map(), locais: new Map(), atividades: new Set(), historico: opcoes.historico ?? new Map() };
  const resultado: ResultadoProcessamento = { registradas: [], criadas: 0, atualizadas: 0, ignoradas: [], avisos: [], planos: [], planosSemIntervalo: [] };
  const semIntervalo = new Map<string, PlanoSemIntervalo>();

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
      if (r.osId) resultado.registradas.push({ numero_ordem: numero!, osId: r.osId });
      if (r.tipo === "criada") resultado.criadas++;
      else resultado.atualizadas++;
      if (r.intervaloInvalido) resultado.avisos.push({ ...identificacao(), numero_ordem: numero!, motivo: AVISO_INTERVALO_INVALIDO });
      if (r.plano) {
        if (!resultado.planos.includes(r.plano.id)) resultado.planos.push(r.plano.id);
        if (r.plano.semIntervalo) {
          semIntervalo.set(r.plano.id, {
            planoId: r.plano.id,
            planoManutencao: r.plano.chave.plano,
            itemManutencao: r.plano.chave.item,
            titulo: r.plano.titulo,
            numeroOrdem: numero!,
          });
        } else semIntervalo.delete(r.plano.id);
      }
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
  resultado.planosSemIntervalo = [...semIntervalo.values()];
  return resultado;
}
