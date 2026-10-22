/**
 * As reações da Vitória (`docs/ia-e-vitoria.md`, seção 4.13): a foto de perfil é sempre a mesma (`icone.webp`) e, de vez em quando, a
 * mensagem dela ganha uma figurinha, que toca uma animação curta e fica no quadro parado. Este arquivo decide **quando** e **qual**,
 * sem IA: a web o usa para reagir ao que a `api` devolve (`alerta` e `ops`), para as saudações e agradecimentos e para os
 * pedidos para imitar uma emoção ("fique triste", "finja que está surpresa"). A `api` nunca vê esses pedidos.
 *
 * Os pedidos não são comparados com frases exatas: o texto vira uma lista de palavras sem acento e a regra procura uma
 * emoção, um verbo que peça para encenar ("fique", "finja", "faça cara de") e nada que mostre que a pessoa está falando
 * de outra coisa (uma pergunta, uma negação, "minha tela"). Na dúvida, devolve `null` e a pergunta segue para a IA.
 */

export const REACOES = ["ola", "certo", "atencao", "comemorando", "errada", "pensando", "triste", "surpresa", "vergonha", "fofo"] as const;
export type Reacao = (typeof REACOES)[number];

/** Toda animação tem 5 s; a pedido da pessoa toca inteira, e como reação sozinha só o começo. */
export const DURACAO_COMPLETA_MS = 5000;
const DURACAO_CURTA_MS = 2500;
/** A `atencao` vira cara de brava de braços cruzados depois de 1 s; sozinha, só vale o dedo levantado. */
const DURACAO_CURTA_DA_REACAO: Partial<Record<Reacao, number>> = { atencao: 900 };

export function duracaoDaReacao(reacao: Reacao, completa: boolean): number {
  return completa ? DURACAO_COMPLETA_MS : (DURACAO_CURTA_DA_REACAO[reacao] ?? DURACAO_CURTA_MS);
}

/**
 * A reação de uma expressão que a `api` devolve ou que o admin escolheu num passo de treinamento. `padrao`, `feliz` e
 * `explicando` ficam sem animação: o rosto da foto de perfil já é calmo e simpático.
 */
export function reacaoDaExpressao(expressao: string | null | undefined): Reacao | null {
  switch (expressao) {
    case "pensando":
      return "pensando";
    case "alerta":
      return "atencao";
    case "comemorando":
      return "comemorando";
    case "ops":
      return "errada";
    default:
      return null;
  }
}

export interface RespostaLocal {
  texto: string;
  reacao: Reacao;
  /** `true` quando a pessoa pediu a emoção: toca a animação inteira. */
  completa: boolean;
}

// ---- Texto em palavras ---------------------------------------------------------------------------------------------------

function palavrasDe(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bsem\s+(jeito|graca)\b/g, "sem$1")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Palavras que não dizem nada sobre o pedido: o nome dela e a gentileza. */
const IGNORADAS = new Set(["vitoria", "por", "favor", "pfv", "pf"]);

const juntas = (...grupos: string[][]) => new Set(grupos.flat());
const contem = (palavras: string[], conjunto: Set<string>) => palavras.some((p) => conjunto.has(p));
const todasEm = (palavras: string[], conjunto: Set<string>) => palavras.length > 0 && palavras.every((p) => conjunto.has(p));

// ---- Saudação, despedida e agradecimento ---------------------------------------------------------------------------------

const SAUDACAO_NUCLEO = new Set(["oi", "ola", "opa", "eai", "ei", "hey", "hello", "salve", "dia", "tarde", "noite", "tudo"]);
const SAUDACAO = juntas([...SAUDACAO_NUCLEO], ["bom", "boa", "e", "ai", "bem", "fala", "td"]);

const DESPEDIDA_NUCLEO = new Set(["tchau", "tchauzinho", "xau", "flw", "falou", "ate"]);
const DESPEDIDA = juntas([...DESPEDIDA_NUCLEO], ["logo", "mais", "amanha", "depois", "breve", "la"]);

const AGRADECIMENTO_NUCLEO = new Set(["obrigado", "obrigada", "brigado", "brigada", "obg", "valeu", "vlw", "agradeco", "agradecido", "agradecida"]);
const ELOGIO_NUCLEO = new Set(["entendi", "entendido", "perfeito", "otimo", "excelente", "funcionou", "resolveu", "ajudou", "show", "massa", "top"]);
const AGRADECIMENTO = juntas(
  [...AGRADECIMENTO_NUCLEO],
  [...ELOGIO_NUCLEO],
  ["muito", "muita", "demais", "mesmo", "de", "verdade", "a", "o", "pela", "pelo", "ajuda", "tudo", "ok", "certo", "deu", "ficou", "bem", "e", "ai", "ta", "esta", "so", "agora", "isso"],
);

function saudacaoDe(palavras: string[]): RespostaLocal | null {
  if (!todasEm(palavras, SAUDACAO) || !contem(palavras, SAUDACAO_NUCLEO)) return null;
  const eco = palavras.includes("noite") ? "Boa noite!" : palavras.includes("tarde") ? "Boa tarde!" : palavras.includes("dia") ? "Bom dia!" : "Oi!";
  return { texto: `${eco} Em que posso ajudar?`, reacao: "ola", completa: false };
}

function despedidaDe(palavras: string[]): RespostaLocal | null {
  if (!todasEm(palavras, DESPEDIDA) || !contem(palavras, DESPEDIDA_NUCLEO)) return null;
  return { texto: "Até mais! Qualquer dúvida, é só chamar.", reacao: "ola", completa: false };
}

function agradecimentoDe(palavras: string[], pergunta: boolean): RespostaLocal | null {
  if (pergunta || !todasEm(palavras, AGRADECIMENTO)) return null;
  if (contem(palavras, AGRADECIMENTO_NUCLEO)) return { texto: "De nada! Se surgir outra dúvida, é só chamar.", reacao: "certo", completa: false };
  if (contem(palavras, ELOGIO_NUCLEO)) return { texto: "Que bom! Se surgir outra dúvida, é só chamar.", reacao: "certo", completa: false };
  return null;
}

// ---- Pedido para imitar uma emoção ---------------------------------------------------------------------------------------

interface Emocao {
  reacao: Reacao;
  /** Palavras inteiras que nomeiam a emoção ("triste"); só valem junto de um verbo que peça para encenar. */
  exatas: string[];
  /** Começos de palavra ("trist" pega triste, tristeza, tristonha). */
  prefixos?: string[];
  /** Já são o próprio pedido ("comemora!", "acene", "joinha"): valem sem outro verbo. */
  imperativos?: string[];
  texto: string;
}

const EMOCOES: Emocao[] = [
  {
    reacao: "triste",
    exatas: ["chateada", "chateado", "desanimada", "desanimado", "magoada", "magoado", "deprimida", "abatida", "chorar"],
    prefixos: ["trist"],
    imperativos: ["chore", "chora"],
    texto: "Pronto, fiquei triste. Já passou! Posso ajudar com alguma coisa do sistema?",
  },
  {
    reacao: "surpresa",
    exatas: ["chocada", "chocado", "assustada", "assustado", "boquiaberta", "impressionada"],
    prefixos: ["surpre", "espanta"],
    texto: "Nossa, que susto! Se tiver uma dúvida do sistema, é só dizer.",
  },
  {
    reacao: "vergonha",
    exatas: ["corada", "acanhada", "constrangida", "constrangido"],
    prefixos: ["vergonh", "envergonh", "timid"],
    texto: "Fiquei sem graça agora. Mudando de assunto: precisa de ajuda com o sistema?",
  },
  {
    reacao: "fofo",
    exatas: ["fofa", "fofo", "fofinha", "fofinho", "fofura", "fofucha", "meiga", "pidona", "carente", "adoravel"],
    texto: "Com esses olhos, ninguém resiste, não é? Em que posso ajudar?",
  },
  {
    reacao: "comemorando",
    exatas: ["animada", "animado", "radiante", "euforica", "euforico", "empolgada", "empolgado"],
    prefixos: ["comemor", "celebr", "festej"],
    imperativos: ["comemora", "comemore", "celebra", "celebre", "vibre", "vibra"],
    texto: "Comemorando! Vitória é o meu nome, afinal.",
  },
  {
    reacao: "certo",
    exatas: ["feliz", "felizes", "alegre", "contente", "satisfeita", "satisfeito", "orgulhosa", "positivo"],
    prefixos: ["felic", "alegr"],
    imperativos: ["joinha", "polegar", "sorria", "sorri"],
    texto: "Tudo certo por aqui! Joinha para você.",
  },
  {
    reacao: "atencao",
    exatas: ["raiva", "severa", "severo", "serio", "seria", "seriedade", "furiosa", "furioso", "fula"],
    prefixos: ["brav", "braba", "irrit", "zang", "nervos", "carranc", "emburr"],
    texto: "Assim, de cara fechada. Agora, vamos ao que interessa?",
  },
  {
    reacao: "pensando",
    exatas: ["pense", "pensa", "pensando", "pensar", "refletir"],
    prefixos: ["pensativ", "reflit", "refleti", "duvid"],
    texto: "Hmm, pensando… Quando tiver uma dúvida do sistema, é só mandar.",
  },
  {
    reacao: "errada",
    exatas: ["errou", "errada", "errado", "errei", "confusa", "confuso", "perdida", "perdido", "atrapalhada", "atrapalhado", "desorientada", "semjeito", "semgraca"],
    texto: "Ops, errei! Acontece. Vamos de novo?",
  },
  {
    reacao: "ola",
    exatas: ["oi", "ola", "tchau", "tchauzinho", "xau", "aceno"],
    imperativos: ["acene", "acena", "acenar", "cumprimente", "cumprimenta", "cumprimentar"],
    texto: "Oi, oi! Em que posso ajudar?",
  },
];

/** Verbos e jeitos de pedir para encenar: "fique", "finja", "faça uma cara de", "dê um", "quero ver você". */
const PEDIDOS = new Set([
  "fique", "fica", "ficar", "ficaria", "finja", "finge", "fingir", "aja", "age", "agir", "atue", "atua", "represente", "representa",
  "imite", "imita", "imitar", "faca", "faz", "fazer", "faria", "mostre", "mostra", "mostrar", "demonstre", "demonstra", "demonstrar",
  "esteja", "estar", "seja", "simule", "simula", "encene", "interprete", "interpreta", "expresse", "exiba", "diga", "diz", "dizer",
  "tente", "tenta", "tentar", "vire", "vira", "cara", "carinha", "careta", "expressao",
]);
const PEDIDOS_DE_VER = new Set(["quero", "queria", "gostaria"]);

/** Quem fala de si, da tela ou do trabalho está perguntando ou contando algo, não pedindo para ela encenar. */
const OUTRO_ASSUNTO = new Set([
  "nao", "nunca", "jamais", "nem", "pare", "sem", "eu", "estou", "estamos", "sou", "meu", "meus", "minha", "minhas",
  "tela", "sistema", "apr", "os", "ordem", "equipe", "pontos", "usuario", "botao", "ranking", "treinamento",
]);
const INTERROGATIVAS = new Set(["como", "onde", "qual", "quais", "quando", "quem", "quanto", "quantos", "quantas", "que", "porque", "pq", "cade", "aonde"]);

const MAXIMO_DE_PALAVRAS = 10;

function pedidoDeEmocao(palavras: string[]): RespostaLocal | null {
  if (palavras.some((p, i) => (p === "para" || p === "deixe") && palavras[i + 1] === "de")) return null;
  if (contem(palavras, OUTRO_ASSUNTO)) return null;

  const primeira = palavras[0]!;
  const comoVoceFica = primeira === "como" && ["voce", "vc", "ce"].includes(palavras[1] ?? "") && ["fica", "ficaria", "faria"].includes(palavras[2] ?? "");
  if ((INTERROGATIVAS.has(primeira) || (primeira === "o" && palavras[1] === "que")) && !comoVoceFica) return null;

  const pedeParaEncenar =
    contem(palavras, PEDIDOS) ||
    palavras.some((p, i) => (p === "de" || p === "da") && (palavras[i + 1] === "um" || palavras[i + 1] === "uma")) ||
    (palavras.includes("ver") && contem(palavras, PEDIDOS_DE_VER));

  for (const palavra of palavras) {
    for (const emocao of EMOCOES) {
      const nomeada = emocao.exatas.includes(palavra) || (emocao.prefixos?.some((p) => palavra.startsWith(p)) ?? false);
      const imperativo = emocao.imperativos?.includes(palavra) ?? false;
      if (!imperativo && !(nomeada && pedeParaEncenar)) continue;
      const despedida = emocao.reacao === "ola" && ["tchau", "tchauzinho", "xau"].includes(palavra);
      return { texto: despedida ? "Tchau, tchau! Se precisar, estou por aqui." : emocao.texto, reacao: emocao.reacao, completa: true };
    }
  }
  return null;
}

/**
 * A resposta que a web dá sozinha, sem chamar a `api` nem a IA, quando a mensagem é só uma saudação, um agradecimento ou
 * um pedido para a Vitória encenar uma emoção. `null` quando é uma pergunta de verdade.
 */
export function respostaLocalDaVitoria(mensagem: string): RespostaLocal | null {
  const todas = palavrasDe(mensagem);
  if (todas.length === 0 || todas.length > MAXIMO_DE_PALAVRAS) return null;
  const palavras = todas.filter((p) => !IGNORADAS.has(p));
  if (palavras.length === 0) return null;
  const pergunta = mensagem.trim().endsWith("?");

  return saudacaoDe(palavras) ?? despedidaDe(palavras) ?? agradecimentoDe(palavras, pergunta) ?? pedidoDeEmocao(palavras);
}
