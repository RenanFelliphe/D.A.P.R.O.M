import { z } from "zod";
import type { CategoriaMaterial, Material, MaterialDoServico } from "@shared/api/catalogo";
import {
  MAX_CARACTERES_DO_MOTIVO,
  MAX_ITENS_DA_SUGESTAO,
  MIN_CARACTERES_DO_MOTIVO,
  diferencaDeListas,
  totalDeMudancas,
  type ItemDaSugestao,
  type ItemEnviado,
  type TipoDeSugestao,
} from "@shared/api/sugestao-materiais";

/**
 * A lista de materiais como o editor a mantém na memória (nada vai para a `api` até o "Enviar") e as regras puras em volta dela:
 * montar o item, conferir a lista e escrever o corpo do `POST /sugestoes-materiais` e do `POST .../aceitar`. A `api` confere tudo
 * de novo; aqui só se evita a viagem de ida e volta por um erro que a pessoa vê na hora.
 */

/** Um item no editor. A quantidade e a observação ficam como texto (o que a pessoa digita) e só viram número ao enviar. */
export interface ItemEditavel {
  /** Identifica a linha na tela; não vai para a `api`. */
  chave: string;
  /** Nulo no item digitado ("Não achei"). */
  material_id: string | null;
  codigo: string | null;
  descricao: string;
  unidade: string;
  categoria: CategoriaMaterial;
  /** Texto da quantidade na unidade do material; vazio = "conforme a necessidade". Aceita vírgula. */
  quantidade: string;
  observacao: string;
  /** Só no ajuste de quem avalia: o item digitado vai ser cadastrado como material novo. */
  criar_material?: boolean;
}

export const LIMITE_DA_OBSERVACAO = 200;

let contador = 0;
const novaChave = () => `item-${++contador}`;

const quantidadeNoCampo = (q: number | null) => (q === null ? "" : String(q).replace(".", ","));

export function itemDoCatalogo(m: Pick<Material, "id" | "codigo" | "descricao" | "unidade" | "categoria">): ItemEditavel {
  return { chave: novaChave(), material_id: m.id, codigo: m.codigo, descricao: m.descricao, unidade: m.unidade, categoria: m.categoria, quantidade: "", observacao: "" };
}

/** O item "Não achei": descrição, unidade e categoria digitadas; quem avalia o liga a um material do catálogo ou o cadastra. */
export function itemDigitado(d: { descricao: string; unidade: string; categoria: CategoriaMaterial }): ItemEditavel {
  const limpo = (t: string) => t.trim().replace(/\s+/g, " ");
  return { chave: novaChave(), material_id: null, codigo: null, descricao: limpo(d.descricao), unidade: limpo(d.unidade), categoria: d.categoria, quantidade: "", observacao: "" };
}

export function itemDaListaDoServico(m: MaterialDoServico): ItemEditavel {
  return { chave: novaChave(), material_id: m.material_id, codigo: m.codigo, descricao: m.descricao, unidade: m.unidade, categoria: m.categoria, quantidade: quantidadeNoCampo(m.quantidade), observacao: m.observacao ?? "" };
}

export function itemDaSugestao(i: ItemDaSugestao): ItemEditavel {
  return { chave: novaChave(), material_id: i.material_id, codigo: i.codigo, descricao: i.descricao, unidade: i.unidade, categoria: i.categoria, quantidade: quantidadeNoCampo(i.quantidade), observacao: i.observacao ?? "" };
}

export type QuantidadeLida = { ok: true; valor: number | null } | { ok: false };

/** "2", "1,5" ou "1.5" viram número; vazio vira `null` (conforme a necessidade); zero, negativo ou texto solto é recusado. */
export function lerQuantidade(texto: string): QuantidadeLida {
  const t = texto.trim().replace(",", ".");
  if (t === "") return { ok: true, valor: null };
  if (!/^\d+(\.\d+)?$/.test(t)) return { ok: false };
  const valor = Number(t);
  return valor > 0 && valor <= 999_999_999 ? { ok: true, valor } : { ok: false };
}

/** O que identifica o item na lista: o material, ou a descrição e a unidade digitadas (como a `api` e `diferencaDeListas` fazem). */
export const chaveDoItem = (i: Pick<ItemEditavel, "material_id" | "descricao" | "unidade">) =>
  i.material_id ?? `livre:${i.descricao.trim().toLowerCase()}|${i.unidade.trim().toLowerCase()}`;

export const jaEstaNaLista = (lista: ItemEditavel[], candidato: Pick<ItemEditavel, "material_id" | "descricao" | "unidade">) => lista.some((i) => chaveDoItem(i) === chaveDoItem(candidato));

/** A primeira coisa errada da lista, em português, ou `null` quando ela pode ir. */
export function faltaNaLista(lista: ItemEditavel[]): string | null {
  if (lista.length === 0) return "Coloque ao menos um item na lista.";
  if (lista.length > MAX_ITENS_DA_SUGESTAO) return `A lista passa de ${MAX_ITENS_DA_SUGESTAO} itens.`;
  const vistas = new Set<string>();
  for (const i of lista) {
    if (!lerQuantidade(i.quantidade).ok) return `Quantidade inválida em "${i.descricao}": use um número maior que zero ou deixe em branco.`;
    if (i.observacao.trim().length > LIMITE_DA_OBSERVACAO) return `A observação de "${i.descricao}" passa de ${LIMITE_DA_OBSERVACAO} caracteres.`;
    const chave = chaveDoItem(i);
    if (vistas.has(chave)) return `"${i.descricao}" aparece mais de uma vez na lista.`;
    vistas.add(chave);
  }
  return null;
}

/** O formato que `diferencaDeListas` compara. */
export interface ItemParaComparar {
  material_id: string | null;
  descricao: string;
  unidade: string;
  quantidade: number | null;
  observacao: string | null;
}

export function paraComparar(lista: ItemEditavel[]): ItemParaComparar[] {
  return lista.map((i) => {
    const q = lerQuantidade(i.quantidade);
    return { material_id: i.material_id, descricao: i.descricao, unidade: i.unidade, quantidade: q.ok ? q.valor : null, observacao: i.observacao.trim() || null };
  });
}

/** Um item no corpo do envio: do catálogo (`material_id`) ou digitado; no ajuste de quem avalia, o digitado pode pedir o cadastro. */
export function itemParaEnvio(i: ItemEditavel): ItemEnviado & { criar_material?: boolean } {
  const q = lerQuantidade(i.quantidade);
  const comum = { quantidade: q.ok ? q.valor : null, observacao: i.observacao.trim() || null };
  if (i.material_id) return { material_id: i.material_id, ...comum };
  return { descricao: i.descricao, unidade: i.unidade, categoria: i.categoria, ...comum, ...(i.criar_material ? { criar_material: true } : {}) };
}

export interface EntradaDoEnvio {
  atividade: string;
  tipo: TipoDeSugestao;
  motivo: string;
  /** `null` = sem lista (só a contestação pode ir assim). */
  lista: ItemEditavel[] | null;
}

/** O corpo do `POST /sugestoes-materiais`. */
export function corpoDoEnvio({ atividade, tipo, motivo, lista }: EntradaDoEnvio) {
  const m = motivo.trim();
  return { atividade, tipo, ...(m ? { motivo: m } : {}), ...(lista ? { lista: lista.map(itemParaEnvio) } : {}) };
}

// ---- O formulário do envio ------------------------------------------------------------------------------------------

export interface ValoresDoEnvio {
  motivo: string;
  /** Na contestação: a pessoa também quer sugerir a lista certa. Na sugestão, sempre há lista. */
  comLista: boolean;
  lista: ItemEditavel[];
}

export function faltaNoMotivoDoEnvio(tipo: TipoDeSugestao, motivo: string): string | null {
  const m = motivo.trim();
  if (tipo === "contestacao" && m.length < MIN_CARACTERES_DO_MOTIVO) return `Explique a contestação em pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres.`;
  if (m.length > MAX_CARACTERES_DO_MOTIVO) return `O motivo passa de ${MAX_CARACTERES_DO_MOTIVO} caracteres.`;
  return null;
}

/** A sugestão sempre leva a lista; a contestação, só se a pessoa quis sugerir a lista certa. */
export const listaVaiNoEnvio = (tipo: TipoDeSugestao, comLista: boolean) => tipo === "sugestao" || comLista;

export const MENSAGEM_SEM_MUDANCA = "A lista é igual à lista atual do serviço. Mude algum item, quantidade ou observação.";

/** O esquema Zod do envio: a mensagem fica junto do campo que errou (o motivo, a lista). `base` é a lista atual do serviço. */
export function esquemaDoEnvio(tipo: TipoDeSugestao, base: ItemParaComparar[]): z.ZodType<ValoresDoEnvio> {
  return z
    .object({ motivo: z.string(), comLista: z.boolean(), lista: z.array(z.custom<ItemEditavel>()) })
    .superRefine((v, ctx) => {
      const problema = (path: string, message: string | null) => message && ctx.addIssue({ code: "custom", path: [path], message });
      problema("motivo", faltaNoMotivoDoEnvio(tipo, v.motivo));
      if (!listaVaiNoEnvio(tipo, v.comLista)) return;
      const falta = faltaNaLista(v.lista);
      problema("lista", falta ?? (totalDeMudancas(diferencaDeListas(base, paraComparar(v.lista))) === 0 ? MENSAGEM_SEM_MUDANCA : null));
    });
}

export interface ValoresDaRecusa {
  resposta: string;
}

export const esquemaDaRecusa: z.ZodType<ValoresDaRecusa> = z.object({
  resposta: z
    .string()
    .trim()
    .min(MIN_CARACTERES_DO_MOTIVO, `Explique a recusa em pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres.`)
    .max(MAX_CARACTERES_DO_MOTIVO, `A resposta passa de ${MAX_CARACTERES_DO_MOTIVO} caracteres.`),
});

/** A resposta ao aceitar: opcional. */
export const esquemaDaRespostaOpcional: z.ZodType<ValoresDaRecusa> = z.object({
  resposta: z.string().trim().max(MAX_CARACTERES_DO_MOTIVO, `A resposta passa de ${MAX_CARACTERES_DO_MOTIVO} caracteres.`),
});

// ---- A avaliação ----------------------------------------------------------------------------------------------------

/** O que quem avalia decidiu para um item digitado: ligá-lo a um material do catálogo ou cadastrá-lo como novo. */
export type Resolucao = { tipo: "ligar"; material: Pick<Material, "id" | "codigo" | "descricao" | "unidade" | "categoria"> } | { tipo: "criar" };

export type Resolucoes = Record<number, Resolucao | undefined>;

/** As ordens dos itens digitados que ainda esperam a decisão de quem avalia. */
export const itensSemResolucao = (itens: Pick<ItemDaSugestao, "ordem" | "material_id">[], resolucoes: Resolucoes): number[] => itens.filter((i) => !i.material_id && !resolucoes[i.ordem]).map((i) => i.ordem);

/** Os itens da proposta com as escolhas aplicadas: o ponto de partida do "Ajustar e aceitar". */
export function listaDoAjuste(itens: ItemDaSugestao[], resolucoes: Resolucoes): ItemEditavel[] {
  return itens.map((i) => {
    const base = itemDaSugestao(i);
    const r = resolucoes[i.ordem];
    if (i.material_id || !r) return base;
    if (r.tipo === "ligar") return { ...base, material_id: r.material.id, codigo: r.material.codigo, descricao: r.material.descricao, unidade: r.material.unidade, categoria: r.material.categoria };
    return { ...base, criar_material: true };
  });
}

export interface ValoresDoAjuste {
  resposta: string;
  lista: ItemEditavel[];
}

/** O "Ajustar e aceitar": a lista ajustada tem de estar certa; a resposta é opcional. */
export const esquemaDoAjuste: z.ZodType<ValoresDoAjuste> = z
  .object({ resposta: z.string().trim().max(MAX_CARACTERES_DO_MOTIVO, `A resposta passa de ${MAX_CARACTERES_DO_MOTIVO} caracteres.`), lista: z.array(z.custom<ItemEditavel>()) })
  .superRefine((v, ctx) => {
    const falta = faltaNaLista(v.lista);
    if (falta) ctx.addIssue({ code: "custom", path: ["lista"], message: falta });
  });

export interface EntradaDoAceite {
  itens: Pick<ItemDaSugestao, "ordem" | "material_id">[];
  resolucoes: Resolucoes;
  /** A lista ajustada (ou a de uma contestação sem lista); `null` aceita a proposta como veio. */
  lista: ItemEditavel[] | null;
  resposta: string;
}

/** O corpo do `POST /sugestoes-materiais/{id}/aceitar`. */
export function corpoDoAceite({ itens, resolucoes, lista, resposta }: EntradaDoAceite) {
  const ligacoes = itens.flatMap((i) => {
    const r = resolucoes[i.ordem];
    if (i.material_id || !r) return [];
    return [r.tipo === "ligar" ? { ordem: i.ordem, material_id: r.material.id } : { ordem: i.ordem, criar_material: true }];
  });
  const texto = resposta.trim();
  return { ...(ligacoes.length > 0 ? { resolucoes: ligacoes } : {}), ...(lista ? { lista: lista.map(itemParaEnvio) } : {}), ...(texto ? { resposta: texto } : {}) };
}
