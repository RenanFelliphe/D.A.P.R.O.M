import * as Location from "expo-location";
import { arredondarPosicao, TEMPO_MAXIMO_DA_POSICAO_MS, type Posicao } from "@shared/api/localizacao";
import { comLimiteDeTempo } from "./tempo-limite";

const TEMPO_DA_FOTO_MS = 3000;

async function lerPosicao(): Promise<Posicao | null> {
  const ponto = (await Location.getLastKnownPositionAsync({ maxAge: 60_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return ponto ? arredondarPosicao({ latitude: ponto.coords.latitude, longitude: ponto.coords.longitude }) : null;
}

/**
 * A posição do aparelho nos cinco momentos da execução (início, pausa, suspensão, interrupção e encerramento). Pede a permissão se
 * ainda não pediu. Devolve `null` quando não há (permissão negada, GPS desligado, tempo esgotado): o serviço NUNCA é bloqueado, o
 * evento segue sem coordenadas e a `api` registra "sem localização".
 */
export async function obterPosicao(): Promise<Posicao | null> {
  try {
    const permissao = await Location.requestForegroundPermissionsAsync();
    if (!permissao.granted) return null;
  } catch {
    return null;
  }
  return comLimiteDeTempo(lerPosicao(), TEMPO_MAXIMO_DA_POSICAO_MS, null);
}

/** A posição da foto: só se a permissão já foi dada (a foto não abre pedido de permissão) e sem esperar muito. */
export async function posicaoDaFoto(): Promise<Posicao | null> {
  try {
    const permissao = await Location.getForegroundPermissionsAsync();
    if (!permissao.granted) return null;
  } catch {
    return null;
  }
  return comLimiteDeTempo(lerPosicao(), TEMPO_DA_FOTO_MS, null);
}
