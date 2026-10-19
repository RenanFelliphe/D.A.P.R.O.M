/**
 * Localização (GPS) nos cinco momentos da execução: início, pausa, suspensão, interrupção e encerramento (não na assinatura da APR).
 * Aqui só o que é puro; quem pede a posição ao aparelho (o navegador na web, o `expo-location` no app) fica de fora. Sem posição
 * (permissão negada, local coberto, tempo esgotado) o serviço NÃO é bloqueado: o evento segue sem coordenadas e a `api` registra
 * "sem localização".
 */

export interface Posicao {
  latitude: number;
  longitude: number;
}

/** O aviso de privacidade (LGPD) que as telas mostram junto dos botões que registram a localização. */
export const AVISO_DE_LOCALIZACAO =
  "A sua localização é registrada ao iniciar, pausar, suspender, interromper e encerrar a execução, para constar no relatório da OS. Sem permissão de localização, o serviço segue normalmente, marcado como “sem localização”.";

/** Tempo máximo de espera pela posição antes de seguir sem ela. */
export const TEMPO_MAXIMO_DA_POSICAO_MS = 8000;

/** Seis casas decimais (~10 cm) bastam para o relatório. */
export const arredondarPosicao = (p: Posicao): Posicao => ({ latitude: Number(p.latitude.toFixed(6)), longitude: Number(p.longitude.toFixed(6)) });

/** Os campos `latitude`/`longitude` do payload de um evento (`{}` quando não há posição). */
export const comPosicao = (p: Posicao | null): { latitude?: number; longitude?: number } => (p ? { latitude: p.latitude, longitude: p.longitude } : {});

/** Link do ponto no mapa (abre o Google Maps). */
export const linkDoMapa = (p: Posicao): string => `https://www.google.com/maps?q=${p.latitude},${p.longitude}`;
