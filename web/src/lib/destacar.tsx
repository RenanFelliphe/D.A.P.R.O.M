import type { ReactNode } from "react";

/** A mesma troca da busca na `api` (`dominio/busca.ts`): a busca não diferencia maiúsculas nem acentos, e o destaque também não. */
const VARIANTES: Record<string, string> = { a: "áàâãäå", e: "éèêë", i: "íìîï", o: "óòôõö", u: "úùûü", c: "ç", n: "ñ", y: "ýÿ" };
const TROCA = new Map<string, string>(Object.entries(VARIANTES).flatMap(([base, letras]) => [...letras, ...letras.toUpperCase()].map((letra) => [letra, base])));

/** Minúsculo e sem acento, caractere por caractere: o resultado tem o mesmo comprimento, então as posições valem no texto original. */
function normalizar(texto: string): string {
  let saida = "";
  for (const c of texto) {
    const trocado = TROCA.get(c) ?? c.toLowerCase();
    saida += trocado.length === c.length ? trocado : c;
  }
  return saida;
}

/** Devolve o texto com o trecho buscado em `<mark>` (sem diferenciar maiúsculas nem acentos); sem busca, o texto como veio. */
export function destacar(texto: string | null | undefined, busca: string | undefined): ReactNode {
  if (!texto) return texto ?? "";
  const termo = normalizar(busca?.trim() ?? "");
  if (!termo) return texto;
  const base = normalizar(texto);
  const partes: ReactNode[] = [];
  let de = 0;
  for (let achado = base.indexOf(termo); achado !== -1; achado = base.indexOf(termo, de)) {
    if (achado > de) partes.push(texto.slice(de, achado));
    partes.push(<mark key={achado}>{texto.slice(achado, achado + termo.length)}</mark>);
    de = achado + termo.length;
  }
  if (de === 0) return texto;
  if (de < texto.length) partes.push(texto.slice(de));
  return partes;
}
