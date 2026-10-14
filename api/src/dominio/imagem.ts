/**
 * Lê o tipo e as dimensões de uma imagem PNG, JPEG ou WebP pelos próprios bytes (sem biblioteca de imagem). O envio das
 * imagens das patentes e das conquistas confere o conteúdo, e não só o tipo que o navegador declarou, e exige que ela seja
 * quadrada.
 */

export type TipoDeImagem = "image/png" | "image/jpeg" | "image/webp";

export interface ImagemLida {
  tipoMime: TipoDeImagem;
  largura: number;
  altura: number;
}

const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;
const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u24le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!) >>> 0;
const u32le = (b: Uint8Array, i: number) => (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
const texto = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

function lerPng(b: Uint8Array): ImagemLida | null {
  if (b.length < 24 || texto(b, 1, 3) !== "PNG" || texto(b, 12, 4) !== "IHDR") return null;
  return { tipoMime: "image/png", largura: u32be(b, 16), altura: u32be(b, 20) };
}

function lerJpeg(b: Uint8Array): ImagemLida | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marcador = b[i + 1]!;
    if (marcador === 0xff) {
      i++;
      continue;
    }
    // SOF0 a SOF15, menos DHT (C4), JPG (C8) e DAC (CC): trazem a altura e a largura.
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      return { tipoMime: "image/jpeg", altura: u16be(b, i + 5), largura: u16be(b, i + 7) };
    }
    if ((marcador >= 0xd0 && marcador <= 0xd9) || marcador === 0x01) {
      i += 2;
      continue;
    }
    i += 2 + u16be(b, i + 2);
  }
  return null;
}

function lerWebp(b: Uint8Array): ImagemLida | null {
  if (b.length < 30 || texto(b, 0, 4) !== "RIFF" || texto(b, 8, 4) !== "WEBP") return null;
  const bloco = texto(b, 12, 4);
  if (bloco === "VP8 ") {
    if (b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    return { tipoMime: "image/webp", largura: u16le(b, 26) & 0x3fff, altura: u16le(b, 28) & 0x3fff };
  }
  if (bloco === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = u32le(b, 21);
    return { tipoMime: "image/webp", largura: (bits & 0x3fff) + 1, altura: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (bloco === "VP8X") return { tipoMime: "image/webp", largura: 1 + u24le(b, 24), altura: 1 + u24le(b, 27) };
  return null;
}

/** O tipo e as dimensões da imagem, ou `null` se os bytes não são um PNG, JPEG ou WebP. */
export function lerImagem(bytes: Uint8Array): ImagemLida | null {
  if (bytes.length >= 8 && bytes[0] === 0x89) return lerPng(bytes);
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return lerJpeg(bytes);
  if (bytes.length >= 12 && bytes[0] === 0x52) return lerWebp(bytes);
  return null;
}
