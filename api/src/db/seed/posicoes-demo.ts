/**
 * Posições GPS fictícias das execuções da demonstração, para o mapa de calor ter manchas onde ficam os locais de
 * instalação (e não todas no mesmo ponto). O ponto depende só do código do local e do número da OS, então o seed e o
 * `pnpm demo:espalhar-gps` (que corrige as execuções já gravadas) chegam ao mesmo lugar, quantas vezes rodarem.
 */

/** Perto de cada local da demo (`locaisDef` em `demo.ts`), pelo endereço; um local fora da lista fica no centro de Vitória. */
const CENTRO_DO_LOCAL: Record<string, [number, number]> = {
  "VILA VELHA/REDE VILA VELHA": [-20.338, -40.301],
  "ERP SERRA/ESTACAO ERP SERRA": [-20.205, -40.224],
  "GUARAPARI/ESTACAO GUARAPARI": [-20.642, -40.478],
  "CARIACICA/RAMAL CARIACICA": [-20.33, -40.375],
  "VITORIA/ESTACAO VITORIA": [-20.28, -40.29],
  "SERRA/ESTACAO SERRA SUL": [-20.215, -40.265],
  "TUBARAO/PR PONTO DE RECEBIMENTO": [-20.287, -40.245],
  "ARACRUZ/ERS ARACRUZ": [-19.82, -40.275],
  "LINHARES/REDE LINHARES": [-19.391, -40.072],
};
const CENTRO_DE_VITORIA: [number, number] = [-20.3195, -40.3378];

/** Até 1,2 km para cada lado do local: as OS de uma rede ou de um ramal se espalham por algumas células do mapa. */
const ESPALHAMENTO = 0.012;

/** FNV-1a de 32 bits: o mesmo texto dá sempre o mesmo número. */
function hash(texto: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Entre -1 e 1, a partir do texto. */
const desvio = (texto: string) => (hash(texto) / 0xffffffff) * 2 - 1;

/** Seis casas decimais, como a coluna `numeric(9,6)` guarda. */
const seisCasas = (v: number) => Math.round(v * 1e6) / 1e6;

/** Onde a execução da OS começou. `deslocamento` afasta o ponto alguns metros (a pausa, o encerramento, cada foto). */
export function posicaoDaDemo(codigoDoLocal: string | null, numeroDaOrdem: string, deslocamento = 0) {
  const [lat, lng] = (codigoDoLocal && CENTRO_DO_LOCAL[codigoDoLocal]) || CENTRO_DE_VITORIA;
  return {
    latitude: seisCasas(lat + desvio(`${numeroDaOrdem}:lat`) * ESPALHAMENTO + deslocamento * 0.0002),
    longitude: seisCasas(lng + desvio(`${numeroDaOrdem}:lng`) * ESPALHAMENTO - deslocamento * 0.0001),
  };
}
