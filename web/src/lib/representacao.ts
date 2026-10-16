import { dataDoDia } from "./formatar";

/** Por que o representante está no comando da equipe: o supervisor está ausente, ou passou dias sem usar o sistema. */
export type MotivoDaRepresentacao = "ausencia" | "inatividade";

/** Quando o representante assume sozinho (os mesmos 3 dias da `api`: `DIAS_SEM_ATIVIDADE`). */
export const DIAS_SEM_ATIVIDADE = 3;

/** Uma equipe que a pessoa representa agora, como `GET /me` traz. */
export interface EquipeRepresentada {
  id: string;
  nome: string;
  supervisor_nome: string;
  desde: string | null;
  motivo: MotivoDaRepresentacao | null;
  /** "o supervisor está ausente" / "o supervisor ficou 3 dias sem usar o sistema". */
  rotulo: string;
}

/** A representação em vigor, no perfil da equipe (`GET /equipes/{id}`): `null` enquanto o supervisor responde pela equipe. */
export interface RepresentacaoDaEquipe {
  desde: string;
  motivo: MotivoDaRepresentacao;
  rotulo: string;
}

export const MOTIVO_DA_REPRESENTACAO: Record<MotivoDaRepresentacao, string> = {
  ausencia: "O supervisor está ausente.",
  inatividade: `O supervisor ficou ${DIAS_SEM_ATIVIDADE} dias sem usar o sistema.`,
};

/** A regra, em uma frase, para quem designa o representante. */
export const REGRA_DO_REPRESENTANTE = `O representante assume a supervisão da equipe quando o supervisor registra uma ausência ou fica ${DIAS_SEM_ATIVIDADE} dias sem usar o sistema, e a devolve quando ele volta.`;

export const desdeDaRepresentacao = (r: Pick<RepresentacaoDaEquipe, "desde">) => dataDoDia(r.desde.slice(0, 10));
