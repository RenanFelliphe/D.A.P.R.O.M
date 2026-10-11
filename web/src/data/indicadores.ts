/** Dados fictícios da tela de indicadores e exportação. */

export type ChaveSituacao = "encerradas" | "abertas" | "comJustificativa" | "semJustificativa";

export interface Situacao {
  chave: ChaveSituacao;
  nome: string;
  cor: string;
}

/** Ordem de empilhamento das barras e da legenda. */
export const situacoes: Situacao[] = [
  { chave: "encerradas", nome: "Encerradas", cor: "#0CA30C" },
  { chave: "abertas", nome: "Abertas no prazo", cor: "#2A78D6" },
  { chave: "comJustificativa", nome: "Atrasadas com justificativa", cor: "#C98500" },
  { chave: "semJustificativa", nome: "Atrasadas sem justificativa", cor: "#D03B3B" },
];

export interface EquipePreventivas {
  nome: string;
  situacao: Record<ChaveSituacao, number>;
  tempo: {
    liquidoMedio: string;
    pausaMedia: string;
    pausaNoTotal: string;
  };
}

export const equipes: EquipePreventivas[] = [
  {
    nome: "Serviços Especiais",
    situacao: { encerradas: 38, abertas: 3, comJustificativa: 3, semJustificativa: 2 },
    tempo: { liquidoMedio: "1h52", pausaMedia: "0h18", pausaNoTotal: "14%" },
  },
  {
    nome: "Instrumentação",
    situacao: { encerradas: 41, abertas: 6, comJustificativa: 3, semJustificativa: 2 },
    tempo: { liquidoMedio: "1h31", pausaMedia: "0h12", pausaNoTotal: "12%" },
  },
  {
    nome: "Manutenção Civil",
    situacao: { encerradas: 42, abertas: 4, comJustificativa: 9, semJustificativa: 3 },
    tempo: { liquidoMedio: "2h10", pausaMedia: "0h22", pausaNoTotal: "14%" },
  },
  {
    nome: "Inspeção de Rede",
    situacao: { encerradas: 30, abertas: 3, comJustificativa: 4, semJustificativa: 1 },
    tempo: { liquidoMedio: "3h05", pausaMedia: "0h35", pausaNoTotal: "16%" },
  },
  {
    nome: "Atendimento Residencial",
    situacao: { encerradas: 13, abertas: 2, comJustificativa: 2, semJustificativa: 1 },
    tempo: { liquidoMedio: "1h12", pausaMedia: "0h10", pausaNoTotal: "12%" },
  },
];

export function totalEquipe(equipe: EquipePreventivas): number {
  return situacoes.reduce((soma, s) => soma + equipe.situacao[s.chave], 0);
}

/** Valor máximo do eixo do gráfico (as barras ocupam total/máximo da trilha). */
export const maximoEixo = 60;

/** Marcas do eixo horizontal do gráfico. */
export const marcasEixo = [0, 20, 40, 60];

/** Percentual com até 2 casas, sem zeros à direita (ex.: 76.67%, 30%). */
export function percentualDoEixo(valor: number): string {
  return `${Number(((valor / maximoEixo) * 100).toFixed(2))}%`;
}

export interface OsParaExportar {
  ordem: string;
  atividade: string;
  equipe: string;
  encerradaEm: string;
  /** Só a primeira linha do protótipo liga a ordem ao detalhe da OS. */
  linkDetalhe?: boolean;
}

/** Quantidade de OS encerradas ainda não exportadas (o protótipo mostra 5 linhas). */
export const totalPendentesExportacao = 12;

export const osParaExportar: OsParaExportar[] = [
  { ordem: "4031187", atividade: "Inspeção de corrosão em válvulas da ERP", equipe: "Serviços Especiais", encerradaEm: "13/10 11:18", linkDetalhe: true },
  { ordem: "4031166", atividade: "Calibração de manômetros da ERS", equipe: "Instrumentação", encerradaEm: "13/10 10:02" },
  { ordem: "4031149", atividade: "Recomposição de calçada após reparo", equipe: "Manutenção Civil", encerradaEm: "13/10 09:47" },
  { ordem: "4031121", atividade: "Inspeção de rede com detector de gás", equipe: "Inspeção de Rede", encerradaEm: "12/10 18:22" },
  { ordem: "4031098", atividade: "Conversão de fogão em residência", equipe: "Atendimento Residencial", encerradaEm: "12/10 17:40" },
];
