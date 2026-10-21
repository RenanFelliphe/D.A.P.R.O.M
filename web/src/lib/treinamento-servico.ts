/**
 * Treinamentos de serviço (seção 3 do `vitoria.md`): o jogo por serviço do catálogo. Tipos como a `api` os devolve
 * (`/treinamentos/*`), os limites do esquema da `api` e as conferências que a web faz antes de salvar. Nomeado
 * `treinamento-servico` (nunca `treinamento` sozinho) para não colidir com o Campo de treino, que é outra funcionalidade
 * (`web/src/components/treino/`, `web/src/treino/`).
 */

import type { IconName } from "@/components/ui/Icon";
import type { MetaIA, PendenciaAberta } from "../../../shared/treinamento-servico/ia";
import { SO_LETRAS, TETO_DE_FASES, letrasDaGrade, letrasDaPalavra } from "../../../shared/treinamento-servico/jogos";

export {
  celulasEntre,
  chaveDaPalavra,
  coresDoPalpite,
  decodificarTermo,
  letrasDaGrade,
  letrasDaPalavra,
  tentativasDoTermo,
  type Celula,
  type CorDoTermo,
} from "../../../shared/treinamento-servico/jogos";

export { impressaoDoItem, itemSemRevisao, pendenciasAbertas, type MetaIA, type PendenciaAberta } from "../../../shared/treinamento-servico/ia";

export const EXPRESSOES_VITORIA = ["padrao", "feliz", "explicando", "pensando", "alerta", "comemorando", "ops"] as const;
export type ExpressaoVitoria = (typeof EXPRESSOES_VITORIA)[number];

/** Os limites do esquema da `api` (`treinamento-servico-esquema.ts`): a web os usa nos campos e na conferência antes de salvar. */
export const LIMITES = {
  passos: 12,
  fasesParaPublicar: 3,
  /** Sem limite de fases no produto: o teto técnico da `api` (`TETO_DE_FASES`), que não aparece nas telas. */
  fases: TETO_DE_FASES,
  textoDoPasso: 600,
  enunciado: 400,
  opcao: 160,
  consequencia: 300,
  explicacao: 400,
  opcoesMin: 3,
  opcoesMax: 4,
  paresMin: 2,
  paresMax: 5,
  etapasMin: 2,
  etapasMax: 6,
  /** Selecione com os materiais do serviço: de 1 a 10 materiais certos e de 1 a 15 itens de outros serviços sorteados. */
  materiaisMin: 1,
  materiaisMax: 10,
  erradosMax: 15,
  /** Caça-palavras: de 2 a 5 palavras, de 3 a 12 letras cada (sem contar acento). */
  palavrasMin: 2,
  palavrasMax: 5,
  palavraDaGradeMin: 3,
  palavraDaGradeMax: 12,
  pista: 160,
  /** Memória: de 2 a 5 pares, cada carta com até 80 caracteres. */
  carta: 80,
  /** Selecione: de 3 a 16 opções, de 1 a 10 certas e ao menos uma errada. */
  selecioneMin: 3,
  selecioneMax: 16,
  selecioneCertasMax: 10,
  /** Desembaralhe: palavras de 3 a 14 letras. */
  palavraMin: 3,
  palavraMax: 14,
  /** Termo: palavras de 4 a 7 letras (sem contar acento). */
  termoMin: 4,
  termoMax: 7,
  /** Desembaralhe e Termo: o banco de palavras (cada partida sorteia uma). */
  palavrasDoBanco: 10,
  /** O texto do procedimento que vai para a IA (`LIMITE_TEXTO_PROCEDIMENTO` e o mínimo da rota `gerar`). */
  procedimentoMin: 40,
  procedimentoMax: 20_000,
} as const;

export interface PassoExplicacao {
  ordem: number;
  texto: string;
  expressao: ExpressaoVitoria;
  imagem_path?: string | null;
  /** Só nos passos montados pela IA: o trecho de origem e as pendências (seção 3.6 do `vitoria.md`). */
  ia?: MetaIA | null;
}

export interface FaseQuiz {
  tipo: "quiz";
  enunciado: string;
  opcoes: string[];
  correta: number;
  explicacao: string;
  ia?: MetaIA | null;
}
export interface FaseDecisao {
  tipo: "decisao";
  situacao: string;
  opcoes: { texto: string; consequencia: string }[];
  correta: number;
  explicacao: string;
  ia?: MetaIA | null;
}
export interface FaseLigar {
  tipo: "ligar";
  pares: { esquerda: string; direita: string }[];
  explicacao: string;
  ia?: MetaIA | null;
}
export interface FaseOrdem {
  tipo: "ordem";
  enunciado: string;
  etapas: string[];
  explicacao: string;
  ia?: MetaIA | null;
}
export interface FaseVerdadeiroFalso {
  tipo: "verdadeiro_falso";
  afirmacao: string;
  verdadeira: boolean;
  explicacao: string;
  ia?: MetaIA | null;
}
export interface PalavraDaGrade {
  palavra: string;
  pista?: string | null;
}
export interface FaseCacaPalavras {
  tipo: "caca_palavras";
  enunciado: string;
  /** "palavras": quem joga vê a lista; "pistas": só as pistas, e a palavra fica escondida. */
  modo: "palavras" | "pistas";
  palavras: PalavraDaGrade[];
  explicacao: string;
  ia?: MetaIA | null;
}
export interface FaseMemoria {
  tipo: "memoria";
  pares: { termo: string; correspondente: string }[];
  explicacao: string;
  ia?: MetaIA | null;
}
/** "Montar com os materiais do serviço": os materiais certos e quantos itens de outros serviços o jogo sorteia e mistura. */
export interface MateriaisDoSelecione {
  material_ids: string[];
  quantidade_errados: number;
}
export interface FaseSelecione {
  tipo: "selecione";
  enunciado: string;
  /** As opções escritas; vazia quando a fase é montada com os materiais do serviço. */
  opcoes: { texto: string; correta: boolean }[];
  materiais?: MateriaisDoSelecione | null;
  explicacao: string;
  ia?: MetaIA | null;
}
/** Desembaralhe e Termo guardam um banco de até 10 palavras (publicar exige as 10); cada partida sorteia uma. */
export interface FaseDesembaralhe {
  tipo: "desembaralhe";
  /** Cada palavra com a sua dica (o que ela é). */
  palavras: { palavra: string; dica: string }[];
  explicacao: string;
  ia?: MetaIA | null;
}
export interface FaseTermo {
  tipo: "termo";
  /** Cada palavra secreta (as tentativas são as letras + 1) com uma dica opcional. */
  palavras: { palavra: string; dica?: string | null }[];
  explicacao: string;
  ia?: MetaIA | null;
}
/** O gabarito de uma fase (o que o admin edita); nunca chega ao jogador antes da resposta. */
export type Fase =
  | FaseTermo
  | FaseQuiz
  | FaseDecisao
  | FaseLigar
  | FaseOrdem
  | FaseVerdadeiroFalso
  | FaseCacaPalavras
  | FaseMemoria
  | FaseSelecione
  | FaseDesembaralhe;
export type TipoDeFase = Fase["tipo"];

export interface InfoDoTipoDeFase {
  tipo: TipoDeFase;
  rotulo: string;
  icone: IconName;
  /** Como funciona, para o admin escolher o tipo. */
  descricao: string;
  /** O que a Vitória diz a quem joga antes de responder. */
  instrucao: string;
  /** Uma frase curta do que é o jogo, para quem escolhe o tipo e para quem joga (na abertura da fase). */
  frase: string;
}

/**
 * Os 11 minijogos (os tipos de fase), todos no mesmo nível. Cada um tem a sua cor (`data-jogo` no CSS: `treinamento-jogo.css`, "Identidade de cada tipo"), o
 * seu ícone e o seu jeito de jogar, para quem joga reconhecer o tipo assim que a fase abre.
 */
export const TIPOS_DE_FASE: InfoDoTipoDeFase[] = [
  { tipo: "quiz", rotulo: "Quiz", icone: "chat", frase: "Descubra a resposta certa para a pergunta.", descricao: "Uma pergunta com 3 ou 4 opções e só uma certa.", instrucao: "Escolha a resposta certa e confirme." },
  {
    tipo: "decisao",
    rotulo: "Decisão",
    icone: "octagon",
    frase: "Escolha a atitude segura diante da situação.",
    descricao: "Uma situação de campo e as atitudes possíveis; depois da resposta, cada uma mostra a consequência.",
    instrucao: "O que você faz nesta situação? Escolha a atitude e confirme.",
  },
  {
    tipo: "ligar",
    rotulo: "Ligar",
    icone: "link",
    frase: "Ligue cada item ao par que combina com ele.",
    descricao: "Ligar cada item da esquerda ao par certo da direita, de 2 a 5 pares.",
    instrucao: "Toque num item da esquerda e depois no par dele à direita.",
  },
  { tipo: "ordem", rotulo: "Pôr em ordem", icone: "list", frase: "Coloque as etapas do serviço na sequência certa.", descricao: "Tocar nas etapas na sequência certa, de 2 a 6 etapas.", instrucao: "Toque nas etapas na ordem em que são feitas." },
  {
    tipo: "verdadeiro_falso",
    rotulo: "Verdadeiro ou falso",
    icone: "vf",
    frase: "Diga se a afirmação é verdadeira ou falsa.",
    descricao: "Uma afirmação sobre o serviço; quem joga diz se é verdadeira ou falsa. Bom para desfazer ideias erradas.",
    instrucao: "Esta afirmação é verdadeira ou falsa? Toque numa das cartas.",
  },
  {
    tipo: "caca_palavras",
    rotulo: "Caça-palavras",
    icone: "caca",
    frase: "Encontre os termos do serviço escondidos na grade.",
    descricao: "Achar de 2 a 5 termos do serviço numa grade de letras, na linha, na coluna ou na diagonal, às vezes se cruzando. As palavras aparecem ou só as pistas.",
    instrucao: "Toque na primeira e na última letra de cada palavra.",
  },
  {
    tipo: "memoria",
    rotulo: "Memória",
    icone: "cartas",
    frase: "Vire as cartas e forme os pares de memória.",
    descricao: "Virar as cartas duas a duas e formar os pares (termo e função, risco e medida), de 2 a 5 pares.",
    instrucao: "Vire duas cartas por vez e encontre os pares.",
  },
  {
    tipo: "selecione",
    rotulo: "Selecione",
    icone: "checks",
    frase: "Marque todas as opções certas: pode haver mais de uma.",
    descricao: "Marcar tudo o que atende ao pedido; várias podem ser certas. As opções são escritas ou, com \"Montar com os materiais do serviço\", vêm do catálogo, misturadas a itens que o sistema sorteia de outros serviços.",
    instrucao: "Marque todas as opções certas. Pode ser mais de uma!",
  },
  {
    tipo: "desembaralhe",
    rotulo: "Desembaralhe",
    icone: "embaralhar",
    frase: "Reorganize as letras e forme a palavra.",
    descricao: "Uma palavra do serviço com as letras embaralhadas e uma dica; quem joga monta a palavra.",
    instrucao: "Toque nas letras na ordem certa para formar a palavra.",
  },
  {
    tipo: "termo",
    rotulo: "Termo",
    icone: "termo",
    frase: "Descubra a palavra secreta pelas cores das letras.",
    descricao: "Descobrir uma palavra secreta de 4 a 7 letras com letras + 1 tentativas; as cores mostram as letras certas, no lugar errado ou fora.",
    instrucao: "Digite uma palavra e confirme; toque numa casa para escrever nela. Verde: letra no lugar certo; amarelo: em outro lugar; cinza: não tem.",
  },
];

export const infoDoTipo = (tipo: TipoDeFase): InfoDoTipoDeFase => TIPOS_DE_FASE.find((t) => t.tipo === tipo)!;

/** Um minijogo no plano da geração com a Vitória; `selecione_materiais` pede o Selecione montado com os materiais do serviço. */
export type PedidoDoPlano = TipoDeFase | "selecione_materiais";

/** "1 de cada": um de cada minijogo, numa ordem sorteada (Fisher-Yates) a cada chamada. */
export function umDeCada(): TipoDeFase[] {
  const tipos = TIPOS_DE_FASE.map((t) => t.tipo);
  for (let i = tipos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tipos[i], tipos[j]] = [tipos[j]!, tipos[i]!];
  }
  return tipos;
}

/** O texto principal de uma fase (o enunciado, a situação ou, no "ligar", o primeiro par), para resumos e listas. */
export function tituloDaFase(fase: Fase): string {
  if (fase.tipo === "decisao") return fase.situacao;
  if (fase.tipo === "ligar") return fase.pares.map((p) => p.esquerda).filter(Boolean).join(" · ");
  if (fase.tipo === "memoria") return fase.pares.map((p) => p.termo).filter(Boolean).join(" · ");
  if (fase.tipo === "verdadeiro_falso") return fase.afirmacao;
  if (fase.tipo === "termo" || fase.tipo === "desembaralhe") return fase.palavras.map((p) => p.palavra).filter(Boolean).join(" · ");
  return fase.enunciado;
}

/**
 * As reações que o admin escolhe para um passo. As três expressões "calmas" (`padrao`, `feliz`, `explicando`) só mostram a
 * foto e aparecem como uma opção só, "Normal"; as outras tocam a figurinha ao mostrar o passo (`shared/vitoria/reacoes.ts`).
 */
export const REACOES_DO_PASSO: { expressao: ExpressaoVitoria; rotulo: string; dica: string }[] = [
  { expressao: "explicando", rotulo: "Normal", dica: "Só a foto da Vitória, sem animação." },
  { expressao: "pensando", rotulo: "Pensando", dica: "Para um ponto que pede atenção ao raciocínio." },
  { expressao: "alerta", rotulo: "Atenção", dica: "O dedo levantado: use nos cuidados de segurança." },
  { expressao: "comemorando", rotulo: "Comemorando", dica: "Bom para o último passo." },
  { expressao: "ops", rotulo: "Ops", dica: "Sem graça: use no que não se deve fazer." },
];

export const reacaoNormal = (expressao: ExpressaoVitoria) => expressao === "padrao" || expressao === "feliz" || expressao === "explicando";

export interface ConteudoDoRascunho {
  explicacao: PassoExplicacao[];
  fases: Fase[];
  cenario_path: string | null;
}

export interface RascunhoDoEditor {
  treinamento_id: string;
  versao_id: string;
  versao: number;
  explicacao: PassoExplicacao[];
  fases: Fase[];
  cenario_path: string | null;
  tem_publicada: boolean;
  /** O texto do procedimento que o admin colou para a IA (nulo no rascunho feito só à mão). */
  texto_origem: string | null;
  gerado_com_ia: boolean;
  rodadas_ia: number;
  pendencias: PendenciaAberta[];
}

/** `GET /treinamentos/{codigo}/rascunho`: o rascunho e o que dá para fazer com a IA agora. */
export type RascunhoComIA = RascunhoDoEditor & { ia: SituacaoIA };

/** O que o editor pode fazer com a IA agora (`GET /treinamentos/{codigo}/rascunho`, campo `ia`). */
export interface SituacaoIA {
  disponivel: boolean;
  usa_ia: boolean;
  treinamentos_usados: number;
  limite_treinamentos: number;
  rodadas_usadas: number;
  limite_rodadas: number;
  pode_gerar: boolean;
  pode_ajustar: boolean;
  motivo: string | null;
}

/** Evento `progresso` do streaming da IA ("Montando a fase 5 de 10…"), com o tempo corrido. */
export interface ProgressoDaIA {
  mensagem: string;
  passos_prontos: number;
  fases_prontas: number;
  total_passos: number | null;
  total_fases: number | null;
  segundos: number;
}

/** Evento `final` do streaming da IA: o rascunho já gravado. */
export interface ResultadoDaIA {
  rascunho: RascunhoDoEditor;
  ia: SituacaoIA;
  resumo: string;
  descartados: number;
}

export interface VersaoAnterior {
  versao_id: string;
  versao: number;
  estado: "rascunho" | "publicada" | "substituida";
  publicada_em: string | null;
  publicada_por_nome: string | null;
  total_fases: number;
  total_passos: number;
  /** Como foi ao ar: pela validação dos supervisores ou direto pelo admin (a exceção, com justificativa). Ausente nas versões de antes da validação. */
  via?: "validacao" | "direta" | null;
  /** Quem assinou a publicação (os validadores que aprovaram) e de qual equipe. */
  assinaturas?: { nome: string; equipe_nome: string | null; em: string }[];
  /** Só na publicação direta: por que o admin não esperou a validação. */
  justificativa?: string | null;
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
export interface FaseParaJogarVerdadeiroFalso {
  indice: number;
  tipo: "verdadeiro_falso";
  afirmacao: string;
}
export interface FaseParaJogarCacaPalavras {
  indice: number;
  tipo: "caca_palavras";
  enunciado: string;
  modo: "palavras" | "pistas";
  /** As linhas da grade, só letras de A a Z. */
  grade: string[];
  /** `palavra` nula no modo de pistas; `chave` reconhece o trecho marcado (`chaveDaPalavra`). */
  palavras: { palavra: string | null; pista: string | null; letras: number; chave: string }[];
}
export interface FaseParaJogarMemoria {
  indice: number;
  tipo: "memoria";
  /** `grupo`: as duas cartas de um par têm o mesmo; `lado` 0 é o termo, 1 o correspondente. */
  cartas: { texto: string; grupo: number; lado: 0 | 1 }[];
}
export interface FaseParaJogarSelecione {
  indice: number;
  tipo: "selecione";
  enunciado: string;
  opcoes: string[];
}
export interface FaseParaJogarDesembaralhe {
  indice: number;
  tipo: "desembaralhe";
  enunciado: string;
  letras: string[];
}
export interface FaseParaJogarTermo {
  indice: number;
  tipo: "termo";
  dica: string | null;
  letras: number;
  tentativas: number;
  /** A palavra codificada (`decodificarTermo`): o jogo pinta as letras na hora; a correção que vale é a do servidor. */
  codigo: string;
}
export type FaseParaJogar =
  | FaseParaJogarTermo
  | FaseParaJogarQuiz
  | FaseParaJogarDecisao
  | FaseParaJogarLigar
  | FaseParaJogarOrdem
  | FaseParaJogarVerdadeiroFalso
  | FaseParaJogarCacaPalavras
  | FaseParaJogarMemoria
  | FaseParaJogarSelecione
  | FaseParaJogarDesembaralhe;

export interface TentativaAberta {
  tentativa_id: string;
  total_fases: number;
  fases: FaseParaJogar[];
}

/**
 * A correção de uma fase. No quiz e na decisão, `opcao_correta` é a posição **mostrada** (já embaralhada); em "separar os
 * itens", `certos` traz os `material_id`; no "ligar" e no "pôr em ordem", os pares e as etapas na forma certa, em texto.
 */
export interface ResultadoDaResposta {
  certa: boolean;
  explicacao: string;
  /** Os acertos e as respostas certas possíveis (a base: 10 × acertos ÷ possíveis), o tempo e os pontos da fase. */
  acertos: number;
  possiveis: number;
  tempo_ms: number;
  multiplicador: number;
  pontos: number;
  gabarito: {
    opcao_correta?: number;
    consequencia_escolhida?: string;
    consequencia_correta?: string;
    pares?: { esquerda: string; direita: string }[];
    etapas?: string[];
    /** Verdadeiro ou falso: a afirmação era verdadeira? */
    verdadeira?: boolean;
    /** Caça-palavras: onde cada palavra estava e se foi achada. */
    palavras?: { palavra: string; inicio: [number, number]; fim: [number, number]; achada: boolean }[];
    /** Memória: os erros contados pelo servidor (não limitam a fase) e os pares. */
    erros?: number;
    completa?: boolean;
    pares_memoria?: { termo: string; correspondente: string }[];
    /** Selecione: as posições mostradas das opções certas. */
    corretas?: number[];
    /** Desembaralhe: a palavra certa, em maiúsculas; Termo: a palavra secreta como o admin escreveu. */
    palavra?: string;
    /** Termo: em qual tentativa acertou (nulo se não acertou). */
    tentativa_do_acerto?: number | null;
  };
}

export interface Ganho {
  regra: string;
  nome: string;
  pontos: number;
  os_id: string | null;
}
/** Uma fase no resultado: os acertos, o tempo, o multiplicador e os pontos; `confirmada` falsa se foi corrigida ao finalizar. */
export interface FaseDoResultado {
  fase: number;
  acertos: number;
  possiveis: number;
  tempo_ms: number;
  multiplicador: number;
  pontos: number;
  confirmada: boolean;
}

export interface ResultadoDaConclusao {
  fases_certas: number;
  total_fases: number;
  /** A nota do treinamento (seção 12 do `treinamentos-de-servico.md`) e a máxima possível. */
  nota: number;
  nota_maxima: number;
  /** A melhor nota da pessoa neste treinamento antes desta tentativa (nula na primeira). */
  melhor_anterior: number | null;
  fases: FaseDoResultado[];
  /** Os pontos da gamificação (5 + 1 por fase certa, só na primeira conclusão). */
  pontos_ganhos: number;
  ganhos: Ganho[];
}

/** Uma linha do ranking do treinamento (`GET /treinamentos/{codigo}/ranking`): a nota da primeira conclusão da pessoa. */
export interface LinhaDoRankingDoTreinamento {
  posicao: number;
  /** Nulo quando a pessoa está anônima para quem vê. */
  usuario_id: string | null;
  nome: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  anonimo: boolean;
  /** A melhor nota da pessoa e a máxima da versão em que ela a fez. */
  nota: number;
  nota_maxima: number;
  fases_certas: number;
  total_fases: number;
  /** A nota ÷ a máxima, de 0 a 100. */
  aproveitamento: number;
  concluido_em: string;
  voce: boolean;
}

export interface RankingDoTreinamento {
  /** Quantas pessoas já concluíram (o ranking inteiro, não só as linhas que vieram). */
  participantes: number;
  linhas: LinhaDoRankingDoTreinamento[];
  /** A linha de quem vê, mesmo fora das primeiras; nula se ainda não concluiu. */
  minha: LinhaDoRankingDoTreinamento | null;
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
}

/** Meio minuto por passo da explicação e 45 segundos por fase, no mínimo 2 minutos (sem fórmula na especificação). */
export const duracaoEstimada = (passos: number, fases: number) => Math.max(2, Math.round(passos * 0.5 + fases * 0.75));

/** O máximo de pontos de um treinamento: 5 pelo concluído e 1 por fase certa na primeira resposta (até 10). */
export const pontosMaximos = (fases: number) => 5 + Math.min(fases, 10);

export { DEGRAUS_DO_TEMPO, MULTIPLICADOR_MINIMO, TEMPO_CHEIO_SEGUNDOS, faixasDoTempo, multiplicadorDoTempo, notaMaxima } from "../../../shared/treinamento-servico/nota";

/** A nota com separador de milhar ("2.000"). */
export const formatarNota = (nota: number) => nota.toLocaleString("pt-BR");

/** O multiplicador como aparece na tela ("1,0×", "0,875×"). */
export const formatarMultiplicador = (m: number) => `${m.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })}×`;

/** O tempo da fase como aparece na tela ("0:42", "1:05"). */
export function formatarTempo(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const novoPasso = (ordem: number): PassoExplicacao => ({ ordem, texto: "", expressao: "explicando", imagem_path: null });

/** Uma fase nova e vazia de cada tipo, para o editor adicionar à lista. */
export function faseEmBranco(tipo: TipoDeFase): Fase {
  switch (tipo) {
    case "quiz":
      return { tipo: "quiz", enunciado: "", opcoes: ["", "", ""], correta: 0, explicacao: "" };
    case "decisao":
      return { tipo: "decisao", situacao: "", opcoes: [{ texto: "", consequencia: "" }, { texto: "", consequencia: "" }, { texto: "", consequencia: "" }], correta: 0, explicacao: "" };
    case "ligar":
      return { tipo: "ligar", pares: [{ esquerda: "", direita: "" }, { esquerda: "", direita: "" }, { esquerda: "", direita: "" }], explicacao: "" };
    case "ordem":
      return { tipo: "ordem", enunciado: "", etapas: ["", "", ""], explicacao: "" };
    case "verdadeiro_falso":
      return { tipo: "verdadeiro_falso", afirmacao: "", verdadeira: true, explicacao: "" };
    case "caca_palavras":
      return { tipo: "caca_palavras", enunciado: "Encontre as palavras do serviço.", modo: "palavras", palavras: [{ palavra: "", pista: "" }, { palavra: "", pista: "" }, { palavra: "", pista: "" }], explicacao: "" };
    case "memoria":
      return { tipo: "memoria", pares: [{ termo: "", correspondente: "" }, { termo: "", correspondente: "" }, { termo: "", correspondente: "" }], explicacao: "" };
    case "selecione":
      return { tipo: "selecione", enunciado: "", opcoes: [true, true, true, false, false, false, false, false].map((correta) => ({ texto: "", correta })), explicacao: "" };
    case "desembaralhe":
      return { tipo: "desembaralhe", palavras: [{ palavra: "", dica: "" }, { palavra: "", dica: "" }, { palavra: "", dica: "" }], explicacao: "" };
    case "termo":
      return { tipo: "termo", palavras: [{ palavra: "", dica: "" }, { palavra: "", dica: "" }, { palavra: "", dica: "" }], explicacao: "" };
  }
}

// ---- Conferência antes de salvar ---------------------------------------------------------------------------------------

/** Um campo que impede salvar (vazio, ou uma lista curta demais): a `api` recusaria o rascunho inteiro com `422`. */
export interface ProblemaDoItem {
  parte: "passo" | "fase";
  indice: number;
  mensagem: string;
}

const vazio = (texto: string) => texto.trim().length === 0;

function problemasDaFase(fase: Fase): string[] {
  const p: string[] = [];
  switch (fase.tipo) {
    case "quiz":
      if (vazio(fase.enunciado)) p.push("Escreva a pergunta.");
      if (fase.opcoes.some(vazio)) p.push("Preencha todas as opções.");
      break;
    case "decisao":
      if (vazio(fase.situacao)) p.push("Descreva a situação.");
      if (fase.opcoes.some((o) => vazio(o.texto))) p.push("Preencha todas as atitudes.");
      if (fase.opcoes.some((o) => vazio(o.consequencia))) p.push("Escreva a consequência de cada atitude.");
      break;
    case "ligar":
      if (fase.pares.some((par) => vazio(par.esquerda) || vazio(par.direita))) p.push("Preencha os dois lados de cada par.");
      break;
    case "ordem":
      if (vazio(fase.enunciado)) p.push("Escreva o enunciado.");
      if (fase.etapas.some(vazio)) p.push("Preencha todas as etapas.");
      break;
    case "verdadeiro_falso":
      if (vazio(fase.afirmacao)) p.push("Escreva a afirmação.");
      break;
    case "caca_palavras": {
      if (vazio(fase.enunciado)) p.push("Escreva o enunciado.");
      const palavras = fase.palavras.map((x) => x.palavra.trim());
      if (palavras.some((x) => !x)) p.push("Preencha todas as palavras.");
      else if (palavras.some((x) => !SO_LETRAS.test(x))) p.push("Cada palavra precisa ser uma palavra só, sem espaço, hífen ou número.");
      else if (palavras.some((x) => letrasDaGrade(x).length < LIMITES.palavraDaGradeMin || letrasDaGrade(x).length > LIMITES.palavraDaGradeMax)) {
        p.push(`Cada palavra precisa ter de ${LIMITES.palavraDaGradeMin} a ${LIMITES.palavraDaGradeMax} letras.`);
      } else if (new Set(palavras.map(letrasDaGrade)).size !== palavras.length) p.push("Há uma palavra repetida.");
      if (fase.modo === "pistas" && fase.palavras.some((x) => vazio(x.pista ?? ""))) p.push("No modo de pistas, escreva a pista de cada palavra.");
      break;
    }
    case "memoria":
      if (fase.pares.some((par) => vazio(par.termo) || vazio(par.correspondente))) p.push("Preencha as duas cartas de cada par.");
      break;
    case "selecione": {
      if (vazio(fase.enunciado)) p.push("Escreva o pedido.");
      if (fase.materiais) {
        if (fase.materiais.material_ids.length < LIMITES.materiaisMin) p.push("Marque ao menos um material certo.");
        break;
      }
      if (fase.opcoes.length < LIMITES.selecioneMin) p.push(`Escreva ao menos ${LIMITES.selecioneMin} opções.`);
      if (fase.opcoes.some((o) => vazio(o.texto))) p.push("Preencha todas as opções.");
      const certas = fase.opcoes.filter((o) => o.correta).length;
      if (certas === 0) p.push("Marque ao menos uma opção certa.");
      else if (certas > LIMITES.selecioneCertasMax) p.push(`Marque no máximo ${LIMITES.selecioneCertasMax} opções certas.`);
      else if (certas === fase.opcoes.length) p.push("Deixe ao menos uma opção errada.");
      break;
    }
    case "termo":
    case "desembaralhe": {
      const termo = fase.tipo === "termo";
      const palavras = fase.palavras.map((x) => x.palavra.trim());
      if (palavras.some((x) => !x)) p.push("Preencha todas as palavras do banco.");
      else if (palavras.some((x) => !SO_LETRAS.test(x))) p.push("Cada palavra precisa ser uma só, sem espaço, hífen ou número.");
      else if (termo && palavras.some((x) => letrasDaGrade(x).length < LIMITES.termoMin || letrasDaGrade(x).length > LIMITES.termoMax)) {
        p.push(`Cada palavra do Termo precisa ter de ${LIMITES.termoMin} a ${LIMITES.termoMax} letras.`);
      } else if (!termo && palavras.some((x) => letrasDaPalavra(x).length < LIMITES.palavraMin)) p.push(`Cada palavra precisa ter ao menos ${LIMITES.palavraMin} letras.`);
      else if (!termo && palavras.some((x) => new Set(letrasDaPalavra(x)).size < 2)) p.push("Cada palavra precisa de ao menos duas letras diferentes.");
      else if (new Set(palavras.map(letrasDaGrade)).size !== palavras.length) p.push("Há uma palavra repetida no banco.");
      if (fase.tipo === "desembaralhe" && fase.palavras.some((x) => vazio(x.dica))) p.push("Escreva a dica de cada palavra.");
      break;
    }
  }
  if (vazio(fase.explicacao)) p.push("Escreva a explicação mostrada depois da resposta.");
  return p;
}

/** O que falta preencher para o rascunho ser aceito pela `api`, item por item, na ordem da tela. */
export function problemasDoConteudo({ explicacao, fases }: Pick<ConteudoDoRascunho, "explicacao" | "fases">): ProblemaDoItem[] {
  const problemas: ProblemaDoItem[] = [];
  explicacao.forEach((passo, indice) => {
    if (vazio(passo.texto)) problemas.push({ parte: "passo", indice, mensagem: "Escreva o texto do passo." });
  });
  fases.forEach((fase, indice) => problemasDaFase(fase).forEach((mensagem) => problemas.push({ parte: "fase", indice, mensagem })));
  return problemas;
}

/** "Passo 2" / "Fase 3": como um item aparece nas listas de problemas e pendências. */
export const nomeDoItem = (item: { parte: "passo" | "fase"; indice: number }) => `${item.parte === "passo" ? "Passo" : "Fase"} ${item.indice + 1}`;

export interface RequisitoDePublicacao {
  chave: "passos" | "fases" | "preenchido" | "palavras" | "pendencias";
  rotulo: string;
  detalhe: string;
  ok: boolean;
}

/** O que a publicação exige (a mesma regra de `validarPublicavel` e `422 pendencias_abertas` da `api`); o banco de palavras só aparece se houver Desembaralhe ou Termo. */
export function requisitosDePublicacao(conteudo: Pick<ConteudoDoRascunho, "explicacao" | "fases">, pendencias: number): RequisitoDePublicacao[] {
  const { explicacao, fases } = conteudo;
  const incompletos = new Set(problemasDoConteudo(conteudo).map(nomeDoItem)).size;
  const bancos = fases.flatMap((f, i) => (f.tipo === "termo" || f.tipo === "desembaralhe" ? [{ f, i }] : []));
  const faltando = bancos.filter(({ f }) => f.palavras.length < LIMITES.palavrasDoBanco);
  return [
    {
      chave: "passos",
      rotulo: "Explicação com 1 a 12 passos",
      detalhe: explicacao.length === 1 ? "1 passo" : `${explicacao.length} passos`,
      ok: explicacao.length >= 1 && explicacao.length <= LIMITES.passos,
    },
    {
      chave: "fases",
      rotulo: `Jogo com ao menos ${LIMITES.fasesParaPublicar} fases`,
      detalhe: fases.length === 1 ? "1 fase" : `${fases.length} fases`,
      ok: fases.length >= LIMITES.fasesParaPublicar && fases.length <= LIMITES.fases,
    },
    {
      chave: "preenchido",
      rotulo: "Todos os campos preenchidos",
      detalhe: incompletos === 0 ? "Nada faltando" : incompletos === 1 ? "1 item incompleto" : `${incompletos} itens incompletos`,
      ok: incompletos === 0,
    },
    ...(bancos.length > 0
      ? [
          {
            chave: "palavras" as const,
            rotulo: `Desembaralhe e Termo com ${LIMITES.palavrasDoBanco} palavras`,
            detalhe: faltando.length === 0 ? "Bancos completos" : faltando.map(({ f, i }) => `Fase ${i + 1}: ${f.palavras.length} de ${LIMITES.palavrasDoBanco}`).join(" · "),
            ok: faltando.length === 0,
          },
        ]
      : []),
    {
      chave: "pendencias",
      rotulo: "Nenhuma pendência da Vitória",
      detalhe: pendencias === 0 ? "Tudo validado" : pendencias === 1 ? "1 pendência aberta" : `${pendencias} pendências abertas`,
      ok: pendencias === 0,
    },
  ];
}

/** O termo que o admin aceita ao publicar (seção 3.7 do `vitoria.md`). */
export const termoDePublicacao = (codigo: string, descricao: string) =>
  `Declaro que revisei este treinamento e que a explicação, as fases e as respostas estão de acordo com as normas da empresa e com o fluxo correto do serviço ${codigo} — ${descricao}.`;
