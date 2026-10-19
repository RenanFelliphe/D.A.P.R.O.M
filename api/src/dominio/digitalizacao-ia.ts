import { createCanvas, loadImage } from "@napi-rs/canvas";
import { z } from "zod";
import { IAIndisponivel, RespostaIAInvalida, type ImagemDeMensagem, type ProvedorIA } from "../servicos/ia";

/**
 * A parte da Digitalização que fala com a IA de visão: lê só o que foi escrito à mão na folha da OS (o início e o fim reais da
 * execução, quantas pessoas e a descrição da atividade). O impresso é do OCR local (`ocr.ts`), e as assinaturas, as rubricas e os
 * nomes nunca são transcritos: ficam só na imagem. A IA lê, o sistema confere (`digitalizacao.ts`) e a pessoa confirma.
 */

/** O que a IA devolve de uma OS. `inicio` e `fim` em `AAAA-MM-DDTHH:MM`, no horário de São Paulo. */
export interface ManuscritoLido {
  inicio: string | null;
  fim: string | null;
  pessoas: number | null;
  texto: string | null;
  /** O que a leitura não conseguiu entender e a conferência avisa (o texto é da IA, em português). */
  avisos: string[];
}

export const MANUSCRITO_VAZIO: ManuscritoLido = { inicio: null, fim: null, pessoas: null, texto: null, avisos: [] };

/** Folhas (recortes) enviadas por OS: o custo cresce com cada imagem, e as que passam disto não trazem o que se procura. */
export const MAX_IMAGENS_POR_OS = 6;
/** Maior lado, em pixels, da imagem enviada à IA: o suficiente para a letra de mão de uma A4 sem pagar por pixel que não ajuda. */
const LADO_MAXIMO_PX = 1800;
const QUALIDADE_DO_JPEG = 80;

const INSTRUCAO = `Você lê o que foi escrito À MÃO numa Ordem de Manutenção (OS) impressa pelo SAP e já executada no papel pela ES Gás. As imagens são as folhas da OS (a tabela de operações e a folha de execução). Responda SOMENTE com um JSON, sem texto antes nem depois.

O que procurar (só o que está escrito à mão, a caneta):
- "inicio" e "fim": a data e a hora REAIS do início e do fim da execução, escritas na linha logo abaixo da operação (ex.: 17/05/26 11:09 e 17/05/26 12:18). Devolva no formato AAAA-MM-DDTHH:MM (ex.: 2026-05-17T11:09). Ano com 2 dígitos é 20aa.
- "pessoas": o número de pessoas escrito na linha da operação (um inteiro).
- "texto": a descrição da atividade e as observações escritas à mão nas linhas da folha de execução, transcritas como estão, em uma só string (use \n entre as linhas). Letra de forma ou cursiva: transcreva o que for legível.

Regras:
- NUNCA invente. Se um campo não está escrito, está ilegível ou você não tem certeza, devolva null e explique em "avisos".
- NÃO transcreva assinaturas, rubricas nem nomes de pessoas; ignore-os.
- Ignore tudo o que é impresso (rótulos, cabeçalho, tabelas vazias) e qualquer folha que não seja da OS.
- Dígitos de data e hora são o que mais se erra: releia-os com calma.

Formato da resposta:
{"inicio": string|null, "fim": string|null, "pessoas": number|null, "texto": string|null, "avisos": string[]}`;

/** O esquema da saída; o Gemini liga a saída em JSON por ele, e a resposta é conferida de qualquer jeito (`esquemaManuscrito`). */
export const ESQUEMA_DO_MANUSCRITO = {
  type: "object",
  properties: {
    inicio: { type: ["string", "null"] },
    fim: { type: ["string", "null"] },
    pessoas: { type: ["integer", "null"] },
    texto: { type: ["string", "null"] },
    avisos: { type: "array", items: { type: "string" } },
  },
  required: ["inicio", "fim", "pessoas", "texto", "avisos"],
} as const;

/** Data e hora lidas pela IA (`AAAA-MM-DDTHH:MM`): o que não é uma data e hora que existe vira nulo, nunca um palpite. */
export const instante = z.union([z.string(), z.null()]).transform((v, ctx) => {
  if (v === null) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [a, mes, d, h, min] = m.slice(1).map(Number) as [number, number, number, number, number];
  const data = new Date(Date.UTC(a, mes - 1, d, h, min));
  if (data.getUTCFullYear() !== a || data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== d || h > 23 || min > 59) {
    ctx.addIssue({ code: "custom", message: "instante inexistente" });
    return z.NEVER;
  }
  return v.trim();
});

const esquemaManuscrito = z.object({
  inicio: instante.catch(null).default(null),
  fim: instante.catch(null).default(null),
  pessoas: z.number().int().min(1).max(50).nullable().catch(null).default(null),
  texto: z
    .string()
    .nullable()
    .transform((t) => (t && t.trim() ? t.trim().slice(0, 4000) : null))
    .catch(null)
    .default(null),
  avisos: z.array(z.string()).catch([]).default([]),
});

/** O JSON da resposta, mesmo que a IA o tenha cercado com ```json … ```. */
export function extrairJson(resposta: string): unknown {
  const limpo = resposta.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const comeco = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (comeco === -1 || fim < comeco) throw new RespostaIAInvalida("A IA não devolveu um JSON");
  try {
    return JSON.parse(limpo.slice(comeco, fim + 1));
  } catch (erro) {
    throw new RespostaIAInvalida("A IA devolveu um JSON inválido", { cause: erro });
  }
}

/**
 * Pede à IA o que está escrito à mão nas folhas de uma OS. `IAIndisponivel` (sem chave, sem cota, rede) e `RespostaIAInvalida`
 * sobem para quem chama, que segue sem a IA: a pessoa digita o manuscrito na conferência.
 */
export async function lerManuscritoComIa(ia: ProvedorIA, imagens: ImagemDeMensagem[]): Promise<ManuscritoLido> {
  if (imagens.length === 0) return { ...MANUSCRITO_VAZIO, avisos: ["Nenhuma folha da OS foi enviada à IA."] };
  const resposta = await ia.conversar({
    modelo: "digitalizacao",
    mensagens: [
      { papel: "sistema", texto: INSTRUCAO, cache: true },
      { papel: "usuario", texto: "Leia o que está escrito à mão nestas folhas da OS e responda com o JSON.", imagens },
    ],
    schemaDeSaida: ESQUEMA_DO_MANUSCRITO,
    maxTokens: 2000,
    tempoLimiteMs: 120_000,
  });
  const lido = esquemaManuscrito.safeParse(extrairJson(resposta));
  if (!lido.success) throw new RespostaIAInvalida("A IA devolveu um JSON fora do formato esperado");
  return lido.data;
}

/** Recorte da folha: de `topo` (px da imagem) até o pé, reduzido ao `LADO_MAXIMO_PX`, em JPEG. Sem `topo`, a folha inteira. */
export async function recortarFolha(jpeg: Uint8Array, topo = 0): Promise<ImagemDeMensagem> {
  const imagem = await loadImage(Buffer.from(jpeg));
  const y = Math.max(0, Math.min(Math.floor(topo), imagem.height - 1));
  const altura = imagem.height - y;
  const escala = Math.min(1, LADO_MAXIMO_PX / Math.max(imagem.width, altura));
  const canvas = createCanvas(Math.max(1, Math.round(imagem.width * escala)), Math.max(1, Math.round(altura * escala)));
  const contexto = canvas.getContext("2d");
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, canvas.width, canvas.height);
  contexto.drawImage(imagem, 0, y, imagem.width, altura, 0, 0, canvas.width, canvas.height);
  return { tipoMime: "image/jpeg", dados: canvas.toBuffer("image/jpeg", QUALIDADE_DO_JPEG) };
}

export { IAIndisponivel, RespostaIAInvalida };
