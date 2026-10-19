import { mediaDeEquipe, numero, ordinal, type Conquista } from "@shared/api/gamificacao";

/** Onde está a barra de progresso (0 a 100): dos pontos da patente de agora até os da próxima; no topo da escada, cheia. */
export function percentualDaBarra(pontosDaTemporada: number, barra: { de: number; ate: number | null }): number {
  if (barra.ate === null) return 100;
  return Math.max(0, Math.min(100, ((pontosDaTemporada - barra.de) / Math.max(1, barra.ate - barra.de)) * 100));
}

export interface ProgressoEmTexto {
  texto: string;
  /** 0 a 100 para a barra; `null` quando a conquista é de posição (não há barra, só o texto). */
  percentual: number | null;
}

/** O progresso de uma conquista que falta: "37 de 50" com a barra, ou o texto próprio dos critérios de posição. `null` sem progresso. */
export function progressoDaConquista(c: Pick<Conquista, "criterio" | "progresso">): ProgressoEmTexto | null {
  const p = c.progresso;
  if (!p) return null;
  if (c.criterio === "posicao" || c.criterio === "posicao_da_equipe") {
    return { texto: p.atual === null ? "Ainda sem temporada fechada." : `Melhor posição: ${ordinal(p.atual)} (a meta é o ${ordinal(p.meta)} ou melhor)`, percentual: null };
  }
  const daEquipe = c.criterio === "patente_da_equipe";
  const pontosDaPatente = c.criterio === "patente" || daEquipe;
  const atual = p.atual ?? 0;
  const formatar = (n: number) => (daEquipe ? mediaDeEquipe(n) : numero(n));
  const sufixo = pontosDaPatente ? (daEquipe ? " de média por membro" : " pontos numa temporada") : "";
  return { texto: `${formatar(atual)} de ${formatar(p.meta)}${sufixo}`, percentual: Math.max(0, Math.min(100, (atual / Math.max(1, p.meta)) * 100)) };
}

/** As últimas conquistas obtidas, da mais nova para a mais antiga. */
export function ultimasConquistas<T extends Pick<Conquista, "obtida_em">>(conquistas: T[], quantas: number): T[] {
  return conquistas
    .filter((c) => c.obtida_em)
    .sort((a, b) => new Date(b.obtida_em!).getTime() - new Date(a.obtida_em!).getTime())
    .slice(0, quantas);
}
