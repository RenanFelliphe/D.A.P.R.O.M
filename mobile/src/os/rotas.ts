import type { Href, useRouter } from "expo-router";

type Roteador = ReturnType<typeof useRouter>;

/** O que cada botão de ação do detalhe da OS faz: abre a tela de campo da situação (APR, assinaturas, execução ou encerramento). */
export type AcaoDeCampo = "iniciar-apr" | "assinar-apr" | "iniciar-execucao" | "continuar-execucao" | "acompanhar-execucao" | "preencher-encerramento" | "acompanhar-assinaturas" | "abrir-conferencia";

/** Os caminhos das telas de uma OS. A APR tem três: escolha do modelo, checklist e assinaturas (ou o impedimento, se reprovar). */
export const rotas = {
  os: (id: string) => `/os/${id}` as Href,
  apr: (id: string) => `/os/${id}/apr` as Href,
  checklist: (id: string) => `/os/${id}/checklist` as Href,
  aprovada: (id: string) => `/os/${id}/aprovada` as Href,
  bloqueio: (id: string) => `/os/${id}/bloqueio` as Href,
  execucao: (id: string) => `/os/${id}/execucao` as Href,
  /** A conferência da execução; `c` é a conferência (a tela abre a mais recente da OS quando não vem). */
  conferencia: (id: string, c?: string) => (c ? `/os/${id}/conferencia?c=${c}` : `/os/${id}/conferencia`) as Href,
};

export const rotaDaOs = rotas.os;

/** Sugerir ou contestar a lista de materiais de um serviço (`/materiais/nova`); o código do serviço vai como parâmetro, sem montar a URL à mão. */
export const rotaDaNovaSugestaoDeMateriais = (atividade: string, tipo: "sugestao" | "contestacao"): Href => ({ pathname: "/materiais/nova", params: { atividade, tipo } }) as Href;

/** A tela de cada ação do detalhe da OS. */
export const rotaDaAcao = (acao: AcaoDeCampo, osId: string, conferenciaId?: string): Href => {
  switch (acao) {
    case "iniciar-apr":
      return rotas.apr(osId);
    case "assinar-apr":
    case "acompanhar-assinaturas":
      return rotas.aprovada(osId);
    case "iniciar-execucao":
    case "continuar-execucao":
    case "acompanhar-execucao":
    case "preencher-encerramento":
      return rotas.execucao(osId);
    case "abrir-conferencia":
      return rotas.conferencia(osId, conferenciaId);
  }
};

export const irParaAcao = (router: Roteador, acao: AcaoDeCampo, osId: string, conferenciaId?: string) => router.push(rotaDaAcao(acao, osId, conferenciaId));
