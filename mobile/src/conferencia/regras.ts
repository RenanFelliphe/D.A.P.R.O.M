import {
  CONFERENCIA_EM_ABERTO,
  ESCOLHA_DESCARTAR,
  ROTULO_DO_ESTADO_DA_CONFERENCIA,
  ROTULO_DO_TIPO_DA_CONFERENCIA,
  type CampoDaConferencia,
  type ConferenciaDaApi,
  type ConferenciaDaOs,
  type ConferenciaResumo,
  type EstadoDaConferencia,
} from "@shared/api/conferencia-execucao";
import { descreverOpcao, ROTULO_DE_DESCARTAR, rotuloDaOpcao } from "@shared/api/conferencia-texto";
import type { TomDoAviso } from "@/tema/tema";

/**
 * As regras da tela da conferência da execução, sem React: qual conferência a tela abre, as escolhas pré-marcadas, o corpo do
 * `POST /conferencias/{id}/decidir`, o que cada campo mostra e as faixas do perfil e da OS. Os textos longos (o passo, o prazo, o que
 * cada opção significa) vêm de `shared/api/conferencia-texto.ts`, os mesmos da web.
 */

export const conferenciaEmAberto = (c: { estado: EstadoDaConferencia }) => CONFERENCIA_EM_ABERTO.includes(c.estado);

/**
 * Qual conferência da OS a tela abre quando ninguém disse qual (`c`): a mais recente que ainda anda (é a que pede algo da pessoa);
 * sem nenhuma em aberto, a mais recente de todas. `GET /os/{id}` as devolve da mais antiga para a mais nova.
 */
export function conferenciaPadrao(conferencias: readonly ConferenciaDaOs[] | undefined): ConferenciaDaOs | null {
  const lista = conferencias ?? [];
  return lista.findLast(conferenciaEmAberto) ?? lista.at(-1) ?? null;
}

/** O nome de um autor das versões (o aparelho que registrou), pelo id; `—` se a conferência não o tem. */
export const nomeDoAutor = (c: Pick<ConferenciaDaApi, "versoes">, autorId: string | null): string | null => (autorId ? (c.versoes.find((v) => v.autor_id === autorId)?.autor_nome ?? "—") : null);

// ---------------------------------------------------------------------------------------------------------------
// A escolha de cada campo

export interface OpcaoParaEscolher {
  /** O que vai em `escolha`: o `autor_id` de quem registrou, ou `descartar` (só na pausa de um aparelho só). */
  valor: string;
  /** O texto do botão ("Valer o de Ana", "Aceitar a pausa", "Descartar a pausa"). */
  rotulo: string;
  /** O que essa opção registrou, numa linha ("19/10/2026 12:10", "Almoço, das 13:00 às 14:00"), ou o que o descarte faz. */
  detalhe: string;
  /** É o padrão que o sistema sugere. */
  sugerida: boolean;
  /** É o que está valendo na execução agora, antes da escolha. */
  valendo: boolean;
}

/** As opções de um campo, na ordem da `api`; na pausa de um aparelho só, "aceitar" e "descartar". */
export function opcoesParaEscolher(c: Pick<ConferenciaDaApi, "versoes">, campo: CampoDaConferencia): OpcaoParaEscolher[] {
  const opcoes = campo.opcoes.map<OpcaoParaEscolher>((o) => ({
    valor: o.autor_id,
    rotulo: rotuloDaOpcao(campo, o),
    detalhe: campo.so_um ? descreverOpcao(campo.campo, o) : `${o.autor_nome}: ${descreverOpcao(campo.campo, o)}`,
    sugerida: campo.sugerido === o.autor_id,
    valendo: campo.valendo_de === o.autor_id,
  }));
  if (campo.so_um) opcoes.push({ valor: ESCOLHA_DESCARTAR, rotulo: ROTULO_DE_DESCARTAR, detalhe: "A pausa sai da execução.", sugerida: false, valendo: false });
  return opcoes;
}

/** A escolha vale para o campo? Uma versão que ele tem, ou o descarte da pausa de um aparelho só. */
export function escolhaValida(campo: CampoDaConferencia, escolha: string): boolean {
  if (escolha === ESCOLHA_DESCARTAR) return campo.so_um;
  return campo.opcoes.some((o) => o.autor_id === escolha);
}

/** O campo que a pessoa pode escolher agora: a `api` o lista em `eu.pode_decidir` e ele pede escolha (divergente). */
export const camposParaEscolher = (c: Pick<ConferenciaDaApi, "campos" | "eu">): CampoDaConferencia[] => c.campos.filter((campo) => campo.divergente && c.eu.pode_decidir.includes(campo.campo));

/** O que vem pré-marcado: o padrão sugerido de cada campo que a pessoa escolhe (se o sugerido não for uma das opções, a primeira). */
export function escolhasIniciais(c: Pick<ConferenciaDaApi, "campos" | "eu">): Record<string, string> {
  const escolhas: Record<string, string> = {};
  for (const campo of camposParaEscolher(c)) {
    const inicial = escolhaValida(campo, campo.sugerido) ? campo.sugerido : campo.opcoes[0]?.autor_id;
    if (inicial) escolhas[campo.campo] = inicial;
  }
  return escolhas;
}

/**
 * O corpo do `POST /conferencias/{id}/decidir`: uma escolha por campo que a pessoa decide agora, na ordem da conferência. O que ela não
 * mexeu vale o sugerido (é o que a tela mostrava marcado); uma escolha que não serve para o campo também cai no sugerido.
 */
export function corpoDeDecidir(c: Pick<ConferenciaDaApi, "campos" | "eu">, escolhas: Record<string, string>): { escolhas: { campo: string; escolha: string }[] } {
  const iniciais = escolhasIniciais(c);
  return {
    escolhas: camposParaEscolher(c).flatMap((campo) => {
      const pedida = escolhas[campo.campo];
      const escolha = pedida && escolhaValida(campo, pedida) ? pedida : iniciais[campo.campo];
      return escolha ? [{ campo: campo.campo, escolha }] : [];
    }),
  };
}

/** O que a escolha de um campo mostra depois de feita: o texto e quem escolheu. */
export function escolhaFeita(c: Pick<ConferenciaDaApi, "decisoes" | "versoes">, campo: string): { escolha: string; porNome: string | null; descartada: boolean } | null {
  const d = c.decisoes.find((x) => x.campo === campo);
  if (!d) return null;
  return { escolha: d.escolha, porNome: d.decidida_por?.nome ?? null, descartada: d.escolha === ESCOLHA_DESCARTAR };
}

export type SituacaoDoCampo = "sem_divergencia" | "decidido" | "para_mim" | "esperando_outro";

/** Em que pé o campo está para quem olha: todos concordam, já foi escolhido, é a pessoa quem escolhe, ou é de outra pessoa. */
export function situacaoDoCampo(c: Pick<ConferenciaDaApi, "decisoes" | "eu">, campo: CampoDaConferencia): SituacaoDoCampo {
  if (!campo.divergente) return "sem_divergencia";
  if (c.decisoes.some((d) => d.campo === campo.campo)) return "decidido";
  return c.eu.pode_decidir.includes(campo.campo) ? "para_mim" : "esperando_outro";
}

/** Quantas diferenças ainda esperam escolha (de qualquer pessoa). */
export const diferencasSemEscolha = (c: Pick<ConferenciaDaApi, "campos" | "decisoes">): number => c.campos.filter((campo) => campo.divergente && !c.decisoes.some((d) => d.campo === campo.campo)).length;

// ---------------------------------------------------------------------------------------------------------------
// A assinatura (ciência) e o fechamento

/** O que o botão e a janela de assinar dizem: ciência no resumo, assinatura quando houve divergência. */
export function textosDeAssinar(tipo: ConferenciaDaApi["tipo"]): { botao: string; janela: string; resumo: string; confirmar: string } {
  return tipo === "resumo"
    ? { botao: "Dar ciência", janela: "Dar ciência", resumo: "Os registros dos aparelhos batem. Ao dar a ciência, você confirma que conferiu o resumo da execução.", confirmar: "Dar ciência" }
    : { botao: "Assinar", janela: "Assinar a conferência", resumo: "Você confirma que conferiu a execução como o responsável escolheu. Se discordar de algo, escreva a ressalva: ela vai ao supervisor e ao relatório, e não trava nada.", confirmar: "Assinar" };
}

/** O corpo do `POST /conferencias/{id}/assinar`: a ressalva só vai se foi escrita. */
export const corpoDeAssinar = (ressalva: string): { ressalva?: string } => {
  const texto = ressalva.trim();
  return texto ? { ressalva: texto } : {};
};

/** O texto do botão de assinar quando a pessoa escreveu uma ressalva. */
export const rotuloDoBotaoDeAssinar = (tipo: ConferenciaDaApi["tipo"], ressalva: string): string => (tipo === "resumo" ? "Dar ciência" : ressalva.trim() ? "Assinar com ressalva" : "Assinar");

/** O que a janela de "Fechar com o que existe" explica: segue sem quem faltou e vale o padrão sugerido onde ninguém escolheu. */
export const EXPLICACAO_DE_FECHAR = "A conferência fecha agora, sem esperar quem ainda falta sincronizar, escolher ou assinar. Onde ninguém escolheu, vale o padrão sugerido pelo sistema. Os nomes de quem faltou ficam no relatório da execução.";

// ---------------------------------------------------------------------------------------------------------------
// As faixas: o perfil, a lista de OS e o detalhe da OS

/** Das conferências em aberto, as que esperam algo da pessoa agora (escolher, dar a ciência ou assinar). */
export const conferenciasQuePedemAcao = (lista: readonly ConferenciaResumo[] | undefined): ConferenciaResumo[] =>
  (lista ?? []).filter((c) => c.minha_acao === "decidir" || c.minha_acao === "ciencia" || c.minha_acao === "assinar");

/** A faixa discreta de toda tela: o título e a frase do que a pessoa precisa fazer, ou `null` se nada pede a vez dela. */
export function faixaDeConferencia(lista: readonly ConferenciaResumo[] | undefined): { conferencia: ConferenciaResumo; titulo: string; texto: string } | null {
  const pedem = conferenciasQuePedemAcao(lista);
  const c = pedem[0];
  if (!c) return null;
  const os = c.os.numero_ordem ?? c.os.titulo;
  const verbo = c.minha_acao === "decidir" ? "escolher a versão certa da execução" : c.minha_acao === "ciencia" ? "dar a ciência do resumo da execução" : "assinar a conferência da execução";
  const mais = pedem.length > 1 ? ` (e mais ${pedem.length - 1})` : "";
  return { conferencia: c, titulo: `Falta ${verbo}${mais}`, texto: `OS ${os}. Toque para abrir.` };
}

/** A linha do estado da conferência no cartão "Para conferir" do perfil. */
export function descricaoDoResumo(c: ConferenciaResumo): string {
  const tipo = c.tipo ? ` · ${ROTULO_DO_TIPO_DA_CONFERENCIA[c.tipo]}` : "";
  return `${ROTULO_DO_ESTADO_DA_CONFERENCIA[c.estado]}${tipo}`;
}

/** O que a OS mostra de cada conferência da execução: o tom, o estado e o que isso quer dizer. */
export function avisoDaConferenciaNaOs(c: ConferenciaDaOs): { tom: TomDoAviso; titulo: string; texto: string } {
  const titulo = `Conferência da execução: ${ROTULO_DO_ESTADO_DA_CONFERENCIA[c.estado].toLowerCase()}.`;
  switch (c.estado) {
    case "aguardando_sincronizacao":
      return { tom: "al", titulo, texto: "Parte da execução foi registrada sem sinal, em aparelhos diferentes. O sistema compara quando todos sincronizarem." };
    case "aguardando_responsavel":
      return { tom: "al", titulo, texto: "Os aparelhos registraram a execução de jeitos diferentes e alguém da equipe precisa escolher a versão certa. O supervisor assina a OS por último, depois disso." };
    case "aguardando_assinaturas":
      return { tom: "al", titulo, texto: c.tipo === "resumo" ? "Os registros batem. Falta a ciência de quem participou." : "As versões já foram escolhidas. Falta a assinatura de quem participou." };
    case "concluida":
      return { tom: "ok", titulo, texto: "A equipe conferiu o que cada aparelho registrou." };
    case "fechada_sem_todos":
      return { tom: "info", titulo, texto: "A conferência fechou sem esperar quem faltou." };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Tons e resumos da tela

/** O tom do selo do estado da conferência: o que anda é amarelo, o que terminou conferido é verde, o fechado sem todos é neutro. */
export const tomDoSeloDoEstado = (estado: EstadoDaConferencia): "al" | "enc" | "neu" => (estado === "concluida" ? "enc" : estado === "fechada_sem_todos" ? "neu" : "al");

/** O tom do aviso do passo no alto da tela: pede a vez da pessoa (amarelo), terminou (verde), ou só espera os outros (azul). */
export function tomDoPasso(c: Pick<ConferenciaDaApi, "estado" | "eu">): TomDoAviso {
  if (c.estado === "concluida") return "ok";
  if (c.estado === "fechada_sem_todos") return "info";
  return c.eu.pode_decidir.length > 0 || c.eu.deve_assinar ? "al" : "info";
}

/** A escolha de um campo numa linha, para a janela de confirmação: "Valer o de Ana (19/10/2026 12:10)" ou "Descartar a pausa". */
export function resumoDaEscolha(campo: CampoDaConferencia, escolha: string): string {
  if (escolha === ESCOLHA_DESCARTAR) return ROTULO_DE_DESCARTAR;
  const opcao = campo.opcoes.find((o) => o.autor_id === escolha);
  return opcao ? `${rotuloDaOpcao(campo, opcao)} (${descreverOpcao(campo.campo, opcao)})` : "—";
}
