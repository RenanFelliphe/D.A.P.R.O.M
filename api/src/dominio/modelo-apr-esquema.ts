import { z } from "zod";
import { ITEM_EVIDENCIAS, ITEM_SECOES, ITEM_TIPOS, RESPOSTAS_BLOQUEANTES } from "../db/schema";
import { invalido } from "../http/erros";
import { dataIso, textoObrigatorio } from "../http/validacao";

const ordem = z.number().int().min(0);

export const esquemaRisco = z.object({
  classificacao: textoObrigatorio,
  nome: textoObrigatorio,
  ordem,
});

export const esquemaItem = z.object({
  secao: z.enum(ITEM_SECOES),
  /** `ordem` do risco que a medida controla: obrigatório em `medida_preventiva`, proibido em `verificacao`. */
  risco_ordem: ordem.nullable().optional(),
  ordem,
  texto: textoObrigatorio,
  resposta_bloqueante: z.enum(RESPOSTAS_BLOQUEANTES).nullable().optional(),
  tipo: z.enum(ITEM_TIPOS),
  evidencia: z.enum(ITEM_EVIDENCIAS).default("foto"),
  permite_na: z.boolean().default(false),
  /** A pergunta mostra a previsão do tempo (a pergunta de clima da APR). */
  mostrar_clima: z.boolean().default(false),
});

/** O PAE é um JSON definido pelo cliente (`{titulo, subtitulo, fluxo, linhas}`); a api só exige que seja um objeto. */
export const esquemaPae = z.record(z.string(), z.unknown());

export const esquemaCodigo = z.string().trim().min(1).max(40);

export type RiscoEntrada = z.infer<typeof esquemaRisco>;
export type ItemEntrada = z.infer<typeof esquemaItem>;

export interface ConteudoDoModelo {
  titulo: string;
  pae: Record<string, unknown> | null;
  dataDocumento: string | null;
  /** A folha tem a coluna "Assinatura" na tabela de participantes (o PDF da OS a reproduz como é). */
  participantesComAssinatura: boolean;
  riscos: RiscoEntrada[];
  itens: ItemEntrada[];
}

/**
 * Coerência do conteúdo de um modelo (rascunho): `ordem` única entre os riscos e entre os itens, toda medida
 * preventiva com um risco que existe e nenhuma verificação com risco. O que só vale para publicar (item eliminatório,
 * resposta bloqueante nas verificações) fica em `exigirPublicavel`.
 */
export function validarConteudo(riscos: RiscoEntrada[], itens: ItemEntrada[]): void {
  const ordensDeRisco = new Set<number>();
  for (const r of riscos) {
    if (ordensDeRisco.has(r.ordem)) throw invalido("ordem_duplicada", `Mais de um risco com a ordem ${r.ordem}`);
    ordensDeRisco.add(r.ordem);
  }
  const ordensDeItem = new Set<number>();
  for (const i of itens) {
    if (ordensDeItem.has(i.ordem)) throw invalido("ordem_duplicada", `Mais de um item com a ordem ${i.ordem}`);
    ordensDeItem.add(i.ordem);

    const temRisco = i.risco_ordem !== null && i.risco_ordem !== undefined;
    if (i.secao === "verificacao" && temRisco) {
      throw invalido("risco_em_verificacao", `Item ${i.ordem}: item de verificação não tem risco`);
    }
    if (i.secao === "medida_preventiva") {
      if (!temRisco) throw invalido("medida_sem_risco", `Item ${i.ordem}: medida preventiva precisa de risco_ordem`);
      if (!ordensDeRisco.has(i.risco_ordem!)) {
        throw invalido("risco_inexistente", `Item ${i.ordem}: não existe risco com a ordem ${i.risco_ordem}`);
      }
    }
  }
}

/** Regras de publicação (decisão-chave 5, `docs/especificacao.md`, seção 2.5): só um modelo que pode bloquear uma APR e cujas verificações têm critério. */
export function exigirPublicavel(itens: Pick<ItemEntrada, "secao" | "tipo" | "resposta_bloqueante">[]): void {
  if (!itens.some((i) => i.tipo === "eliminatorio")) {
    throw invalido("sem_item_eliminatorio", "Modelo precisa de ao menos um item eliminatório");
  }
  if (itens.some((i) => i.secao === "verificacao" && !i.resposta_bloqueante)) {
    throw invalido("verificacao_sem_resposta_bloqueante", "Todo item de verificação precisa de resposta bloqueante");
  }
}

/** `AAAA-MM-DD` de um dia que existe (a coluna é `date`; "2026-13-45" chegaria ao banco como erro). */
export const dataDoDocumento = dataIso.refine((v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}, "Data inexistente");
