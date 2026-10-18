import type { Reacao } from "../../../shared/vitoria/reacoes";

/** A animação da reação, gerada por `scripts/gerar-vitoria.mjs` a partir dos originais de `vitoria/NovaVitória/`. */
export const urlDaReacao = (reacao: Reacao) => `/vitoria/reacao-${reacao}.webp`;

/** Com "reduzir movimento" ligado no aparelho, a figurinha da Vitória não anima: fica no quadro parado. */
export function movimentoReduzido(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const baixadas = new Map<Reacao, Promise<Blob>>();

/**
 * Baixa a animação uma vez e guarda na memória. Quem toca usa um endereço novo (`URL.createObjectURL`) a cada vez: uma
 * imagem animada com o mesmo endereço não recomeça do primeiro quadro, e assim a reação repetida toca de novo sem baixar
 * outra vez. Se o download falhar, a entrada sai do cache e a próxima reação tenta de novo.
 */
export function carregarReacao(reacao: Reacao): Promise<Blob> {
  let promessa = baixadas.get(reacao);
  if (!promessa) {
    promessa = fetch(urlDaReacao(reacao)).then((r) => {
      if (!r.ok) throw new Error(`Animação ${reacao}: HTTP ${r.status}`);
      return r.blob();
    });
    promessa.catch(() => baixadas.delete(reacao));
    baixadas.set(reacao, promessa);
  }
  return promessa;
}

/** O quadro parado da reação: o que a figurinha mostra antes e depois de tocar. */
export const urlDoQuadroDaReacao = (reacao: Reacao) => `/vitoria/reacao-${reacao}-quadro.webp`;
