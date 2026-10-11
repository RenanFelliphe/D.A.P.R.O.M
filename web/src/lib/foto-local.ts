/** Auxiliares do navegador para as fotos da APR: miniatura para o rascunho e posição (GPS) quando disponível. */

/** Miniatura JPEG (data URL, ~160 px) de uma foto local; `undefined` se o navegador não conseguir decodificá-la. */
export async function miniaturaDe(endereco: string): Promise<string | undefined> {
  try {
    const imagem = new Image();
    imagem.src = endereco;
    await imagem.decode();
    const escala = Math.min(1, 160 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
    const tela = document.createElement("canvas");
    tela.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
    tela.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
    tela.getContext("2d")!.drawImage(imagem, 0, 0, tela.width, tela.height);
    return tela.toDataURL("image/jpeg", 0.6);
  } catch {
    return undefined;
  }
}

/** Posição do aparelho, se o GPS estiver disponível e permitido (espera pouco: a foto não depende dele). */
export function posicaoAtual(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolver) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolver(null),
      { timeout: 3000, maximumAge: 60_000 },
    );
  });
}
