/**
 * A conferência da execução na web (`docs/operacao-de-campo.md`, seções 6.5 a 6.7). O contrato e os textos vêm de `shared/api`
 * (o app `mobile` usa os mesmos); as regras puras do que cada tela mostra e habilita ficam aqui, sem React, para serem testadas
 * (`web/scripts/testar-conferencia.mts`).
 */
import {
  CONFERENCIA_EM_ABERTO,
  CONFERENCIA_ESPERANDO_DADOS,
  ESCOLHA_DESCARTAR,
  type CampoDaConferencia,
  type ConferenciaDaApi,
  type ConferenciaDaOs,
  type ConferenciaResumo,
  type EstadoDaConferencia,
} from "../../../shared/api/conferencia-execucao";
import { ROTULO_DE_DESCARTAR, descreverOpcao } from "../../../shared/api/conferencia-texto";

export * from "../../../shared/api/conferencia-execucao";
export * from "../../../shared/api/conferencia-texto";

/** O tom do aviso (o mesmo de `Notice`) e o ícone-padrão de cada situação. */
export type TomDaConferencia = "al" | "info" | "ok";

/** A conferência em aberto (a mais nova, se houver mais de uma) ou, sem nenhuma, a mais recente: a `api` entrega do mais antigo ao mais novo. */
export function conferenciaEmDestaque<T extends Pick<ConferenciaDaOs, "estado">>(lista: readonly T[]): T | null {
  const emAberto = lista.filter((c) => CONFERENCIA_EM_ABERTO.includes(c.estado));
  return emAberto.at(-1) ?? lista.at(-1) ?? null;
}

/** A conferência que a tela abre: a pedida em `?c` (se for desta OS) ou a em destaque. */
export function conferenciaParaAbrir(lista: readonly ConferenciaDaOs[], pedida?: string | null): ConferenciaDaOs | null {
  return (pedida ? lista.find((c) => c.id === pedida) : undefined) ?? conferenciaEmDestaque(lista);
}

/** A assinatura final do supervisor espera: há conferência cujas versões ainda não foram conferidas (a `api` recusa com 409 `conferencia_pendente`). */
export function assinaturaFinalEsperaConferencia(lista: readonly Pick<ConferenciaDaOs, "estado">[] | null | undefined): boolean {
  return (lista ?? []).some((c) => CONFERENCIA_ESPERANDO_DADOS.includes(c.estado));
}

export interface AvisoDaConferencia {
  conferenciaId: string;
  tom: TomDaConferencia;
  titulo: string;
  texto: string;
  /** O texto do botão que leva à tela da conferência. */
  rotuloDoLink: string;
}

const AVISO_DO_ESTADO: Record<EstadoDaConferencia, { tom: TomDaConferencia; titulo: string; texto: string; rotuloDoLink: string }> = {
  aguardando_sincronizacao: {
    tom: "al",
    titulo: "Esperando todos sincronizarem",
    texto: "Parte da execução foi registrada sem sinal, em aparelhos diferentes. Quando todos sincronizarem, o sistema compara os registros.",
    rotuloDoLink: "Acompanhar a conferência",
  },
  aguardando_responsavel: {
    tom: "al",
    titulo: "Esperando a escolha das versões",
    texto: "Os aparelhos registraram a execução de jeitos diferentes. O responsável escolhe a versão certa de cada diferença.",
    rotuloDoLink: "Abrir a conferência",
  },
  aguardando_assinaturas: {
    tom: "info",
    titulo: "Faltam ciências e assinaturas",
    texto: "As versões já foram conferidas. Falta a equipe dar a ciência ou assinar.",
    rotuloDoLink: "Abrir a conferência",
  },
  concluida: {
    tom: "ok",
    titulo: "Conferência concluída",
    texto: "A equipe conferiu o que foi registrado em cada aparelho.",
    rotuloDoLink: "Ver a conferência",
  },
  fechada_sem_todos: {
    tom: "info",
    titulo: "Fechada com o que existia",
    texto: "A conferência foi fechada sem esperar quem faltou.",
    rotuloDoLink: "Ver a conferência",
  },
};

/** O aviso do detalhe da OS: `null` quando a OS não teve conferência. */
export function avisoDaConferenciaNaOs(lista: readonly ConferenciaDaOs[] | null | undefined): AvisoDaConferencia | null {
  const c = conferenciaEmDestaque(lista ?? []);
  if (!c) return null;
  return { conferenciaId: c.id, ...AVISO_DO_ESTADO[c.estado] };
}

/** O recado que fica no lugar do botão da assinatura final do supervisor enquanto a conferência não comparou as versões. */
export const AVISO_DA_ASSINATURA_FINAL_ESPERA =
  "A assinatura final espera a conferência da execução: parte do serviço foi registrada sem sinal, em aparelhos diferentes, e as versões ainda não foram conferidas.";

/** O código com que a `api` recusa a assinatura final (409) enquanto a conferência espera. */
export const CODIGO_CONFERENCIA_PENDENTE = "conferencia_pendente";

// ---------- A tela da conferência ----------

/** Só o que a tela precisa para saber de que lado cada coisa está. */
type ParaEscolher = Pick<ConferenciaDaApi, "campos" | "decisoes" | "eu">;

/** O campo já tem escolha gravada (feita por quem decide). */
export const campoDecidido = (c: Pick<ConferenciaDaApi, "decisoes">, campo: string) => c.decisoes.some((d) => d.campo === campo);

/** Os campos que quem olha escolhe agora (o `eu.pode_decidir` da `api`, na ordem da tela, só os que existem). */
export function camposParaEscolher(c: ParaEscolher): CampoDaConferencia[] {
  return c.campos.filter((campo) => c.eu.pode_decidir.includes(campo.campo));
}

/** O que está marcado num campo: a troca que a pessoa fez, a escolha já gravada ou o padrão sugerido. */
export function escolhaEfetiva(c: Pick<ConferenciaDaApi, "decisoes">, campo: CampoDaConferencia, trocas: Readonly<Record<string, string>>): string {
  return trocas[campo.campo] ?? c.decisoes.find((d) => d.campo === campo.campo)?.escolha ?? campo.sugerido;
}

/** A escolha é uma das versões do campo ou, só na pausa de um aparelho só, "descartar". */
export function escolhaValida(campo: CampoDaConferencia, escolha: string): boolean {
  if (escolha === ESCOLHA_DESCARTAR) return campo.so_um;
  return campo.opcoes.some((o) => o.autor_id === escolha);
}

/** O corpo de `POST /conferencias/{id}/decidir`: um item por campo que a pessoa escolhe (as escolhas inválidas ficam de fora). */
export function escolhasParaEnviar(c: ParaEscolher, trocas: Readonly<Record<string, string>>): { campo: string; escolha: string }[] {
  return camposParaEscolher(c)
    .map((campo) => ({ campo: campo.campo, escolha: escolhaEfetiva(c, campo, trocas) }))
    .filter((e) => escolhaValida(c.campos.find((campo) => campo.campo === e.campo)!, e.escolha));
}

/** Separa o que pede atenção (as versões divergem) do que os aparelhos concordam. */
export function separarCampos(campos: readonly CampoDaConferencia[]): { divergentes: CampoDaConferencia[]; conferem: CampoDaConferencia[] } {
  return { divergentes: campos.filter((c) => c.divergente), conferem: campos.filter((c) => !c.divergente) };
}

export type AcaoDaTela = "escolher" | "ciencia" | "assinar" | "fechar" | "acompanhar";

/**
 * O que a tela põe em primeiro plano para quem olha: escolher (se tem campo para decidir), dar a ciência (resumo) ou assinar
 * (com divergência) quando falta ele, fechar com o que existe, ou só acompanhar. O "fechar" nunca esconde a escolha nem a assinatura.
 */
export function acaoDaTela(c: Pick<ConferenciaDaApi, "estado" | "tipo" | "eu">): AcaoDaTela {
  if (c.estado === "concluida" || c.estado === "fechada_sem_todos") return "acompanhar";
  if (c.eu.pode_decidir.length > 0) return "escolher";
  if (c.eu.deve_assinar && c.estado === "aguardando_assinaturas") return c.tipo === "resumo" ? "ciencia" : "assinar";
  if (c.eu.pode_fechar) return "fechar";
  return "acompanhar";
}

/** A conferência anda: a tela relê sozinha (depois de concluída ou fechada, nada mais muda). */
export const conferenciaAnda = (c: Pick<ConferenciaDaApi, "estado">) => CONFERENCIA_EM_ABERTO.includes(c.estado);

export interface EtapaDaConferencia {
  rotulo: string;
  situacao: "feita" | "atual" | "futura";
}

/** Os passos da conferência, para a trilha no alto da tela: sincronizar, comparar ou escolher, ciências ou assinaturas, e o fim. */
export function etapasDaConferencia(c: Pick<ConferenciaDaApi, "estado" | "tipo">): EtapaDaConferencia[] {
  const atual = { aguardando_sincronizacao: 0, aguardando_responsavel: 1, aguardando_assinaturas: 2, concluida: 4, fechada_sem_todos: 4 }[c.estado];
  const rotulos = [
    "Sincronizar",
    c.tipo === "com_divergencia" ? "Escolher as versões" : "Comparar",
    c.tipo === "resumo" ? "Ciências" : c.tipo === "com_divergencia" ? "Assinaturas" : "Ciências e assinaturas",
    c.estado === "fechada_sem_todos" ? "Fechada" : "Concluída",
  ];
  // O resumo não tem escolha: depois de sincronizar, a comparação já leva às ciências.
  return rotulos.map((rotulo, i) => ({ rotulo, situacao: i < atual ? "feita" : i === atual ? "atual" : "futura" }));
}

/** A linha de cada participante: se sincronizou e o que já deu (ciência, assinatura, ressalva). */
export function situacaoDoParticipante(p: ConferenciaDaApi["participantes"][number], responsavelId: string | null): { sincronia: string; assinatura: string; tom: "enc" | "al" | "neu" } {
  const sincronia = p.sincronizou ? "Sincronizou" : "Falta sincronizar";
  if (p.usuario.id === responsavelId) return { sincronia, assinatura: "Responsável pela conferência", tom: p.sincronizou ? "enc" : "al" };
  if (p.assinatura) {
    const verbo = p.assinatura.tipo === "ciencia" ? "Deu ciência" : "Assinou";
    return { sincronia, assinatura: p.assinatura.ressalva ? `${verbo} com ressalva` : verbo, tom: "enc" };
  }
  return { sincronia, assinatura: p.deve_assinar ? "Falta a ciência ou assinatura" : "Sem ciência a dar", tom: p.sincronizou ? "al" : "neu" };
}

/** As ressalvas dos que assinaram, para o supervisor e o responsável lerem. */
export function ressalvasDaConferencia(c: Pick<ConferenciaDaApi, "participantes">): { nome: string; ressalva: string; quando: string }[] {
  return c.participantes.flatMap((p) => (p.assinatura?.ressalva ? [{ nome: p.usuario.nome, ressalva: p.assinatura.ressalva, quando: p.assinatura.assinada_em }] : []));
}

/** A linha "Para conferir" do perfil e a faixa: o que ainda é do usuário fazer (fora o "aguardar"). */
export const pedeAcaoDoUsuario = (r: Pick<ConferenciaResumo, "minha_acao">) => r.minha_acao !== "aguardar";

/** As conferências que a faixa chama a atenção: escolher, dar a ciência ou assinar. O "fechar" fica só no cartão do perfil. */
export const pedeAtencaoNaFaixa = (r: Pick<ConferenciaResumo, "minha_acao">) => r.minha_acao === "decidir" || r.minha_acao === "ciencia" || r.minha_acao === "assinar";

/** O que a escolha de um campo vai valer, numa linha, para a janela de confirmação: "Ana: 19/10/2026 12:10", "Aceitar a pausa (…)" ou "Descartar a pausa". */
export function textoDaEscolha(campo: CampoDaConferencia, escolha: string): string {
  if (escolha === ESCOLHA_DESCARTAR) return ROTULO_DE_DESCARTAR;
  const o = campo.opcoes.find((x) => x.autor_id === escolha);
  if (!o) return "—";
  const valor = descreverOpcao(campo.campo, o);
  return campo.so_um ? `Aceitar a pausa (${valor})` : `${o.autor_nome}: ${valor}`;
}
