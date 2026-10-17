/**
 * Treinamentos de serviço (seção 3 do `vitoria.md`): o jogo por serviço do catálogo. Tipos como a `api` os devolve
 * (`/treinamentos/*`). Nomeado `treinamento-servico` (nunca `treinamento` sozinho) para não colidir com o Campo de
 * treino, que é outra funcionalidade (`web/src/components/treino/`, `web/src/treino/`).
 */

export const EXPRESSOES_VITORIA = ["padrao", "feliz", "explicando", "pensando", "alerta", "comemorando", "ops"] as const;
export type ExpressaoVitoria = (typeof EXPRESSOES_VITORIA)[number];

export interface PassoExplicacao {
  ordem: number;
  texto: string;
  expressao: ExpressaoVitoria;
  imagem_path?: string | null;
}

export interface FaseQuiz {
  tipo: "quiz";
  enunciado: string;
  opcoes: string[];
  correta: number;
  explicacao: string;
}
export interface FaseDecisao {
  tipo: "decisao";
  situacao: string;
  opcoes: { texto: string; consequencia: string }[];
  correta: number;
  explicacao: string;
}
export interface FaseSepararItens {
  tipo: "separar_itens";
  enunciado: string;
  material_ids: string[];
  quantidade_errados: number;
  explicacao: string;
}
export interface FaseLigar {
  tipo: "ligar";
  pares: { esquerda: string; direita: string }[];
  explicacao: string;
}
export interface FaseOrdem {
  tipo: "ordem";
  enunciado: string;
  etapas: string[];
  explicacao: string;
}
/** O gabarito de uma fase (o que o admin edita); nunca chega ao jogador antes da resposta. */
export type Fase = FaseQuiz | FaseDecisao | FaseSepararItens | FaseLigar | FaseOrdem;
export type TipoDeFase = Fase["tipo"];

export const TIPOS_DE_FASE: { tipo: TipoDeFase; rotulo: string }[] = [
  { tipo: "quiz", rotulo: "Quiz" },
  { tipo: "decisao", rotulo: "Decisão" },
  { tipo: "separar_itens", rotulo: "Separar os itens" },
  { tipo: "ligar", rotulo: "Ligar" },
  { tipo: "ordem", rotulo: "Pôr em ordem" },
];

export interface RascunhoDoEditor {
  treinamento_id: string;
  versao_id: string;
  versao: number;
  explicacao: PassoExplicacao[];
  fases: Fase[];
  cenario_path: string | null;
  tem_publicada: boolean;
}

export interface VersaoAnterior {
  versao_id: string;
  versao: number;
  estado: "rascunho" | "publicada" | "substituida";
  publicada_em: string | null;
  publicada_por_nome: string | null;
  total_fases: number;
  total_passos: number;
}

export interface TreinamentoResumo {
  atividade_codigo: string;
  descricao: string;
  versao: number;
  publicada_em: string;
  total_fases: number;
  concluido: boolean;
  fases_certas: number;
}

export interface TreinamentoParaJogador {
  atividade_codigo: string;
  descricao: string;
  treinamento_id: string;
  versao_id: string;
  versao: number;
  explicacao: PassoExplicacao[];
  cenario_path: string | null;
  total_fases: number;
  publicada_em: string;
  publicada_por_nome: string;
}

// ---- O jogo (sem gabarito, embaralhado na abertura) ------------------------------------------------------------------

export interface FaseParaJogarQuiz {
  indice: number;
  tipo: "quiz";
  enunciado: string;
  opcoes: string[];
}
export interface FaseParaJogarDecisao {
  indice: number;
  tipo: "decisao";
  situacao: string;
  opcoes: string[];
}
export interface FaseParaJogarSepararItens {
  indice: number;
  tipo: "separar_itens";
  enunciado: string;
  itens: { material_id: string; descricao: string }[];
}
export interface FaseParaJogarLigar {
  indice: number;
  tipo: "ligar";
  esquerda: string[];
  direita: string[];
}
export interface FaseParaJogarOrdem {
  indice: number;
  tipo: "ordem";
  enunciado: string;
  etapas: string[];
}
export type FaseParaJogar = FaseParaJogarQuiz | FaseParaJogarDecisao | FaseParaJogarSepararItens | FaseParaJogarLigar | FaseParaJogarOrdem;

export interface TentativaAberta {
  tentativa_id: string;
  total_fases: number;
  fases: FaseParaJogar[];
}

export interface ResultadoDaResposta {
  certa: boolean;
  explicacao: string;
  gabarito: {
    opcao_correta?: number;
    consequencia_escolhida?: string;
    consequencia_correta?: string;
    certos?: string[];
    pares?: { esquerda: string; direita: string }[];
    etapas?: string[];
  };
}

export interface Ganho {
  regra: string;
  nome: string;
  pontos: number;
  os_id: string | null;
}
export interface ResultadoDaConclusao {
  fases_certas: number;
  total_fases: number;
  pontos_ganhos: number;
  ganhos: Ganho[];
}

export interface ReporteDeTreinamento {
  id: string;
  atividade_codigo: string;
  descricao: string;
  versao: number;
  fase: number | null;
  usuario_nome: string;
  texto: string;
  criado_em: string;
  tratado_em: string | null;
  pagina: number;
  tamanho: number;
  total: number;
}

/** Uma fase nova e vazia de cada tipo, para o editor adicionar à lista. */
export function faseEmBranco(tipo: TipoDeFase): Fase {
  switch (tipo) {
    case "quiz":
      return { tipo: "quiz", enunciado: "", opcoes: ["", "", ""], correta: 0, explicacao: "" };
    case "decisao":
      return { tipo: "decisao", situacao: "", opcoes: [{ texto: "", consequencia: "" }, { texto: "", consequencia: "" }, { texto: "", consequencia: "" }], correta: 0, explicacao: "" };
    case "separar_itens":
      return { tipo: "separar_itens", enunciado: "", material_ids: [], quantidade_errados: 1, explicacao: "" };
    case "ligar":
      return { tipo: "ligar", pares: [{ esquerda: "", direita: "" }, { esquerda: "", direita: "" }], explicacao: "" };
    case "ordem":
      return { tipo: "ordem", enunciado: "", etapas: ["", ""], explicacao: "" };
  }
}
