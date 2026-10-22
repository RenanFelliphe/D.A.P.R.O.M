/**
 * A assinatura com validade jurídica (`docs/pessoas-e-equipes.md`, seção 3.3): no lugar do desenho do perfil, cada ato assinado passa
 * por um provedor de assinatura eletrônica (ZapSign). A pessoa confirma o ato na janela de assinatura, a janela cria o documento
 * (`POST /assinaturas-juridicas`), abre a página do provedor, espera a assinatura (`GET /assinaturas-juridicas/{id}`) e só então
 * manda o ato à `api` trazendo o código da assinatura: no cabeçalho `X-Assinatura-Juridica` das rotas e, nos eventos de campo, no campo
 * `assinatura_juridica_id` do `payload`. Cada assinatura vale para um ato só.
 *
 * Sem sinal não há provedor: o ato vale com a assinatura desenhada e fica `pendente_offline`, para a pessoa assinar depois, online
 * (`POST /assinaturas-juridicas/{id}/enviar`). Com o provedor desligado (`GET /me` diz `assinatura_juridica.ligada = false`), nada disto
 * acontece e a assinatura desenhada segue valendo sozinha.
 */

export const SITUACOES_DA_ASSINATURA_JURIDICA = ["pendente_offline", "aguardando", "assinada", "recusada", "falhou"] as const;
export type SituacaoDaAssinaturaJuridica = (typeof SITUACOES_DA_ASSINATURA_JURIDICA)[number];

export const ROTULO_DA_SITUACAO_DA_ASSINATURA_JURIDICA: Record<SituacaoDaAssinaturaJuridica, string> = {
  pendente_offline: "Feita sem sinal, falta assinar",
  aguardando: "Aguardando a assinatura",
  assinada: "Assinada",
  recusada: "Recusada",
  falhou: "Não foi possível enviar",
};

/** Cabeçalho que leva o código da assinatura às rotas que registram um ato assinado. */
export const CABECALHO_ASSINATURA_JURIDICA = "X-Assinatura-Juridica";

/** Campo do `payload` do evento de campo assinado que leva o código da assinatura. */
export const CAMPO_ASSINATURA_JURIDICA_DO_EVENTO = "assinatura_juridica_id";

/** Código de erro de quem tentou o ato online sem assinar no provedor: a janela de assinatura trata e abre a assinatura. */
export const ERRO_ASSINATURA_JURIDICA_PENDENTE = "assinatura_juridica_pendente";

/** Os eventos de campo que são atos assinados (os outros nunca pedem assinatura). */
export const EVENTOS_ASSINADOS = ["apr_assinada", "encerramento_assinado", "execucao_interrompida", "execucao_cancelada"] as const;

/** Depois de assinada, a assinatura espera o ato por este tempo; passado ele, é preciso assinar de novo. */
export const VALIDADE_DA_ASSINATURA_JURIDICA_MIN = 30;

export const LIMITE_DO_TITULO_DA_ASSINATURA = 120;
export const LIMITE_DO_RESUMO_DA_ASSINATURA = 600;

/** O que `GET /me` diz do provedor: se está ligado e se é o simulado (a página de assinatura é da própria `api`, sem validade jurídica). */
export interface ConfigDaAssinaturaJuridica {
  ligada: boolean;
  simulada: boolean;
}

/** Uma assinatura no provedor (`POST /assinaturas-juridicas`, `GET /assinaturas-juridicas/{id}`, `GET /assinaturas-juridicas`). */
export interface AssinaturaJuridica {
  id: string;
  /** O que a pessoa assina: o título da janela de assinatura. */
  titulo: string;
  resumo: string | null;
  situacao: SituacaoDaAssinaturaJuridica;
  /** A página de assinatura do provedor; só existe enquanto `aguardando`. */
  url_assinatura: string | null;
  criada_em: string;
  assinada_em: string | null;
  /** Já serviu a um ato (cada assinatura serve a um só). */
  usada: boolean;
  /** O PDF assinado já está guardado (`GET /assinaturas-juridicas/{id}/pdf`). */
  pdf_pronto: boolean;
  /** A OS de que o ato trata, quando há. */
  os_id: string | null;
  /** O ato nasceu sem sinal e valeu com a assinatura desenhada (ver `pendente_offline`). */
  origem_offline: boolean;
}

/** Uma assinatura na lista da OS (`GET /os/{id}/assinaturas-juridicas`): quem assinou e o que, para o supervisor e o admin conferirem. */
export interface AssinaturaJuridicaDaOs extends AssinaturaJuridica {
  usuario: { id: string; nome: string };
}

/** Corpo de `POST /assinaturas-juridicas`. */
export interface NovaAssinaturaJuridica {
  titulo: string;
  resumo?: string;
  /** A OS de que o ato trata, quando há: o termo mostra o número e o serviço. */
  os_id?: string;
}

/** Quanto tempo a janela espera, entre uma consulta e outra, pela assinatura no provedor. */
export const INTERVALO_DA_CONSULTA_DA_ASSINATURA_MS = 2500;
