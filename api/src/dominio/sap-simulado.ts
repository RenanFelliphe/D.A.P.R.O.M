import { and, asc, desc, eq, inArray, isNotNull, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { atividade, equipe, importacao, ordemSapSimulada, os, type OsStatus } from "../db/schema";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { dataIso } from "../http/validacao";
import { ultimaLeituraConcluida } from "../servicos/leitura-sap";
import type { OrdemSap } from "../servicos/sap";
import { algum, contem } from "./busca";
import type { DetalheIgnorada } from "./importacao-ordens";
import { AVISO_SEM_MODELO, esquemaOrdem } from "./importacao-ordens";
import { SETORES } from "./rh-simulado";

/*
 * O SAP simulado (`apiSAP.md`): o contrato que o DAPROM lê (agora a partir da tabela `ordem_sap_simulada`), o catálogo e o gerador
 * de ordens fictícias e as operações de gestão da tela `/simulador/ordens`. O DAPROM só fala com o simulador pelo contrato HTTP; a
 * gestão consulta as tabelas `os` e `importacao` só para mostrar, na coluna "No DAPROM", como ele reagiu (atalho de demonstração).
 */

type Linha = typeof ordemSapSimulada.$inferSelect;
type NovaLinha = typeof ordemSapSimulada.$inferInsert;

// ------------------------------------------------------------------------------------------------------------------
// Contrato
// ------------------------------------------------------------------------------------------------------------------

/** A ordem no formato do contrato (`OrdemSap`): o que o DAPROM lê. Sem intervalo, a chave nem existe. */
export function paraContrato(l: Linha): OrdemSap {
  return {
    numero_ordem: l.numeroOrdem,
    numero_nota: l.numeroNota,
    tipo_ordem: l.tipoOrdem,
    tipo_atividade: l.tipoAtividade,
    codigo_atividade: l.codigoAtividade,
    titulo: l.titulo,
    descricao: l.descricao,
    centro_trabalho: l.centroTrabalho,
    local_instalacao: { codigo: l.localCodigo, endereco: l.localEndereco, plus_code: l.localPlusCode, cliente: l.localCliente },
    equipamento: l.equipamento,
    prioridade: l.prioridade,
    data_inicio_prog: l.dataInicioProg,
    data_fim_prog: l.dataFimProg,
    status_sap: l.statusSap,
    solicitante: l.solicitante,
    criado_por: l.criadoPor,
    criada_em: l.criadaEm ? l.criadaEm.toISOString() : null,
    plano_manutencao: l.planoManutencao,
    item_manutencao: l.itemManutencao,
    ...(l.intervaloCiclo != null && { intervalo_ciclo: l.intervaloCiclo as OrdemSap["intervalo_ciclo"] }),
  };
}

/** Uma ordem do contrato (já validada) como linha da tabela. */
export function deContrato(o: z.output<typeof esquemaOrdem>, agora: Date): NovaLinha {
  return {
    numeroOrdem: o.numero_ordem,
    numeroNota: o.numero_nota ?? null,
    tipoOrdem: o.tipo_ordem,
    tipoAtividade: o.tipo_atividade ?? null,
    codigoAtividade: o.codigo_atividade ?? null,
    titulo: o.titulo,
    descricao: o.descricao ?? null,
    centroTrabalho: o.centro_trabalho,
    localCodigo: o.local_instalacao.codigo,
    localEndereco: o.local_instalacao.endereco ?? null,
    localPlusCode: o.local_instalacao.plus_code ?? null,
    localCliente: o.local_instalacao.cliente ?? null,
    equipamento: o.equipamento ?? null,
    prioridade: o.prioridade ?? null,
    dataInicioProg: o.data_inicio_prog,
    dataFimProg: o.data_fim_prog ?? null,
    statusSap: o.status_sap ?? null,
    solicitante: o.solicitante ?? null,
    criadoPor: o.criado_por ?? null,
    criadaEm: o.criada_em ? new Date(o.criada_em) : agora,
    planoManutencao: o.plano_manutencao ?? null,
    itemManutencao: o.item_manutencao ?? null,
    intervaloCiclo: o.intervalo_ciclo != null ? (o.intervalo_ciclo as object | string) : null,
    alteradaEm: agora,
  };
}

/** Página do contrato (`GET /ordens`), por número da ordem; `alteradasDesde` filtra pela `alterada_em` da tabela. */
export async function paginaDoContrato(db: Db, o: { alteradasDesde?: Date; pagina: number; tamanho: number }) {
  const onde = o.alteradasDesde ? sql`${ordemSapSimulada.alteradaEm} >= ${o.alteradasDesde}` : undefined;
  const linhas = await db
    .select()
    .from(ordemSapSimulada)
    .where(onde)
    .orderBy(asc(ordemSapSimulada.numeroOrdem))
    .limit(o.tamanho + 1)
    .offset((o.pagina - 1) * o.tamanho);
  return { ordens: linhas.slice(0, o.tamanho).map(paraContrato), ...(linhas.length > o.tamanho ? { proxima_pagina: o.pagina + 1 } : {}) };
}

export async function obterOrdemSimulada(db: Db, numero: string): Promise<Linha | null> {
  const [l] = await db.select().from(ordemSapSimulada).where(eq(ordemSapSimulada.numeroOrdem, numero));
  return l ?? null;
}

// ------------------------------------------------------------------------------------------------------------------
// Catálogos
// ------------------------------------------------------------------------------------------------------------------

/** Opções prontas do status SAP; a tela também aceita texto livre. A regra do DAPROM é só procurar o `LIB`. */
export const STATUS_PRONTOS = [
  { codigo: "CRTD", rotulo: "Criada" },
  { codigo: "LIB", rotulo: "Liberada" },
  { codigo: "LIB IMPR", rotulo: "Liberada e impressa" },
  { codigo: "LIB IMPR CAPC", rotulo: "Liberada, impressa e com custos" },
  { codigo: "ENCE", rotulo: "Encerrada" },
] as const;

export interface LocalDoCatalogo {
  codigo: string;
  endereco: string;
  plus_code: string;
  cliente: string | null;
}

/** Locais de instalação fictícios: os das ordens de exemplo e os da demonstração. */
export const LOCAIS: readonly LocalDoCatalogo[] = [
  { codigo: "VILA VELHA/REDE VILA VELHA", endereco: "Rua das Palmeiras, 120, Vila Velha/ES", plus_code: "6R7M+4Q Vila Velha, ES", cliente: "Distribuição" },
  { codigo: "ERP SERRA/ESTACAO ERP SERRA", endereco: "Rod. BR-101, km 262, Serra/ES", plus_code: "7R2F+9J Serra, ES", cliente: "Suzano" },
  { codigo: "GUARAPARI/ESTACAO GUARAPARI", endereco: "Rod. do Sol, km 21 — Guarapari/ES", plus_code: "6RQ7+XJ Guarapari, ES", cliente: null },
  { codigo: "CARIACICA/RAMAL CARIACICA", endereco: "Av. Mário Gurgel, 800 — Cariacica/ES", plus_code: "6RP4+3C Cariacica, ES", cliente: null },
  { codigo: "VITORIA/ESTACAO VITORIA", endereco: "Av. Dante Michelini, 55 — Vitória/ES", plus_code: "6RQ8+2M Vitória, ES", cliente: null },
  { codigo: "SERRA/ESTACAO SERRA SUL", endereco: "Rua da Fábrica, 310 — Serra/ES", plus_code: "7R3G+5P Serra, ES", cliente: null },
  { codigo: "TUBARAO/PR PONTO DE RECEBIMENTO", endereco: "Av. Brigadeiro Eduardo Gomes, s/n — Vitória/ES", plus_code: "6RQ9+7W Vitória, ES", cliente: "Vale" },
  { codigo: "ARACRUZ/ERS ARACRUZ", endereco: "Rod. ES-257, km 6 — Aracruz/ES", plus_code: "7V4C+8H Aracruz, ES", cliente: "Suzano" },
  { codigo: "LINHARES/REDE LINHARES", endereco: "Av. Nossa Senhora da Conceição, 90 — Linhares/ES", plus_code: "8V2G+4R Linhares, ES", cliente: null },
];

export interface ServicoDoCatalogo {
  titulo: string;
  descricao: string;
  tipo: "YBA1" | "YBA2";
  /** Prefixo do equipamento ("DCV" gera `DCV-VV-0042`). */
  prefixo: string;
}

/** Serviços fictícios, no estilo das ordens de exemplo. */
export const SERVICOS: readonly ServicoDoCatalogo[] = [
  { titulo: "Desobstrução de caixa de válvula", descricao: "Caixa de válvula com acúmulo de água e sedimento. Desobstruir, drenar e verificar o estado da válvula. Materiais: bomba de sucção, mangote, EPI. Ferramentas: chave de caixa, espelho.", tipo: "YBA1", prefixo: "DCV" },
  { titulo: "Reparo de vazamento em ramal", descricao: "Vazamento detectado no ramal. Isolar o trecho, substituir a conexão e testar a estanqueidade. Materiais: conexão, vedante, lacre. Ferramentas: chaves, manômetro.", tipo: "YBA1", prefixo: "RML" },
  { titulo: "Substituição de manômetro", descricao: "Manômetro com leitura instável. Substituir pelo novo, aferir e lacrar. Materiais: manômetro, fita veda-rosca. Ferramentas: chaves, bomba de teste.", tipo: "YBA1", prefixo: "MAN" },
  { titulo: "Troca de regulador de pressão", descricao: "Regulador com variação de pressão fora da faixa. Substituir, ajustar e registrar o ajuste. Materiais: regulador, junta. Ferramentas: chaves, torquímetro.", tipo: "YBA1", prefixo: "REG" },
  { titulo: "Inspeção funcional de retificador", descricao: "Inspeção funcional do retificador de proteção catódica: leitura de tensão e corrente de saída, verificação de conexões e do horímetro.", tipo: "YBA2", prefixo: "RET" },
  { titulo: "Inspeção de corrosão em válvulas", descricao: "Inspecionar visualmente as válvulas, registrar com foto cada ponto de corrosão e aplicar inibidor onde a corrosão for superficial.", tipo: "YBA2", prefixo: "VLV" },
  { titulo: "Lavagem de estação", descricao: "Lavagem geral da estação: pisos, canaletas e equipamentos externos. Materiais: detergente, escovas. Ferramentas: lavadora de alta pressão.", tipo: "YBA2", prefixo: "EST" },
  { titulo: "Calibração de transmissor de pressão", descricao: "Calibrar o transmissor de pressão contra o padrão e registrar os desvios. Materiais: selos. Ferramentas: calibrador, notebook.", tipo: "YBA2", prefixo: "PT" },
];

const PRIORIDADES = ["Muito alto", "Alto", "Médio", "Baixo"];
const CRIADORES = ["RFAVARO", "MSANTOS", "LCARDOSO", "IP1020251202", "TPEREIRA"];
const INTERVALOS: OrdemSap["intervalo_ciclo"][] = ["mensal", "trimestral", "3 MES", "6 meses", "semestral", "1 ano", { quantidade: 2, unidade: "meses" }];
/** Atividades que não existem no DAPROM: a OS entra com o aviso "Atividade sem modelo de APR". */
const ATIVIDADES_SEM_MODELO = ["Z-ATIV-01", "Z-ATIV-02", "Z-ATIV-03", "Inspeção especial", "Ajuste de campo"];

export async function catalogoDoSimuladorSap(db: Db) {
  const equipes = await db.select({ centro: equipe.centroTrabalho, nome: equipe.nome }).from(equipe);
  const comEquipe = new Map(equipes.map((e) => [e.centro, e.nome]));
  // Os centros do DAPROM que o catálogo fixo não conhece também aparecem (equipes criadas pelo admin).
  const conhecidos = new Set(SETORES.map((s) => s.centro));
  const centros = [
    ...SETORES.map((s) => ({ centroTrabalho: s.centro, nome: s.nome, equipeNoDaprom: comEquipe.get(s.centro) ?? null })),
    ...equipes.filter((e) => !conhecidos.has(e.centro)).map((e) => ({ centroTrabalho: e.centro, nome: e.nome, equipeNoDaprom: e.nome })),
  ];
  const atividades = await db.select({ codigo: atividade.codigo, descricao: atividade.descricao, modelo: atividade.modeloAprCodigo }).from(atividade).orderBy(asc(atividade.codigo));
  return {
    centrosDeTrabalho: centros,
    locais: LOCAIS,
    atividades: atividades.map((a) => ({ codigo: a.codigo, descricao: a.descricao, comModelo: a.modelo !== null })),
    servicos: SERVICOS,
    statusProntos: STATUS_PRONTOS,
    proximoNumero: await proximoNumero(db),
  };
}

/** Número sugerido: o maior número numérico mais um (a partir de `4000001`). */
export async function proximoNumero(db: Db): Promise<string> {
  const [r] = await db
    .select({ maior: sql<string | null>`max(${ordemSapSimulada.numeroOrdem}::bigint) filter (where ${ordemSapSimulada.numeroOrdem} ~ '^[0-9]{1,15}$')` })
    .from(ordemSapSimulada);
  return String(Math.max(4000000, Number(r?.maior ?? 0)) + 1);
}

// ------------------------------------------------------------------------------------------------------------------
// Gerador
// ------------------------------------------------------------------------------------------------------------------

export const LIMITE_POR_ENVIO = 200;
const DIAS_PADRAO = 14;

export const esquemaLotesDeOrdens = z.object({
  lotes: z
    .array(
      z.object({
        quantidade: z.number().int().min(1).max(LIMITE_POR_ENVIO),
        tipo: z.enum(["corretiva", "preventiva"]).optional(),
        centro_trabalho: z.string().trim().min(1).optional(),
        status: z.enum(["liberada", "criada"]).optional(),
        atividade: z.enum(["com_modelo", "sem_modelo", "qualquer"]).optional(),
      }),
    )
    .min(1),
  dias: z.number().int().min(0).max(365).optional(),
});
export type LoteDeOrdens = z.infer<typeof esquemaLotesDeOrdens>["lotes"][number];

export interface OpcoesDoGeradorDeOrdens {
  sorteio?: () => number;
  /** Primeiro número livre. */
  numeroInicial: number;
  /** Atividades do DAPROM que têm modelo de APR (para o "com modelo"). */
  atividadesComModelo: string[];
  /** Hoje, `AAAA-MM-DD`: o início programado sai dos próximos `dias`. */
  hoje: Date;
  dias?: number;
  centrosConhecidos?: string[];
}

const somaDias = (dia: string, dias: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

/**
 * Gera as ordens dos lotes: números sequenciais depois do maior existente, serviços e locais dos catálogos fixos, atividade com
 * modelo (sorteada entre as do DAPROM) ou sem modelo (códigos inventados), preventivas com plano, item e, às vezes, intervalo,
 * prioridade e "criado por" sorteados, e início programado nos próximos `dias`. O sorteio é injetável.
 */
export function gerarOrdens(lotes: LoteDeOrdens[], o: OpcoesDoGeradorDeOrdens): NovaLinha[] {
  const sorteio = o.sorteio ?? Math.random;
  const escolher = <T>(lista: readonly T[]): T => lista[Math.min(lista.length - 1, Math.floor(sorteio() * lista.length))]!;
  const entre = (min: number, max: number) => min + Math.floor(sorteio() * (max - min + 1));
  const total = lotes.reduce((s, l) => s + l.quantidade, 0);
  if (total > LIMITE_POR_ENVIO) throw invalido("limite_excedido", `No máximo ${LIMITE_POR_ENVIO} ordens por envio`);
  const hoje = o.hoje.toISOString().slice(0, 10);
  const dias = o.dias ?? DIAS_PADRAO;
  const centros = o.centrosConhecidos ?? SETORES.map((s) => s.centro);

  const saida: NovaLinha[] = [];
  let numero = o.numeroInicial;
  for (const lote of lotes) {
    if (lote.centro_trabalho && !centros.includes(lote.centro_trabalho)) throw invalido("centro_inexistente", `Centro de trabalho desconhecido: ${lote.centro_trabalho}`);
    if (lote.atividade === "com_modelo" && o.atividadesComModelo.length === 0) throw invalido("sem_atividade_com_modelo", "O DAPROM não tem nenhuma atividade com modelo de APR para sortear");
    for (let i = 0; i < lote.quantidade; i++) {
      const tipo = lote.tipo ?? (sorteio() < 0.5 ? "corretiva" : "preventiva");
      const servico = escolher(SERVICOS.filter((s) => s.tipo === (tipo === "corretiva" ? "YBA1" : "YBA2")));
      const local = escolher(LOCAIS);
      const comModelo = lote.atividade === "com_modelo" || (lote.atividade !== "sem_modelo" && o.atividadesComModelo.length > 0 && sorteio() < 0.5);
      const inicio = somaDias(hoje, entre(0, dias));
      const preventiva = tipo === "preventiva";
      const liberada = (lote.status ?? "liberada") === "liberada";
      const sigla = local.codigo.split("/")[0]!.slice(0, 2);
      const alterada = o.hoje;
      saida.push({
        numeroOrdem: String(numero++),
        numeroNota: String(10_000_000 + entre(0, 99_999)),
        tipoOrdem: preventiva ? "YBA2" : "YBA1",
        tipoAtividade: preventiva ? "Z02-Manutenção Preventiva" : "Z01-Manutenção Corretiva",
        codigoAtividade: comModelo ? escolher(o.atividadesComModelo) : escolher(ATIVIDADES_SEM_MODELO),
        titulo: servico.titulo,
        descricao: servico.descricao,
        centroTrabalho: lote.centro_trabalho ?? escolher(centros),
        localCodigo: local.codigo,
        localEndereco: local.endereco,
        localPlusCode: local.plus_code,
        localCliente: local.cliente,
        equipamento: `${servico.prefixo}-${sigla}-${String(entre(1, 99)).padStart(4, "0")}`,
        prioridade: escolher(PRIORIDADES),
        dataInicioProg: inicio,
        dataFimProg: somaDias(inicio, entre(0, 3)),
        statusSap: liberada ? escolher(["LIB", "LIB IMPR", "LIB IMPR", "LIB IMPR CAPC"]) : "CRTD",
        solicitante: null,
        criadoPor: escolher(CRIADORES),
        criadaEm: alterada,
        planoManutencao: preventiva ? String(entre(10_000, 99_999)) : null,
        itemManutencao: preventiva ? String(entre(10_000, 99_999)) : null,
        intervaloCiclo: preventiva && sorteio() < 0.6 ? (escolher(INTERVALOS) as object | string) : null,
        alteradaEm: alterada,
      });
    }
  }
  return saida;
}

// ------------------------------------------------------------------------------------------------------------------
// A coluna "No DAPROM"
// ------------------------------------------------------------------------------------------------------------------

export type SituacaoNoDaprom = "nao_lida" | "ignorada" | OsStatus;

export interface NoDaprom {
  situacao: SituacaoNoDaprom;
  /** Só em `ignorada`: o motivo que a leitura gravou em `importacao.detalhe_ignoradas`. */
  motivo?: string;
  /** Só quando a OS existe: "Atividade sem modelo de APR" (o aviso que a leitura dá ao criar a OS; o técnico escolhe o modelo na APR). */
  aviso?: string;
}

/**
 * Como o DAPROM está com cada ordem: o status da OS que ele tem ("Liberada", "Em execução"…), "Ignorada" com o motivo (da leitura mais
 * recente que passou pela ordem e a ignorou) ou "Ainda não lida". Atalho de demonstração: o SAP real não sabe nada do DAPROM.
 */
export async function situacoesNoDaprom(db: Db, numeros: string[]): Promise<Map<string, NoDaprom>> {
  const mapa = new Map<string, NoDaprom>();
  if (numeros.length === 0) return mapa;
  const oss = await db.select({ numero: os.numeroOrdem, status: os.status, atividade: os.codigoAtividade }).from(os).where(and(isNotNull(os.numeroOrdem), inArray(os.numeroOrdem, numeros)));
  const codigos = [...new Set(oss.map((o) => o.atividade).filter((c): c is string => c !== null))];
  const comModelo = new Set(
    codigos.length ? (await db.select({ codigo: atividade.codigo }).from(atividade).where(and(inArray(atividade.codigo, codigos), isNotNull(atividade.modeloAprCodigo)))).map((a) => a.codigo) : [],
  );
  for (const o of oss) mapa.set(o.numero!, { situacao: o.status, ...(o.atividade && comModelo.has(o.atividade) ? {} : { aviso: AVISO_SEM_MODELO }) });

  const faltam = new Set(numeros.filter((n) => !mapa.has(n)));
  if (faltam.size > 0) {
    // As leituras mais recentes primeiro: a primeira que cita a ordem como ignorada vale.
    const leituras = await db
      .select({ detalhe: importacao.detalheIgnoradas })
      .from(importacao)
      .where(and(eq(importacao.origem, "api"), sql`${importacao.erro} is null`, sql`${importacao.ignoradas} > 0`))
      .orderBy(desc(importacao.criadaEm), desc(importacao.id))
      .limit(100);
    for (const l of leituras) {
      for (const d of (l.detalhe as DetalheIgnorada[] | null) ?? []) {
        if (d.numero_ordem && faltam.has(d.numero_ordem)) {
          mapa.set(d.numero_ordem, { situacao: "ignorada", motivo: d.motivo });
          faltam.delete(d.numero_ordem);
        }
      }
      if (faltam.size === 0) break;
    }
  }
  for (const n of faltam) mapa.set(n, { situacao: "nao_lida" });
  return mapa;
}

// ------------------------------------------------------------------------------------------------------------------
// Gestão
// ------------------------------------------------------------------------------------------------------------------

export const esquemaListaDeOrdens = z.object({
  busca: z.string().trim().min(1).optional(),
  tipo: z.enum(["YBA1", "YBA2"]).optional(),
  centro_trabalho: z.string().trim().min(1).optional(),
  no_daprom: z
    .enum(["nao_lida", "ignorada", "liberada", "pendente", "em_execucao", "encerrada", "cancelada"])
    .optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(200).default(50),
});
type FiltrosDaLista = Omit<z.infer<typeof esquemaListaDeOrdens>, "pagina" | "tamanho">;

const condicoes = (f: FiltrosDaLista): SQL | undefined =>
  and(
    f.busca ? algum([ordemSapSimulada.numeroOrdem, ordemSapSimulada.titulo, ordemSapSimulada.equipamento, ordemSapSimulada.localCodigo], f.busca, contem) : undefined,
    f.tipo ? eq(ordemSapSimulada.tipoOrdem, f.tipo) : undefined,
    f.centro_trabalho ? eq(ordemSapSimulada.centroTrabalho, f.centro_trabalho) : undefined,
  );

/**
 * Lista paginada com `no_daprom` e `alterada_depois_da_leitura` em cada ordem, e o contador por situação no DAPROM (de todas as ordens,
 * sem os filtros). O filtro `no_daprom` age sobre a situação calculada, então com ele a lista é filtrada antes de paginar.
 */
export async function listarOrdens(db: Db, f: z.infer<typeof esquemaListaDeOrdens>) {
  const ultimaLeitura = await ultimaLeituraConcluida(db);
  const todas = await db.select({ numero: ordemSapSimulada.numeroOrdem }).from(ordemSapSimulada);
  const situacoesDeTodas = await situacoesNoDaprom(db, todas.map((t) => t.numero));
  const contagem: Record<string, number> = { nao_lida: 0, ignorada: 0, liberada: 0, pendente: 0, em_execucao: 0, encerrada: 0, cancelada: 0 };
  for (const s of situacoesDeTodas.values()) contagem[s.situacao] = (contagem[s.situacao] ?? 0) + 1;

  const onde = condicoes(f);
  let linhas: Linha[];
  let total: number;
  if (f.no_daprom) {
    const doFiltro = await db.select().from(ordemSapSimulada).where(onde).orderBy(asc(ordemSapSimulada.numeroOrdem));
    const filtradas = doFiltro.filter((l) => situacoesDeTodas.get(l.numeroOrdem)?.situacao === f.no_daprom);
    total = filtradas.length;
    linhas = filtradas.slice((f.pagina - 1) * f.tamanho, f.pagina * f.tamanho);
  } else {
    linhas = await db
      .select()
      .from(ordemSapSimulada)
      .where(onde)
      .orderBy(asc(ordemSapSimulada.numeroOrdem))
      .limit(f.tamanho)
      .offset((f.pagina - 1) * f.tamanho);
    const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(ordemSapSimulada).where(onde);
    total = c?.n ?? 0;
  }
  const ordens = linhas.map((l) => ({
    ...paraContrato(l),
    // O que muda no DAPROM com a próxima leitura: a ordem mudou depois da última leitura sem erro (sem leitura nenhuma, todas).
    alterada_depois_da_leitura: !ultimaLeitura || l.alteradaEm > ultimaLeitura,
    alterada_em: l.alteradaEm,
    no_daprom: situacoesDeTodas.get(l.numeroOrdem) ?? { situacao: "nao_lida" as const },
  }));
  return { ordens, total, contagem, totalGeral: todas.length };
}

export const esquemaNovaOrdem = esquemaOrdem;

/** Edição: tudo, menos o número da ordem (`.strict()` recusa a tentativa em vez de ignorá-la). */
export const esquemaEdicaoDeOrdem = z
  .object({
    numero_nota: z.string().trim().nullable().optional(),
    tipo_ordem: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.enum(["YBA1", "YBA2"])).optional(),
    tipo_atividade: z.string().trim().nullable().optional(),
    codigo_atividade: z.string().trim().nullable().optional(),
    titulo: z.string().trim().min(1).optional(),
    descricao: z.string().nullable().optional(),
    centro_trabalho: z.string().trim().min(1).optional(),
    local_instalacao: z
      .object({
        codigo: z.string().trim().min(1),
        endereco: z.string().trim().nullable().optional(),
        plus_code: z.string().trim().nullable().optional(),
        cliente: z.string().trim().nullable().optional(),
      })
      .optional(),
    equipamento: z.string().trim().nullable().optional(),
    prioridade: z.string().trim().nullable().optional(),
    data_inicio_prog: dataIso.optional(),
    data_fim_prog: dataIso.nullable().optional(),
    status_sap: z.string().trim().nullable().optional(),
    solicitante: z.string().trim().nullable().optional(),
    criado_por: z.string().trim().nullable().optional(),
    plano_manutencao: z.string().trim().nullable().optional(),
    item_manutencao: z.string().trim().nullable().optional(),
    intervalo_ciclo: z.union([z.string().trim(), z.object({ quantidade: z.number().positive(), unidade: z.string().trim().min(1) })]).nullable().optional(),
  })
  .strict();

const vazioParaNulo = (v: string | null | undefined) => (v === undefined ? undefined : v === null || v.trim() === "" ? null : v.trim());

export async function criarOrdem(db: Db, dados: z.output<typeof esquemaOrdem>, agora: Date): Promise<Linha> {
  if (await obterOrdemSimulada(db, dados.numero_ordem)) throw conflito("ordem_duplicada", "Ordem já existe no simulador");
  const [criada] = await db.insert(ordemSapSimulada).values(deContrato(dados, agora)).returning();
  return criada!;
}

export async function criarAleatorias(db: Db, corpo: z.infer<typeof esquemaLotesDeOrdens>, agora: Date, sorteio?: () => number): Promise<number> {
  const comModelo = await db.select({ codigo: atividade.codigo }).from(atividade).where(isNotNull(atividade.modeloAprCodigo));
  const equipes = await db.select({ centro: equipe.centroTrabalho }).from(equipe);
  const novas = gerarOrdens(corpo.lotes, {
    ...(sorteio ? { sorteio } : {}),
    numeroInicial: Number(await proximoNumero(db)),
    atividadesComModelo: comModelo.map((a) => a.codigo),
    hoje: agora,
    ...(corpo.dias !== undefined ? { dias: corpo.dias } : {}),
    centrosConhecidos: [...new Set([...SETORES.map((s) => s.centro), ...equipes.map((e) => e.centro)])],
  });
  await db.insert(ordemSapSimulada).values(novas);
  return novas.length;
}

/** O que o DAPROM faz com cada edição, para a tela avisar antes de salvar (`apiSAP.md`, seção 7). */
export async function editarOrdem(db: Db, numero: string, dados: z.infer<typeof esquemaEdicaoDeOrdem>, agora: Date): Promise<Linha> {
  const atual = await obterOrdemSimulada(db, numero);
  if (!atual) throw naoEncontrado("Ordem não encontrada");
  const inicio = dados.data_inicio_prog ?? atual.dataInicioProg;
  const fim = dados.data_fim_prog === undefined ? atual.dataFimProg : dados.data_fim_prog;
  if (fim && fim < inicio) throw invalido("datas_invalidas", "A data fim programada é anterior ao início");
  const local = dados.local_instalacao;
  const [editada] = await db
    .update(ordemSapSimulada)
    .set({
      ...(dados.numero_nota !== undefined && { numeroNota: vazioParaNulo(dados.numero_nota) ?? null }),
      ...(dados.tipo_ordem !== undefined && { tipoOrdem: dados.tipo_ordem }),
      ...(dados.tipo_atividade !== undefined && { tipoAtividade: vazioParaNulo(dados.tipo_atividade) ?? null }),
      ...(dados.codigo_atividade !== undefined && { codigoAtividade: vazioParaNulo(dados.codigo_atividade) ?? null }),
      ...(dados.titulo !== undefined && { titulo: dados.titulo }),
      ...(dados.descricao !== undefined && { descricao: vazioParaNulo(dados.descricao) ?? null }),
      ...(dados.centro_trabalho !== undefined && { centroTrabalho: dados.centro_trabalho }),
      ...(local && { localCodigo: local.codigo, localEndereco: vazioParaNulo(local.endereco) ?? null, localPlusCode: vazioParaNulo(local.plus_code) ?? null, localCliente: vazioParaNulo(local.cliente) ?? null }),
      ...(dados.equipamento !== undefined && { equipamento: vazioParaNulo(dados.equipamento) ?? null }),
      ...(dados.prioridade !== undefined && { prioridade: vazioParaNulo(dados.prioridade) ?? null }),
      ...(dados.data_inicio_prog !== undefined && { dataInicioProg: dados.data_inicio_prog }),
      ...(dados.data_fim_prog !== undefined && { dataFimProg: dados.data_fim_prog }),
      ...(dados.status_sap !== undefined && { statusSap: vazioParaNulo(dados.status_sap) ?? null }),
      ...(dados.solicitante !== undefined && { solicitante: vazioParaNulo(dados.solicitante) ?? null }),
      ...(dados.criado_por !== undefined && { criadoPor: vazioParaNulo(dados.criado_por) ?? null }),
      ...(dados.plano_manutencao !== undefined && { planoManutencao: vazioParaNulo(dados.plano_manutencao) ?? null }),
      ...(dados.item_manutencao !== undefined && { itemManutencao: vazioParaNulo(dados.item_manutencao) ?? null }),
      ...(dados.intervalo_ciclo !== undefined && { intervaloCiclo: dados.intervalo_ciclo === "" ? null : dados.intervalo_ciclo }),
      alteradaEm: agora,
    })
    .where(eq(ordemSapSimulada.numeroOrdem, numero))
    .returning();
  return editada!;
}

export const MOTIVO_NO_DAPROM = "Esta ordem já está no DAPROM. No SAP, uma ordem não é apagada: encerre-a (tire o LIB do status) e o DAPROM a cancela na próxima leitura.";

/** Exclui só a ordem que o DAPROM não tem (nunca lida, ou lida e ignorada): no SAP real uma ordem não some, ela é encerrada. */
export async function excluirOrdem(db: Db, numero: string): Promise<void> {
  if (!(await obterOrdemSimulada(db, numero))) throw naoEncontrado("Ordem não encontrada");
  const situacao = (await situacoesNoDaprom(db, [numero])).get(numero);
  if (situacao && situacao.situacao !== "nao_lida" && situacao.situacao !== "ignorada") throw conflito("ordem_no_daprom", MOTIVO_NO_DAPROM);
  await db.delete(ordemSapSimulada).where(eq(ordemSapSimulada.numeroOrdem, numero));
}

export const ACOES_EM_MASSA = ["mudar_status", "mudar_centro", "reprogramar", "excluir"] as const;

export const esquemaEmMassaDeOrdens = z
  .object({
    numeros: z.array(z.string().trim().min(1)).min(1).optional(),
    todos_da_busca: z.boolean().optional(),
    busca: z.string().trim().min(1).optional(),
    tipo: z.enum(["YBA1", "YBA2"]).optional(),
    centro_trabalho: z.string().trim().min(1).optional(),
    no_daprom: esquemaListaDeOrdens.shape.no_daprom,
    acao: z.enum(ACOES_EM_MASSA),
    /** O status novo (`mudar_status`) ou o centro de trabalho novo (`mudar_centro`). */
    valor: z.string().trim().min(1).optional(),
    /** `reprogramar`: desloca as datas em N dias (pode ser negativo)… */
    dias: z.number().int().min(-3650).max(3650).optional(),
    /** …ou define o início numa data nova (o fim acompanha, com a mesma duração). */
    data: dataIso.optional(),
  })
  .refine((c) => (c.numeros ? !c.todos_da_busca : c.todos_da_busca === true), "Informe os números ou marque todos_da_busca");

export interface ResultadoEmMassaOrdens {
  afetadas: number;
  recusadas: { numero_ordem: string; motivo: string }[];
}

const diaMais = (dia: string, dias: number) => new Date(Date.parse(`${dia}T12:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);

export async function agirEmMassaNasOrdens(db: Db, c: z.infer<typeof esquemaEmMassaDeOrdens>, agora: Date): Promise<ResultadoEmMassaOrdens> {
  let alvos: string[];
  if (c.numeros) alvos = c.numeros;
  else {
    const f = { ...(c.busca ? { busca: c.busca } : {}), ...(c.tipo ? { tipo: c.tipo } : {}), ...(c.centro_trabalho ? { centro_trabalho: c.centro_trabalho } : {}) };
    const doFiltro = await db.select({ numero: ordemSapSimulada.numeroOrdem }).from(ordemSapSimulada).where(condicoes(f));
    alvos = doFiltro.map((l) => l.numero);
    if (c.no_daprom) {
      const s = await situacoesNoDaprom(db, alvos);
      alvos = alvos.filter((n) => s.get(n)?.situacao === c.no_daprom);
    }
  }
  const existentes = alvos.length ? await db.select().from(ordemSapSimulada).where(inArray(ordemSapSimulada.numeroOrdem, alvos)) : [];
  const achadas = new Set(existentes.map((l) => l.numeroOrdem));
  const recusadas: ResultadoEmMassaOrdens["recusadas"] = alvos.filter((n) => !achadas.has(n)).map((n) => ({ numero_ordem: n, motivo: "Ordem não encontrada" }));
  const numeros = existentes.map((l) => l.numeroOrdem);

  if (c.acao === "excluir") {
    const situacoes = await situacoesNoDaprom(db, numeros);
    const livres = numeros.filter((n) => ["nao_lida", "ignorada"].includes(situacoes.get(n)?.situacao ?? "nao_lida"));
    for (const n of numeros) if (!livres.includes(n)) recusadas.push({ numero_ordem: n, motivo: MOTIVO_NO_DAPROM });
    if (livres.length) await db.delete(ordemSapSimulada).where(inArray(ordemSapSimulada.numeroOrdem, livres));
    return { afetadas: livres.length, recusadas };
  }

  if (numeros.length === 0) return { afetadas: 0, recusadas };

  if (c.acao === "mudar_status") {
    if (!c.valor) throw invalido("status_obrigatorio", "Informe o status SAP");
    await db.update(ordemSapSimulada).set({ statusSap: c.valor, alteradaEm: agora }).where(inArray(ordemSapSimulada.numeroOrdem, numeros));
    return { afetadas: numeros.length, recusadas };
  }

  if (c.acao === "mudar_centro") {
    if (!c.valor) throw invalido("centro_obrigatorio", "Informe o centro de trabalho");
    await db.update(ordemSapSimulada).set({ centroTrabalho: c.valor, alteradaEm: agora }).where(inArray(ordemSapSimulada.numeroOrdem, numeros));
    return { afetadas: numeros.length, recusadas };
  }

  // reprogramar
  if ((c.dias === undefined) === (c.data === undefined)) throw invalido("reprogramacao_invalida", "Informe os dias a deslocar ou a data nova (um dos dois)");
  for (const l of existentes) {
    const deslocamento = c.dias ?? Math.round((Date.parse(`${c.data}T12:00:00Z`) - Date.parse(`${l.dataInicioProg}T12:00:00Z`)) / 86_400_000);
    await db
      .update(ordemSapSimulada)
      .set({ dataInicioProg: diaMais(l.dataInicioProg, deslocamento), dataFimProg: l.dataFimProg ? diaMais(l.dataFimProg, deslocamento) : null, alteradaEm: agora })
      .where(eq(ordemSapSimulada.numeroOrdem, l.numeroOrdem));
  }
  return { afetadas: existentes.length, recusadas };
}

