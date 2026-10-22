import type { HoraDoClima, IconeDoClima, NivelDeRisco } from "@shared/api/clima";
import { hora } from "@shared/api/formatar";
import { cores } from "../tema/tema";

/**
 * O que a previsão do tempo mostra no app (`docs/operacao-de-campo.md`, seção 4.7), sem depender do React Native: as cores de cada nível
 * (sem vermelho nem amarelo puros), os chips das horas e a frase de "atualizada às". As telas só desenham.
 */

/** O tom de cada nível: o âmbar suave da atenção e o terracota do extremo (o vermelho puro cansa e lembra alarme). */
export const tomDoNivel: Record<NivelDeRisco, { fundo: string; borda: string; texto: string }> = {
  sem_risco: { fundo: cores.okFundo, borda: cores.okBorda, texto: cores.okTinta },
  atencao: { fundo: cores.alertaFundo, borda: cores.alertaBorda, texto: cores.alertaTinta },
  extremo: { fundo: cores.criticoFundo, borda: cores.criticoBorda, texto: cores.critico },
};

/** O ícone (Ionicons, que o app já tem) de cada tempo. */
export const iconeDoClima: Record<IconeDoClima, "sunny-outline" | "partly-sunny-outline" | "cloud-outline" | "rainy-outline" | "thunderstorm-outline" | "water-outline"> = {
  sol: "sunny-outline",
  "nuvem-sol": "partly-sunny-outline",
  nuvem: "cloud-outline",
  chuva: "rainy-outline",
  trovoada: "thunderstorm-outline",
  nevoeiro: "water-outline",
};

/** "14h", da hora local que a `api` manda (`AAAA-MM-DDTHH:00`). */
export const rotuloDaHora = (h: Pick<HoraDoClima, "hora">) => `${Number(h.hora.slice(11, 13))}h`;

/**
 * As horas que cabem nos chips: no máximo `maximo`, espalhadas pela janela (a janela do expediente tem até 12 horas e a tela é estreita),
 * sempre com a primeira e a última.
 */
export function horasParaChips(horas: HoraDoClima[], maximo = 6): HoraDoClima[] {
  if (horas.length <= maximo) return horas;
  const passo = (horas.length - 1) / (maximo - 1);
  const indices = new Set(Array.from({ length: maximo }, (_, i) => Math.round(i * passo)));
  return horas.filter((_, i) => indices.has(i));
}

/** "atualizada às 14:05": a hora em que a previsão foi consultada (é o que diz se a cópia guardada ainda é fresca). */
export const textoDeAtualizacao = (consultadaEm: string) => `atualizada às ${hora(consultadaEm)}`;

/** "Vitória, ES (cidade padrão) · atualizada às 14:05": a linha pequena do cartão. */
export const linhaDoLocal = (local: { nome: string; origem: "aparelho" | "padrao" }, consultadaEm: string) =>
  `${local.nome}${local.origem === "padrao" ? " (cidade padrão)" : ""} · ${textoDeAtualizacao(consultadaEm)}`;
