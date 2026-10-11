import type { BadgeTone } from "@/components/ui/Badge";
import type { IconName } from "@/components/ui/Icon";
import { rotas } from "@/lib/telas";

/** Indicador do topo do quadro. `cor` gera a bolinha; `icone` substitui a bolinha. */
export interface KpiQuadro {
  rotulo: string;
  cor?: string;
  icone?: IconName;
  valor: string;
  sub: string;
  /** Tom do texto de apoio (vermelho de bloqueio ou verde de encerrada). */
  subTom?: "blq" | "enc";
}

export const kpisQuadro: KpiQuadro[] = [
  { rotulo: "Liberadas", cor: "#1C5CAB", valor: "18", sub: "7 em locais críticos" },
  { rotulo: "Em execução", cor: "#C98500", valor: "4", sub: "último registro de campo 12:38" },
  { rotulo: "Pendentes", cor: "#D03B3B", valor: "3", sub: "3 aguardam nova APR", subTom: "blq" },
  { rotulo: "Encerradas no mês", cor: "#0CA30C", valor: "41", sub: "+6 vs. setembro", subTom: "enc" },
  { rotulo: "Preventivas atrasadas", icone: "clock", valor: "5", sub: "2 sem justificativa", subTom: "blq" },
];

export interface FiltroQuadro {
  id: string;
  rotulo: string;
  opcoes: string[];
}

export const filtrosQuadro: FiltroQuadro[] = [
  { id: "f-eq", rotulo: "Equipe", opcoes: ["Serviços Especiais", "Instrumentação", "Manutenção Civil"] },
  { id: "f-tp", rotulo: "Tipo", opcoes: ["Todos", "Preventiva", "Corretiva"] },
  { id: "f-cr", rotulo: "Criticidade", opcoes: ["Todas", "Só críticas"] },
  { id: "f-pe", rotulo: "Período", opcoes: ["Outubro de 2026", "Setembro de 2026"] },
];

export interface OsQuadro {
  os: string;
  tipo: "Preventiva" | "Corretiva";
  critico?: boolean;
  titulo: string;
  local: string;
  /** Linha de detalhe sob o local. */
  detalhe: string;
  /** Cor/peso da linha de detalhe. */
  detalheTom?: "exe" | "enc" | "ink2";
  detalheIcone?: IconName;
  /** Selo no rodapé do cartão (OS pendentes). */
  selo?: string;
  /** Destino do cartão; sem destino o cartão é um botão. */
  href?: string;
  /** Mensagem mostrada ao clicar num cartão sem destino. */
  aviso?: string;
}

export interface ColunaQuadroDados {
  id: string;
  titulo: string;
  icone: IconName;
  iconeCheio?: boolean;
  /** Variável CSS de cor do ícone do cabeçalho. */
  iconeCor: string;
  tomBadge: BadgeTone;
  total: string;
  cartoes: OsQuadro[];
  /** Texto "Mais N OS" ao final da coluna. */
  mais?: string;
}

export const colunasQuadro: ColunaQuadroDados[] = [
  {
    id: "liberada",
    titulo: "Liberada",
    icone: "lock",
    iconeCor: "var(--lib)",
    tomBadge: "lib",
    total: "18",
    cartoes: [
      { os: "4031204", tipo: "Preventiva", aviso: "Esta OS está na área de demonstração do app (ERP Serra).", critico: true, titulo: "Teste de estanqueidade do filtro F-201", local: "ERP Serra", detalhe: "Prog. 13/10 · APR 03 ainda não feita" },
      { os: "4031230", tipo: "Preventiva", aviso: "Fora do roteiro desta demonstração.", critico: true, titulo: "Inspeção do sistema de odorização", local: "PR Cariacica", detalhe: "Prog. 14/10 · APR 03" },
      { os: "4031241", tipo: "Corretiva", aviso: "Fora do roteiro desta demonstração.", critico: true, titulo: "Troca de manômetro com leitura instável", local: "ERS Vila Velha 02", detalhe: "Prog. 14/10 · APR 03" },
      { os: "4031255", tipo: "Preventiva", aviso: "Fora do roteiro desta demonstração.", titulo: "Pintura de identificação da tubulação", local: "Rede Vitória Centro", detalhe: "Prog. 16/10 · APR 03" },
    ],
    mais: "Mais 14 OS",
  },
  {
    id: "execucao",
    titulo: "Em execução",
    icone: "play",
    iconeCheio: true,
    iconeCor: "var(--exe)",
    tomBadge: "exe",
    total: "4",
    cartoes: [
      { os: "4031190", tipo: "Preventiva", aviso: "Em execução no campo, sem registro novo até a próxima sincronização.", critico: true, titulo: "Calibração da PSV da linha 2", local: "ERP Serra", detalhe: "Iniciada 11:26 · Carlos Menezes", detalheTom: "exe" },
      { os: "4031012", tipo: "Corretiva", aviso: "Em execução no campo.", critico: true, titulo: "Vazamento em conexão do medidor industrial", local: "Mineração Atlântica", detalhe: "Iniciada 08:41 · Fernanda Lopes", detalheTom: "exe" },
      { os: "4031176", tipo: "Preventiva", aviso: "Em execução no campo.", titulo: "Inspeção de proteção catódica", local: "Rede Serra Norte", detalhe: "Iniciada 10:05 · Paulo Ribeiro", detalheTom: "exe" },
    ],
    mais: "Mais 1 OS",
  },
  {
    id: "pendente",
    titulo: "Pendente",
    icone: "octagon",
    iconeCor: "var(--blq)",
    tomBadge: "blq",
    total: "3",
    cartoes: [
      { os: "4030877", tipo: "Corretiva", titulo: "DCV Desobstrução de caixa de válvula", local: "Rede Vila Velha", detalhe: "Caixa de válvula alagada · desde 12/10", detalheTom: "ink2", selo: "Aguardando nova APR", href: rotas.web.alertas },
      { os: "4030655", tipo: "Preventiva", critico: true, titulo: "Inspeção de válvula na área industrial", local: "Celulose Capixaba", detalhe: "Dedetização concluída pela OS de apoio", detalheTom: "ink2", selo: "Apoio concluído", href: rotas.web.alertas },
      { os: "4030990", tipo: "Corretiva", titulo: "Reparo em válvula de bloqueio", local: "Rede Serra Norte", detalhe: "Execução interrompida: odor de gás · hoje 10:52", detalheTom: "ink2", selo: "Aguardando nova APR", href: rotas.web.alertas },
    ],
  },
  {
    id: "encerrada",
    titulo: "Encerrada",
    icone: "check",
    iconeCor: "var(--enc)",
    tomBadge: "enc",
    total: "41",
    cartoes: [
      { os: "4031187", tipo: "Preventiva", critico: true, titulo: "Inspeção de corrosão em válvulas da ERP", local: "ERP Serra", detalhe: "Hoje 11:18 · PDF pronto", detalheTom: "enc", detalheIcone: "file", href: rotas.web.detalhe },
      { os: "4030951", tipo: "Preventiva", aviso: "Já exportada ao SAP em 12/10.", critico: true, titulo: "Pintura anticorrosiva de suportes", local: "ERS Vila Velha 02", detalhe: "12/10 · exportada ao SAP", detalheTom: "enc" },
      { os: "4030934", tipo: "Corretiva", aviso: "Já exportada ao SAP em 11/10.", titulo: "Limpeza de filtro cesto", local: "Rede Vila Velha", detalhe: "11/10 · exportada ao SAP", detalheTom: "enc" },
    ],
    mais: "Mais 38 OS",
  },
];
