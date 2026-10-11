/** Dados fictícios da tela de importação SAP. */

export interface LinhaIgnorada {
  linha: number;
  ordem: string;
  centro: string;
  motivo: string;
}

export interface ImportacaoAnterior {
  data: string;
  arquivo: string;
  responsavel: string;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
}

export const colunasLidas = [
  "Ordem e nota",
  "Tipo de ordem (YBA1 / YBA2)",
  "Centro de trabalho → equipe",
  "Local de instalação e endereço",
  "Equipamento",
  "Início e fim programados",
  "Prioridade",
  "Descrição, materiais e ferramentas",
];

const semEquipe = "Centro de trabalho sem equipe cadastrada";
const semOrdem = "Linha sem número de ordem";

export const linhasIgnoradas: LinhaIgnorada[] = [
  { linha: 14, ordem: "4031322", centro: "LAB_QUI", motivo: semEquipe },
  { linha: 29, ordem: "4031327", centro: "LAB_QUI", motivo: semEquipe },
  { linha: 57, ordem: "—", centro: "SERV_ESP", motivo: semOrdem },
  { linha: 103, ordem: "4031340", centro: "LAB_QUI", motivo: semEquipe },
  { linha: 188, ordem: "—", centro: "INSTRUM", motivo: semOrdem },
];

export const importacoesAnteriores: ImportacaoAnterior[] = [
  { data: "13/10 07:41", arquivo: "export_ordens_2026-10-13.xlsx", responsavel: "Ana Ribeiro", criadas: 37, atualizadas: 368, ignoradas: 7 },
  { data: "06/10 07:35", arquivo: "export_ordens_2026-10-06.xlsx", responsavel: "Ana Ribeiro", criadas: 52, atualizadas: 331, ignoradas: 4 },
  { data: "01/10 08:02", arquivo: "export_ordens_2026-10-01.xlsx", responsavel: "Ana Ribeiro", criadas: 389, atualizadas: 0, ignoradas: 11 },
];
