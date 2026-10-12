/**
 * Cores dos dashboards, validadas no script de paleta (dataviz). As de estado vão sempre com ícone e rótulo; as
 * categóricas seguem a entidade em todos os gráficos.
 */

/** Estado "bom" (em dia, aprovada): só em barra sozinha, nunca ao lado do vermelho (na deuteranopia eles se confundem). */
export const COR_EM_DIA = "#0CA30C";
/** Estado de aviso (atrasada com justificativa, alerta). */
export const COR_AVISO = "#C98500";
/** Estado crítico (bloqueada, atrasada sem justificativa, falha). */
export const COR_CRITICA = "#D03B3B";
/** Contexto ao lado do vermelho (aprovada, sem falha): ΔE 13 na deuteranopia e 3:1 no fundo branco. */
export const COR_CONTEXTO = "#8A949F";
/** Barras de uma série só (ranking de locais): a cor da marca. */
export const COR_UNICA = "#0F5C78";

/**
 * Tipo da OS: violeta e magenta (slots 7 e 5 da paleta categórica), longe do azul e do laranja da entrada de OS, que
 * aparecem na mesma página. ΔE 19,9 na protanopia; o magenta fica abaixo de 3:1, então a tabela do gráfico traz os números.
 */
export const COR_CORRETIVA = "#6250D6";
export const COR_PREVENTIVA = "#E87BA4";

/** Bolinha do status da OS nos indicadores (as mesmas do quadro). */
export const MARCADOR_DO_STATUS = {
  liberada: "#1C5CAB",
  em_execucao: "#C98500",
  pendente: "#D03B3B",
  encerrada: "#0CA30C",
} as const;
