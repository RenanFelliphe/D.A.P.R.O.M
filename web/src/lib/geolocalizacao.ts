/**
 * Localização (GPS) nos cinco momentos da execução: início, pausa, suspensão, interrupção e encerramento (não na assinatura da APR).
 * No celular a posição vem do GPS; no notebook vem da rede e é aproximada. Sem posição (permissão negada, local coberto, tempo
 * esgotado) o serviço NÃO é bloqueado: o evento segue sem coordenadas e a `api` registra "sem localização".
 */

import { TEMPO_MAXIMO_DA_POSICAO_MS as TEMPO_MAXIMO_MS, arredondarPosicao, type Posicao } from "./localizacao";

export { AVISO_DE_LOCALIZACAO, comPosicao, linkDoMapa, type Posicao } from "./localizacao";

export interface OpcoesDaPosicao {
  /** Falso: aceita a posição aproximada (rede/Wi-Fi), que o notebook devolve rápido; a previsão do tempo não precisa de GPS. */
  precisa?: boolean;
  tempoMaximoMs?: number;
}

/** Pede a posição atual ao navegador; devolve `null` quando não há (nunca lança). */
export function obterPosicao({ precisa = true, tempoMaximoMs = TEMPO_MAXIMO_MS }: OpcoesDaPosicao = {}): Promise<Posicao | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolver) => {
    const limite = setTimeout(() => resolver(null), tempoMaximoMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(limite);
        resolver(arredondarPosicao({ latitude: p.coords.latitude, longitude: p.coords.longitude }));
      },
      () => {
        clearTimeout(limite);
        resolver(null);
      },
      { enableHighAccuracy: precisa, timeout: tempoMaximoMs, maximumAge: 60_000 },
    );
  });
}

/** `true` só quando o navegador diz que a permissão está negada (sem a API de permissões, devolve `false`: tenta de novo). */
export async function localizacaoNegada(): Promise<boolean> {
  try {
    const estado = await navigator.permissions?.query({ name: "geolocation" });
    return estado?.state === "denied";
  } catch {
    return false;
  }
}

