import { and, asc, eq, inArray, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { CONFERENCIA_ESPERANDO_DADOS } from "../../../shared/api/conferencia-execucao";
import { ordenarValidacoes, TIPOS_DE_VALIDACAO, type ItemDeValidacao, type TipoDeValidacao, type Validacoes } from "../../../shared/api/validacoes";
import type { Db } from "../db/conexao";
import { ausencia, conferenciaExecucao, equipe, execucao, os, usuario } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { minhasConferencias } from "./conferencia-execucao";
import { HORAS_DA_CIENCIA } from "./pontuacao";
import { listarSugestoes } from "./sugestao-materiais";
import { dataBr, diaDe, inicioDoDia } from "./tempo";
import { treinamentosParaValidar } from "./treinamento-servico-validacao";

const HORA_MS = 3_600_000;
/** A ciência que falta menos que isto para perder o prazo da pontuação (ou já perdeu) vai para o topo da fila. */
const AVISO_DA_CIENCIA_MS = 24 * HORA_MS;
/** Quantas sugestões a fila lê de uma vez (o teto da paginação da `api`). */
const SUGESTOES_NA_FILA = 200;

const iso = (d: Date) => d.toISOString();

/** A OS que espera a ciência do supervisor: o fim da execução e se a conferência ainda compara os aparelhos. */
async function ciencias(db: Db, eu: UsuarioAutenticado, agora: Date): Promise<ItemDeValidacao[]> {
  const linhas = await db
    .select({
      id: os.id,
      numero: os.numeroOrdem,
      titulo: os.titulo,
      equipeId: os.equipeId,
      equipeNome: equipe.nome,
      fim: sql<Date | null>`(select max(${execucao.fim}) from ${execucao} where ${execucao.osId} = ${os.id} and ${execucao.resultado} = 'encerrada')`,
      conferindo: sql<boolean>`exists (select 1 from ${conferenciaExecucao} join ${execucao} on ${execucao.id} = ${conferenciaExecucao.execucaoId} where ${execucao.osId} = ${os.id} and ${inArray(conferenciaExecucao.estado, [...CONFERENCIA_ESPERANDO_DADOS])})`,
    })
    .from(os)
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .where(and(inArray(os.equipeId, eu.equipesSupervisionadas), eq(os.status, "aguardando_supervisor")));
  return linhas.map((o) => {
    const fim = o.fim ? new Date(o.fim) : null;
    const prazo = fim ? new Date(fim.getTime() + HORAS_DA_CIENCIA * HORA_MS) : null;
    return {
      chave: `os_ciencia:${o.id}`,
      tipo: "os_ciencia",
      acao: o.conferindo ? "aguardar_conferencia" : "assinar",
      id: o.id,
      os_id: o.id,
      atividade_codigo: null,
      equipe_id: o.equipeId,
      equipe_nome: o.equipeNome,
      titulo: `OS ${o.numero ?? "de apoio"} — ${o.titulo}`,
      detalhe: o.conferindo ? "Os aparelhos da equipe ainda estão sendo comparados: a assinatura espera a conferência." : fim ? `Encerrada em ${dataBr(diaDe(fim))}. Leia o relatório da execução e assine.` : "Leia o relatório da execução e assine.",
      desde: iso(fim ?? agora),
      prazo_em: prazo ? iso(prazo) : null,
      // A que espera a conferência não está nas mãos dele: não sobe para o topo.
      urgente: !o.conferindo && prazo !== null && prazo.getTime() - agora.getTime() < AVISO_DA_CIENCIA_MS,
    } satisfies ItemDeValidacao;
  });
}

async function treinamentos(db: Db, eu: UsuarioAutenticado): Promise<ItemDeValidacao[]> {
  return (await treinamentosParaValidar(db, eu)).map((t) => ({
    chave: `treinamento:${t.codigo}`,
    tipo: "treinamento",
    acao: "decidir",
    id: t.codigo,
    os_id: null,
    atividade_codigo: t.codigo,
    equipe_id: null,
    equipe_nome: null,
    titulo: `${t.codigo} — ${t.descricao}`,
    detalhe: `Versão ${t.versao}, enviada por ${t.autorNome ?? "—"}. ${t.aprovacoes} de ${t.necessarias} aprovações.`,
    desde: iso(t.enviadaEm),
    prazo_em: null,
    urgente: false,
  }));
}

async function sugestoes(db: Db, eu: UsuarioAutenticado): Promise<ItemDeValidacao[]> {
  const { sugestoes: lista } = await listarSugestoes(db, eu, { escopo: "avaliar", pagina: 1, tamanho: SUGESTOES_NA_FILA });
  return lista
    .filter((s) => s.possoAvaliar)
    .map((s) => ({
      chave: `sugestao_material:${s.id}`,
      tipo: "sugestao_material",
      acao: "decidir",
      id: s.id,
      os_id: null,
      atividade_codigo: s.atividadeCodigo,
      equipe_id: s.equipeResponsavelId,
      equipe_nome: s.equipeResponsavelNome,
      titulo: `${s.atividadeCodigo} — ${s.atividadeDescricao}`,
      detalhe: `${s.tipo === "contestacao" ? "Contestação da lista" : "Sugestão de lista"} de ${s.autorNome}${s.temLista ? `, com ${s.itensTotal} ${s.itensTotal === 1 ? "item" : "itens"}` : ""}.`,
      desde: iso(s.criadaEm),
      prazo_em: null,
      urgente: false,
    }));
}

/** Só o que falta de quem pergunta: a conferência que só espera os outros (`aguardar`) não entra. */
async function conferencias(db: Db, eu: UsuarioAutenticado, agora: Date): Promise<ItemDeValidacao[]> {
  const lista = (await minhasConferencias(db, eu, agora)).filter((c) => c.minha_acao !== "aguardar");
  if (lista.length === 0) return [];
  const equipes = await db.select({ osId: os.id, equipeId: os.equipeId, equipeNome: equipe.nome }).from(os).innerJoin(equipe, eq(equipe.id, os.equipeId)).where(inArray(os.id, lista.map((c) => c.os.id)));
  const daOs = new Map(equipes.map((e) => [e.osId, e]));
  const detalhes = {
    decidir: "As versões dos aparelhos divergem: escolha a que vale.",
    fechar: "Passaram 72 horas: feche com o que existe, sem quem não sincronizou.",
    ciencia: "Sem divergência: falta a sua ciência.",
    assinar: "Há divergência já decidida: falta a sua assinatura.",
  } as const;
  return lista.map((c) => {
    const acao = c.minha_acao as keyof typeof detalhes;
    return {
      chave: `conferencia:${c.id}`,
      tipo: "conferencia",
      acao,
      id: c.id,
      os_id: c.os.id,
      atividade_codigo: null,
      equipe_id: daOs.get(c.os.id)?.equipeId ?? null,
      equipe_nome: daOs.get(c.os.id)?.equipeNome ?? null,
      titulo: `Conferência da OS ${c.os.numero_ordem ?? "de apoio"} — ${c.os.titulo}`,
      detalhe: `${detalhes[acao]} Fecha sozinha em ${dataBr(diaDe(new Date(c.limite_em)))}.`,
      desde: c.criada_em,
      prazo_em: c.limite_em,
      // Depois das 72 h o supervisor passa a poder fechar, e aos 7 dias a conferência fecha sozinha.
      urgente: acao === "fechar",
    } satisfies ItemDeValidacao;
  });
}

/**
 * Os pedidos de ausência e de fim antecipado a responder e as ausências vencidas das equipes que a pessoa supervisiona (o mesmo
 * recorte do resumo por e-mail). O pedido da própria pessoa não é dela para responder.
 */
async function ausencias(db: Db, eu: UsuarioAutenticado, agora: Date): Promise<ItemDeValidacao[]> {
  // O supervisor ausente não age pela equipe (só a própria ausência): não há o que responder por ela.
  if (eu.ausencia) return [];
  const hoje = diaDe(agora);
  const linhas = await db
    .select({
      id: ausencia.id,
      nome: usuario.nome,
      equipeId: ausencia.equipeId,
      equipeNome: equipe.nome,
      estado: ausencia.estado,
      inicio: ausencia.inicio,
      retorno: ausencia.retorno,
      fimPedidoData: ausencia.fimPedidoData,
      fimPedidoEm: ausencia.fimPedidoEm,
      criadaEm: ausencia.criadaEm,
    })
    .from(ausencia)
    .innerJoin(usuario, eq(usuario.id, ausencia.usuarioId))
    .innerJoin(equipe, eq(equipe.id, ausencia.equipeId))
    .where(
      and(
        inArray(ausencia.equipeId, eu.equipesSupervisionadas),
        ne(ausencia.usuarioId, eu.id),
        or(eq(ausencia.estado, "pedida"), and(eq(ausencia.estado, "confirmada"), or(isNotNull(ausencia.fimPedidoEm), lte(ausencia.retorno, hoje)))),
      ),
    )
    .orderBy(asc(ausencia.criadaEm));
  const periodo = (inicio: string, retorno: string) => `de ${dataBr(inicio)} a ${dataBr(retorno)}`;
  return linhas.map((a) => {
    const base = { tipo: "ausencia", id: a.id, os_id: null, atividade_codigo: null, equipe_id: a.equipeId, equipe_nome: a.equipeNome, prazo_em: null } as const;
    if (a.estado === "pedida") {
      return { ...base, chave: `ausencia:${a.id}`, acao: "pedida", titulo: `${a.nome} pediu ausência`, detalhe: `Pedido ${periodo(a.inicio, a.retorno)}. Aprove, ajuste as datas ou recuse.`, desde: iso(a.criadaEm), urgente: a.inicio <= hoje } satisfies ItemDeValidacao;
    }
    if (a.fimPedidoEm) {
      return { ...base, chave: `ausencia:${a.id}`, acao: "fim_pedido", titulo: `${a.nome} pediu o fim antecipado da ausência`, detalhe: `Quer voltar em ${a.fimPedidoData ? dataBr(a.fimPedidoData) : "uma data mais cedo"} (o previsto era ${dataBr(a.retorno)}).`, desde: iso(a.fimPedidoEm), urgente: !!a.fimPedidoData && a.fimPedidoData <= hoje } satisfies ItemDeValidacao;
    }
    return { ...base, chave: `ausencia:${a.id}`, acao: "vencida", titulo: `Ausência de ${a.nome} vencida`, detalhe: `O retorno era em ${dataBr(a.retorno)} e ainda não foi confirmado. Prorrogue ou encerre.`, desde: iso(inicioDoDia(a.retorno)), urgente: true } satisfies ItemDeValidacao;
  });
}

/**
 * A fila de quem supervisiona: o que espera a decisão ou a assinatura dele agora, vinda de cinco fontes. Quem não supervisiona
 * nenhuma equipe recebe a fila vazia (o admin tem as telas próprias de cada fila).
 */
export async function minhasValidacoes(db: Db, eu: UsuarioAutenticado, agora: Date): Promise<Validacoes> {
  const vazia = { total: 0, por_tipo: Object.fromEntries(TIPOS_DE_VALIDACAO.map((t) => [t, 0])) as Record<TipoDeValidacao, number>, itens: [] };
  if (eu.equipesSupervisionadas.length === 0) return vazia;
  const [a, b, c, d, e] = await Promise.all([ciencias(db, eu, agora), treinamentos(db, eu), sugestoes(db, eu), conferencias(db, eu, agora), ausencias(db, eu, agora)]);
  const itens = ordenarValidacoes([...a, ...b, ...c, ...d, ...e]);
  const por_tipo = { ...vazia.por_tipo };
  for (const i of itens) por_tipo[i.tipo]++;
  return { total: itens.length, por_tipo, itens };
}
