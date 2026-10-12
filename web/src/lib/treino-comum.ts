/** Constantes do Campo de treino que servidor e navegador compartilham (o cookie `treino` vive em `treino-modo.ts`, só do servidor). */

/** Cookie de sessão (sem validade) que esconde as boas-vindas depois de "Fazer depois"; o logout o apaga. Legível pelo navegador. */
export const COOKIE_TREINO_ADIADO = "treino_adiado";

/** Chaves do `sessionStorage`: modalidade escolhida, passo do tutorial direcionado. */
export const SESSAO_TREINO_MODO = "treino:modo";
export const SESSAO_TREINO_PASSO = "treino:passo";

export type ModoDoTreino = "direcionado" | "livre";
