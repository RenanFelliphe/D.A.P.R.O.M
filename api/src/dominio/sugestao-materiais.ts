import { and, asc, desc, eq, inArray, notInArray, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import {
  diferencaDeListas,
  MAX_CARACTERES_DO_MOTIVO,
  MAX_ITENS_DA_SUGESTAO,
  MIN_CARACTERES_DO_MOTIVO,
  resumoDasMudancas,
  totalDeMudancas,
} from "../../../shared/api/sugestao-materiais";
import type { Db } from "../db/conexao";
import {
  MATERIAL_CATEGORIAS,
  SUGESTAO_ESTADOS,
  SUGESTAO_TIPOS,
  atividade,
  equipe,
  lancamentoEquipe,
  lancamentoPontos,
  material,
  os,
  sugestaoMateriais,
  sugestaoMateriaisItem,
  usuario,
  type MaterialCategoria,
  type SugestaoEstado,
  type SugestaoTipo,
} from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado, proibido } from "../http/erros";
import { contar, limiteEDeslocamento, type Paginacao } from "../http/paginacao";
import { textoObrigatorio, uuid } from "../http/validacao";
import { adminsAtivos, criarAviso, destinatariosDaEquipe } from "./alertas";
import { criarMaterial, materiaisDosServicos, salvarMateriaisDoServico, type MaterialDoServico } from "./catalogo";
import { lancar, type Ganho } from "./lancamentos";

/*
 * Sugestão e contestação da lista de materiais de um serviço (`docs/operacao-de-campo.md`, seções 10.2 a 10.5).
 *
 * Qualquer pessoa que não seja administradora (o admin edita a lista direto no catálogo) pode sugerir uma lista nova ou
 * corrigida, ou contestar a lista recomendada (com o motivo, e, se quiser, a lista certa). Quem avalia é o supervisor da equipe
 * que mais faz o serviço: a que tem mais OS dele, e, no empate, a de mais pontos. Aceita, a lista passa a ser a do serviço
 * (e todas as equipes que fazem o serviço são avisadas); recusada, o autor recebe o motivo. Só a aceitação dá pontos ao autor.
 */

/** Dias entre duas sugestões do mesmo serviço, da mesma pessoa, que pontuam (as aceitas no meio atualizam a lista, mas não pontuam). */
export const DIAS_ENTRE_PONTUACOES = 30;

const textoDoMotivo = z.string().trim().max(MAX_CARACTERES_DO_MOTIVO);

/** Um item enviado: do catálogo (`material_id`) ou digitado (`descricao` e `unidade`); `criar_material` só vale para quem avalia. */
const esquemaItem = z.object({
  material_id: uuid.nullable().optional(),
  descricao: textoObrigatorio.max(200).optional(),
  unidade: textoObrigatorio.max(20).optional(),
  categoria: z.enum(MATERIAL_CATEGORIAS).optional(),
  /** Na unidade do material; nula = conforme a necessidade. */
  quantidade: z.number().positive().max(999_999_999).nullable().optional(),
  observacao: z.string().trim().max(200).nullable().optional(),
  criar_material: z.boolean().optional(),
});
type ItemEntrada = z.infer<typeof esquemaItem>;

export const esquemaNovaSugestao = z.object({
  atividade: textoObrigatorio.max(200),
  tipo: z.enum(SUGESTAO_TIPOS),
  motivo: textoDoMotivo.nullable().optional(),
  /** A contestação pode vir sem lista; a lista vazia vale como sem lista. */
  lista: z.array(esquemaItem).max(MAX_ITENS_DA_SUGESTAO).nullable().optional(),
});
export type NovaSugestaoEntrada = z.infer<typeof esquemaNovaSugestao>;

export const esquemaAceite = z.object({
  /** O que fazer com cada item digitado da proposta: ligar a um material do catálogo ou cadastrá-lo. */
  resolucoes: z.array(z.object({ ordem: z.number().int().min(1), material_id: uuid.optional(), criar_material: z.boolean().optional() })).max(MAX_ITENS_DA_SUGESTAO).optional(),
  /** A lista que o avaliador quer no lugar da proposta (ajuste), ou a lista nova de uma contestação sem lista. */
  lista: z.array(esquemaItem).max(MAX_ITENS_DA_SUGESTAO).optional(),
  resposta: textoDoMotivo.nullable().optional(),
});
export type AceiteEntrada = z.infer<typeof esquemaAceite>;

export const esquemaRecusa = z.object({ resposta: textoDoMotivo });

export const esquemaFiltrosDeSugestoes = z.object({
  /** `minhas`: as que a pessoa enviou; `avaliar`: as que ela pode avaliar; `servico`: o histórico de um serviço (pede `atividade`). */
  escopo: z.enum(["minhas", "avaliar", "servico"]).default("minhas"),
  atividade: textoObrigatorio.max(200).optional(),
  estado: z.enum(SUGESTAO_ESTADOS).optional(),
});

const normalizar = (texto: string) => texto.trim().replace(/\s+/g, " ");

// ---- Equipes que fazem o serviço --------------------------------------------------------------------------------

export interface EquipeDoServicoLinha {
  equipeId: string;
  nome: string;
  osTotal: number;
  pontos: number;
  supervisorNome: string | null;
  responsavel: boolean;
}

/**
 * As equipes que fazem o serviço (têm OS dele, fora as canceladas e as devolvidas ao SAP), da que mais faz para a que menos faz;
 * no empate, a de mais pontos (a soma de tudo o que a equipe já recebeu), e, se ainda empatar, a ordem alfabética. A primeira é a
 * responsável: avalia as sugestões e as contestações do serviço.
 */
export async function equipesDoServico(db: Db, codigo: string): Promise<EquipeDoServicoLinha[]> {
  const linhas = await db
    .select({
      equipeId: equipe.id,
      nome: equipe.nome,
      osTotal: sql<number>`count(${os.id})::int`,
      supervisorNome: usuario.nome,
      pontos: sql<number>`coalesce((select sum(${lancamentoPontos.pontos}) from ${lancamentoEquipe} join ${lancamentoPontos} on ${lancamentoPontos.id} = ${lancamentoEquipe.lancamentoId} where ${lancamentoEquipe.equipeId} = ${equipe.id}), 0)::int`,
    })
    .from(os)
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .leftJoin(usuario, eq(usuario.id, equipe.supervisorId))
    .where(and(eq(os.codigoAtividade, codigo), notInArray(os.status, ["cancelada", "devolvida"])))
    .groupBy(equipe.id, equipe.nome, usuario.nome);
  linhas.sort((a, b) => b.osTotal - a.osTotal || b.pontos - a.pontos || a.nome.localeCompare(b.nome, "pt-BR"));
  return linhas.map((l, i) => ({ ...l, responsavel: i === 0 }));
}

export async function equipeResponsavelDoServico(db: Db, codigo: string): Promise<string | null> {
  return (await equipesDoServico(db, codigo)).find((e) => e.responsavel)?.equipeId ?? null;
}

// ---- Itens ----------------------------------------------------------------------------------------------------------

interface ItemPreparado {
  materialId: string | null;
  /** Só no item digitado (sem `materialId`). */
  descricao: string | null;
  unidade: string | null;
  categoria: MaterialCategoria | null;
  quantidade: number | null;
  observacao: string | null;
}

/** O material ativo do catálogo com a mesma descrição e unidade (sem diferenciar maiúsculas): o item digitado vira ele. */
async function materialIgual(db: Db, descricao: string, unidade: string) {
  const [m] = await db
    .select({ id: material.id })
    .from(material)
    .where(and(eq(material.ativo, true), sql`lower(btrim(${material.descricao})) = ${normalizar(descricao).toLowerCase()} and lower(btrim(${material.unidade})) = ${normalizar(unidade).toLowerCase()}`))
    .limit(1);
  return m?.id ?? null;
}

interface OpcoesDosItens {
  /** O autor deixa o item digitado como está; quem avalia precisa ligá-lo (ou cadastrá-lo). */
  permitirLivre: boolean;
  /** Materiais que já estão na lista do serviço: continuam valendo mesmo desativados. */
  jaNaLista: ReadonlySet<string>;
}

/**
 * Confere os itens enviados e os põe na forma de gravar: material do catálogo (existente, ativo ou já na lista), item digitado
 * que é igual a um material do catálogo (vira ele), item digitado novo (fica livre se `permitirLivre`; senão `criar_material`
 * o cadastra) e nada repetido.
 */
async function prepararItens(db: Db, itens: ItemEntrada[], opcoes: OpcoesDosItens): Promise<ItemPreparado[]> {
  const ids = itens.map((i) => i.material_id).filter((id): id is string => !!id);
  const cadastrados = ids.length ? await db.select().from(material).where(inArray(material.id, ids)) : [];
  const pronto: ItemPreparado[] = [];
  for (const i of itens) {
    const quantidade = i.quantidade ?? null;
    const observacao = i.observacao ? i.observacao : null;
    if (i.material_id) {
      const m = cadastrados.find((x) => x.id === i.material_id);
      if (!m) throw invalido("material_inexistente", "Material não encontrado no catálogo");
      if (!m.ativo && !opcoes.jaNaLista.has(m.id)) throw invalido("material_inativo", `"${m.descricao}" está desativado e não pode entrar em um serviço`);
      pronto.push({ materialId: m.id, descricao: null, unidade: null, categoria: null, quantidade, observacao });
      continue;
    }
    if (!i.descricao || !i.unidade) throw invalido("item_invalido", "Cada item precisa de um material do catálogo ou de descrição e unidade");
    const descricao = normalizar(i.descricao);
    const unidade = normalizar(i.unidade);
    const igual = await materialIgual(db, descricao, unidade);
    if (igual) {
      pronto.push({ materialId: igual, descricao: null, unidade: null, categoria: null, quantidade, observacao });
    } else if (opcoes.permitirLivre) {
      pronto.push({ materialId: null, descricao, unidade, categoria: i.categoria ?? "material", quantidade, observacao });
    } else if (i.criar_material) {
      const criado = await criarMaterial(db, { codigo: null, descricao, unidade, categoria: i.categoria ?? "material" });
      pronto.push({ materialId: criado.id, descricao: null, unidade: null, categoria: null, quantidade, observacao });
    } else {
      throw invalido("item_sem_material", `Ligue "${descricao}" a um material do catálogo ou cadastre-o como novo`);
    }
  }
  const chaves = pronto.map((p) => p.materialId ?? `livre:${p.descricao!.toLowerCase()}|${p.unidade!.toLowerCase()}`);
  if (new Set(chaves).size !== chaves.length) throw invalido("material_repetido", "O mesmo material aparece mais de uma vez na lista");
  return pronto;
}

/** A lista do serviço como a base da sugestão a guarda (e como o aviso a compara). */
const baseDaLista = (lista: MaterialDoServico[]) => lista.map((m) => ({ material_id: m.materialId, quantidade: m.quantidade, observacao: m.observacao }));

interface ItemDaBase {
  material_id: string;
  quantidade: number | null;
  observacao: string | null;
}

/** Os itens de uma lista (do serviço, ou a base de uma sugestão) com a descrição e a unidade, para comparar e mostrar. */
async function descreverLista(db: Db, itens: { materialId: string; quantidade: number | null; observacao: string | null }[]) {
  const ids = itens.map((i) => i.materialId);
  const cadastrados = ids.length ? await db.select({ id: material.id, descricao: material.descricao, unidade: material.unidade }).from(material).where(inArray(material.id, ids)) : [];
  const porId = new Map(cadastrados.map((m) => [m.id, m]));
  return itens.map((i) => ({
    material_id: i.materialId,
    descricao: porId.get(i.materialId)?.descricao ?? "Material removido do catálogo",
    unidade: porId.get(i.materialId)?.unidade ?? "",
    quantidade: i.quantidade,
    observacao: i.observacao,
  }));
}

// ---- Quem pode o quê ------------------------------------------------------------------------------------------------

/** Avalia o admin, e o supervisor (ou o representante no comando) da equipe responsável, desde que não seja o autor. */
export const podeAvaliarSugestao = (eu: UsuarioAutenticado, s: { estado: SugestaoEstado; autorId: string; equipeResponsavelId: string | null }) =>
  s.estado === "pendente" && (eu.perfil === "admin" || (s.autorId !== eu.id && s.equipeResponsavelId !== null && eu.equipesSupervisionadas.includes(s.equipeResponsavelId)));

export const podeRetirarSugestao = (eu: UsuarioAutenticado, s: { estado: SugestaoEstado; autorId: string }) => s.estado === "pendente" && s.autorId === eu.id;

/** Quem recebe o aviso da sugestão: o supervisor (ou o representante) da equipe responsável, sem o autor; sem ninguém, os administradores. */
async function avaliadoresDe(db: Db, equipeId: string | null, autorId: string): Promise<string[]> {
  const daEquipe = equipeId ? (await destinatariosDaEquipe(db, equipeId)).map((d) => d.id).filter((id) => id !== autorId) : [];
  return daEquipe.length > 0 ? daEquipe : await adminsAtivos(db);
}

// ---- Enviar ---------------------------------------------------------------------------------------------------------

const rotuloDoTipo = (tipo: SugestaoTipo) => (tipo === "sugestao" ? "sugestão" : "contestação");

async function nomeDoServico(db: Db, codigo: string): Promise<string> {
  const [a] = await db.select({ descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, codigo));
  return a ? `${codigo} — ${a.descricao}` : codigo;
}

/** Envia a sugestão ou a contestação e avisa quem avalia. Uma pendente por pessoa e serviço. */
export async function enviarSugestao(db: Db, eu: UsuarioAutenticado, dados: NovaSugestaoEntrada, agora: Date) {
  if (eu.perfil === "admin") throw proibido("O administrador edita a lista direto no catálogo, sem sugestão");
  const motivo = dados.motivo && dados.motivo.length > 0 ? dados.motivo : null;
  if (dados.tipo === "contestacao" && (!motivo || motivo.length < MIN_CARACTERES_DO_MOTIVO)) {
    throw invalido("motivo_obrigatorio", `Explique a contestação em pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres`);
  }
  const lista = dados.lista && dados.lista.length > 0 ? dados.lista : null;
  if (dados.tipo === "sugestao" && !lista) throw invalido("lista_obrigatoria", "A sugestão precisa de ao menos um item");

  return db.transaction(async (tx) => {
    const [servico] = await tx.select({ codigo: atividade.codigo }).from(atividade).where(eq(atividade.codigo, dados.atividade));
    if (!servico) throw naoEncontrado("Serviço não encontrado");

    const [jaPendente] = await tx
      .select({ id: sugestaoMateriais.id })
      .from(sugestaoMateriais)
      .where(and(eq(sugestaoMateriais.autorId, eu.id), eq(sugestaoMateriais.atividadeCodigo, dados.atividade), eq(sugestaoMateriais.estado, "pendente")));
    if (jaPendente) throw conflito("sugestao_pendente", "Você já tem uma sugestão ou contestação deste serviço aguardando avaliação. Retire-a antes de enviar outra.");

    const atual = (await materiaisDosServicos(tx, [dados.atividade])).get(dados.atividade) ?? [];
    const itens = lista ? await prepararItens(tx, lista, { permitirLivre: true, jaNaLista: new Set(atual.map((a) => a.materialId)) }) : [];

    let resumo = "";
    if (lista) {
      const proposta = await descreverItens(tx, itens);
      const mudancas = diferencaDeListas(await descreverLista(tx, atual), proposta);
      if (totalDeMudancas(mudancas) === 0) throw invalido("sem_mudanca", "A lista enviada é igual à lista atual do serviço");
      resumo = resumoDasMudancas(mudancas);
    }

    const equipeResponsavelId = await equipeResponsavelDoServico(tx, dados.atividade);
    const [criada] = await tx
      .insert(sugestaoMateriais)
      .values({
        atividadeCodigo: dados.atividade,
        tipo: dados.tipo,
        autorId: eu.id,
        equipeResponsavelId,
        motivo,
        temLista: lista !== null,
        listaBase: baseDaLista(atual),
        criadaEm: agora,
      })
      .returning({ id: sugestaoMateriais.id });
    if (itens.length > 0) {
      await tx.insert(sugestaoMateriaisItem).values(
        itens.map((i, n) => ({
          sugestaoId: criada!.id,
          ordem: n + 1,
          materialId: i.materialId,
          descricao: i.descricao,
          unidade: i.unidade,
          categoria: i.categoria,
          quantidade: i.quantidade,
          observacao: i.observacao,
        })),
      );
    }

    const servicoNome = await nomeDoServico(tx, dados.atividade);
    const detalhe =
      dados.tipo === "sugestao"
        ? `${eu.nome} sugeriu uma lista de materiais para ${servicoNome} (${itens.length} ${itens.length === 1 ? "item" : "itens"}: ${resumo}).${motivo ? ` Motivo: "${motivo}"` : ""}`
        : `${eu.nome} contestou a lista de materiais de ${servicoNome}: "${motivo}"${lista ? ` e sugeriu uma lista nova (${itens.length} ${itens.length === 1 ? "item" : "itens"}: ${resumo}).` : "."}`;
    await criarAviso(tx, await avaliadoresDe(tx, equipeResponsavelId, eu.id), {
      tipo: dados.tipo === "sugestao" ? "sugestao_materiais_nova" : "contestacao_materiais_nova",
      sugestaoMateriaisId: criada!.id,
      detalhe,
      agora,
    });
    return { id: criada!.id, equipeResponsavelId };
  });
}

/** Os itens preparados (do catálogo ou digitados) como a comparação os lê. */
async function descreverItens(db: Db, itens: ItemPreparado[]) {
  const ids = itens.map((i) => i.materialId).filter((id): id is string => !!id);
  const cadastrados = ids.length ? await db.select({ id: material.id, descricao: material.descricao, unidade: material.unidade }).from(material).where(inArray(material.id, ids)) : [];
  const porId = new Map(cadastrados.map((m) => [m.id, m]));
  return itens.map((i) => ({
    material_id: i.materialId,
    descricao: i.materialId ? (porId.get(i.materialId)?.descricao ?? "") : i.descricao!,
    unidade: i.materialId ? (porId.get(i.materialId)?.unidade ?? "") : i.unidade!,
    quantidade: i.quantidade,
    observacao: i.observacao,
  }));
}

/** O autor retira a sugestão que ainda não foi avaliada. */
export async function retirarSugestao(db: Db, eu: UsuarioAutenticado, id: string) {
  const [s] = await db.select({ estado: sugestaoMateriais.estado, autorId: sugestaoMateriais.autorId, atividadeCodigo: sugestaoMateriais.atividadeCodigo }).from(sugestaoMateriais).where(eq(sugestaoMateriais.id, id));
  if (!s) throw naoEncontrado("Sugestão não encontrada");
  if (s.autorId !== eu.id) throw proibido("Só quem enviou pode retirar a sugestão");
  const [retirada] = await db
    .update(sugestaoMateriais)
    .set({ estado: "cancelada" })
    .where(and(eq(sugestaoMateriais.id, id), eq(sugestaoMateriais.estado, "pendente")))
    .returning({ id: sugestaoMateriais.id });
  if (!retirada) throw conflito("sugestao_ja_avaliada", "A sugestão já foi avaliada ou retirada");
  return s;
}

// ---- Ler ------------------------------------------------------------------------------------------------------------

const autor = alias(usuario, "autor_da_sugestao");
const avaliador = alias(usuario, "avaliador_da_sugestao");
const equipeResponsavel = alias(equipe, "equipe_responsavel");

const colunasDoResumo = {
  id: sugestaoMateriais.id,
  atividadeCodigo: sugestaoMateriais.atividadeCodigo,
  atividadeDescricao: atividade.descricao,
  tipo: sugestaoMateriais.tipo,
  estado: sugestaoMateriais.estado,
  autorId: sugestaoMateriais.autorId,
  autorNome: autor.nome,
  equipeResponsavelId: sugestaoMateriais.equipeResponsavelId,
  equipeResponsavelNome: equipeResponsavel.nome,
  motivo: sugestaoMateriais.motivo,
  temLista: sugestaoMateriais.temLista,
  itensTotal: sql<number>`(select count(*)::int from ${sugestaoMateriaisItem} where ${sugestaoMateriaisItem.sugestaoId} = ${sugestaoMateriais.id})`,
  criadaEm: sugestaoMateriais.criadaEm,
  avaliadaEm: sugestaoMateriais.avaliadaEm,
};

export type FiltrosDeSugestoes = Paginacao & z.infer<typeof esquemaFiltrosDeSugestoes>;

/** As sugestões que a pessoa enviou, as que ela pode avaliar (pendentes, a menos que peça outro estado) ou o histórico de um serviço. */
export async function listarSugestoes(db: Db, eu: UsuarioAutenticado, f: FiltrosDeSugestoes) {
  const condicoes: (SQL | undefined)[] = [f.atividade ? eq(sugestaoMateriais.atividadeCodigo, f.atividade) : undefined];
  if (f.escopo === "minhas") condicoes.push(eq(sugestaoMateriais.autorId, eu.id), f.estado ? eq(sugestaoMateriais.estado, f.estado) : undefined);
  else if (f.escopo === "avaliar") {
    condicoes.push(eq(sugestaoMateriais.estado, f.estado ?? "pendente"));
    if (eu.perfil !== "admin") {
      if (eu.equipesSupervisionadas.length === 0) return { sugestoes: [], total: 0 };
      condicoes.push(inArray(sugestaoMateriais.equipeResponsavelId, eu.equipesSupervisionadas), sql`${sugestaoMateriais.autorId} <> ${eu.id}`);
    }
  } else {
    if (!f.atividade) throw invalido("atividade_obrigatoria", "O histórico do serviço pede o código do serviço");
    condicoes.push(f.estado ? eq(sugestaoMateriais.estado, f.estado) : undefined);
  }
  const onde = and(...condicoes);
  const { limit, offset } = limiteEDeslocamento(f);
  const [linhas, total] = await Promise.all([
    db
      .select(colunasDoResumo)
      .from(sugestaoMateriais)
      .innerJoin(atividade, eq(atividade.codigo, sugestaoMateriais.atividadeCodigo))
      .innerJoin(autor, eq(autor.id, sugestaoMateriais.autorId))
      .leftJoin(equipeResponsavel, eq(equipeResponsavel.id, sugestaoMateriais.equipeResponsavelId))
      .where(onde)
      // Para avaliar, as mais antigas primeiro (a fila); o resto, das mais novas para as mais antigas.
      .orderBy(f.escopo === "avaliar" ? asc(sugestaoMateriais.criadaEm) : desc(sugestaoMateriais.criadaEm), asc(sugestaoMateriais.id))
      .limit(limit)
      .offset(offset),
    contar(db, sugestaoMateriais, onde),
  ]);
  return { sugestoes: linhas.map((l) => ({ ...l, possoAvaliar: podeAvaliarSugestao(eu, l), possoRetirar: podeRetirarSugestao(eu, l) })), total };
}

/** Quantas sugestões esperam a avaliação da pessoa (o número do selo). */
export async function totalParaAvaliar(db: Db, eu: UsuarioAutenticado): Promise<number> {
  return (await listarSugestoes(db, eu, { escopo: "avaliar", pagina: 1, tamanho: 1 })).total;
}

/** A sugestão inteira: os itens propostos, a lista de base, a lista de agora e se a lista mudou desde o envio. */
export async function detalheDaSugestao(db: Db, eu: UsuarioAutenticado, id: string) {
  const [linha] = await db
    .select({
      ...colunasDoResumo,
      listaBase: sugestaoMateriais.listaBase,
      resposta: sugestaoMateriais.resposta,
      ajustada: sugestaoMateriais.ajustada,
      avaliadaPorNome: avaliador.nome,
    })
    .from(sugestaoMateriais)
    .innerJoin(atividade, eq(atividade.codigo, sugestaoMateriais.atividadeCodigo))
    .innerJoin(autor, eq(autor.id, sugestaoMateriais.autorId))
    .leftJoin(avaliador, eq(avaliador.id, sugestaoMateriais.avaliadaPor))
    .leftJoin(equipeResponsavel, eq(equipeResponsavel.id, sugestaoMateriais.equipeResponsavelId))
    .where(eq(sugestaoMateriais.id, id));
  if (!linha) throw naoEncontrado("Sugestão não encontrada");

  const itens = await db
    .select({
      ordem: sugestaoMateriaisItem.ordem,
      materialId: sugestaoMateriaisItem.materialId,
      codigo: material.codigo,
      descricaoDoMaterial: material.descricao,
      unidadeDoMaterial: material.unidade,
      categoriaDoMaterial: material.categoria,
      descricaoLivre: sugestaoMateriaisItem.descricao,
      unidadeLivre: sugestaoMateriaisItem.unidade,
      categoriaLivre: sugestaoMateriaisItem.categoria,
      quantidade: sugestaoMateriaisItem.quantidade,
      observacao: sugestaoMateriaisItem.observacao,
    })
    .from(sugestaoMateriaisItem)
    .leftJoin(material, eq(material.id, sugestaoMateriaisItem.materialId))
    .where(eq(sugestaoMateriaisItem.sugestaoId, id))
    .orderBy(asc(sugestaoMateriaisItem.ordem));

  const base = (linha.listaBase as ItemDaBase[]).map((b) => ({ materialId: b.material_id, quantidade: b.quantidade, observacao: b.observacao }));
  const listaAtual = (await materiaisDosServicos(db, [linha.atividadeCodigo])).get(linha.atividadeCodigo) ?? [];
  const chave = (l: { materialId: string; quantidade: number | null; observacao: string | null }[]) => JSON.stringify(l.map((m) => [m.materialId, m.quantidade, m.observacao]));
  const { listaBase: _listaBase, ...resto } = linha;
  return {
    ...resto,
    possoAvaliar: podeAvaliarSugestao(eu, linha),
    possoRetirar: podeRetirarSugestao(eu, linha),
    itens: itens.map((i) => ({
      ordem: i.ordem,
      materialId: i.materialId,
      codigo: i.codigo,
      descricao: i.descricaoDoMaterial ?? i.descricaoLivre ?? "",
      unidade: i.unidadeDoMaterial ?? i.unidadeLivre ?? "",
      categoria: i.categoriaDoMaterial ?? i.categoriaLivre ?? "material",
      quantidade: i.quantidade,
      observacao: i.observacao,
    })),
    listaBase: await descreverLista(db, base),
    listaAtual,
    desatualizada: chave(base) !== chave(listaAtual),
  };
}

// ---- Avaliar --------------------------------------------------------------------------------------------------------

/** Os pontos de quem enviou: só a primeira aceita de cada serviço a cada `DIAS_ENTRE_PONTUACOES` dias. */
async function autorPodePontuar(db: Db, autorId: string, codigo: string, agora: Date): Promise<boolean> {
  const prefixo = `sugestao_materiais:${codigo}:`;
  const desde = new Date(agora.getTime() - DIAS_ENTRE_PONTUACOES * 86_400_000);
  const [recente] = await db
    .select({ id: lancamentoPontos.id })
    .from(lancamentoPontos)
    .where(and(eq(lancamentoPontos.usuarioId, autorId), eq(lancamentoPontos.regra, "sugestao_materiais_aceita"), sql`left(${lancamentoPontos.chave}, ${prefixo.length}) = ${prefixo}`, sql`${lancamentoPontos.ocorridoEm} > ${desde}`))
    .limit(1);
  return !recente;
}

async function carregarParaAvaliar(db: Db, eu: UsuarioAutenticado, id: string) {
  const [s] = await db.select().from(sugestaoMateriais).where(eq(sugestaoMateriais.id, id));
  if (!s) throw naoEncontrado("Sugestão não encontrada");
  if (s.estado !== "pendente") throw conflito("sugestao_ja_avaliada", "A sugestão já foi avaliada ou retirada");
  if (!podeAvaliarSugestao(eu, s)) throw proibido("Só o supervisor da equipe que mais faz este serviço, ou o administrador, avalia esta sugestão");
  return s;
}

/** Aviso a todos os que fazem o serviço (menos quem agiu): membros e supervisores das equipes com OS dele. Só no sino. */
export async function avisarListaAtualizada(
  db: Db,
  dados: { codigo: string; antes: MaterialDoServico[]; depois: MaterialDoServico[]; excluir: string[]; agora: Date },
): Promise<string[]> {
  const equipes = (await equipesDoServico(db, dados.codigo)).map((e) => e.equipeId);
  if (equipes.length === 0) return [];
  const membros = await db
    .select({ id: usuario.id })
    .from(usuario)
    .where(and(inArray(usuario.equipeId, equipes), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado"), sql`${usuario.perfil} <> 'admin'`));
  const chefes = await db.select({ supervisorId: equipe.supervisorId, representanteId: equipe.representanteId }).from(equipe).where(inArray(equipe.id, equipes));
  const candidatos = new Set([...membros.map((m) => m.id), ...chefes.flatMap((c) => [c.supervisorId, c.representanteId]).filter((id): id is string => !!id)]);
  for (const id of dados.excluir) candidatos.delete(id);
  if (candidatos.size === 0) return [];
  const ativos = await db.select({ id: usuario.id }).from(usuario).where(and(inArray(usuario.id, [...candidatos]), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado")));

  const mudancas = diferencaDeListas(await descreverLista(db, dados.antes), await descreverLista(db, dados.depois));
  const resumo = resumoDasMudancas(mudancas);
  const servico = await nomeDoServico(db, dados.codigo);
  return criarAviso(
    db,
    ativos.map((u) => u.id),
    { tipo: "materiais_atualizados", atividadeCodigo: dados.codigo, detalhe: `A lista de materiais recomendados do serviço ${servico} mudou: ${resumo}.`, agora: dados.agora },
  );
}

/**
 * Aceita a sugestão: a lista (a proposta, com os itens digitados já ligados, ou a que o avaliador ajustou) passa a ser a do
 * serviço. Pontua o autor (uma vez por serviço a cada 30 dias) e o avaliador, avisa o autor e todos os que fazem o serviço.
 */
export async function aceitarSugestao(db: Db, eu: UsuarioAutenticado, id: string, entrada: AceiteEntrada, agora: Date) {
  return db.transaction(async (tx) => {
    const s = await carregarParaAvaliar(tx, eu, id);
    const resposta = entrada.resposta && entrada.resposta.length > 0 ? entrada.resposta : null;

    const [reivindicada] = await tx
      .update(sugestaoMateriais)
      .set({ estado: "aceita", avaliadaPor: eu.id, avaliadaEm: agora, resposta })
      .where(and(eq(sugestaoMateriais.id, id), eq(sugestaoMateriais.estado, "pendente")))
      .returning({ id: sugestaoMateriais.id });
    if (!reivindicada) throw conflito("sugestao_ja_avaliada", "A sugestão já foi avaliada ou retirada");

    const anteriores = (await materiaisDosServicos(tx, [s.atividadeCodigo])).get(s.atividadeCodigo) ?? [];
    const jaNaLista = new Set(anteriores.map((a) => a.materialId));

    // A proposta, com os itens digitados ligados a um material (a escolha do avaliador) ou cadastrados.
    const propostos = await tx.select().from(sugestaoMateriaisItem).where(eq(sugestaoMateriaisItem.sugestaoId, id)).orderBy(asc(sugestaoMateriaisItem.ordem));
    const proposta = await prepararItens(
      tx,
      propostos.map((p) => {
        const r = entrada.resolucoes?.find((x) => x.ordem === p.ordem);
        return {
          material_id: p.materialId ?? r?.material_id ?? null,
          descricao: p.descricao ?? undefined,
          unidade: p.unidade ?? undefined,
          categoria: p.categoria ?? undefined,
          quantidade: p.quantidade,
          observacao: p.observacao,
          criar_material: r?.criar_material,
        };
      }),
      { permitirLivre: false, jaNaLista },
    );

    let final = proposta;
    let ajustada = false;
    if (entrada.lista) {
      final = await prepararItens(tx, entrada.lista, { permitirLivre: false, jaNaLista });
      ajustada = totalDeMudancas(diferencaDeListas(await descreverItens(tx, proposta), await descreverItens(tx, final))) > 0;
    } else if (!s.temLista) {
      throw invalido("lista_obrigatoria", "Esta contestação não trouxe uma lista nova: informe a lista que passa a valer para aceitá-la");
    }

    const salvo = await salvarMateriaisDoServico(tx, s.atividadeCodigo, { materiais: final.map((f) => ({ material_id: f.materialId!, quantidade: f.quantidade, observacao: f.observacao })) });
    if (ajustada) await tx.update(sugestaoMateriais).set({ ajustada: true }).where(eq(sugestaoMateriais.id, id));

    const pontuaAutor = await autorPodePontuar(tx, s.autorId, s.atividadeCodigo, agora);
    const ganhos = await lancar({ tx, agora }, [
      ...(pontuaAutor ? [{ usuarioId: s.autorId, regra: "sugestao_materiais_aceita" as const, chave: `sugestao_materiais:${s.atividadeCodigo}:${id}`, ocorridoEm: agora }] : []),
      { usuarioId: eu.id, regra: "sugestao_materiais_avaliada" as const, chave: `avaliacao_materiais:${id}`, ocorridoEm: agora },
    ]);
    const pontosDoAutor = ganhos.filter((g) => g.usuarioId === s.autorId && g.regra === "sugestao_materiais_aceita").reduce((t, g) => t + g.pontos, 0);

    const servico = await nomeDoServico(tx, s.atividadeCodigo);
    await criarAviso(tx, [s.autorId], {
      tipo: "sugestao_materiais_aceita",
      sugestaoMateriaisId: id,
      detalhe: `Sua ${rotuloDoTipo(s.tipo)} para ${servico} foi aceita${ajustada ? ", com ajustes," : ""} por ${eu.nome}.${pontosDoAutor > 0 ? ` Você ganhou ${pontosDoAutor} pontos.` : ""}${resposta ? ` Resposta: "${resposta}"` : ""}`,
      agora,
    });
    if (salvo.mudou) await avisarListaAtualizada(tx, { codigo: s.atividadeCodigo, antes: salvo.itensAntes, depois: salvo.itensDepois, excluir: [s.autorId, eu.id], agora });
    return { sugestao: s, ajustada, salvo, ganhos: ganhos as Ganho[], pontosDoAutor };
  });
}

/** Recusa a sugestão com o motivo, que chega ao autor. O avaliador pontua do mesmo jeito: o ponto é por responder. */
export async function recusarSugestao(db: Db, eu: UsuarioAutenticado, id: string, resposta: string, agora: Date) {
  if (resposta.length < MIN_CARACTERES_DO_MOTIVO) throw invalido("resposta_obrigatoria", `Explique a recusa em pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres`);
  return db.transaction(async (tx) => {
    const s = await carregarParaAvaliar(tx, eu, id);
    const [recusada] = await tx
      .update(sugestaoMateriais)
      .set({ estado: "recusada", avaliadaPor: eu.id, avaliadaEm: agora, resposta })
      .where(and(eq(sugestaoMateriais.id, id), eq(sugestaoMateriais.estado, "pendente")))
      .returning({ id: sugestaoMateriais.id });
    if (!recusada) throw conflito("sugestao_ja_avaliada", "A sugestão já foi avaliada ou retirada");
    const ganhos = await lancar({ tx, agora }, [{ usuarioId: eu.id, regra: "sugestao_materiais_avaliada", chave: `avaliacao_materiais:${id}`, ocorridoEm: agora }]);
    await criarAviso(tx, [s.autorId], {
      tipo: "sugestao_materiais_recusada",
      sugestaoMateriaisId: id,
      detalhe: `Sua ${rotuloDoTipo(s.tipo)} para ${await nomeDoServico(tx, s.atividadeCodigo)} foi recusada por ${eu.nome}. Motivo: "${resposta}"`,
      agora,
    });
    return { sugestao: s, ganhos: ganhos as Ganho[] };
  });
}
