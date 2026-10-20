import { cache } from "react";
import { api, apiOuNulo } from "@/lib/api";
import type { ServicoDaOs } from "@/lib/catalogo";
import type { EquipeDoServico, ListaDeSugestoes, Sugestao } from "@/lib/sugestao-materiais";

/** As leituras das telas de sugestão e contestação de materiais (`/app/catalogo/servicos/{codigo}/materiais/*`), uma vez por requisição. */

export const servicoDoCatalogo = cache((codigo: string) => apiOuNulo<ServicoDaOs>(`/catalogo/servicos/${encodeURIComponent(codigo)}`));

export const equipesDoServico = cache(async (codigo: string) => (await api<{ equipes: EquipeDoServico[] }>("/sugestoes-materiais/equipes", { consulta: { atividade: codigo } })).equipes);

export const sugestaoDeMateriais = cache((id: string) => apiOuNulo<Sugestao>(`/sugestoes-materiais/${id}`));

export const sugestoesDe = (consulta: { escopo: "minhas" | "avaliar" | "servico"; atividade?: string; estado?: string; pagina?: number; tamanho?: number }) =>
  api<ListaDeSugestoes>("/sugestoes-materiais", { consulta });

/** Quantas sugestões esperam a avaliação de quem pede (o selo da aba). */
export const totalParaAvaliar = async () => (await apiOuNulo<{ para_avaliar: number }>("/sugestoes-materiais/resumo"))?.para_avaliar ?? 0;
