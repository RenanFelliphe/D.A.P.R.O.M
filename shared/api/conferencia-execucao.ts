/**
 * A conferência da execução (`funcionalidades/execucao-compartilhada.md`, etapa 3): o que a equipe registrou sem sinal, em aparelhos
 * diferentes, vira **um** registro certo. Quando todos sincronizam, a `api` compara a versão de cada aparelho; sem divergência é um
 * resumo com ciência, com divergência o responsável escolhe a versão certa e os demais assinam. A `api`, a `web` e o app usam este arquivo.
 */

/** Dois horários a menos que isto um do outro valem como o mesmo (o relógio de dois aparelhos nunca bate no segundo). */
export const TOLERANCIA_MS = 5 * 60_000;
/** Os avisos a quem ainda falta (sincronizar ou assinar), em horas desde que a conferência abriu. */
export const AVISAR_FALTANTES_EM_HORAS = [24, 48] as const;
/** Depois disto o responsável ou o supervisor pode "fechar com o que existe". */
export const LIBERAR_FECHAMENTO_EM_MS = 72 * 3_600_000;
/** Depois disto a conferência fecha sozinha, pelo padrão sugerido (o mesmo prazo da fila offline do app). */
export const LIMITE_DA_CONFERENCIA_MS = 7 * 86_400_000;

export type EstadoDaConferencia = "aguardando_sincronizacao" | "aguardando_responsavel" | "aguardando_assinaturas" | "concluida" | "fechada_sem_todos";
export type TipoDaConferencia = "resumo" | "com_divergencia";
export type TipoDaAssinatura = "ciencia" | "assinatura";
export type ResultadoDaExecucao = "encerrada" | "suspensa" | "interrompida";
export type QuemDecide = "responsavel" | "supervisor";

export const ROTULO_DO_ESTADO_DA_CONFERENCIA: Record<EstadoDaConferencia, string> = {
  aguardando_sincronizacao: "Esperando todos sincronizarem",
  aguardando_responsavel: "Esperando a escolha do responsável",
  aguardando_assinaturas: "Esperando ciências e assinaturas",
  concluida: "Conferida e assinada",
  fechada_sem_todos: "Fechada com o que existia",
};

export const ROTULO_DO_TIPO_DA_CONFERENCIA: Record<TipoDaConferencia, string> = {
  resumo: "Resumo para ciência",
  com_divergencia: "Com divergência",
};

/** Os estados em que a conferência ainda anda (e em que o supervisor ainda espera para assinar por último). */
export const CONFERENCIA_EM_ABERTO: readonly EstadoDaConferencia[] = ["aguardando_sincronizacao", "aguardando_responsavel", "aguardando_assinaturas"];
/** Os estados em que as versões ainda não foram conferidas: a assinatura final do supervisor espera. */
export const CONFERENCIA_ESPERANDO_DADOS: readonly EstadoDaConferencia[] = ["aguardando_sincronizacao", "aguardando_responsavel"];

export const ROTULO_DO_RESULTADO: Record<ResultadoDaExecucao, string> = {
  encerrada: "Encerrada",
  suspensa: "Suspensa",
  interrompida: "Interrompida por risco",
};

/** O valor de `escolha` de quem descartou o item que só um aparelho registrou. */
export const ESCOLHA_DESCARTAR = "descartar";

export interface PausaDaVersao {
  id: string;
  inicio: string;
  fim: string | null;
  motivo: string | null;
  complemento: string | null;
}

/** O que um autor (um aparelho) registrou da execução, montado dos eventos dele. */
export interface VersaoDeAutor {
  autor_id: string;
  autor_nome: string;
  /** O instante do `execucao_iniciada` dele; nulo se ele só agiu depois (pausou, encerrou). */
  inicio: string | null;
  fim: string | null;
  resultado: ResultadoDaExecucao | null;
  /** O motivo da interrupção ou da suspensão que ele registrou. */
  motivo: string | null;
  complemento: string | null;
  pausas: PausaDaVersao[];
  /** Quantas fotos e PDFs ele anexou no encerramento (somam, não divergem). */
  evidencias: number;
  /** Algum registro dele veio sem sinal ou ficou como versão de outro aparelho. */
  sem_sinal: boolean;
}

/** O que um autor registrou para o campo: horário, resultado ou a pausa. */
export interface OpcaoDoCampo {
  autor_id: string;
  autor_nome: string;
  /** Início, fim ou o início da pausa. */
  instante: string | null;
  /** O fim da pausa. */
  fim: string | null;
  /** O resultado (rótulo) ou o motivo da pausa (com o complemento, se houver). */
  texto: string | null;
  /** Só na pausa: o id dela na versão do autor. */
  pausa_id: string | null;
}

export interface CampoDaConferencia {
  /** `inicio`, `fim`, `resultado` ou `pausa:<n>`. */
  campo: string;
  rotulo: string;
  decide: QuemDecide;
  /** Pede escolha: as versões não batem, ou é uma pausa que só um aparelho registrou e foi feita sem sinal. */
  divergente: boolean;
  /** Pausa registrada por um aparelho só: a escolha é aceitar ou descartar. */
  so_um: boolean;
  opcoes: OpcaoDoCampo[];
  /** O autor cuja versão o sistema sugere (a conclusão mais antiga, a pausa do responsável); `aceitar` na pausa de um aparelho só vale o autor dela. */
  sugerido: string;
  /** O autor cuja versão está valendo na execução agora (antes da escolha), se houver. */
  valendo_de: string | null;
}

export interface DecisaoDoCampo {
  campo: string;
  escolha: string;
  decidida_por: { id: string; nome: string } | null;
  decidida_em: string;
}

export interface ParticipanteDaConferencia {
  usuario: { id: string; nome: string };
  /** `true` também para quem nunca usou o modo offline (não tem fila a esperar). */
  sincronizou: boolean;
  /** Quem dá a ciência ou assina (todos, menos o responsável). */
  deve_assinar: boolean;
  assinatura: { tipo: TipoDaAssinatura; ressalva: string | null; assinada_em: string } | null;
}

export interface ConferenciaDaApi {
  id: string;
  execucao_id: string;
  os: { id: string; numero_ordem: string | null; titulo: string };
  estado: EstadoDaConferencia;
  tipo: TipoDaConferencia | null;
  criada_em: string;
  libera_fechar_em: string;
  limite_em: string;
  montada_em: string | null;
  responsavel: { id: string; nome: string } | null;
  versoes: VersaoDeAutor[];
  campos: CampoDaConferencia[];
  decisoes: DecisaoDoCampo[];
  participantes: ParticipanteDaConferencia[];
  faltaram: { sincronizar: string[]; assinar: string[] } | null;
  fechada_em: string | null;
  /** Quem fechou com o que existia; `null` com `fechada_em` = o prazo de 7 dias. */
  fechada_por: { id: string; nome: string } | null;
  /** O que quem está olhando pode fazer agora. */
  eu: {
    participante: boolean;
    /** Os campos que ele pode escolher agora. */
    pode_decidir: string[];
    /** Falta ele dar a ciência ou assinar. */
    deve_assinar: boolean;
    pode_fechar: boolean;
  };
}

/** A linha da lista "Para conferir" (`GET /me/conferencias`). */
export interface ConferenciaResumo {
  id: string;
  execucao_id: string;
  os: { id: string; numero_ordem: string | null; titulo: string };
  estado: EstadoDaConferencia;
  tipo: TipoDaConferencia | null;
  criada_em: string;
  limite_em: string;
  /** O que falta de quem pergunta: escolher, dar a ciência, assinar, ou só esperar os outros. */
  minha_acao: "decidir" | "ciencia" | "assinar" | "fechar" | "aguardar";
}

/** O que a OS mostra da conferência da execução (`GET /os/{id}`). */
export interface ConferenciaDaOs {
  id: string;
  execucao_id: string;
  estado: EstadoDaConferencia;
  tipo: TipoDaConferencia | null;
}

/** Em que passo o participante está, para a faixa e o cartão da tela: o que ele precisa fazer. */
export function rotuloDaAcao(acao: ConferenciaResumo["minha_acao"]): string {
  switch (acao) {
    case "decidir":
      return "Escolha as versões";
    case "ciencia":
      return "Dar ciência";
    case "assinar":
      return "Assinar";
    case "fechar":
      return "Fechar com o que existe";
    default:
      return "Acompanhar";
  }
}
