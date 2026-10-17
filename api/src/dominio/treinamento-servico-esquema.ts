import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { material } from "../db/schema";
import { invalido } from "../http/erros";
import { textoObrigatorio, uuid } from "../http/validacao";

/**
 * Validação do conteúdo dos treinamentos de serviço (seção 3 do `vitoria.md`), no espírito de `modelo-apr-esquema.ts`: o
 * formato de cada jsonb é um `z.object`/`z.discriminatedUnion` simples, e as regras que cruzam campos (índice da opção
 * certa, material repetido, limites de publicação) ficam em funções `validar*` à parte, para o schema do banco não precisar
 * de `check` com `jsonb_array_length`.
 */

/** Expressões da Vitória usáveis num passo da explicação (as de `vitoria/expressoes.json`, exceto `icone`, que é só o botão). */
export const EXPRESSOES_VITORIA = ["padrao", "feliz", "explicando", "pensando", "alerta", "comemorando", "ops"] as const;
export type ExpressaoVitoria = (typeof EXPRESSOES_VITORIA)[number];

const textoCurto = (max: number) => textoObrigatorio.max(max);

export const esquemaPassoExplicacao = z.object({
  ordem: z.number().int().min(0),
  texto: textoCurto(600),
  expressao: z.enum(EXPRESSOES_VITORIA),
  imagem_path: z.string().trim().min(1).max(200).nullable().optional(),
});
export type PassoExplicacao = z.infer<typeof esquemaPassoExplicacao>;
export const esquemaExplicacao = z.array(esquemaPassoExplicacao).max(12);

// ---- Fases do jogo (a união é o gabarito; nunca sai da api antes da resposta) -------------------------------------

export const esquemaFaseQuiz = z.object({
  tipo: z.literal("quiz"),
  enunciado: textoCurto(400),
  opcoes: z.array(textoCurto(160)).min(3).max(4),
  correta: z.number().int().min(0),
  explicacao: textoCurto(400),
});

export const esquemaFaseDecisao = z.object({
  tipo: z.literal("decisao"),
  situacao: textoCurto(400),
  opcoes: z.array(z.object({ texto: textoCurto(160), consequencia: textoCurto(300) })).min(3).max(4),
  correta: z.number().int().min(0),
  explicacao: textoCurto(400),
});

export const esquemaFaseSepararItens = z.object({
  tipo: z.literal("separar_itens"),
  enunciado: textoCurto(400),
  /** Os materiais certos deste serviço (do catálogo); o servidor sorteia os errados de outros serviços na abertura. */
  material_ids: z.array(uuid).min(2).max(10),
  quantidade_errados: z.number().int().min(1).max(10),
  explicacao: textoCurto(400),
});

export const esquemaFaseLigar = z.object({
  tipo: z.literal("ligar"),
  pares: z.array(z.object({ esquerda: textoCurto(160), direita: textoCurto(160) })).min(2).max(5),
  explicacao: textoCurto(400),
});

export const esquemaFaseOrdem = z.object({
  tipo: z.literal("ordem"),
  enunciado: textoCurto(400),
  /** A ordem do array É o gabarito: a sequência certa das etapas. */
  etapas: z.array(textoCurto(160)).min(2).max(6),
  explicacao: textoCurto(400),
});

export const esquemaFase = z.discriminatedUnion("tipo", [esquemaFaseQuiz, esquemaFaseDecisao, esquemaFaseSepararItens, esquemaFaseLigar, esquemaFaseOrdem]);
export type FaseEntrada = z.infer<typeof esquemaFase>;
export const esquemaFases = z.array(esquemaFase).max(10);

export interface ConteudoDoTreinamento {
  explicacao: PassoExplicacao[];
  fases: FaseEntrada[];
}

/** Coerência do rascunho: `ordem` única entre os passos, índice da opção certa dentro da lista e sem material repetido. */
export function validarConteudo(explicacao: PassoExplicacao[], fases: FaseEntrada[]): void {
  const ordensDoPasso = new Set<number>();
  for (const p of explicacao) {
    if (ordensDoPasso.has(p.ordem)) throw invalido("ordem_duplicada", `Mais de um passo da explicação com a ordem ${p.ordem}`);
    ordensDoPasso.add(p.ordem);
  }
  fases.forEach((f, i) => {
    const n = i + 1;
    if ((f.tipo === "quiz" || f.tipo === "decisao") && (f.correta < 0 || f.correta >= f.opcoes.length)) {
      throw invalido("fase_sem_opcao_correta", `Fase ${n}: a opção certa precisa existir na lista de opções`);
    }
    if (f.tipo === "separar_itens" && new Set(f.material_ids).size !== f.material_ids.length) {
      throw invalido("fase_material_repetido", `Fase ${n}: um material está repetido na lista de itens certos`);
    }
  });
}

/** Só vale na publicação (Decisão da seção 3 do `vitoria.md`): 1 a 12 passos e 3 a 10 fases. */
export function validarPublicavel(explicacao: PassoExplicacao[], fases: FaseEntrada[]): void {
  if (explicacao.length === 0) throw invalido("sem_explicacao", "A explicação precisa de ao menos 1 passo para publicar");
  if (fases.length < 3) throw invalido("fases_insuficientes", "O jogo precisa de ao menos 3 fases para publicar");
}

/** Os `material_ids` de "separar os itens" precisam existir e estar ativos no catálogo. */
export async function validarFasesContraCatalogo(db: Db, fases: FaseEntrada[]): Promise<void> {
  const ids = [...new Set(fases.filter((f) => f.tipo === "separar_itens").flatMap((f) => f.material_ids))];
  if (ids.length === 0) return;
  const existentes = await db.select({ id: material.id, ativo: material.ativo }).from(material).where(inArray(material.id, ids));
  const porId = new Map(existentes.map((m) => [m.id, m.ativo]));
  const faltando = ids.filter((id) => !porId.has(id));
  if (faltando.length > 0) throw invalido("material_inexistente", `Material inexistente no catálogo: ${faltando.join(", ")}`);
  const inativos = ids.filter((id) => porId.get(id) === false);
  if (inativos.length > 0) throw invalido("material_inativo", `Material desativado no catálogo: ${inativos.join(", ")}`);
}

export const esquemaConteudo = z.object({ explicacao: esquemaExplicacao, fases: esquemaFases });

// ---- O que o jogador envia ao responder uma fase (o tipo já se sabe pela fase gravada; não precisa vir de novo) ----

export const esquemaRespostaEscolha = z.object({ escolha: z.number().int().min(0) });
export const esquemaRespostaSelecionados = z.object({ selecionados: z.array(uuid).max(10) });
export const esquemaRespostaPares = z.object({ pares: z.array(z.object({ esquerda: z.number().int().min(0), direita: z.number().int().min(0) })).max(5) });
export const esquemaRespostaSequencia = z.object({ sequencia: z.array(z.number().int().min(0)).max(6) });
