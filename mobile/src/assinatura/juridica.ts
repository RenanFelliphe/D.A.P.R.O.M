import {
  CABECALHO_ASSINATURA_JURIDICA,
  CAMPO_ASSINATURA_JURIDICA_DO_EVENTO,
  EVENTOS_ASSINADOS,
  INTERVALO_DA_CONSULTA_DA_ASSINATURA_MS,
  VALIDADE_DA_ASSINATURA_JURIDICA_MIN,
  type AssinaturaJuridica,
} from "@shared/api/assinatura-juridica";
import type { EventoDeCampo } from "@shared/api/eventos";
import { ErroDeRede } from "../api/erros";

/**
 * O lado do app da assinatura com validade jurídica (`shared/api/assinatura-juridica.ts`). Esta parte não conhece React Native (o
 * `fetch`, o relógio e a janela entram por fora), então os testes a exercitam direto.
 */

// --- o código da assinatura que o ato em curso leva ----------------------------------------------------------------------------
let ativa: string | null = null;

/** O código da assinatura já confirmada no provedor que o próximo ato assinado leva (`null` fora da janela de assinatura). */
export const assinaturaJuridicaAtiva = (): string | null => ativa;

export function definirAssinaturaJuridica(id: string | null): void {
  ativa = id;
}

/** O cabeçalho das rotas que registram um ato assinado; vazio quando não há assinatura em curso. */
export const cabecalhosDaAssinaturaJuridica = (): Record<string, string> => (ativa ? { [CABECALHO_ASSINATURA_JURIDICA]: ativa } : {});

/**
 * O evento de campo assinado (`apr_assinada`, `encerramento_assinado`…) leva o código no `payload`, que é o que a fila grava: se o evento
 * esperar sinal e subir depois, a `api` o confere pelo instante em que o ato aconteceu. Os demais eventos passam intactos.
 */
export function comAssinaturaJuridicaNoEvento(evento: EventoDeCampo, codigo: string | null = ativa): EventoDeCampo {
  if (!codigo || !(EVENTOS_ASSINADOS as readonly string[]).includes(evento.tipo) || evento.payload[CAMPO_ASSINATURA_JURIDICA_DO_EVENTO]) return evento;
  return { ...evento, payload: { ...evento.payload, [CAMPO_ASSINATURA_JURIDICA_DO_EVENTO]: codigo } };
}

/**
 * A assinatura confirmada ainda serve a um ato? Vale por `VALIDADE_DA_ASSINATURA_JURIDICA_MIN` depois de assinada e uma vez só; um minuto de
 * folga evita o ato que sai na borda do prazo.
 */
export function aindaServeAoAto(a: AssinaturaJuridica, agora: number = Date.now()): boolean {
  if (a.situacao !== "assinada" || a.usada || !a.assinada_em) return false;
  return agora - Date.parse(a.assinada_em) < (VALIDADE_DA_ASSINATURA_JURIDICA_MIN - 1) * 60_000;
}

// --- a espera pela assinatura na página do provedor ----------------------------------------------------------------------------

/** A pessoa desistiu de esperar (o "Cancelar" ou o X da janela): não é falha, a janela só volta ao começo. */
export class AssinaturaCancelada extends Error {
  constructor() {
    super("Assinatura cancelada");
    this.name = "AssinaturaCancelada";
  }
}

/** A assinatura não se completou (recusada na página, falha no provedor, tempo esgotado): a mensagem já é para a pessoa. */
export class AssinaturaNaoConcluida extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "AssinaturaNaoConcluida";
  }
}

export const TEMPO_MAXIMO_DA_ESPERA_MS = VALIDADE_DA_ASSINATURA_JURIDICA_MIN * 60_000;

export interface OpcoesDaEspera {
  /** `GET /assinaturas-juridicas/{id}`: a `api` reconsulta o provedor. */
  consultar(): Promise<AssinaturaJuridica>;
  intervaloMs?: number;
  limiteMs?: number;
  agora?: () => number;
}

/**
 * Consulta a assinatura de tempos em tempos até ela ser assinada. `conferirJa` antecipa a consulta (o app voltou para a frente depois de a
 * pessoa assinar no navegador) e `cancelar` encerra a espera. A falta de sinal no meio não encerra: a pessoa pode estar assinando num
 * túnel de rede ruim, e a consulta se repete. Erro da `api` (a assinatura não existe mais) encerra.
 */
export function criarEspera({ consultar, intervaloMs = INTERVALO_DA_CONSULTA_DA_ASSINATURA_MS, limiteMs = TEMPO_MAXIMO_DA_ESPERA_MS, agora = Date.now }: OpcoesDaEspera) {
  let cancelado = false;
  let acordar: (() => void) | null = null;

  const dormir = (ms: number) =>
    new Promise<void>((resolver) => {
      const relogio = setTimeout(resolver, ms);
      acordar = () => {
        clearTimeout(relogio);
        resolver();
      };
    }).finally(() => {
      acordar = null;
    });

  return {
    cancelar(): void {
      cancelado = true;
      acordar?.();
    },
    conferirJa(): void {
      acordar?.();
    },
    async aguardar(): Promise<AssinaturaJuridica> {
      const inicio = agora();
      for (;;) {
        if (cancelado) throw new AssinaturaCancelada();
        await dormir(intervaloMs);
        if (cancelado) throw new AssinaturaCancelada();
        if (agora() - inicio > limiteMs) throw new AssinaturaNaoConcluida("O tempo para assinar acabou. Tente de novo.");
        let a: AssinaturaJuridica;
        try {
          a = await consultar();
        } catch (e) {
          if (e instanceof ErroDeRede) continue;
          throw e;
        }
        if (cancelado) throw new AssinaturaCancelada();
        if (a.situacao === "assinada") return a;
        if (a.situacao === "recusada") throw new AssinaturaNaoConcluida("A assinatura foi recusada na página do provedor. Tente de novo.");
        if (a.situacao === "falhou") throw new AssinaturaNaoConcluida("O provedor não conseguiu concluir a assinatura. Tente de novo.");
      }
    },
  };
}

export type Espera = ReturnType<typeof criarEspera>;
