/**
 * A previsão do tempo no navegador (`docs/operacao-de-campo.md`, seção 4.7): os tipos e as regras puras vêm de `shared/api/clima`
 * (o app usa os mesmos); aqui ficam o pedido à `api` (`GET /clima`, com a posição do aparelho e, sem ela, a cidade padrão), a posição
 * guardada para não pedir permissão em loop e o que a APR faz com a previsão que a pessoa viu: o rascunho guarda uma cópia
 * (`ClimaDoRascunho`) e a manda junto do `apr_concluida`.
 */

import type { FotoDoRascunho, RascunhoApr } from "./apr";
import { montarAvaliacao, montarPayload, trocarModelo, type ModeloDoRascunho } from "./apr";
import { ErroCliente, chamar } from "./cliente-api";
import { localizacaoNegada, obterPosicao, type Posicao } from "./geolocalizacao";
import type { ClimaRegistrado, JanelaDoClima, PrevisaoDoTempo } from "./clima-comum";

export * from "./clima-comum";

// ---- Posição -------------------------------------------------------------------------------------------------------

const CHAVE_DA_POSICAO = "synqos:posicao-do-clima-2";
const VALIDADE_DA_POSICAO_MS = 10 * 60_000;
/** Mais folga que os 8 s do registro da execução: a previsão aceita a posição aproximada, mas o navegador pode levar um tempo. */
const TEMPO_DA_POSICAO_DO_CLIMA_MS = 15_000;

interface PosicaoGuardada {
  em: number;
  /** `null`: a pessoa negou a permissão (vale por dez minutos, para não repetir o pedido). Se o aparelho só não deu a posição, grava `em: 0` e a próxima consulta tenta de novo. */
  posicao: Posicao | null;
}

let guardada: PosicaoGuardada | null = null;
let pedindo: Promise<Posicao | null> | null = null;

function lerDaSessao(): PosicaoGuardada | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_DA_POSICAO);
    return bruto ? (JSON.parse(bruto) as PosicaoGuardada) : null;
  } catch {
    return null;
  }
}

function gravarNaSessao(valor: PosicaoGuardada) {
  try {
    window.sessionStorage.setItem(CHAVE_DA_POSICAO, JSON.stringify(valor));
  } catch {
    /* armazenamento bloqueado: segue só na memória da aba */
  }
}

/**
 * A posição do aparelho para a previsão: a última guardada (na memória e na sessão do navegador) enquanto tiver menos de dez
 * minutos; senão pede ao navegador, uma vez por vez. Sem permissão ou sem sinal de GPS devolve `null` e a `api` usa a cidade padrão.
 */
export async function posicaoParaOClima(): Promise<Posicao | null> {
  const agora = Date.now();
  const recente = (g: PosicaoGuardada | null) => (g && agora - g.em < VALIDADE_DA_POSICAO_MS ? g : null);
  const guardadaAgora = recente(guardada) ?? recente(lerDaSessao());
  if (guardadaAgora) {
    guardada = guardadaAgora;
    return guardadaAgora.posicao;
  }
  pedindo ??= obterPosicao({ precisa: false, tempoMaximoMs: TEMPO_DA_POSICAO_DO_CLIMA_MS })
    .then(async (posicao) => {
      // Falha ou demora não é recusa: só a permissão negada de fato guarda o `null` por mais tempo; senão tenta de novo logo.
      const validade = posicao || (await localizacaoNegada()) ? Date.now() : 0;
      guardada = { em: validade, posicao };
      gravarNaSessao(guardada);
      return posicao;
    })
    .finally(() => {
      pedindo = null;
    });
  return pedindo;
}

// ---- Consulta ------------------------------------------------------------------------------------------------------

/**
 * `GET /clima` na janela pedida. `undefined` quando a previsão não existe nesta tela (o Campo de treino responde 404): quem chama
 * esconde o cartão, sem erro. Qualquer outra falha vira `null`: "previsão indisponível", sem alarde e sem bloquear nada.
 */
export async function buscarPrevisao(janela: JanelaDoClima): Promise<PrevisaoDoTempo | null | undefined> {
  const posicao = await posicaoParaOClima();
  const consulta = new URLSearchParams({ janela });
  if (posicao) {
    consulta.set("latitude", String(posicao.latitude));
    consulta.set("longitude", String(posicao.longitude));
  }
  try {
    return await chamar<PrevisaoDoTempo>("GET", `/clima?${consulta.toString()}`);
  } catch (e) {
    if (e instanceof ErroCliente && e.status === 404) return undefined;
    return null;
  }
}

// ---- A APR ---------------------------------------------------------------------------------------------------------

/** A previsão que a pessoa viu ao responder a pergunta de clima, e a pergunta a que ela pertence. */
export interface ClimaDoRascunho {
  itemId: string;
  registro: ClimaRegistrado;
}

/**
 * O rascunho da APR com o clima. O tipo do rascunho é do `shared` (o app o usa também); o clima fica num campo a mais do mesmo objeto,
 * que o armazenamento do navegador já preserva (`state/rascunho-apr`).
 */
export type RascunhoComClima = RascunhoApr & { clima?: ClimaDoRascunho | null };

export const climaDoRascunho = (r: RascunhoApr): ClimaDoRascunho | null => (r as RascunhoComClima).clima ?? null;

/** Guarda (ou, com `null`, apaga) a previsão que a pessoa viu na pergunta de clima. */
export const guardarClima = (r: RascunhoApr, itemId: string, registro: ClimaRegistrado | null): RascunhoApr => ({ ...r, clima: registro ? { itemId, registro } : null }) as RascunhoComClima;

/** Esquece o clima da pergunta e a foto do local que ficou nela (a pessoa mudou a resposta de "Sim"). */
export function esquecerClima(r: RascunhoApr, itemId: string): RascunhoApr {
  const fotos = { ...r.fotos };
  delete fotos[itemId];
  return { ...guardarClima(r, itemId, null), fotos };
}

/** Tira a resposta de uma pergunta ("Revisar a minha resposta" na janela do clima): ela volta a ficar em branco. */
export function desmarcarResposta(r: RascunhoApr, itemId: string): RascunhoApr {
  const respostas = { ...r.respostas };
  delete respostas[itemId];
  return { ...esquecerClima(r, itemId), respostas, concluidaEm: null, avaliacao: null };
}

/** `trocarModelo` apaga as respostas e as fotos; o clima da pergunta antiga também sai. */
export function trocarModeloSemClima(r: RascunhoApr, novo: ModeloDoRascunho, riscos: string[]) {
  const troca = trocarModelo(r, novo, riscos);
  return { ...troca, rascunho: { ...troca.rascunho, clima: null } as RascunhoComClima };
}

const fotoParaEvento = (f: FotoDoRascunho, itemId: string) => ({
  id: f.id,
  arquivo_id: f.arquivoId,
  item_id: itemId,
  capturada_em: f.capturadaEm,
  ...(f.latitude !== undefined && f.longitude !== undefined ? { latitude: f.latitude, longitude: f.longitude } : {}),
});

/** `POST /aprs/avaliar` com a previsão que a pessoa viu (a `api` a guarda também na APR bloqueada). */
export function montarAvaliacaoComClima(r: RascunhoApr) {
  const clima = climaDoRascunho(r);
  return clima ? { ...montarAvaliacao(r), clima: clima.registro } : montarAvaliacao(r);
}

/**
 * O payload do `apr_concluida` com a previsão e, no risco extremo, a foto do local: a foto vai como evidência do item de clima
 * (que foi respondido "Sim", por isso o `montarPayload` do `shared` não a leva: ele só leva a dos itens reprovados).
 */
export function montarPayloadComClima(r: RascunhoApr) {
  const base = montarPayload(r);
  const clima = climaDoRascunho(r);
  if (!clima) return base;
  const fotos = (r.fotos[clima.itemId] ?? []).map((f) => fotoParaEvento(f, clima.itemId));
  return { ...base, evidencias: [...base.evidencias, ...fotos], clima: clima.registro };
}
