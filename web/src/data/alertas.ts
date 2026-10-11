interface AlertaBase {
  /** Rótulo do tipo (ex.: "APR bloqueada"). */
  tipo: string;
  quando: string;
  os: string;
  local: string;
  resumo: string;
  naoLido: boolean;
  titulo: string;
  /** Texto do selo no topo do detalhe. */
  badge: string;
}

/** Alerta de impedimento: a OS ficou pendente e exige decisão do supervisor. */
export interface AlertaBloqueio extends AlertaBase {
  natureza: "bloq";
  endereco: string;
  equipe: string;
  /** Quando aconteceu, no campo e no servidor. */
  quandoDetalhe: string;
  itemRotulo: string;
  /** Texto do item; `destaque` (resposta em vermelho) vem logo depois, se houver. */
  item: { texto: string; destaque?: string };
  observacao: string;
  foto: string;
  /** Texto sugerido para a OS de apoio. */
  apoio: string;
  nota: string;
}

/** Alerta informativo (apoio encerrado, conflito, duplicidade). */
export interface AlertaInformativo extends AlertaBase {
  natureza: "info";
  mensagem: string;
  /** Rótulo do botão de ação. */
  acao: string;
}

export type Alerta = AlertaBloqueio | AlertaInformativo;

export const alertas: Alerta[] = [
  {
    natureza: "bloq",
    tipo: "APR bloqueada",
    quando: "12/10 09:14",
    os: "4030877",
    local: "Rede Vila Velha",
    resumo: "Caixa de válvula alagada. Precisa de bombeamento antes.",
    naoLido: true,
    titulo: "DCV Desobstrução de caixa de válvula",
    endereco: "Rede Vila Velha · Av. Champagnat, 1100",
    equipe: "Carlos Menezes (responsável) e Diego Rocha",
    quandoDetalhe: "12/10 às 09:14 no campo · recebido às 10:02",
    itemRotulo: "Item que bloqueou · pergunta 9 · eliminatório",
    item: { texto: "Existe algum impedimento para realizar a atividade?", destaque: "Sim" },
    observacao:
      "Caixa de válvula com água até a borda. É preciso bombeamento e limpeza pela manutenção civil antes da intervenção.",
    foto: "09:14",
    apoio: "Bombear e limpar a caixa de válvula para liberar a OS 4030877.",
    badge: "APR bloqueada",
    nota: "Atraso desta OS conta como justificado no indicador do mês.",
  },
  {
    natureza: "bloq",
    tipo: "Execução interrompida",
    quando: "hoje 10:52",
    os: "4030990",
    local: "Rede Serra Norte",
    resumo: "Odor de gás percebido durante o reparo. Área isolada.",
    naoLido: true,
    titulo: "Reparo em válvula de bloqueio",
    endereco: "Rede Serra Norte · Rua das Palmeiras, 320",
    equipe: "Paulo Ribeiro (responsável) e Marcelo Dias",
    quandoDetalhe: "hoje às 10:52 no campo · recebido às 12:40",
    itemRotulo: "Motivo da interrupção",
    item: { texto: "Condição de risco durante a execução: odor de gás percebido." },
    observacao: "Odor de gás percebido ao abrir a válvula. Área isolada e equipe afastada. Aguardando equipe de emergência.",
    foto: "10:52",
    apoio: "Verificar vazamento e liberar a área para o reparo da OS 4030990.",
    badge: "Execução interrompida",
    nota: "Atraso desta OS conta como justificado no indicador do mês.",
  },
  {
    natureza: "info",
    tipo: "Apoio encerrado",
    quando: "hoje 08:15",
    os: "4030655",
    local: "Celulose Capixaba",
    resumo: "Dedetização concluída pela OS de apoio 4031301. A original já pode receber nova APR.",
    naoLido: true,
    titulo: "Inspeção de válvula na área industrial",
    badge: "Apoio encerrado",
    mensagem:
      "A OS de apoio 4031301 (dedetização, equipe externa) foi encerrada hoje às 08:15. A OS original continua pendente: a equipe já pode fazer uma nova APR, e reprogramar é opcional.",
    acao: "Reprogramar OS 4030655",
  },
  {
    natureza: "info",
    tipo: "Conflito de planejamento",
    quando: "ontem 17:20",
    os: "4031012",
    local: "Mineração Atlântica",
    resumo: "Reatribuída na web enquanto o técnico estava sem sinal. Registro de campo mantido.",
    naoLido: false,
    titulo: "Vazamento em conexão do medidor industrial",
    badge: "Conflito de planejamento",
    mensagem:
      "A OS foi reatribuída na web enquanto o técnico estava sem sinal. A execução feita em campo foi aplicada mesmo assim: conflito vira alerta, nunca sobrescrita.",
    acao: "Abrir a OS",
  },
  {
    natureza: "info",
    tipo: "Execução duplicada",
    quando: "08/10 15:03",
    os: "4030802",
    local: "ERS Vila Velha 02",
    resumo: "Duas execuções feitas sem sinal. Vale a primeira encerrada.",
    naoLido: false,
    titulo: "Inspeção de filtro",
    badge: "Execução duplicada",
    mensagem: "Duas pessoas executaram a mesma OS sem sinal. As duas execuções ficam guardadas; vale a primeira encerrada.",
    acao: "Abrir a OS",
  },
];

/** Índice do alerta selecionado ao abrir a tela. */
export const alertaSelecionadoInicial = 0;

/** Texto do contador do cabeçalho, ex.: "3 não lidos". */
export function textoNaoLidos(lista: Alerta[]): string {
  const n = lista.filter((a) => a.naoLido).length;
  return `${n} ${n === 1 ? "não lido" : "não lidos"}`;
}
