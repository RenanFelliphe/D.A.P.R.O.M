import { celulasEntre, letrasDaGrade, type Celula } from "../../../shared/treinamento-servico/jogos";

/**
 * As peças dos minijogos que precisam de mais que embaralhar uma lista (`treinamentos-de-servico.md`, tipos de fase): a
 * grade do caça-palavras, a partida da memória refeita no servidor e as letras do "desembaralhe". Tudo é sorteado na
 * abertura da tentativa e gravado na apresentação; a correção usa só o que foi gravado.
 */

/** Fisher-Yates: embaralha sem repetir nem perder nenhum. */
export function embaralhar<T>(itens: readonly T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j]!, copia[i]!];
  }
  return copia;
}

/** Uma permutação de `0..n-1`: a posição mostrada → o índice original no gabarito. Não revela nada sozinha. */
export const permutacao = (n: number): number[] => embaralhar([...Array(n).keys()]);

const sorteio = (n: number) => Math.floor(Math.random() * n);

/** Uma posição de `0..n-1` ao acaso: a palavra do banco que sai nesta tentativa. */
export const sortearIndice = (n: number) => sorteio(n);

/**
 * Uma permutação sorteada que nunca repete `evitar` (com 2 ou mais itens); por padrão, a ordem em que o admin escreveu.
 * Vale para todo tipo com opções: no "Pôr em ordem" a ordem escrita é a resposta, e no quiz, na decisão e no selecione a
 * certa costuma vir primeiro (a IA quase sempre a põe ali). No "Ligar", a direita evita a ordem da esquerda, para os pares
 * não ficarem um em frente ao outro.
 */
export function permutacaoDesordenada(n: number, evitar: readonly number[] = [...Array(n).keys()]): number[] {
  if (n < 2) return permutacao(n);
  for (let t = 0; t < 30; t++) {
    const ordem = permutacao(n);
    if (ordem.some((v, i) => v !== evitar[i])) return ordem;
  }
  return evitar.map((_, i) => evitar[(i + 1) % n]!);
}

// ---- Caça-palavras -----------------------------------------------------------------------------------------------------

export interface PosicaoNaGrade {
  inicio: Celula;
  fim: Celula;
}

export interface GradeMontada {
  /** As linhas da grade, cada uma com `tamanho` letras de A a Z. */
  linhas: string[];
  /** Onde cada palavra ficou, na ordem das palavras da fase. */
  posicoes: PosicaoNaGrade[];
}

/** O lado da grade: 2 a mais que a maior palavra, entre 8 e 12 (12 colunas ainda cabem no celular). */
export const ladoDaGrade = (palavras: string[]) => Math.min(12, Math.max(8, Math.max(...palavras.map((p) => letrasDaGrade(p).length)) + 2));

/**
 * Monta a grade: cada palavra só na horizontal (da esquerda para a direita) ou na vertical (de cima para baixo), podendo
 * cruzar outra na mesma letra; o resto é preenchido com letras sorteadas. Se o sorteio não achar lugar, cada palavra vai
 * para uma linha própria (sempre cabe: até 5 palavras de até 12 letras numa grade de 8 a 12).
 */
export function montarGrade(palavras: string[]): GradeMontada {
  const lado = ladoDaGrade(palavras);
  const letras = palavras.map(letrasDaGrade);
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    const montada = tentarMontar(letras, lado);
    if (montada) return montada;
  }
  const linhasLivres = embaralhar([...Array(lado).keys()]);
  const grade: (string | null)[][] = Array.from({ length: lado }, () => Array<string | null>(lado).fill(null));
  const posicoes = letras.map((p, i) => {
    const linha = linhasLivres[i]!;
    const coluna = sorteio(lado - p.length + 1);
    [...p].forEach((letra, k) => (grade[linha]![coluna + k] = letra));
    return { inicio: [linha, coluna], fim: [linha, coluna + p.length - 1] } as PosicaoNaGrade;
  });
  return { linhas: preencher(grade), posicoes };
}

function tentarMontar(letras: string[], lado: number): GradeMontada | null {
  const grade: (string | null)[][] = Array.from({ length: lado }, () => Array<string | null>(lado).fill(null));
  const posicoes: PosicaoNaGrade[] = [];
  // As maiores primeiro: são as mais difíceis de encaixar.
  const ordem = [...letras.keys()].sort((a, b) => letras[b]!.length - letras[a]!.length);
  for (const i of ordem) {
    const palavra = letras[i]!;
    let posta: PosicaoNaGrade | null = null;
    for (let t = 0; t < 120 && !posta; t++) {
      const horizontal = Math.random() < 0.5;
      const linha = sorteio(horizontal ? lado : lado - palavra.length + 1);
      const coluna = sorteio(horizontal ? lado - palavra.length + 1 : lado);
      const celula = (k: number): Celula => (horizontal ? [linha, coluna + k] : [linha + k, coluna]);
      const cabe = [...palavra].every((letra, k) => {
        const [l, c] = celula(k);
        const atual = grade[l]![c];
        return atual === null || atual === letra;
      });
      if (!cabe) continue;
      [...palavra].forEach((letra, k) => {
        const [l, c] = celula(k);
        grade[l]![c] = letra;
      });
      posta = { inicio: celula(0), fim: celula(palavra.length - 1) };
    }
    if (!posta) return null;
    posicoes[i] = posta;
  }
  return { linhas: preencher(grade), posicoes };
}

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function preencher(grade: (string | null)[][]): string[] {
  return grade.map((linha) => linha.map((letra) => letra ?? ALFABETO[sorteio(ALFABETO.length)]).join(""));
}

/**
 * Quais palavras (índices) as marcações acharam: cada marcação precisa ser uma linha reta na grade cujas letras, lidas da
 * esquerda para a direita ou de cima para baixo, formem uma das palavras. Vale o texto, não a posição sorteada: se o
 * preenchimento formou a palavra de novo em outro lugar, achar lá também vale. Marcação que não forma palavra não conta.
 */
export function palavrasAchadas(linhas: string[], palavras: string[], selecoes: PosicaoNaGrade[]): Set<number> {
  const naGrade = palavras.map(letrasDaGrade);
  const achadas = new Set<number>();
  for (const s of selecoes) {
    const celulas = celulasEntre(s.inicio, s.fim, linhas.length);
    if (!celulas) continue;
    const lido = celulas.map(([l, c]) => linhas[l]![c]).join("");
    const i = naGrade.indexOf(lido);
    if (i >= 0) achadas.add(i);
  }
  return achadas;
}

// ---- Memória ---------------------------------------------------------------------------------------------------------

/** Uma carta na mesa: de qual par ela é e qual lado (0 o termo, 1 o correspondente). */
export interface CartaNaMesa {
  par: number;
  lado: 0 | 1;
}

/** As cartas embaralhadas na mesa: duas por par. */
export const mesaDaMemoria = (pares: number): CartaNaMesa[] => embaralhar([...Array(pares).keys()].flatMap((par) => [{ par, lado: 0 as const }, { par, lado: 1 as const }]));

/** O máximo de erros (duas cartas viradas que não formam par) para a fase valer como certa: um por par. */
export const limiteDeErrosDaMemoria = (pares: number) => pares;

/**
 * Refaz a partida a partir das jogadas: cada jogada vira duas cartas diferentes ainda na mesa; se forem do mesmo par, saem
 * da mesa, senão conta um erro. Jogada com carta inexistente ou já tirada torna a partida inválida (não é um jogo possível).
 */
export function refazerMemoria(mesa: CartaNaMesa[], jogadas: [number, number][]): { valida: boolean; completa: boolean; erros: number; formados: number } {
  const tiradas = new Set<number>();
  let erros = 0;
  for (const [a, b] of jogadas) {
    if (a === b || a >= mesa.length || b >= mesa.length || tiradas.has(a) || tiradas.has(b)) return { valida: false, completa: false, erros, formados: tiradas.size / 2 };
    if (mesa[a]!.par === mesa[b]!.par) {
      tiradas.add(a);
      tiradas.add(b);
    } else erros++;
  }
  return { valida: true, completa: tiradas.size === mesa.length, erros, formados: tiradas.size / 2 };
}

// ---- Desembaralhe ------------------------------------------------------------------------------------------------------

/** Embaralha as letras até a ordem mostrada não formar a própria palavra (sempre possível com duas letras diferentes). */
export function embaralharLetras(letras: string[]): number[] {
  const palavra = letras.join("");
  for (let t = 0; t < 30; t++) {
    const ordem = permutacao(letras.length);
    if (ordem.map((i) => letras[i]).join("") !== palavra) return ordem;
  }
  // Sem sorte no sorteio: gira uma posição (com duas letras diferentes, a palavra girada nunca é ela mesma em todas as posições).
  for (let giro = 1; giro < letras.length; giro++) {
    const ordem = letras.map((_, i) => (i + giro) % letras.length);
    if (ordem.map((i) => letras[i]).join("") !== palavra) return ordem;
  }
  return permutacao(letras.length);
}
