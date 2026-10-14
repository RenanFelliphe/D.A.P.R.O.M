import { deflateSync } from "node:zlib";
import type { Armazenamento } from "../../servicos/armazenamento";
import { CONQUISTAS_DA_CARGA, PATENTES_DA_CARGA, type Emblema } from "./gamificacao-dados";

/**
 * As imagens da carga inicial da gamificação: uma medalha (das pessoas) e um brasão (das equipes) para cada metal, e um troféu
 * para cada conquista, desenhados em código (PNG com transparência, sem biblioteca de imagem). São simples de propósito: o
 * admin troca pelas definitivas em "Patentes" e "Conquistas". Quadradas, como o cadastro exige.
 */

const LADO = 192;
const AMOSTRAS = 2;

type Cor = [number, number, number];
type Ponto = [number, number];

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

/** PNG RGBA de `LADO × LADO`, com bordas suavizadas por amostragem múltipla. */
function png(pintar: (u: number, v: number) => [number, number, number, number]): Uint8Array {
  const linhas = Buffer.alloc((LADO * 4 + 1) * LADO);
  for (let y = 0; y < LADO; y++) {
    const base = y * (LADO * 4 + 1);
    linhas[base] = 0;
    for (let x = 0; x < LADO; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < AMOSTRAS; sy++) {
        for (let sx = 0; sx < AMOSTRAS; sx++) {
          const [cr, cg, cb, ca] = pintar((x + (sx + 0.5) / AMOSTRAS) / LADO, (y + (sy + 0.5) / AMOSTRAS) / LADO);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const n = AMOSTRAS * AMOSTRAS;
      const o = base + 1 + x * 4;
      if (a > 0) linhas.set([Math.round(r / a), Math.round(g / a), Math.round(b / a), Math.round((a / n) * 255)], o);
    }
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(LADO, 0);
  cabecalho.writeUInt32BE(LADO, 4);
  cabecalho.set([8, 6, 0, 0, 0], 8);
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloco("IHDR", cabecalho), bloco("IDAT", deflateSync(linhas)), bloco("IEND", Buffer.alloc(0))]));
}

// ---- Geometria ---------------------------------------------------------------------------------------------------

const hex = (h: string): Cor => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const tom = (c: Cor, k: number): Cor => c.map((v) => Math.max(0, Math.min(255, Math.round(v * k)))) as Cor;
const misturar = (a: Cor, b: Cor, t: number): Cor => a.map((v, i) => Math.round(v + (b[i]! - v) * t)) as Cor;

const dentroDoPoligono = (p: Ponto[], x: number, y: number) => {
  let dentro = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i]!;
    const [xj, yj] = p[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
};
const noDisco = (cx: number, cy: number, r: number, u: number, v: number) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
const naCoroa = (cx: number, cy: number, r1: number, r2: number, u: number, v: number) => {
  const d = (u - cx) ** 2 + (v - cy) ** 2;
  return d <= r1 * r1 && d >= r2 * r2;
};
const noRetangulo = (u: number, v: number, x0: number, y0: number, x1: number, y1: number) => u >= x0 && u <= x1 && v >= y0 && v <= y1;

const estrela = (pontas: number, externo: number, interno: number): Ponto[] =>
  Array.from({ length: pontas * 2 }, (_, i) => {
    const ang = -Math.PI / 2 + (i * Math.PI) / pontas;
    const r = i % 2 === 0 ? externo : interno;
    return [Math.cos(ang) * r, Math.sin(ang) * r] as Ponto;
  });

/** Os emblemas em coordenadas locais (-1 a 1, y para baixo): `true` onde há desenho. */
const EMBLEMAS: Record<Emblema, (x: number, y: number) => boolean> = {
  estrela: (() => {
    const p = estrela(5, 1, 0.42);
    return (x, y) => dentroDoPoligono(p, x, y);
  })(),
  visto: (() => {
    const p: Ponto[] = [[-0.9, 0.05], [-0.62, -0.23], [-0.3, 0.1], [0.6, -0.8], [0.9, -0.52], [-0.3, 0.68]];
    return (x, y) => dentroDoPoligono(p, x, y);
  })(),
  escudo: (() => {
    const p: Ponto[] = [[-0.8, -0.8], [0, -1], [0.8, -0.8], [0.8, 0.1], [0, 1], [-0.8, 0.1]];
    return (x, y) => dentroDoPoligono(p, x, y) && !dentroDoPoligono([[-0.45, -0.5], [0, -0.62], [0.45, -0.5], [0.45, 0.02], [0, 0.6], [-0.45, 0.02]], x, y);
  })(),
  engrenagem: (x, y) => {
    const d = Math.hypot(x, y);
    if (d < 0.32) return false;
    const ang = Math.atan2(y, x);
    const dente = Math.abs(Math.sin(ang * 4)) > 0.55;
    return d <= (dente ? 1 : 0.78);
  },
  raio: (() => {
    const p: Ponto[] = [[0.25, -1], [-0.7, 0.12], [-0.08, 0.12], [-0.3, 1], [0.7, -0.2], [0.08, -0.2]];
    return (x, y) => dentroDoPoligono(p, x, y);
  })(),
  pessoas: (x, y) => {
    const cabeca = (cx: number) => noDisco(cx, -0.42, 0.28, x, y);
    const corpo = (cx: number) => y > 0.0 && y < 0.8 && ((x - cx) / 0.5) ** 2 + ((y - 0.8) / 0.8) ** 2 <= 1;
    return cabeca(-0.45) || cabeca(0.45) || corpo(-0.45) || corpo(0.45);
  },
  alvo: (x, y) => naCoroa(0, 0, 1, 0.78, x, y) || naCoroa(0, 0, 0.56, 0.36, x, y) || noDisco(0, 0, 0.16, x, y),
  relogio: (x, y) => naCoroa(0, 0, 1, 0.8, x, y) || noRetangulo(x, y, -0.07, -0.62, 0.07, 0.07) || noRetangulo(x, y, -0.07, -0.07, 0.5, 0.07),
  mapa: (() => {
    const bico: Ponto[] = [[-0.62, 0.18], [0, 1], [0.62, 0.18]];
    return (x, y) => (noDisco(0, -0.3, 0.7, x, y) && !noDisco(0, -0.3, 0.26, x, y)) || dentroDoPoligono(bico, x, y);
  })(),
  coroa: (() => {
    const p: Ponto[] = [[-1, 0.7], [-1, -0.7], [-0.45, -0.05], [0, -0.9], [0.45, -0.05], [1, -0.7], [1, 0.7]];
    return (x, y) => dentroDoPoligono(p, x, y);
  })(),
  livro: (() => {
    const esquerda: Ponto[] = [[-1, -0.7], [-0.06, -0.5], [-0.06, 0.8], [-1, 0.6]];
    const direita: Ponto[] = [[1, -0.7], [0.06, -0.5], [0.06, 0.8], [1, 0.6]];
    return (x, y) => dentroDoPoligono(esquerda, x, y) || dentroDoPoligono(direita, x, y);
  })(),
};

/** Pinta o emblema (centro `(cx, cy)`, raio `r`) por cima, se o ponto cair nele. */
const emblemaEm = (nome: Emblema, cx: number, cy: number, r: number, u: number, v: number) => EMBLEMAS[nome]((u - cx) / r, (v - cy) / r);

// ---- Medalha e troféu --------------------------------------------------------------------------------------------

const opaco = (c: Cor): [number, number, number, number] => [c[0], c[1], c[2], 1];

/** A medalha de uma patente: disco metálico com aro e o emblema no centro (losango no Diamante, estrela nas outras). */
function medalha(corHex: string, diamante: boolean): Uint8Array {
  const metal = hex(corHex);
  const escuro = tom(metal, 0.55);
  return png((u, v) => {
    if (!noDisco(0.5, 0.5, 0.47, u, v)) return [0, 0, 0, 0];
    if (!noDisco(0.5, 0.5, 0.41, u, v)) return opaco(escuro);
    if (naCoroa(0.5, 0.5, 0.345, 0.325, u, v)) return opaco(tom(metal, 1.3));
    const emblema = diamante
      ? dentroDoPoligono([[0, -1], [0.75, 0], [0, 1], [-0.75, 0]], (u - 0.5) / 0.2, (v - 0.5) / 0.2)
      : emblemaEm("estrela", 0.5, 0.52, 0.2, u, v);
    if (emblema) return opaco(tom(metal, 0.5));
    const luz = Math.max(0, Math.min(1, (u + v) / 2));
    return opaco(misturar(tom(metal, 1.3), tom(metal, 0.78), luz));
  });
}

/** O contorno do brasão: um escudo de topo reto e ponta embaixo. */
const ESCUDO_DO_BRASAO: Ponto[] = [[0.14, 0.1], [0.5, 0.03], [0.86, 0.1], [0.86, 0.5], [0.5, 0.97], [0.14, 0.5]];
const reduzir = (p: Ponto[], k: number): Ponto[] => p.map(([x, y]) => [0.5 + (x - 0.5) * k, 0.5 + (y - 0.5) * k] as Ponto);

/**
 * O brasão de uma patente de equipe: escudo metálico com aro e duas pessoas no centro, para não se confundir com a medalha
 * (disco com estrela) das pessoas.
 */
function brasao(corHex: string): Uint8Array {
  const metal = hex(corHex);
  const escuro = tom(metal, 0.55);
  const interno = reduzir(ESCUDO_DO_BRASAO, 0.88);
  const filete = reduzir(ESCUDO_DO_BRASAO, 0.8);
  return png((u, v) => {
    if (!dentroDoPoligono(ESCUDO_DO_BRASAO, u, v)) return [0, 0, 0, 0];
    if (!dentroDoPoligono(interno, u, v)) return opaco(escuro);
    if (!dentroDoPoligono(filete, u, v)) return opaco(tom(metal, 1.3));
    if (emblemaEm("pessoas", 0.5, 0.42, 0.2, u, v)) return opaco(tom(metal, 0.5));
    const luz = Math.max(0, Math.min(1, (u + v) / 2));
    return opaco(misturar(tom(metal, 1.3), tom(metal, 0.78), luz));
  });
}

const NIVEIS: Record<string, string> = { bronze: "#CD7F32", prata: "#A8A9AD", ouro: "#D4AF37", equipe: "#4F86E8" };

/** O troféu de uma conquista: taça com alças, haste e base, na cor do nível (bronze, prata, ouro; azul para as de equipe), e o emblema. */
function trofeu(nivel: keyof typeof NIVEIS, emblema: Emblema): Uint8Array {
  const metal = hex(NIVEIS[nivel]!);
  const sombra = tom(metal, 0.62);
  const luz = tom(metal, 1.28);
  return png((u, v) => {
    // Alças (anéis dos dois lados da taça).
    const alca = (cx: number) => naCoroa(cx, 0.3, 0.115, 0.07, u, v) && (cx < 0.5 ? u <= 0.27 : u >= 0.73);
    if (alca(0.25) || alca(0.75)) return opaco(sombra);
    // Aro, taça, haste, base e pedestal.
    if (noRetangulo(u, v, 0.23, 0.15, 0.77, 0.205)) return opaco(luz);
    if (v >= 0.205 && ((u - 0.5) / 0.255) ** 2 + ((v - 0.205) / 0.33) ** 2 <= 1) {
      if (emblemaEm(emblema, 0.5, 0.34, 0.105, u, v)) return opaco(tom(metal, 0.48));
      if (u < 0.37 && u > 0.31 && v > 0.25 && v < 0.43) return opaco(luz);
      return opaco(misturar(luz, tom(metal, 0.82), Math.max(0, Math.min(1, (u - 0.25) / 0.5))));
    }
    if (noRetangulo(u, v, 0.46, 0.52, 0.54, 0.7)) return opaco(sombra);
    if (noRetangulo(u, v, 0.35, 0.7, 0.65, 0.775)) return opaco(metal);
    if (noRetangulo(u, v, 0.28, 0.775, 0.72, 0.84)) return opaco(sombra);
    return [0, 0, 0, 0];
  });
}

const nivelDaConquista = (pontos: number, deEquipe: boolean): keyof typeof NIVEIS => (deEquipe ? "equipe" : pontos >= 100 ? "ouro" : pontos >= 50 ? "prata" : "bronze");

/** Todas as imagens da carga inicial, pelo id do arquivo no bucket `gamificacao`. */
export function imagensDaCarga(): Map<string, Uint8Array> {
  const imagens = new Map<string, Uint8Array>();
  for (const p of PATENTES_DA_CARGA) {
    imagens.set(p.imagemId, medalha(p.cor, p.nome === "Diamante"));
    imagens.set(p.imagemEquipeId, brasao(p.cor));
  }
  for (const c of CONQUISTAS_DA_CARGA) imagens.set(c.imagemId, trofeu(nivelDaConquista(c.pontos, c.pontos === 0), c.emblema));
  return imagens;
}

/**
 * Grava no bucket `gamificacao` as imagens da carga que ainda não estão lá (a subida da `api` chama; é idempotente). Uma imagem
 * que o admin trocou não é tocada: a linha passa a apontar para outro arquivo, e o original só reaparece se faltar.
 */
export async function garantirImagensDaGamificacao(armazenamento: Armazenamento): Promise<number> {
  let gravadas = 0;
  const faltam = [];
  for (const id of [...PATENTES_DA_CARGA.flatMap((p) => [p.imagemId, p.imagemEquipeId]), ...CONQUISTAS_DA_CARGA.map((c) => c.imagemId)]) {
    if (!(await armazenamento.existe("gamificacao", id))) faltam.push(id);
  }
  if (faltam.length === 0) return 0;
  const imagens = imagensDaCarga();
  for (const id of faltam) {
    await armazenamento.gravar("gamificacao", id, imagens.get(id)!, "image/png");
    gravadas++;
  }
  return gravadas;
}
