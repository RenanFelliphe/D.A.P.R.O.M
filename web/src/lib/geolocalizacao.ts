/**
 * Localização (GPS) nos cinco momentos da execução: início, pausa, suspensão, interrupção e encerramento (não na assinatura da APR).
 * No celular a posição vem do GPS; no notebook vem da rede e é aproximada. Sem posição (permissão negada, local coberto, tempo
 * esgotado) o serviço NÃO é bloqueado: o evento segue sem coordenadas e a `api` registra "sem localização".
 */

export interface Posicao {
  latitude: number;
  longitude: number;
}

/** O aviso de privacidade (LGPD) que as telas mostram junto dos botões que registram a localização. */
export const AVISO_DE_LOCALIZACAO =
  "A sua localização é registrada ao iniciar, pausar, suspender, interromper e encerrar a execução, para constar no relatório da OS. Sem permissão de localização, o serviço segue normalmente, marcado como “sem localização”.";

const TEMPO_MAXIMO_MS = 8000;

/** Pede a posição atual ao navegador; devolve `null` quando não há (nunca lança). */
export function obterPosicao(): Promise<Posicao | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolver) => {
    const limite = setTimeout(() => resolver(null), TEMPO_MAXIMO_MS + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        clearTimeout(limite);
        resolver({ latitude: Number(p.coords.latitude.toFixed(6)), longitude: Number(p.coords.longitude.toFixed(6)) });
      },
      () => {
        clearTimeout(limite);
        resolver(null);
      },
      { enableHighAccuracy: true, timeout: TEMPO_MAXIMO_MS, maximumAge: 60_000 },
    );
  });
}

/** Os campos `latitude`/`longitude` do payload de um evento (`{}` quando não há posição). */
export const comPosicao = (p: Posicao | null): { latitude?: number; longitude?: number } => (p ? { latitude: p.latitude, longitude: p.longitude } : {});

/** Link do ponto no mapa (abre o Google Maps). */
export const linkDoMapa = (p: Posicao): string => `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
