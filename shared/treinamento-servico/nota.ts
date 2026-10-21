/**
 * A nota de um treinamento de serviço (`funcionalidades/treinamentos-de-servico.md`, seção 12): cada fase vale até 10 pontos
 * pelos acertos, vezes o multiplicador do tempo; a soma das fases vezes (fases × 10) dá a nota. É a nota do treinamento e
 * do ranking dele, não os pontos da gamificação (que seguem 5 pelo concluído + 1 por fase certa). A `api` calcula e grava; a
 * web usa as mesmas contas para mostrar a tabela do tempo e o detalhe do resultado.
 */

/** Os tipos de fase (minijogos): cada um tem o seu tempo, porque uns pedem segundos e outros minutos. */
export type TipoDoJogo = "quiz" | "decisao" | "ligar" | "ordem" | "verdadeiro_falso" | "caca_palavras" | "memoria" | "selecione" | "desembaralhe" | "termo";

/**
 * O tempo cheio de cada minijogo, em segundos: até aqui a fase vale 100%. É também o tamanho de cada degrau seguinte (o
 * intervalo do decréscimo é igual ao tempo cheio), então quem joga num ritmo normal fica nos primeiros degraus.
 */
export const TEMPO_CHEIO_SEGUNDOS: Record<TipoDoJogo, number> = {
  verdadeiro_falso: 10,
  quiz: 15,
  decisao: 20,
  selecione: 30,
  ligar: 30,
  ordem: 30,
  desembaralhe: 30,
  memoria: 45,
  caca_palavras: 60,
  termo: 90,
};

/** Os 5 degraus do multiplicador, do tempo cheio ao piso (perde 12,5 pontos percentuais por degrau). */
export const DEGRAUS_DO_TEMPO = [1, 0.875, 0.75, 0.625, 0.5];
export const MULTIPLICADOR_MINIMO = DEGRAUS_DO_TEMPO[DEGRAUS_DO_TEMPO.length - 1]!;

/**
 * Os degraus de um minijogo: até o limite (em segundos, inclusive), o multiplicador; o último não tem limite (o piso, a
 * partir de 4 vezes o tempo cheio).
 */
export function faixasDoTempo(tipo: TipoDoJogo): { ateSegundos: number | null; multiplicador: number }[] {
  const cheio = TEMPO_CHEIO_SEGUNDOS[tipo];
  return DEGRAUS_DO_TEMPO.map((multiplicador, i) => ({ ateSegundos: i < DEGRAUS_DO_TEMPO.length - 1 ? cheio * (i + 1) : null, multiplicador }));
}

/** O multiplicador pelo tempo gasto na fase (somadas todas as vezes que a pessoa esteve nela), pelos degraus do minijogo. */
export function multiplicadorDoTempo(tipo: TipoDoJogo, tempoMs: number): number {
  const segundos = Math.max(0, tempoMs) / 1000;
  const degrau = Math.min(Math.max(Math.ceil(segundos / TEMPO_CHEIO_SEGUNDOS[tipo]) - 1, 0), DEGRAUS_DO_TEMPO.length - 1);
  return DEGRAUS_DO_TEMPO[degrau]!;
}

/** Até 10 pontos pelos acertos, proporcionais às respostas certas possíveis da fase. */
export const pontosBase = (acertos: number, possiveis: number) => (possiveis > 0 ? (10 * Math.min(acertos, possiveis)) / possiveis : 0);

/**
 * Os pontos da fase: a base vezes o multiplicador do tempo, com duas casas. A base é 10 × acertos ÷ possíveis, ou 10 × `fracao`
 * quando a fase não se mede assim (o Termo vale 10 ÷ a tentativa em que acertou).
 */
export const pontosDaFase = (tipo: TipoDoJogo, acertos: number, possiveis: number, tempoMs: number, fracao?: number) =>
  Math.round((fracao === undefined ? pontosBase(acertos, possiveis) : 10 * fracao) * multiplicadorDoTempo(tipo, tempoMs) * 100) / 100;

/** A nota do treinamento: a soma das fases vezes (total de fases × 10). Fase sem resposta entra com zero, mas conta no total. */
export const notaDoTreinamento = (pontosDasFases: number[], totalFases: number) => Math.round(pontosDasFases.reduce((s, p) => s + p, 0) * totalFases * 10);

/** A nota máxima de um treinamento com `totalFases` fases: tudo certo dentro do tempo cheio de cada fase. */
export const notaMaxima = (totalFases: number) => 10 * totalFases * totalFases * 10;
