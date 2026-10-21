/**
 * As funções de IA do SYNQ OS e o que cada uma lê (`base/funcionalidades/controle-da-ia.md`). É a única fonte do texto que o
 * admin vê e assina: a `api` confere a versão assinada e a `web` mostra as mesmas frases. O nome de cada função é também o nome
 * lógico do uso no módulo de IA (`ModeloLogico`): a configuração traduz cada um para o modelo real do fornecedor.
 */

export const FUNCOES_DE_IA = ["chatbot", "minigames", "recomendacao", "digitalizacao"] as const;
export type FuncaoDeIA = (typeof FUNCOES_DE_IA)[number];

/**
 * - `sem_dados`: funciona sem receber dado real da operação (OS, APR, pessoas); o admin pode, se quiser, ligar a leitura de
 *   dados para ela render mais.
 * - `com_dados`: só funciona lendo dado real; ligar já é autorizar essa leitura.
 */
export type GrupoDeIA = "sem_dados" | "com_dados";

export interface DefinicaoDaFuncaoDeIA {
  id: FuncaoDeIA;
  grupo: GrupoDeIA;
  titulo: string;
  /** O que a função é, em uma ou duas frases. */
  explicacao: string;
  /** O que a IA recebe mesmo sem dado real da operação (só nas funções `sem_dados`). */
  semDados: string[];
  /** O que a leitura de dados melhora (só nas `sem_dados`). */
  melhoraComDados: string | null;
  /** O que a IA passa a ler quando a leitura de dados está ligada (nas `com_dados`, é o que ela lê sempre). */
  le: string[];
  /** O que continua funcionando com a função desligada. */
  semIa: string;
  /**
   * Sobe a cada mudança em `le`: quem assinou a versão anterior precisa assinar de novo, porque não autorizou a leitura nova.
   */
  versaoDoTexto: number;
}

export const DEFINICOES_DE_IA: readonly DefinicaoDaFuncaoDeIA[] = [
  {
    id: "chatbot",
    grupo: "sem_dados",
    titulo: "Chatbot",
    explicacao: "A Vitória responde as dúvidas de quem usa o sistema pelo manual do perfil e leva à tela certa (\"Me leve lá\").",
    semDados: ["a pergunta", "as últimas mensagens da conversa", "a tela em que a pessoa está", "o manual do perfil"],
    melhoraComDados: "Ela passa a responder sobre o trabalho de quem pergunta: \"qual é a minha OS mais atrasada?\", \"falta alguém assinar a minha APR?\".",
    le: [
      "as OS em aberto da equipe de quem pergunta (número, título, serviço, local, situação e data prevista)",
      "as APRs dessas OS que ainda esperam assinatura (só quantas e de quem é a vez de quem pergunta, sem os nomes dos outros)",
      "os pontos da temporada e a patente de quem pergunta",
    ],
    semIa: "Ela responde pelas sugestões fixas e pela busca no manual.",
    versaoDoTexto: 1,
  },
  {
    id: "minigames",
    grupo: "sem_dados",
    titulo: "Criação de jogos",
    explicacao: "A Vitória monta o rascunho dos treinamentos de serviço (a explicação e os minijogos) a partir do procedimento que o administrador cola. O administrador revisa, corrige e assina antes de publicar.",
    semDados: ["o texto do procedimento colado pelo administrador", "os materiais do serviço no catálogo"],
    melhoraComDados: "Os jogos passam a insistir no que dá problema de verdade em campo; o conteúdo continua saindo só do procedimento.",
    le: [
      "os motivos de pausa e de suspensão registrados nas execuções das OS desse serviço, e quantas vezes cada um (sem a pessoa e sem o texto livre)",
      "os itens das APRs desse serviço que as equipes marcaram com problema, e quantas vezes",
      "os materiais que as pessoas pediram para acrescentar à lista do serviço e o supervisor aceitou, e quantas vezes",
    ],
    semIa: "O administrador monta o treinamento à mão no editor; o botão de gerar rascunho some.",
    versaoDoTexto: 1,
  },
  {
    id: "recomendacao",
    grupo: "com_dados",
    titulo: "Recomendação de modelo de APR",
    explicacao: "A Vitória lê cada OS assim que ela entra no sistema e guarda qual modelo de APR combina mais. O técnico continua escolhendo o modelo: a recomendação só orienta.",
    semDados: [],
    melhoraComDados: null,
    le: ["o título, a descrição e o serviço do catálogo de cada OS", "a descrição e os exemplos de cada modelo de APR"],
    semIa: "A recomendação sai das palavras-chave de cada modelo, sem IA, como antes.",
    versaoDoTexto: 1,
  },
  {
    id: "digitalizacao",
    grupo: "com_dados",
    titulo: "Digitalização de documentos",
    explicacao: "A Vitória lê as folhas de OS e de APR antigas (PDF ou foto) e preenche o histórico no sistema. O administrador confere tudo antes de registrar.",
    semDados: [],
    melhoraComDados: null,
    le: ["as imagens das folhas, com nomes, matrículas, assinaturas e o que foi escrito à mão", "os modelos de APR, para reconhecer qual deles a folha usou"],
    semIa: "A folha é lida só pelo OCR local, e o que foi escrito à mão é digitado na conferência.",
    versaoDoTexto: 1,
  },
];

export const definicaoDaFuncao = (id: FuncaoDeIA): DefinicaoDaFuncaoDeIA => DEFINICOES_DE_IA.find((d) => d.id === id)!;

/** `true` quando a função só funciona lendo dado real: ligar já é autorizar a leitura. */
export const exigeDados = (id: FuncaoDeIA): boolean => definicaoDaFuncao(id).grupo === "com_dados";

/** Como cada função vem ao instalar: as sem dados ligadas, as com dados desligadas até o admin assinar. */
export const LIGADA_AO_INSTALAR: Record<FuncaoDeIA, boolean> = { chatbot: true, minigames: true, recomendacao: false, digitalizacao: false };
