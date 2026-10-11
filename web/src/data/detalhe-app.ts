/** Dados da tela "Detalhe da OS" do app. */

export interface CampoSap {
  rotulo: string;
  valor: string;
  /** Valor em fonte monoespaçada (códigos). */
  mono?: boolean;
}

export const camposSap: CampoSap[] = [
  { rotulo: "Ordem", valor: "4031187", mono: true },
  { rotulo: "Nota", valor: "10018842", mono: true },
  { rotulo: "Centro de trabalho", valor: "SERV_ESP", mono: true },
  { rotulo: "Equipamento", valor: "VLV-ERP01-012", mono: true },
  { rotulo: "Início programado", valor: "13/10/2026" },
  { rotulo: "Fim programado", valor: "15/10/2026" },
];

export const ferramentasOs = ["Escova de aço", "Inibidor de corrosão", "Medidor de espessura", "Detector de gás"];
