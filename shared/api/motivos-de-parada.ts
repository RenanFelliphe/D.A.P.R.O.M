/**
 * Os motivos que a pessoa escolhe ao pausar e ao suspender a execução, como a `api` os grava (`pausa_iniciada.motivo` e
 * `execucao_suspensa.motivo`), com o texto de cada um. Usados pela gestão (detalhe da OS, relatório, dashboards) e pelo Campo de
 * treino; a tela do técnico em campo tem a própria lista, com os campos de complemento.
 */

export const MOTIVOS_DA_PAUSA = ["almoco", "aguardando", "descanso", "clima", "enfermidade", "lesao", "outro"] as const;
export type MotivoDaPausa = (typeof MOTIVOS_DA_PAUSA)[number];

export const MOTIVOS_DA_SUSPENSAO = ["enfermidade", "lesao", "fim_expediente", "clima", "falta_material", "outro"] as const;
export type MotivoDaSuspensao = (typeof MOTIVOS_DA_SUSPENSAO)[number];

export const rotuloDoMotivoDaPausa: Record<MotivoDaPausa, string> = {
  almoco: "Almoço",
  aguardando: "Aguardando",
  descanso: "Descanso",
  clima: "Condição climática",
  enfermidade: "Enfermidade",
  lesao: "Lesão",
  outro: "Outro",
};

export const rotuloDoMotivoDaSuspensao: Record<MotivoDaSuspensao, string> = {
  enfermidade: "Enfermidade",
  lesao: "Lesão",
  fim_expediente: "Fim de expediente",
  clima: "Condição climática",
  falta_material: "Falta de material ou equipamento",
  outro: "Outro",
};

/** Lesão e enfermidade (na pausa ou na suspensão): acidente de trabalho em potencial; o supervisor é avisado na hora e o relatório destaca. */
export const ehMotivoDeSaude = (motivo: string | null | undefined): boolean => motivo === "lesao" || motivo === "enfermidade";

/**
 * "Almoço", "Aguardando: peça do almoxarifado": o motivo com o complemento, para listas. Motivo desconhecido (uma pausa antiga ou um
 * código novo) aparece como veio; sem motivo, "sem motivo informado".
 */
export function descreverMotivo(rotulos: Record<string, string>, motivo: string | null, complemento: string | null): string {
  if (!motivo) return "sem motivo informado";
  const nome = rotulos[motivo] ?? motivo;
  return complemento?.trim() ? `${nome}: ${complemento.trim()}` : nome;
}
