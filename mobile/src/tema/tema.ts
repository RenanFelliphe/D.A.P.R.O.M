import type { TomDoSelo } from "@shared/api/tipos";

/** As cores da web (`web/src/styles/variables.css`), com os mesmos nomes de tom dos selos de status. */
export const cores = {
  fundo: "#F2F2EE",
  superficie: "#FFFFFF",
  superficie2: "#F7F7F4",
  chip: "#EDEEE9",
  linha: "#DCDDD6",
  linha2: "#ECEDE8",
  tinta: "#17212B",
  tinta2: "#2C3742",
  tinta3: "#4A5561",
  tinta4: "#66707A",
  marca: "#0F5C78",
  marcaEscura: "#0B4A61",
  marcaFundo: "#E2EEF3",
  marcaBorda: "#B8D3DE",
  marcaTinta: "#0D3F52",
  escuro: "#17212B",
  branco: "#FFFFFF",
  ok: "#1E6236",
  okFundo: "#E1F2E6",
  okBorda: "#A9D3B5",
  okTinta: "#1F3D29",
  alerta: "#6E4C00",
  alertaFundo: "#FFF8E0",
  alertaBorda: "#E9CF6B",
  alertaTinta: "#4D3800",
  perigo: "#A3241B",
  perigoFundo: "#FBE4E1",
  perigoBorda: "#EDB3AC",
  perigoTinta: "#5A1510",
  critico: "#A3420D",
  criticoFundo: "#FFF3EC",
  criticoBorda: "#E7B394",
} as const;

export const espaco = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;
export const raio = { s: 8, m: 12, l: 16, pilula: 999 } as const;

/** Cada tom de selo (`TomDoSelo`, o mesmo da web) em fundo e texto. */
export const tomDoSelo: Record<TomDoSelo, { fundo: string; texto: string }> = {
  lib: { fundo: "#E3EDF9", texto: "#1C5CAB" },
  exe: { fundo: "#FFF0D4", texto: "#8A4B00" },
  blq: { fundo: cores.perigoFundo, texto: cores.perigo },
  enc: { fundo: cores.okFundo, texto: cores.ok },
  neu: { fundo: cores.chip, texto: cores.tinta3 },
  al: { fundo: "#FFF4C7", texto: cores.alerta },
  crit: { fundo: cores.criticoFundo, texto: cores.critico },
  dark: { fundo: cores.escuro, texto: cores.branco },
  brand: { fundo: cores.marca, texto: cores.branco },
};

/** Cada tom de aviso (a faixa colorida com ícone), como os `.notice` da web. */
export const tomDoAviso = {
  info: { fundo: cores.marcaFundo, borda: cores.marcaBorda, texto: cores.marcaTinta },
  al: { fundo: cores.alertaFundo, borda: cores.alertaBorda, texto: cores.alertaTinta },
  ok: { fundo: cores.okFundo, borda: cores.okBorda, texto: cores.okTinta },
  blq: { fundo: cores.perigoFundo, borda: cores.perigoBorda, texto: cores.perigoTinta },
} as const;
export type TomDoAviso = keyof typeof tomDoAviso;
