/** Espera `promessa` por no máximo `ms`; passou do tempo (ou falhou), devolve `padrao`. Nunca lança: a localização não pode travar o serviço. */
export async function comLimiteDeTempo<T>(promessa: Promise<T>, ms: number, padrao: T): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promessa, new Promise<T>((resolver) => (relogio = setTimeout(() => resolver(padrao), ms)))]);
  } catch {
    return padrao;
  } finally {
    if (relogio) clearTimeout(relogio);
  }
}
