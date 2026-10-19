import type { Href, useRouter } from "expo-router";

type Roteador = ReturnType<typeof useRouter>;

/** O que cada botão de ação do detalhe da OS faz: abre a tela de campo da situação (APR, assinaturas, execução ou encerramento). */
export type AcaoDeCampo = "iniciar-apr" | "assinar-apr" | "iniciar-execucao" | "continuar-execucao" | "preencher-encerramento" | "acompanhar-assinaturas";

/** Os caminhos das telas de uma OS. A APR tem três: escolha do modelo, checklist e assinaturas (ou o impedimento, se reprovar). */
export const rotas = {
  os: (id: string) => `/os/${id}` as Href,
  apr: (id: string) => `/os/${id}/apr` as Href,
  checklist: (id: string) => `/os/${id}/checklist` as Href,
  aprovada: (id: string) => `/os/${id}/aprovada` as Href,
  bloqueio: (id: string) => `/os/${id}/bloqueio` as Href,
  execucao: (id: string) => `/os/${id}/execucao` as Href,
};

export const rotaDaOs = rotas.os;

/** A tela de cada ação do detalhe da OS. */
export const rotaDaAcao = (acao: AcaoDeCampo, osId: string): Href => {
  switch (acao) {
    case "iniciar-apr":
      return rotas.apr(osId);
    case "assinar-apr":
    case "acompanhar-assinaturas":
      return rotas.aprovada(osId);
    case "iniciar-execucao":
    case "continuar-execucao":
    case "preencher-encerramento":
      return rotas.execucao(osId);
  }
};

export const irParaAcao = (router: Roteador, acao: AcaoDeCampo, osId: string) => router.push(rotaDaAcao(acao, osId));
