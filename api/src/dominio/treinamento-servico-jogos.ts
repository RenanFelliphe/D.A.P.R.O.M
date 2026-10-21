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

/** O lado da grade: 3 a mais que a maior palavra, entre 10 e 14 (14 colunas ainda cabem no celular, com a letra menor). */
export const ladoDaGrade = (palavras: string[]) => Math.min(14, Math.max(10, Math.max(...palavras.map((p) => letrasDaGrade(p).length)) + 3));

/** As direções em que uma palavra se lê: na linha (→), na coluna (↓) e nas duas diagonais, sempre da esquerda para a direita (↘ e ↗). */
const DIRECOES: readonly Celula[] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
];

/**
 * Monta a grade: cada palavra na linha, na coluna ou numa diagonal, sempre lida da esquerda para a direita (na coluna, de
 * cima para baixo), cruzando outra na mesma letra sempre que der; o resto é preenchido com letras sorteadas. Se o sorteio
 * não achar lugar, cada palavra vai para uma linha própria (sempre cabe: até 5 palavras de até 12 letras numa grade de 10 a 14).
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

interface Encaixe {
  celulas: Celula[];
  direcao: number;
  cruzamentos: number;
}

/**
 * Todos os lugares onde a palavra cabe: dentro da grade, cada letra numa casa vazia ou na mesma letra de outra palavra
 * (o cruzamento). Só cruza palavra de outra direção, para duas palavras nunca se sobreporem na mesma reta, e nunca
 * fica inteira por cima de outras.
 */
function encaixes(palavra: string, grade: (string | null)[][], direcoesDaCasa: Set<number>[][], lado: number): Encaixe[] {
  const lista: Encaixe[] = [];
  DIRECOES.forEach(([dl, dc], direcao) => {
    for (let l = 0; l < lado; l++) {
      for (let c = 0; c < lado; c++) {
        const fimL = l + dl * (palavra.length - 1);
        const fimC = c + dc * (palavra.length - 1);
        if (fimL < 0 || fimL >= lado || fimC >= lado) continue;
        const celulas = [...palavra].map((_, k) => [l + dl * k, c + dc * k] as Celula);
        let cruzamentos = 0;
        const cabe = celulas.every(([cl, cc], k) => {
          const atual = grade[cl]![cc];
          if (atual === null) return true;
          if (atual !== palavra[k] || direcoesDaCasa[cl]![cc]!.has(direcao)) return false;
          cruzamentos++;
          return true;
        });
        if (cabe && cruzamentos < palavra.length) lista.push({ celulas, direcao, cruzamentos });
      }
    }
  });
  return lista;
}

/**
 * Uma tentativa de montar a grade. As maiores primeiro (são as mais difíceis de encaixar); cada palavra cruza outra quando
 * algum lugar permite e vai, de preferência, na direção menos usada até ali, para a grade ter linha, coluna e diagonal.
 */
function tentarMontar(letras: string[], lado: number): GradeMontada | null {
  const grade: (string | null)[][] = Array.from({ length: lado }, () => Array<string | null>(lado).fill(null));
  const direcoesDaCasa = Array.from({ length: lado }, () => Array.from({ length: lado }, () => new Set<number>()));
  const usoDaDirecao = DIRECOES.map(() => 0);
  const posicoes: PosicaoNaGrade[] = [];
  const ordem = [...letras.keys()].sort((a, b) => letras[b]!.length - letras[a]!.length || Math.random() - 0.5);
  for (const i of ordem) {
    const palavra = letras[i]!;
    const todos = encaixes(palavra, grade, direcoesDaCasa, lado);
    if (todos.length === 0) return null;
    const cruzando = todos.filter((e) => e.cruzamentos > 0);
    const candidatos = cruzando.length > 0 ? cruzando : todos;
    const menosUsada = Math.min(...candidatos.map((e) => usoDaDirecao[e.direcao]!));
    const preferidos = candidatos.filter((e) => usoDaDirecao[e.direcao] === menosUsada);
    const escolhido = preferidos[sorteio(preferidos.length)]!;
    escolhido.celulas.forEach(([l, c], k) => {
      grade[l]![c] = palavra[k]!;
      direcoesDaCasa[l]![c]!.add(escolhido.direcao);
    });
    usoDaDirecao[escolhido.direcao]!++;
    posicoes[i] = { inicio: escolhido.celulas[0]!, fim: escolhido.celulas[escolhido.celulas.length - 1]! };
  }
  return { linhas: preencher(grade), posicoes };
}

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function preencher(grade: (string | null)[][]): string[] {
  return grade.map((linha) => linha.map((letra) => letra ?? ALFABETO[sorteio(ALFABETO.length)]).join(""));
}

/**
 * Quais palavras (índices) as marcações acharam: cada marcação precisa ser uma linha reta na grade (linha, coluna ou
 * diagonal) cujas letras, lidas da esquerda para a direita (na coluna, de cima para baixo), formem uma das palavras. Vale o texto, não a posição sorteada: se o
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
