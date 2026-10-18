/**
 * Motivos de pausa e de suspensão do Campo de treino: os mesmos de `api/src/dominio/motivos-de-parada.ts` (e de `PAUSA_MOTIVOS` e
 * `SUSPENSAO_MOTIVOS` do esquema), com os textos que a linha do tempo mostra. Pausar e suspender passaram a exigir o motivo
 * (Reunião 3); "aguardando" e "outro" pedem também um complemento.
 */

export const PAUSA_MOTIVOS = ["almoco", "aguardando", "descanso", "clima", "enfermidade", "lesao", "outro"] as const;
export type MotivoDaPausa = (typeof PAUSA_MOTIVOS)[number];

export const SUSPENSAO_MOTIVOS = ["enfermidade", "lesao", "fim_expediente", "clima", "falta_material", "outro"] as const;
export type MotivoDaSuspensao = (typeof SUSPENSAO_MOTIVOS)[number];

export const ROTULO_DA_PAUSA: Record<MotivoDaPausa, string> = {
  almoco: "Almoço",
  aguardando: "Aguardando",
  descanso: "Descanso",
  clima: "Condição climática",
  enfermidade: "Enfermidade",
  lesao: "Lesão",
  outro: "Outro",
};

export const ROTULO_DA_SUSPENSAO: Record<MotivoDaSuspensao, string> = {
  enfermidade: "Enfermidade",
  lesao: "Lesão",
  fim_expediente: "Fim de expediente",
  clima: "Condição climática",
  falta_material: "Falta de material ou equipamento",
  outro: "Outro",
};

/** Os motivos que pedem uma explicação: "Aguardando" (o que ou quem) e "Outro" (a descrição). */
export const pedeComplemento = (motivo: string) => motivo === "aguardando" || motivo === "outro";

/** Lesão e enfermidade: o supervisor é avisado na hora, e o relatório os traz. */
export const ehMotivoDeSaude = (motivo: string | null | undefined): motivo is "lesao" | "enfermidade" => motivo === "lesao" || motivo === "enfermidade";

/** "Almoço", "Aguardando: peça do almoxarifado", "Outro: trânsito": o motivo com o complemento, para listas e avisos. */
export function descreverMotivo(rotulos: Record<string, string>, motivo: string | null, complemento: string | null): string {
  if (!motivo) return "sem motivo informado";
  const nome = rotulos[motivo] ?? motivo;
  return complemento?.trim() ? `${nome}: ${complemento.trim()}` : nome;
}
