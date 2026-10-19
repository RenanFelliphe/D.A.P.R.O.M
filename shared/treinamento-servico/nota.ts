/**
 * A nota de um treinamento de serviço (`funcionalidades/treinamentos-de-servico.md`, seção 12): cada fase vale até 10 pontos
 * pelos acertos, vezes o multiplicador do tempo; a soma das fases vezes (fases × 10) dá a nota. É a nota do treinamento e
 * do ranking dele, não os pontos da gamificação (que seguem 5 pelo concluído + 1 por fase certa). A `api` calcula e grava; a
 * web usa as mesmas contas para mostrar a tabela do tempo e o detalhe do resultado.
 */

/** As faixas do multiplicador: até o limite (em segundos, inclusive), o multiplicador; depois da última, `MULTIPLICADOR_MINIMO`. */
export const FAIXAS_DO_TEMPO: { ateSegundos: number; multiplicador: number }[] = [
  { ateSegundos: 10, multiplicador: 1 },
  { ateSegundos: 20, multiplicador: 0.9 },
  { ateSegundos: 30, multiplicador: 0.8 },
  { ateSegundos: 40, multiplicador: 0.7 },
  { ateSegundos: 50, multiplicador: 0.6 },
  { ateSegundos: 60, multiplicador: 0.5 },
];
export const MULTIPLICADOR_MINIMO = 0.4;

/** O multiplicador pelo tempo gasto na fase (somadas todas as vezes que a pessoa esteve nela). */
export function multiplicadorDoTempo(tempoMs: number): number {
  const segundos = Math.max(0, tempoMs) / 1000;
  return FAIXAS_DO_TEMPO.find((f) => segundos <= f.ateSegundos)?.multiplicador ?? MULTIPLICADOR_MINIMO;
}

/** Até 10 pontos pelos acertos, proporcionais às respostas certas possíveis da fase. */
export const pontosBase = (acertos: number, possiveis: number) => (possiveis > 0 ? (10 * Math.min(acertos, possiveis)) / possiveis : 0);

/** Os pontos da fase: a base vezes o multiplicador do tempo, com duas casas. */
export const pontosDaFase = (acertos: number, possiveis: number, tempoMs: number) => Math.round(pontosBase(acertos, possiveis) * multiplicadorDoTempo(tempoMs) * 100) / 100;

/** A nota do treinamento: a soma das fases vezes (total de fases × 10). Fase sem resposta entra com zero, mas conta no total. */
export const notaDoTreinamento = (pontosDasFases: number[], totalFases: number) => Math.round(pontosDasFases.reduce((s, p) => s + p, 0) * totalFases * 10);

/** A nota máxima de um treinamento com `totalFases` fases: tudo certo em até 10 segundos por fase. */
export const notaMaxima = (totalFases: number) => 10 * totalFases * totalFases * 10;
