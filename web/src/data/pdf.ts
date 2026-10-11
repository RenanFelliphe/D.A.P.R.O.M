/** Dados fictícios do PDF de duas páginas da OS 4031187 (APR + registro da OS). */
import type { PessoaAssinatura } from "@/components/ui/Assinatura";

export interface CelulaPdf {
  rotulo: string;
  valor: string;
}

export const aprIdentificacao: CelulaPdf[] = [
  { rotulo: "APR", valor: "A-2210" },
  { rotulo: "Modelo", valor: "APR 03 · versão 4" },
  { rotulo: "Resultado", valor: "Aprovada" },
  { rotulo: "Alertas", valor: "1 (item 5)" },
  { rotulo: "Tipo de atividade", valor: "Z02-Manutenção Preventiva" },
  { rotulo: "Local de instalação", valor: "ERP Serra" },
  { rotulo: "Ordem", valor: "4031187" },
  { rotulo: "Concluída em", valor: "13/10/2026 09:24" },
];

export interface ParticipantePdf {
  pessoa: PessoaAssinatura;
  titulo: string;
  detalhe: string;
}

export const aprParticipantes: ParticipantePdf[] = [
  { pessoa: "carlos", titulo: "Carlos Menezes · Responsável", detalhe: "Matrícula 10482 · assinado em 13/10/2026 09:24" },
  { pessoa: "diego", titulo: "Diego Rocha · Executor", detalhe: "Matrícula 12077 · assinado em 13/10/2026 09:24" },
];

export const osCabecalho: CelulaPdf[] = [
  { rotulo: "Ordem", valor: "4031187" },
  { rotulo: "Emitida em", valor: "01/10/2026" },
  { rotulo: "Status da ordem", valor: "Encerrada" },
  { rotulo: "Registro digital", valor: "13/10/2026 12:41" },
  { rotulo: "Centro de trabalho", valor: "SERV_ESP · Serviços Especiais" },
  { rotulo: "Tipo de atividade", valor: "Z02-Manutenção Preventiva" },
  { rotulo: "Grupo de planejamento", valor: "Manutenção" },
  { rotulo: "Criado por", valor: "Helena Duarte" },
];

export const osObjetosTecnicos: CelulaPdf[] = [
  { rotulo: "Local de instalação", valor: "ERP Serra · Rod. BR-101, km 262, Serra/ES" },
  { rotulo: "Equipamento", valor: "VLV-ERP01-012" },
];

export const osNota = {
  rotulo: "Nota 10018842 · criada em 29/09/2026 · Helena Duarte",
  texto:
    "Inspeção de corrosão em válvulas da ERP. Inspecionar visualmente as válvulas V-101 a V-112, registrar com foto cada ponto de corrosão e aplicar inibidor onde a corrosão for superficial.",
};

export const osPlanejamento: CelulaPdf[] = [
  { rotulo: "Início programado", valor: "13/10/2026" },
  { rotulo: "Fim programado", valor: "15/10/2026" },
  { rotulo: "Prioridade", valor: "Muito alto" },
  { rotulo: "Criticidade", valor: "Local crítico" },
];

export const osExecucao: CelulaPdf[] = [
  { rotulo: "Início", valor: "13/10/2026 09:31" },
  { rotulo: "Fim", valor: "13/10/2026 11:18" },
  { rotulo: "Tempo total", valor: "1h47" },
  { rotulo: "Número de pessoas", valor: "2" },
  { rotulo: "Pausas", valor: "0h12 · 1 pausa" },
  { rotulo: "Tempo líquido", valor: "1h35" },
];

export const osAtividadeRealizada =
  "Inspecionadas as 12 válvulas. Corrosão superficial em V-104 e V-109, tratada com inibidor. Demais válvulas sem anomalias.";

export interface AssinaturaPdf {
  /** Sem `pessoa`, o espaço da assinatura fica em branco. */
  pessoa?: PessoaAssinatura;
  titulo: string;
  detalhe: string;
}

export const osAssinaturas: AssinaturaPdf[] = [
  { pessoa: "carlos", titulo: "Executante 1", detalhe: "Carlos Menezes · mat. 10482 · 11:18" },
  { pessoa: "diego", titulo: "Executante 2", detalhe: "Diego Rocha · mat. 12077 · 11:18" },
  { titulo: "Executante 3", detalhe: "Sem terceiro executante" },
  { pessoa: "carlos", titulo: "Responsável da manutenção", detalhe: "Carlos Menezes · líder técnico" },
  { titulo: "Supervisor (ciência)", detalhe: "Marcos Tavares · pendente" },
  { titulo: "Solicitante", detalhe: "Em branco" },
];

export const osFotos: string[] = [
  "13/10 09:52 · V-104 · -20,1834 / -40,2712",
  "13/10 10:07 · V-109 · -20,1835 / -40,2709",
  "13/10 10:41 · inibidor aplicado",
];
