/**
 * Qualidade de uma foto de folha antes de mandá-la ler (Digitalização por câmera, `docs/ia-e-vitoria.md`, seção 6.1): mede a luz e a nitidez
 * na própria imagem, para o aviso "foto escura" ou "tremida" sair na hora e não depois de uma leitura ruim. Os avisos nunca
 * impedem o envio: uma folha quase em branco também tem pouca "nitidez" medida, e quem decide é a pessoa.
 */

export interface QualidadeDaFoto {
  /** Luminância média, de 0 (preto) a 255 (branco). */
  luz: number;
  /**
   * Variância do laplaciano dividida pela variância dos tons de cinza: o quanto a imagem tem de borda em relação ao contraste que
   * ela tem. Alta no texto nítido, baixa na foto tremida ou fora de foco; dividir pelo contraste evita culpar a folha quase em
   * branco (que tem pouca borda por ter pouca coisa escrita).
   */
  nitidez: number;
  /** O que a pessoa deve olhar, em português; vazio quando a foto parece boa. */
  avisos: string[];
}

/** Abaixo disto a folha branca saiu escura demais para o OCR; acima, a luz estourou o papel e a caneta some. */
export const LUZ_MINIMA = 80;
export const LUZ_MAXIMA = 242;
/**
 * Abaixo disto o texto está borrado (medido em imagem de 640 px de largura). Valor inicial, escolhido em imagens sintéticas (texto
 * nítido ≈ 3, o mesmo texto borrado com uma caixa de 7×7 px ≈ 0,2): precisa ser afinado com fotos de verdade de folhas do SAP, de celular.
 */
export const NITIDEZ_MINIMA = 0.25;
/** Folha com pouco contraste (quase em branco): não há o que medir, e o aviso de foco não vale. */
export const CONTRASTE_MINIMO = 150;
/** Largura em que a imagem é medida: o bastante para ver o borrão, e barato para qualquer celular. */
export const LARGURA_DA_MEDIDA_PX = 640;

/** Mede a luz e a nitidez de pixels RGBA (como `ImageData.data`), de `largura` × `altura`. */
export function medirQualidade(pixels: Uint8ClampedArray, largura: number, altura: number): QualidadeDaFoto {
  const cinza = new Float32Array(largura * altura);
  let soma = 0;
  for (let i = 0; i < cinza.length; i++) {
    const g = 0.299 * pixels[i * 4]! + 0.587 * pixels[i * 4 + 1]! + 0.114 * pixels[i * 4 + 2]!;
    cinza[i] = g;
    soma += g;
  }
  const luz = cinza.length ? soma / cinza.length : 0;
  let somaDesvios = 0;
  for (let i = 0; i < cinza.length; i++) somaDesvios += (cinza[i]! - luz) ** 2;
  const contraste = cinza.length ? somaDesvios / cinza.length : 0;

  // Variância do laplaciano (4 vizinhos) sobre o miolo da imagem.
  let n = 0;
  let somaLap = 0;
  let somaLap2 = 0;
  for (let y = 1; y < altura - 1; y++) {
    for (let x = 1; x < largura - 1; x++) {
      const i = y * largura + x;
      const lap = 4 * cinza[i]! - cinza[i - 1]! - cinza[i + 1]! - cinza[i - largura]! - cinza[i + largura]!;
      somaLap += lap;
      somaLap2 += lap * lap;
      n++;
    }
  }
  const varianciaLap = n ? somaLap2 / n - (somaLap / n) ** 2 : 0;
  const nitidez = contraste > 0 ? varianciaLap / contraste : 0;

  const avisos: string[] = [];
  if (luz < LUZ_MINIMA) avisos.push("Foto escura: acenda a luz ou chegue perto de uma janela.");
  else if (luz > LUZ_MAXIMA) avisos.push("Luz demais: o papel estourou e a caneta pode sumir. Afaste-se do reflexo ou da luz direta.");
  if (contraste >= CONTRASTE_MINIMO && nitidez < NITIDEZ_MINIMA) avisos.push("A foto pode estar tremida ou fora de foco: apoie o aparelho e espere o foco antes de capturar.");
  return { luz, nitidez, avisos };
}

/** Mede uma imagem já decodificada (`ImageBitmap` ou canvas) reduzindo-a a `LARGURA_DA_MEDIDA_PX`. */
export function qualidadeDaImagem(imagem: ImageBitmap | HTMLCanvasElement): QualidadeDaFoto {
  const escala = Math.min(1, LARGURA_DA_MEDIDA_PX / imagem.width);
  const largura = Math.max(3, Math.round(imagem.width * escala));
  const altura = Math.max(3, Math.round(imagem.height * escala));
  const tela = document.createElement("canvas");
  tela.width = largura;
  tela.height = altura;
  const contexto = tela.getContext("2d", { willReadFrequently: true })!;
  contexto.drawImage(imagem, 0, 0, largura, altura);
  return medirQualidade(contexto.getImageData(0, 0, largura, altura).data, largura, altura);
}

/** Maior lado, em pixels, da foto enviada: a `api` guarda até 2.800 px, e mais que isso só pesa no envio. */
export const LADO_MAXIMO_DO_ENVIO_PX = 2800;
const QUALIDADE_DO_ENVIO = 0.88;

/**
 * Decodifica a foto respeitando a orientação do EXIF (a foto de celular tirada em pé vem "deitada" nos metadados), com um giro
 * opcional de `graus` (0, 90, 180 ou 270), e a devolve como canvas. Lança quando o navegador não abre a imagem.
 */
export async function abrirFoto(blob: Blob, graus = 0): Promise<HTMLCanvasElement> {
  const imagem = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    const lateral = graus === 90 || graus === 270;
    const escala = Math.min(1, LADO_MAXIMO_DO_ENVIO_PX / Math.max(imagem.width, imagem.height));
    const largura = Math.max(1, Math.round(imagem.width * escala));
    const altura = Math.max(1, Math.round(imagem.height * escala));
    const tela = document.createElement("canvas");
    tela.width = lateral ? altura : largura;
    tela.height = lateral ? largura : altura;
    const contexto = tela.getContext("2d")!;
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, tela.width, tela.height);
    contexto.translate(tela.width / 2, tela.height / 2);
    contexto.rotate((graus * Math.PI) / 180);
    contexto.drawImage(imagem, -largura / 2, -altura / 2, largura, altura);
    return tela;
  } finally {
    imagem.close();
  }
}

/** O canvas como JPEG para o envio. */
export function paraJpeg(tela: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolver, rejeitar) => tela.toBlob((b) => (b ? resolver(b) : rejeitar(new Error("não foi possível gerar o JPEG"))), "image/jpeg", QUALIDADE_DO_ENVIO));
}
