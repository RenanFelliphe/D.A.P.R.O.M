/** Histórico de OS exibido na tela de perfil. */

export interface OsHistorico {
  numero: string;
  descricao: string;
  detalhe: string;
  situacao: "encerrada" | "execucao";
}

export const historicoOs: OsHistorico[] = [
  {
    numero: "OS 4031187",
    descricao: "Inspeção de corrosão em válvulas da ERP",
    detalhe: "13/10 · 1h35 líquidos · PDF gerado",
    situacao: "encerrada",
  },
  {
    numero: "OS 4031190",
    descricao: "Calibração da PSV da linha 2",
    detalhe: "Iniciada 13/10 às 11:26",
    situacao: "execucao",
  },
  {
    numero: "OS 4030812",
    descricao: "Inspeção de filtro na ERS Vila Velha 02",
    detalhe: "09/10 · 1h20 líquidos · PDF gerado",
    situacao: "encerrada",
  },
  {
    numero: "OS 4030733",
    descricao: "Pintura de identificação da tubulação",
    detalhe: "07/10 · 2h05 líquidos · PDF gerado",
    situacao: "encerrada",
  },
];
