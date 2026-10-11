/** Dados fictícios da tela de modelos de APR. */

export interface ModeloApr {
  /** Número exibido após "APR " (ex.: "03"). */
  numero: string;
  versao: string;
  titulo: string;
  perguntas: number;
  /** Modelo aberto no editor. */
  atual?: boolean;
}

export const modelosApr: ModeloApr[] = [
  { numero: "01", versao: "v3", titulo: "Operação", perguntas: 16 },
  { numero: "02", versao: "v3", titulo: "Instrumentação", perguntas: 15 },
  { numero: "03", versao: "v4 · rascunho v5", titulo: "Operação e manutenção", perguntas: 18, atual: true },
  { numero: "04", versao: "v3", titulo: "Construção de rede de distribuição", perguntas: 21 },
  { numero: "05", versao: "v3", titulo: "Conversão de clientes", perguntas: 14 },
  { numero: "06", versao: "v3", titulo: "Altura e espaço confinado", perguntas: 24 },
  { numero: "07", versao: "v3", titulo: "Inspeção de rede", perguntas: 12 },
  { numero: "09", versao: "v1", titulo: "Movimentação de almoxarifado", perguntas: 11 },
];

export interface VersaoModelo {
  titulo: string;
  detalhe: string;
}

export const versoesApr03: VersaoModelo[] = [
  { titulo: "v5 · rascunho", detalhe: "Luciana Prado · hoje · 1 pergunta nova" },
  { titulo: "v4 · em uso", detalhe: "Publicada em 02/09/2026 · 312 APRs" },
  { titulo: "v3 · carga inicial", detalhe: "A partir da REV 03 em papel · 97 APRs" },
];

export interface AtividadeModelo {
  atividade: string;
  modelo: string;
}

export const atividadesModelo: AtividadeModelo[] = [
  { atividade: "8.7.1 · Drenagem Caixa de Válvula", modelo: "APR 03" },
  { atividade: "8.7.10 · Roçagem Semestral", modelo: "APR 03" },
  { atividade: "8.6.1 · Calibração AIT COGN", modelo: "APR 02" },
  { atividade: "8.2.3 · Inspeção Visual – Tubulação", modelo: "APR 03" },
];

export type TipoPergunta = "elim" | "alt";

export const rotuloTipoPergunta: Record<TipoPergunta, string> = {
  elim: "Eliminatório",
  alt: "Alerta",
};

export interface PerguntaApr {
  numero: number;
  texto: string;
  secao: string;
  /** Resposta que dispara o tipo (Sim, Não ou "—" quando não há). */
  respostaCritica: string;
  tipo: TipoPergunta;
  /** Pergunta incluída no rascunho da v5. */
  novaNaV5?: boolean;
}

export const perguntasApr03: PerguntaApr[] = [
  { numero: 1, texto: "Todos os participantes estão em boas condições físicas e psicológicas?", secao: "Verificação", respostaCritica: "Não", tipo: "elim" },
  { numero: 2, texto: "Todos usam EPI completo e em bom estado?", secao: "Verificação", respostaCritica: "Não", tipo: "elim" },
  { numero: 3, texto: "A atividade será feita em dupla, com responsável definido?", secao: "Verificação", respostaCritica: "Não", tipo: "elim" },
  { numero: 4, texto: "Os participantes estão sem adornos (anéis, correntes, relógio)?", secao: "Verificação", respostaCritica: "Não", tipo: "elim" },
  { numero: 5, texto: "Há necessidade de iluminação auxiliar?", secao: "Verificação", respostaCritica: "Sim", tipo: "alt" },
  { numero: 6, texto: "A equipe sabe onde fica o atendimento médico mais próximo?", secao: "Verificação", respostaCritica: "Não", tipo: "elim" },
  { numero: 7, texto: "A equipe está apta a realizar um resgate de emergência no local?", secao: "Verificação", respostaCritica: "Não", tipo: "elim" },
  { numero: 8, texto: "Os equipamentos elétricos são adequados para atmosfera com gás?", secao: "Verificação", respostaCritica: "Não", tipo: "elim" },
  { numero: 9, texto: "Existe algum impedimento para realizar a atividade?", secao: "Verificação", respostaCritica: "Sim", tipo: "elim" },
  { numero: 10, texto: "Os participantes conhecem o plano de emergência do cliente?", secao: "Verificação", respostaCritica: "Não", tipo: "elim", novaNaV5: true },
  { numero: 11, texto: "Sinalizar e isolar a área de trabalho", secao: "Medida preventiva", respostaCritica: "—", tipo: "alt" },
];

export const verificacoesModelo = [
  "10 itens eliminatórios (mínimo 1)",
  "Toda pergunta de verificação tem resposta crítica",
  "Ordem sequencial definida",
];
