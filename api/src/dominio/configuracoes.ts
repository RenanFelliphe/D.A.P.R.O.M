import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Config } from "../config";
import { MAX_CONTATOS_DO_PAE, telefoneValido, type ContatoDeEmergencia } from "../../../shared/api/emergencia";
import { configuracao, type ConfiguracaoChave } from "../db/schema";
import type { Deps } from "../deps";
import { invalido, naoEncontrado } from "../http/erros";

/**
 * As configurações do sistema que o admin edita em `/app/configuracoes` (`docs/operacao-de-campo.md`, seção 13): a cidade padrão da
 * previsão do tempo, os horários das rotinas e os limites de uso da IA. Até aqui eram variáveis de ambiente; agora o ambiente é só o
 * valor inicial (`padrao`) e o que o admin muda fica no banco (`configuracao`), por cima. A mudança vale na hora, sem reiniciar:
 * `aplicarConfiguracoes` escreve o valor no próprio `config` da `api`, que o agendador e as rotas leem a cada uso.
 *
 * O que NÃO está aqui de propósito: endereços, chaves e tokens (SAP, RH, SMTP, IA). São segredos e ligações com outros sistemas;
 * ficam no ambiente, fora do alcance de uma tela.
 */

export interface CidadePadrao {
  nome: string;
  latitude: number;
  longitude: number;
}

/** Vitória (ES): a cidade da sede, usada enquanto o admin não escolhe outra. */
export const CIDADE_PADRAO_INICIAL: CidadePadrao = { nome: "Vitória, ES", latitude: -20.3155, longitude: -40.3128 };

const esquemaCidade = z.object({
  nome: z.string().trim().min(2).max(80),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

/** Um contato do PAE como o admin o cadastra (`docs/operacao-de-campo.md`, seção 5.9): nome, telefone para ligar e o que ele atende. */
const esquemaContato = z.object({
  nome: z.string().trim().min(2, "Informe o nome do contato").max(80),
  telefone: z.string().trim().refine(telefoneValido, "Informe um telefone que dê para ligar (de 3 a 15 dígitos)"),
  descricao: z.string().trim().max(120).nullish().transform((d) => d || null),
});
const esquemaContatosDoPae = z.array(esquemaContato).max(MAX_CONTATOS_DO_PAE, `No máximo ${MAX_CONTATOS_DO_PAE} contatos`);

export type GrupoDeConfiguracao = "rotinas" | "ia";

interface Numerica {
  chave: Exclude<ConfiguracaoChave, "cidade_padrao" | "contatos_pae">;
  grupo: GrupoDeConfiguracao;
  rotulo: string;
  descricao: string;
  unidade: string;
  min: number;
  max: number;
  ler: (c: Config) => number;
  escrever: (c: Config, v: number) => void;
}

const NUMERICAS: Numerica[] = [
  {
    chave: "sap_leitura_intervalo_min",
    grupo: "rotinas",
    rotulo: "Leitura do SAP",
    descricao: "De quanto em quanto tempo o sistema lê as OS novas e alteradas no SAP.",
    unidade: "minutos",
    min: 5,
    max: 1440,
    ler: (c) => c.sapLeituraIntervaloMin,
    escrever: (c, v) => void (c.sapLeituraIntervaloMin = v),
  },
  {
    chave: "rh_leitura_hora",
    grupo: "rotinas",
    rotulo: "Leitura do registro de funcionários",
    descricao: "A partir de que hora (de São Paulo) o sistema faz a leitura diária completa do registro de funcionários.",
    unidade: "hora (0 a 23)",
    min: 0,
    max: 23,
    ler: (c) => c.rhLeituraHora,
    escrever: (c, v) => void (c.rhLeituraHora = v),
  },
  {
    chave: "email_resumo_hora",
    grupo: "rotinas",
    rotulo: "Resumo diário por e-mail",
    descricao: "A partir de que hora (de São Paulo) sai o e-mail com o que espera por cada pessoa.",
    unidade: "hora (0 a 23)",
    min: 0,
    max: 23,
    ler: (c) => c.emailResumoHora,
    escrever: (c, v) => void (c.emailResumoHora = v),
  },
  {
    chave: "vitoria_limite_por_conversa",
    grupo: "ia",
    rotulo: "Mensagens por conversa",
    descricao: "Quantas mensagens a Vitória responde com IA numa mesma conversa; depois disso ela responde só pelo manual.",
    unidade: "mensagens",
    min: 1,
    max: 500,
    ler: (c) => c.vitoria.limitePorConversa,
    escrever: (c, v) => void (c.vitoria = { ...c.vitoria, limitePorConversa: v }),
  },
  {
    chave: "vitoria_limite_por_conta_dia",
    grupo: "ia",
    rotulo: "Respostas por pessoa, por dia",
    descricao: "Quantas respostas com IA cada pessoa recebe da Vitória por dia.",
    unidade: "respostas",
    min: 1,
    max: 2000,
    ler: (c) => c.vitoria.limitePorContaDia,
    escrever: (c, v) => void (c.vitoria = { ...c.vitoria, limitePorContaDia: v }),
  },
  {
    chave: "vitoria_limite_global_dia",
    grupo: "ia",
    rotulo: "Respostas de todos, por dia",
    descricao: "O teto diário de respostas com IA do sistema inteiro; ao atingi-lo, a Vitória volta ao manual até a meia-noite e o admin é avisado.",
    unidade: "respostas",
    min: 1,
    max: 100000,
    ler: (c) => c.vitoria.limiteGlobalDia,
    escrever: (c, v) => void (c.vitoria = { ...c.vitoria, limiteGlobalDia: v }),
  },
  {
    chave: "vitoria_max_tokens_resposta",
    grupo: "ia",
    rotulo: "Tamanho máximo da resposta da Vitória",
    descricao: "O tamanho máximo de cada resposta da Vitória, em tokens (mais ou menos três quartos de uma palavra cada). Vale a partir da próxima reinicialização da api.",
    unidade: "tokens",
    min: 128,
    max: 8192,
    ler: (c) => c.vitoria.maxTokensResposta,
    escrever: (c, v) => void (c.vitoria = { ...c.vitoria, maxTokensResposta: v }),
  },
  {
    chave: "treinamento_ia_limite_treinamentos",
    grupo: "ia",
    rotulo: "Treinamentos com IA",
    descricao: "Quantos treinamentos de serviço podem usar a IA para gerar o rascunho (0 desliga o rascunho por IA).",
    unidade: "treinamentos",
    min: 0,
    max: 100,
    ler: (c) => c.treinamentoIa.limiteTreinamentos,
    escrever: (c, v) => void (c.treinamentoIa = { ...c.treinamentoIa, limiteTreinamentos: v }),
  },
  {
    chave: "treinamento_ia_limite_rodadas",
    grupo: "ia",
    rotulo: "Rodadas por treinamento",
    descricao: "Quantas vezes a IA pode gerar ou refazer partes de um mesmo treinamento (pedido no chat, fase regerada ou nova geração).",
    unidade: "rodadas",
    min: 0,
    max: 50,
    ler: (c) => c.treinamentoIa.limiteRodadas,
    escrever: (c, v) => void (c.treinamentoIa = { ...c.treinamentoIa, limiteRodadas: v }),
  },
  {
    chave: "treinamento_ia_max_tokens",
    grupo: "ia",
    rotulo: "Tamanho máximo do rascunho de treinamento",
    descricao: "O tamanho máximo de cada resposta da IA ao gerar um treinamento, em tokens.",
    unidade: "tokens",
    min: 1000,
    max: 64000,
    ler: (c) => c.treinamentoIa.maxTokens,
    escrever: (c, v) => void (c.treinamentoIa = { ...c.treinamentoIa, maxTokens: v }),
  },
];

const numericaDe = (chave: string) => NUMERICAS.find((n) => n.chave === chave);

/** O valor do ambiente de cada chave, guardado na primeira vez que o `config` é visto (antes de qualquer valor do banco entrar nele). */
const padroesDoAmbiente = new WeakMap<Config, Record<string, number>>();

function padroesDe(config: Config): Record<string, number> {
  let padroes = padroesDoAmbiente.get(config);
  if (!padroes) {
    padroes = Object.fromEntries(NUMERICAS.map((n) => [n.chave, n.ler(config)]));
    padroesDoAmbiente.set(config, padroes);
  }
  return padroes;
}

/** O que o banco guarda de cada chave (`undefined` = sem linha: vale o padrão). */
async function lerLinhas(deps: Pick<Deps, "db">) {
  const linhas = await deps.db.select().from(configuracao);
  return new Map(linhas.map((l) => [l.chave, l]));
}

/** A cidade padrão da previsão do tempo: a que o admin escolheu ou, sem escolha, Vitória. */
export async function cidadePadrao(deps: Pick<Deps, "db">): Promise<CidadePadrao> {
  const [linha] = await deps.db.select().from(configuracao).where(eq(configuracao.chave, "cidade_padrao"));
  const lida = linha ? esquemaCidade.safeParse(linha.valor) : null;
  return lida?.success ? lida.data : CIDADE_PADRAO_INICIAL;
}

/**
 * Os contatos do PAE que o botão de emergência mostra: os que o admin cadastrou em Configurações. Vazio até ele cadastrar (a Segurança do
 * Trabalho é quem fornece os números; o botão funciona sem eles e mostra só os números públicos).
 */
export async function contatosDoPae(deps: Pick<Deps, "db">): Promise<ContatoDeEmergencia[]> {
  const [linha] = await deps.db.select().from(configuracao).where(eq(configuracao.chave, "contatos_pae"));
  const lida = linha ? esquemaContatosDoPae.safeParse(linha.valor) : null;
  return lida?.success ? lida.data : [];
}

/**
 * Escreve no `config` da `api` os valores que o admin mudou. Chamada na subida e depois de cada mudança; guarda antes o valor do
 * ambiente, que é a volta ao padrão. Um valor guardado que ficou fora do limite permitido é ignorado (vale o padrão).
 */
export async function aplicarConfiguracoes(deps: Pick<Deps, "db" | "config">): Promise<void> {
  const padroes = padroesDe(deps.config);
  const linhas = await lerLinhas(deps);
  for (const n of NUMERICAS) {
    const valor = linhas.get(n.chave)?.valor;
    const lido = z.number().int().min(n.min).max(n.max).safeParse(valor);
    n.escrever(deps.config, lido.success ? lido.data : padroes[n.chave]!);
  }
}

export interface ConfiguracaoNumerica {
  chave: string;
  grupo: GrupoDeConfiguracao;
  rotulo: string;
  descricao: string;
  unidade: string;
  min: number;
  max: number;
  valor: number;
  padrao: number;
  personalizado: boolean;
  atualizado_em: string | null;
}

/** O que a tela de configurações do sistema mostra: a cidade padrão e cada valor, com o padrão e se o admin o mudou. */
export async function lerConfiguracoes(deps: Pick<Deps, "db" | "config">) {
  const padroes = padroesDe(deps.config);
  const linhas = await lerLinhas(deps);
  const linhaDaCidade = linhas.get("cidade_padrao");
  const cidade = await cidadePadrao(deps);
  const linhaDosContatos = linhas.get("contatos_pae");
  const itens: ConfiguracaoNumerica[] = NUMERICAS.map((n) => {
    const linha = linhas.get(n.chave);
    return {
      chave: n.chave,
      grupo: n.grupo,
      rotulo: n.rotulo,
      descricao: n.descricao,
      unidade: n.unidade,
      min: n.min,
      max: n.max,
      valor: n.ler(deps.config),
      padrao: padroes[n.chave]!,
      personalizado: Boolean(linha),
      atualizado_em: linha?.atualizadoEm.toISOString() ?? null,
    };
  });
  return {
    contatos_pae: { contatos: await contatosDoPae(deps), personalizado: Boolean(linhaDosContatos), atualizado_em: linhaDosContatos?.atualizadoEm.toISOString() ?? null },
    cidade_padrao: { ...cidade, padrao: CIDADE_PADRAO_INICIAL, personalizado: Boolean(linhaDaCidade), atualizado_em: linhaDaCidade?.atualizadoEm.toISOString() ?? null },
    itens,
  };
}

/** Confere o valor de uma chave e devolve o que fica guardado (`invalido` com a faixa permitida quando não cabe). */
export function validarConfiguracao(chave: string, valor: unknown): { chave: ConfiguracaoChave; valor: unknown; rotulo: string } {
  if (chave === "cidade_padrao") {
    const lida = esquemaCidade.safeParse(valor);
    if (!lida.success) throw invalido("cidade_invalida", "Informe o nome e a posição (latitude e longitude) da cidade");
    const c = lida.data;
    return { chave, valor: { nome: c.nome, latitude: Number(c.latitude.toFixed(4)), longitude: Number(c.longitude.toFixed(4)) }, rotulo: "Cidade padrão da previsão do tempo" };
  }
  if (chave === "contatos_pae") {
    const lidos = esquemaContatosDoPae.safeParse(valor);
    if (!lidos.success) throw invalido("contatos_invalidos", lidos.error.issues[0]?.message ?? "Confira os contatos do PAE");
    return { chave, valor: lidos.data, rotulo: "Contatos de emergência (PAE)" };
  }
  const n = numericaDe(chave);
  if (!n) throw naoEncontrado("Configuração inexistente");
  const lido = z.number().int().min(n.min).max(n.max).safeParse(valor);
  if (!lido.success) throw invalido("valor_invalido", `${n.rotulo}: informe um número inteiro de ${n.min} a ${n.max} (${n.unidade})`);
  return { chave: n.chave, valor: lido.data, rotulo: n.rotulo };
}

export const ehChaveDeConfiguracao = (chave: string): chave is ConfiguracaoChave => chave === "cidade_padrao" || chave === "contatos_pae" || Boolean(numericaDe(chave));
