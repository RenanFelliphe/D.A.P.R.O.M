import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { material } from "../db/schema";
import { invalido } from "../http/erros";
import { textoObrigatorio, uuid } from "../http/validacao";
import { pendenciasAbertas } from "../../../shared/treinamento-servico/ia";
import { PALAVRAS_DO_BANCO, SO_LETRAS, TETO_DE_FASES, letrasDaGrade, letrasDaPalavra } from "../../../shared/treinamento-servico/jogos";

/**
 * Validação do conteúdo dos treinamentos de serviço (seção 3 do `vitoria.md`), no espírito de `modelo-apr-esquema.ts`: o
 * formato de cada jsonb é um `z.object`/`z.discriminatedUnion` simples, e as regras que cruzam campos (índice da opção
 * certa, material repetido, limites de publicação) ficam em funções `validar*` à parte, para o schema do banco não precisar
 * de `check` com `jsonb_array_length`.
 */

/** Expressões da Vitória usáveis num passo da explicação (cada uma vira uma reação da Vitória: `shared/vitoria/reacoes.ts`). */
export const EXPRESSOES_VITORIA = ["padrao", "feliz", "explicando", "pensando", "alerta", "comemorando", "ops"] as const;
export type ExpressaoVitoria = (typeof EXPRESSOES_VITORIA)[number];

const textoCurto = (max: number) => textoObrigatorio.max(max);

/**
 * O que acompanha um passo ou uma fase montada pela IA (`shared/treinamento-servico/ia.ts`): o trecho de origem, as
 * pendências da geração, a impressão do conteúdo como a IA o entregou e se o admin já o confirmou. Itens feitos à mão não têm.
 */
export const esquemaMetaIA = z.object({
  origem: z.string().max(2000),
  impressao: z.string().max(40),
  pendencias: z.array(z.object({ codigo: z.string().max(60), mensagem: z.string().max(300) })).max(20),
  conferido: z.boolean(),
});
const metaIA = esquemaMetaIA.nullable().optional();

export const esquemaPassoExplicacao = z.object({
  ordem: z.number().int().min(0),
  texto: textoCurto(600),
  expressao: z.enum(EXPRESSOES_VITORIA),
  imagem_path: z.string().trim().min(1).max(200).nullable().optional(),
  ia: metaIA,
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
  ia: metaIA,
});

export const esquemaFaseDecisao = z.object({
  tipo: z.literal("decisao"),
  situacao: textoCurto(400),
  opcoes: z.array(z.object({ texto: textoCurto(160), consequencia: textoCurto(300) })).min(3).max(4),
  correta: z.number().int().min(0),
  explicacao: textoCurto(400),
  ia: metaIA,
});

export const esquemaFaseLigar = z.object({
  tipo: z.literal("ligar"),
  pares: z.array(z.object({ esquerda: textoCurto(160), direita: textoCurto(160) })).min(2).max(5),
  explicacao: textoCurto(400),
  ia: metaIA,
});

export const esquemaFaseOrdem = z.object({
  tipo: z.literal("ordem"),
  enunciado: textoCurto(400),
  /** A ordem do array É o gabarito: a sequência certa das etapas. */
  etapas: z.array(textoCurto(160)).min(2).max(6),
  explicacao: textoCurto(400),
  ia: metaIA,
});

export const esquemaFaseVerdadeiroFalso = z.object({
  tipo: z.literal("verdadeiro_falso"),
  afirmacao: textoCurto(400),
  /** O gabarito: a afirmação é verdadeira? */
  verdadeira: z.boolean(),
  explicacao: textoCurto(400),
  ia: metaIA,
});

/** Uma palavra do caça-palavras: só letras (3 a 12, sem contar acento), e a pista ou definição, se houver. */
const esquemaPalavraDaGrade = z.object({
  palavra: z.string().trim().regex(SO_LETRAS, "Só letras, sem espaço").min(3).max(12),
  pista: z.string().trim().max(160).nullable().optional(),
});

export const esquemaFaseCacaPalavras = z.object({
  tipo: z.literal("caca_palavras"),
  enunciado: textoCurto(400),
  /** "palavras": a lista mostra as palavras (a pista, se houver, vai embaixo); "pistas": só as pistas, a palavra fica escondida. */
  modo: z.enum(["palavras", "pistas"]),
  palavras: z.array(esquemaPalavraDaGrade).min(2).max(5),
  explicacao: textoCurto(400),
  ia: metaIA,
});

export const esquemaFaseMemoria = z.object({
  tipo: z.literal("memoria"),
  /** Cada par vira duas cartas: o termo e o que corresponde a ele (a função, a definição, a medida). */
  pares: z.array(z.object({ termo: textoCurto(80), correspondente: textoCurto(80) })).min(2).max(5),
  explicacao: textoCurto(400),
  ia: metaIA,
});

/**
 * "Montar com os materiais do serviço": os materiais certos (do catálogo, de 1 a 10) e quantos itens de outros serviços o
 * servidor sorteia a cada partida para misturar (de 1 a 10). Era o antigo "Separar os itens" (migração `0033`).
 */
export const esquemaMateriaisDoSelecione = z.object({
  material_ids: z.array(uuid).min(1).max(10),
  quantidade_errados: z.number().int().min(1).max(10),
});

export const esquemaFaseSelecione = z.object({
  tipo: z.literal("selecione"),
  enunciado: textoCurto(400),
  /** As opções escritas pelo admin (3 a 12; de 1 a 8 certas e ao menos uma errada). Vazia quando a fase usa `materiais`. */
  opcoes: z.array(z.object({ texto: textoCurto(160), correta: z.boolean() })).max(12),
  materiais: esquemaMateriaisDoSelecione.nullable().optional(),
  explicacao: textoCurto(400),
  ia: metaIA,
});

/**
 * O banco de palavras do Desembaralhe e do Termo: cada tentativa sorteia uma, para quem joga de novo não pegar sempre a
 * mesma. O rascunho aceita de 1 a 10, para salvar no meio do caminho; publicar exige as 10 (`validarPublicavel`).
 */
const bancoDePalavras = <T extends z.ZodTypeAny>(palavra: T) => z.array(palavra).min(1).max(PALAVRAS_DO_BANCO);

export const esquemaFaseDesembaralhe = z.object({
  tipo: z.literal("desembaralhe"),
  /** Cada palavra (de 3 a 14 letras, que o jogo embaralha letra por letra) com a sua dica: o que ela é. */
  palavras: bancoDePalavras(z.object({ palavra: z.string().trim().regex(SO_LETRAS, "Só letras, sem espaço").min(3).max(14), dica: textoCurto(400) })),
  explicacao: textoCurto(400),
  ia: metaIA,
});

export const esquemaFaseTermo = z.object({
  tipo: z.literal("termo"),
  /** Cada palavra secreta (de 4 a 7 letras, sem contar acento; as tentativas são as letras + 1) com uma dica opcional. */
  palavras: bancoDePalavras(z.object({ palavra: z.string().trim().regex(SO_LETRAS, "Só letras, sem espaço").min(4).max(7), dica: z.string().trim().max(160).nullable().optional() })),
  explicacao: textoCurto(400),
  ia: metaIA,
});

export const esquemaFase = z.discriminatedUnion("tipo", [
  esquemaFaseQuiz,
  esquemaFaseDecisao,
  esquemaFaseLigar,
  esquemaFaseOrdem,
  esquemaFaseVerdadeiroFalso,
  esquemaFaseCacaPalavras,
  esquemaFaseMemoria,
  esquemaFaseSelecione,
  esquemaFaseDesembaralhe,
  esquemaFaseTermo,
]);
export type FaseEntrada = z.infer<typeof esquemaFase>;
/** Sem limite de fases no produto: `TETO_DE_FASES` só protege a `api` de um pedido gigante. */
export const esquemaFases = z.array(esquemaFase).max(TETO_DE_FASES);

export interface ConteudoDoTreinamento {
  explicacao: PassoExplicacao[];
  fases: FaseEntrada[];
}

/** Coerência do rascunho: `ordem` única entre os passos, índice da opção certa dentro da lista e sem material repetido. */
/**
 * A regra que cruza campos de uma fase e que o formato sozinho não garante (índice da certa, material ou palavra repetida,
 * quantas certas no "selecione"...). Devolve o código e a mensagem do primeiro problema, ou `null`. A geração pela IA usa
 * a mesma regra para descartar a fase em vez de gravar um rascunho que o editor não salvaria.
 */
export function problemaDaFase(f: FaseEntrada): { codigo: string; mensagem: string } | null {
  if ((f.tipo === "quiz" || f.tipo === "decisao") && (f.correta < 0 || f.correta >= f.opcoes.length)) {
    return { codigo: "fase_sem_opcao_correta", mensagem: "a opção certa precisa existir na lista de opções" };
  }
  if (f.tipo === "caca_palavras") {
    const naGrade = f.palavras.map((p) => letrasDaGrade(p.palavra));
    if (naGrade.some((p) => p.length < 3 || p.length > 12)) return { codigo: "fase_palavra_invalida", mensagem: "cada palavra precisa ter de 3 a 12 letras" };
    if (new Set(naGrade).size !== naGrade.length) return { codigo: "fase_palavra_repetida", mensagem: "uma palavra está repetida" };
    if (f.modo === "pistas" && f.palavras.some((p) => !p.pista?.trim())) return { codigo: "fase_sem_pista", mensagem: "no modo de pistas, toda palavra precisa da pista" };
  }
  if (f.tipo === "selecione" && f.materiais) {
    if (f.opcoes.length > 0) return { codigo: "fase_selecione_mista", mensagem: "com os materiais do serviço, a fase não leva opções escritas" };
    if (new Set(f.materiais.material_ids).size !== f.materiais.material_ids.length) return { codigo: "fase_material_repetido", mensagem: "um material está repetido na lista de itens certos" };
  } else if (f.tipo === "selecione") {
    if (f.opcoes.length < 3) return { codigo: "fase_selecione_opcoes", mensagem: "escreva de 3 a 12 opções" };
    const certas = f.opcoes.filter((o) => o.correta).length;
    if (certas < 1 || certas > 8) return { codigo: "fase_selecione_certas", mensagem: "marque de 1 a 8 opções certas" };
    if (certas === f.opcoes.length) return { codigo: "fase_selecione_sem_errada", mensagem: "ao menos uma opção precisa ser errada" };
  }
  if (f.tipo === "termo" || f.tipo === "desembaralhe") {
    const naGrade = f.palavras.map((p) => letrasDaGrade(p.palavra));
    if (new Set(naGrade).size !== naGrade.length) return { codigo: "fase_palavra_repetida", mensagem: "uma palavra está repetida no banco" };
    if (f.tipo === "termo" && naGrade.some((p) => p.length < 4 || p.length > 7)) return { codigo: "fase_palavra_invalida", mensagem: "cada palavra do Termo precisa ter de 4 a 7 letras" };
    if (f.tipo === "desembaralhe" && f.palavras.some((p) => new Set(letrasDaPalavra(p.palavra)).size < 2)) {
      return { codigo: "fase_palavra_invalida", mensagem: "cada palavra precisa de ao menos duas letras diferentes para embaralhar" };
    }
  }
  return null;
}

export function validarConteudo(explicacao: PassoExplicacao[], fases: FaseEntrada[]): void {
  const ordensDoPasso = new Set<number>();
  for (const p of explicacao) {
    if (ordensDoPasso.has(p.ordem)) throw invalido("ordem_duplicada", `Mais de um passo da explicação com a ordem ${p.ordem}`);
    ordensDoPasso.add(p.ordem);
  }
  fases.forEach((f, i) => {
    const problema = problemaDaFase(f);
    if (problema) throw invalido(problema.codigo, `Fase ${i + 1}: ${problema.mensagem}`);
  });
}

/** Só vale na publicação (Decisão da seção 3 do `vitoria.md`): 1 a 12 passos, ao menos 3 fases e o banco cheio no Desembaralhe e no Termo. */
export function validarPublicavel(explicacao: PassoExplicacao[], fases: FaseEntrada[]): void {
  if (explicacao.length === 0) throw invalido("sem_explicacao", "A explicação precisa de ao menos 1 passo para publicar");
  if (fases.length < 3) throw invalido("fases_insuficientes", "O jogo precisa de ao menos 3 fases para publicar");
  const incompleta = fases.findIndex((f) => (f.tipo === "termo" || f.tipo === "desembaralhe") && f.palavras.length < PALAVRAS_DO_BANCO);
  if (incompleta >= 0) throw invalido("palavras_insuficientes", `Fase ${incompleta + 1}: o banco precisa de ${PALAVRAS_DO_BANCO} palavras para publicar`);
}

/**
 * Pendência das conferências da IA ainda aberta (o item não foi editado nem confirmado) impede publicar (seção 3.6 do
 * `vitoria.md`). Vai nos `detalhes` do erro, para a tela apontar cada uma.
 */
export function validarSemPendencias(explicacao: PassoExplicacao[], fases: FaseEntrada[]): void {
  const abertas = pendenciasAbertas({ explicacao, fases });
  if (abertas.length === 0) return;
  throw invalido("pendencias_abertas", `Há ${abertas.length} pendência(s) do rascunho da IA: edite o item ou confirme-o antes de publicar`, { pendencias: abertas });
}

/** Os materiais do Selecione "montado com os materiais do serviço" precisam existir e estar ativos no catálogo. */
export async function validarFasesContraCatalogo(db: Db, fases: FaseEntrada[]): Promise<void> {
  const ids = [...new Set(fases.flatMap((f) => (f.tipo === "selecione" && f.materiais ? f.materiais.material_ids : [])))];
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
export const esquemaRespostaPares = z.object({ pares: z.array(z.object({ esquerda: z.number().int().min(0), direita: z.number().int().min(0) })).max(5) });
export const esquemaRespostaSequencia = z.object({ sequencia: z.array(z.number().int().min(0)).max(6) });
export const esquemaRespostaVerdadeiroFalso = z.object({ verdadeira: z.boolean() });
const celula = z.tuple([z.number().int().min(0), z.number().int().min(0)]);
/** As palavras achadas: o início e o fim de cada uma na grade. */
export const esquemaRespostaGrade = z.object({ selecoes: z.array(z.object({ inicio: celula, fim: celula })).max(5) });
/** As cartas viradas, duas a duas, na ordem em que foram viradas (o servidor refaz a partida para contar os erros). */
export const esquemaRespostaMemoria = z.object({ jogadas: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])).max(200) });
export const esquemaRespostaMarcadas = z.object({ marcadas: z.array(z.number().int().min(0)).max(20) });
/** As peças na ordem em que foram postas (posições mostradas). */
/** Os palpites do Termo, na ordem (o servidor confere o tamanho, o limite de tentativas e se algum acertou). */
export const esquemaRespostaPalpites = z.object({ palpites: z.array(z.string().max(20)).max(8) });
export const esquemaRespostaLetras = z.object({ letras: z.array(z.number().int().min(0)).max(14) });
