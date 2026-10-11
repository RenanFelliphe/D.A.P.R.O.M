import type { PessoaAssinatura } from "@/components/ui/Assinatura";

export interface DadoSap {
  rotulo: string;
  valor: string;
  mono?: boolean;
}

export const dadosSap: DadoSap[] = [
  { rotulo: "Ordem", valor: "4031187", mono: true },
  { rotulo: "Nota", valor: "10018842", mono: true },
  { rotulo: "Tipo de atividade", valor: "Z02-Manutenção Preventiva" },
  { rotulo: "Centro de trabalho", valor: "SERV_ESP", mono: true },
  { rotulo: "Equipamento", valor: "VLV-ERP01-012", mono: true },
  { rotulo: "Prioridade", valor: "Muito alto" },
  { rotulo: "Início programado", valor: "13/10/2026" },
  { rotulo: "Fim programado", valor: "15/10/2026" },
  { rotulo: "Origem", valor: "Importação nº 12 · 01/10" },
];

export interface ParticipanteApr {
  iniciais: string;
  nome: string;
  detalhe: string;
  /** Variante de cor do avatar (.av2). */
  alternativo?: boolean;
}

export const participantesApr: ParticipanteApr[] = [
  { iniciais: "CM", nome: "Carlos Menezes", detalhe: "Responsável · mat. 10482 · assinou 09:24" },
  { iniciais: "DR", nome: "Diego Rocha", detalhe: "Executor · mat. 12077 · assinou 09:24", alternativo: true },
];

export interface ItemAprResumo {
  numero: string;
  item: string;
  tipo: string;
  resposta: string;
  /** Item de alerta: linha e resposta ganham o tom de alerta. */
  alerta?: boolean;
}

export const itensApr: ItemAprResumo[] = [
  { numero: "1", item: "Todos os participantes estão em boas condições físicas e psicológicas?", tipo: "Eliminatório", resposta: "Sim" },
  { numero: "4", item: "Os participantes estão sem adornos (anéis, correntes, relógio)?", tipo: "Eliminatório", resposta: "Sim" },
  { numero: "5", item: "Há necessidade de iluminação auxiliar?", tipo: "Alerta", resposta: "Sim · alerta", alerta: true },
  { numero: "7", item: "A equipe está apta a realizar um resgate de emergência no local?", tipo: "Eliminatório", resposta: "Sim" },
  { numero: "9", item: "Existe algum impedimento para realizar a atividade?", tipo: "Eliminatório", resposta: "Não" },
  { numero: "11", item: "Usar detector de gás calibrado durante toda a atividade", tipo: "Medida preventiva", resposta: "Sim" },
];

export interface MedidaExecucao {
  rotulo: string;
  valor: string;
}

export const medidasExecucao: MedidaExecucao[] = [
  { rotulo: "Início", valor: "13/10 · 09:31" },
  { rotulo: "Fim", valor: "13/10 · 11:18" },
  { rotulo: "Tempo total", valor: "1h47" },
  { rotulo: "Pausas", valor: "0h12 · 1 pausa" },
  { rotulo: "Tempo líquido", valor: "1h35" },
  { rotulo: "Pessoas", valor: "2" },
  { rotulo: "Recebida no servidor", valor: "13/10 · 12:40" },
];

export interface FotoExecucao {
  hora: string;
  legenda: string;
}

export const fotosExecucao: FotoExecucao[] = [
  { hora: "09:52", legenda: "V-104 · -20,1834 / -40,2712" },
  { hora: "10:07", legenda: "V-109 · -20,1835 / -40,2709" },
  { hora: "10:41", legenda: "Inibidor aplicado" },
];

export interface AssinaturaExecucao {
  papel: string;
  pessoa: PessoaAssinatura;
  legenda: string;
}

export const assinaturasExecucao: AssinaturaExecucao[] = [
  { papel: "Executante · responsável", pessoa: "carlos", legenda: "Carlos Menezes · mat. 10482 · 11:18" },
  { papel: "Executante", pessoa: "diego", legenda: "Diego Rocha · mat. 12077 · 11:18" },
];

export interface EventoLinhaDoTempo {
  quando: string;
  titulo: string;
  detalhe: string;
  cor: string;
}

export const linhaDoTempo: EventoLinhaDoTempo[] = [
  { quando: "01/10 08:02", titulo: "Importada do SAP", detalhe: "Importação nº 12 · Ana Ribeiro, analista", cor: "#9AA29A" },
  { quando: "12/10 14:05", titulo: "APR #A-2198 bloqueada", detalhe: "OS ficou pendente · supervisor avisado", cor: "#D03B3B" },
  { quando: "13/10 07:58", titulo: "Baixada no aparelho", detalhe: "Celular de Carlos Menezes", cor: "#9AA29A" },
  { quando: "13/10 09:24", titulo: "APR #A-2210 aprovada", detalhe: "Nova APR; a #A-2198 fica no histórico", cor: "#0CA30C" },
  { quando: "13/10 09:31", titulo: "Execução iniciada", detalhe: "Horário do aparelho", cor: "#C98500" },
  { quando: "13/10 10:15", titulo: "Pausa de 12 min", detalhe: "Retomada às 10:27 · não entra no tempo líquido", cor: "#C98500" },
  { quando: "13/10 11:18", titulo: "Execução encerrada", detalhe: "3 fotos e assinatura", cor: "#0CA30C" },
  { quando: "13/10 12:40", titulo: "Recebida no servidor", detalhe: "Sincronização após 4h26 sem sinal", cor: "#1C5CAB" },
  { quando: "13/10 12:41", titulo: "PDF gerado", detalhe: "OS-4031187.pdf", cor: "#1C5CAB" },
];
