/**
 * Regras dos minijogos que a `api` e a web precisam fazer igual (`docs/gamificacao-e-treinamentos.md`,
 * seção 8.4), lidas pelos dois lados por caminho relativo, como `ia.ts`: como uma palavra vira letras da grade do
 * caça-palavras e como vira as peças do "desembaralhe".
 */

/** Só letras, com ou sem acento, sem espaço, hífen ou número: o que cabe numa grade ou em peças soltas. */
export const SO_LETRAS = /^\p{L}+$/u;

/** FNV-1a de 32 bits de um texto: não é segurança, só uma impressão curta e estável. */
export function fnv1a(texto: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * A palavra como aparece na grade do caça-palavras: maiúsculas de A a Z, sem acento nem cedilha ("Inspeção" → "INSPECAO"),
 * para a grade não misturar "A" e "Ã" e a busca não depender do acento.
 */
export function letrasDaGrade(palavra: string): string {
  return palavra
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/** A impressão de uma palavra do caça-palavras: o jogo confere na hora se o trecho marcado é uma das palavras sem receber a lista. */
export const chaveDaPalavra = (palavra: string) => fnv1a(`caca:${letrasDaGrade(palavra)}`);

/** As peças do "desembaralhe": a palavra em maiúsculas, letra por letra, com o acento ("Inspeção" → I N S P E Ç Ã O). */
export function letrasDaPalavra(palavra: string): string[] {
  return Array.from(palavra.trim().normalize("NFC").toLocaleUpperCase("pt-BR"));
}

/** Uma posição na grade: linha e coluna, a partir de 0. */
export type Celula = [linha: number, coluna: number];

/**
 * As células entre o início e o fim de uma marcação, em linha reta, na ordem em que a palavra se lê (as palavras só ficam
 * assim): na linha, da esquerda para a direita; na coluna, de cima para baixo; nas duas diagonais, da esquerda para a
 * direita (descendo ou subindo). Tanto faz marcar do começo para o fim ou ao contrário. Linha torta ou fora da grade
 * devolve `null`.
 */
export function celulasEntre(inicio: Celula, fim: Celula, tamanho: number): Celula[] | null {
  const dentro = (n: number) => Number.isInteger(n) && n >= 0 && n < tamanho;
  if (![...inicio, ...fim].every(dentro)) return null;
  // Começa pela ponta da esquerda (na coluna, pela de cima).
  const [[l1, c1], [l2, c2]] = inicio[1] < fim[1] || (inicio[1] === fim[1] && inicio[0] <= fim[0]) ? [inicio, fim] : [fim, inicio];
  const passoL = Math.sign(l2 - l1);
  const passoC = Math.sign(c2 - c1);
  const tamanhoDaLinha = Math.max(Math.abs(l2 - l1), c2 - c1) + 1;
  if (passoL !== 0 && passoC !== 0 && Math.abs(l2 - l1) !== c2 - c1) return null;
  return Array.from({ length: tamanhoDaLinha }, (_, k) => [l1 + passoL * k, c1 + passoC * k] as Celula);
}

// ---- Termo -------------------------------------------------------------------------------------------------------------

/** A cor de cada letra de um palpite: no lugar certo, na palavra mas em outro lugar, ou fora (já contadas todas as vezes que ela aparece). */
export type CorDoTermo = "certa" | "presente" | "ausente";

/** As tentativas do Termo: sempre o número de letras da palavra + 1. */
export const tentativasDoTermo = (letras: number) => letras + 1;

/**
 * As cores de um palpite contra a palavra secreta, sem acento nem caixa ("mao" vale para "mão"). Primeiro as letras no
 * lugar certo; depois, da esquerda para a direita, as que existem em outro lugar, até acabar a quantidade daquela letra.
 */
export function coresDoPalpite(palpite: string, segredo: string): CorDoTermo[] {
  const p = letrasDaGrade(palpite);
  const s = letrasDaGrade(segredo);
  const cores: CorDoTermo[] = [...p].map(() => "ausente");
  const sobram = new Map<string, number>();
  [...p].forEach((letra, i) => {
    if (s[i] === letra) cores[i] = "certa";
    else if (s[i]) sobram.set(s[i]!, (sobram.get(s[i]!) ?? 0) + 1);
  });
  [...p].forEach((letra, i) => {
    if (cores[i] === "certa") return;
    const n = sobram.get(letra) ?? 0;
    if (n > 0) {
      cores[i] = "presente";
      sobram.set(letra, n - 1);
    }
  });
  return cores;
}

/**
 * A palavra do Termo vai ao jogo embaralhada desta forma, para as cores aparecerem na hora sem a palavra ficar à vista
 * na resposta da rede. Não é segredo de verdade (quem joga pode decodificar); a correção que vale é a do servidor.
 */
export function codificarTermo(palavra: string): string {
  return [...letrasDaGrade(palavra)].reverse().map((l, i) => String.fromCharCode(((l.charCodeAt(0) - 65 + 7 * (i + 3)) % 26) + 97)).join("");
}

export function decodificarTermo(codigo: string): string {
  return [...codigo]
    .map((c, i) => String.fromCharCode(((((c.charCodeAt(0) - 97 - 7 * (i + 3)) % 26) + 26) % 26) + 65))
    .reverse()
    .join("");
}

/** Quantas palavras o Desembaralhe e o Termo guardam: cada partida sorteia uma, para quem joga de novo não pegar sempre a mesma. */
export const PALAVRAS_DO_BANCO = 10;

/**
 * O jogo não tem limite de fases (só o mínimo de 3 para publicar). Este teto não é regra do produto e não aparece nas telas:
 * só protege a `api` e a geração pela IA de um pedido gigante.
 */
export const TETO_DE_FASES = 50;
