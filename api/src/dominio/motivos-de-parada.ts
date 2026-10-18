import { MOTIVOS_DE_SAUDE, PAUSA_MOTIVOS, SUSPENSAO_MOTIVOS } from "../db/schema";

export type MotivoDaPausa = (typeof PAUSA_MOTIVOS)[number];
export type MotivoDaSuspensao = (typeof SUSPENSAO_MOTIVOS)[number];

/** O texto de cada motivo da pausa, como a lista da tela, o relatório da execução e a linha do tempo o mostram. */
export const ROTULO_DA_PAUSA: Record<MotivoDaPausa, string> = {
  almoco: "Almoço",
  aguardando: "Aguardando",
  descanso: "Descanso",
  clima: "Condição climática",
  enfermidade: "Enfermidade",
  lesao: "Lesão",
  outro: "Outro",
};

/** O texto de cada motivo da suspensão (mais críticos que os da pausa: o serviço não continua hoje). */
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
export const ehMotivoDeSaude = (motivo: string | null | undefined): motivo is (typeof MOTIVOS_DE_SAUDE)[number] =>
  motivo === "lesao" || motivo === "enfermidade";

/** "Almoço", "Aguardando: peça do almoxarifado", "Outro: trânsito": o motivo com o complemento, para listas e avisos. */
export function descreverMotivo(rotulos: Record<string, string>, motivo: string | null, complemento: string | null): string {
  if (!motivo) return "sem motivo informado";
  const nome = rotulos[motivo] ?? motivo;
  return complemento?.trim() ? `${nome}: ${complemento.trim()}` : nome;
}
