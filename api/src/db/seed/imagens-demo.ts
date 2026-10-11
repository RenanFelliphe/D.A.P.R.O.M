import { deflateSync } from "node:zlib";

/** PNGs gerados em código (sem biblioteca de imagem): servem de fotos e assinaturas nos dados de demonstração. */

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = TABELA_CRC[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloco(tipo: string, dados: Buffer): Buffer {
  const cabeca = Buffer.alloc(8);
  cabeca.writeUInt32BE(dados.length, 0);
  cabeca.write(tipo, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([cabeca.subarray(4), dados])), 0);
  return Buffer.concat([cabeca, dados, crc]);
}

function png(largura: number, altura: number, pixel: (x: number, y: number) => [number, number, number]): Uint8Array {
  const linhas = Buffer.alloc((largura * 3 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    const base = y * (largura * 3 + 1);
    linhas[base] = 0;
    for (let x = 0; x < largura; x++) {
      const [r, g, b] = pixel(x, y);
      linhas.set([r, g, b], base + 1 + x * 3);
    }
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho.set([8, 2, 0, 0, 0], 8);
  return new Uint8Array(
    Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloco("IHDR", cabecalho), bloco("IDAT", deflateSync(linhas)), bloco("IEND", Buffer.alloc(0))]),
  );
}

const PALETAS: [number, number, number][] = [
  [196, 112, 52],
  [70, 120, 160],
  [110, 150, 90],
  [150, 90, 130],
  [180, 160, 70],
  [90, 130, 140],
];

/** "Foto" de campo: degradê colorido com faixas diagonais, uma cor por `semente`. */
export function fotoDemo(semente: number): Uint8Array {
  const [r, g, b] = PALETAS[semente % PALETAS.length]!;
  return png(480, 360, (x, y) => {
    const t = y / 360;
    const faixa = ((x + y + semente * 37) % 90) < 6 ? 28 : 0;
    const moldura = x < 6 || y < 6 || x > 473 || y > 353 ? -40 : 0;
    const f = (v: number, k: number) => Math.max(0, Math.min(255, Math.round(v * (1.15 - 0.5 * t) + faixa + moldura + k)));
    return [f(r, 0), f(g, 0), f(b, 0)];
  });
}

/** "Assinatura": um rabisco escuro contínuo sobre fundo branco, diferente por `semente`. */
export function assinaturaDemo(semente: number): Uint8Array {
  const L = 420;
  const A = 120;
  const f1 = 0.035 + (semente % 5) * 0.006;
  const fase = semente * 1.3;
  return png(L, A, (x, y) => {
    const decai = 1 - x / (L * 1.25);
    const alvo = A / 2 + Math.sin(x * f1 + fase) * 30 * decai + Math.sin(x * f1 * 2.7) * 9;
    return Math.abs(y - alvo) < 2.2 && x > 14 && x < L - 14 ? [23, 33, 43] : [255, 255, 255];
  });
}
