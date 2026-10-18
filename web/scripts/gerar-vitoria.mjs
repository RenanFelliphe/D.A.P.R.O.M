// Gera as imagens da Vitória que a web serve (`web/public/vitoria/`) a partir dos originais de `vitoria/NovaVitória/`.
//
// Os originais são pesados (GIFs de 20 a 38 MB, PNGs de 1254 px) e ficam fora do git. Aqui viram:
//   - `icone.webp`: a foto de perfil, o `icon.png` inteiro (ela com as mãos apoiadas na borda) sem os cantos pretos, num círculo de 192 px (cerca de 15 KB);
//   - `reacao-<nome>.webp`: cada animação em 200 px a 15 quadros por segundo, tocando uma vez (cerca de 450 KB);
//   - `reacao-<nome>-quadro.webp`: um quadro parado de cada animação (cerca de 15 KB), o que a figurinha mostra antes e depois de tocar.
//
// Uso (na pasta `web/`): `node scripts/gerar-vitoria.mjs [pasta dos originais] [--so-icone | --so-quadros]`. Precisa do `sharp`, que o Next já traz.
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const raiz = path.join(import.meta.dirname, "..", "..");
const argumentos = process.argv.slice(2);
const soIcone = argumentos.includes("--so-icone");
const soQuadros = argumentos.includes("--so-quadros");
const origem = argumentos.find((a) => !a.startsWith("--")) ?? path.join(raiz, "vitoria", "NovaVitória");
const destino = path.join(import.meta.dirname, "..", "public", "vitoria");

/** Nome da reação (o mesmo de `shared/vitoria/reacoes.ts`) e o GIF de onde sai. */
const REACOES = {
  ola: "ola.gif",
  certo: "certo.gif",
  atencao: "atencao.gif",
  comemorando: "comemorando.gif",
  errada: "errada.gif",
  pensando: "pensando.gif",
  triste: "triste.gif",
  surpresa: "surpresa.gif",
  vergonha: "vergonha.gif",
  fofo: "fofo.gif",
};

const TAMANHO_DA_ANIMACAO = 200;
const PASSO_DOS_QUADROS = 2; // os GIFs têm 30 quadros por segundo; ficar com 1 de cada 2 dá 15
const ATRASO_DO_QUADRO_MS = 67;
const TAMANHO_DO_ICONE = 192;
/** O quadro parado de cada figurinha, em quadros do GIF (30 por segundo): a pose mais legível, sem o fim que vira cara de brava. */
const QUADRO_PARADO = { atencao: 16, certo: 80 };
const QUADRO_PARADO_PADRAO = 20;
/** O círculo verde de `icon.png` (1254 x 1254) vai de 16 a 1224 na horizontal e de 17 a 1221 na vertical; o recorte entra 12 px para não sobrar borda preta. */
const RECORTE_DO_ICONE = { left: 28, top: 29, width: 1184, height: 1184 };

const kb = (arquivo) => `${(statSync(arquivo).size / 1024).toFixed(0)} KB`;

async function gerarIcone() {
  const mascara = Buffer.from(`<svg width="${TAMANHO_DO_ICONE}" height="${TAMANHO_DO_ICONE}"><circle cx="${TAMANHO_DO_ICONE / 2}" cy="${TAMANHO_DO_ICONE / 2}" r="${TAMANHO_DO_ICONE / 2}"/></svg>`);
  const arquivo = path.join(destino, "icone.webp");
  await sharp(path.join(origem, "icon.png"))
    .extract(RECORTE_DO_ICONE)
    .resize(TAMANHO_DO_ICONE, TAMANHO_DO_ICONE)
    .composite([{ input: mascara, blend: "dest-in" }])
    .webp({ quality: 85 })
    .toFile(arquivo);
  console.log(`icone.webp  ${kb(arquivo)}`);
}

async function gerarQuadro(nome, gif) {
  const arquivo = path.join(destino, `reacao-${nome}-quadro.webp`);
  await sharp(path.join(origem, gif), { page: QUADRO_PARADO[nome] ?? QUADRO_PARADO_PADRAO, pages: 1 })
    .resize(TAMANHO_DA_ANIMACAO, TAMANHO_DA_ANIMACAO)
    .webp({ quality: 80 })
    .toFile(arquivo);
  console.log(`reacao-${nome}-quadro.webp  ${kb(arquivo)}`);
}

async function gerarReacao(nome, gif) {
  const entrada = path.join(origem, gif);
  const { pages } = await sharp(entrada, { pages: -1 }).metadata();
  const quadros = [];
  for (let pagina = 0; pagina < (pages ?? 1); pagina += PASSO_DOS_QUADROS) {
    quadros.push(await sharp(entrada, { page: pagina, pages: 1 }).resize(TAMANHO_DA_ANIMACAO, TAMANHO_DA_ANIMACAO).png().toBuffer());
  }
  const arquivo = path.join(destino, `reacao-${nome}.webp`);
  await sharp(quadros, { join: { animated: true } })
    .webp({ quality: 65, effort: 5, loop: 1, delay: quadros.map(() => ATRASO_DO_QUADRO_MS) })
    .toFile(arquivo);
  console.log(`reacao-${nome}.webp  ${quadros.length} quadros  ${kb(arquivo)}`);
}

mkdirSync(destino, { recursive: true });
await gerarIcone();
if (!soIcone) for (const [nome, gif] of Object.entries(REACOES)) await gerarQuadro(nome, gif);
if (!soIcone && !soQuadros) for (const [nome, gif] of Object.entries(REACOES)) await gerarReacao(nome, gif);
