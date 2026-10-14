import { z } from "zod";
import type { ClienteSap, OrdemSap, PaginaDeOrdens } from "./sap";

/** O envelope da página; cada ordem é validada depois, uma a uma, para que uma ordem ruim não derrube a leitura. */
const esquemaPagina = z.object({
  ordens: z.array(z.record(z.string(), z.unknown())),
  proxima_pagina: z.number().int().positive().nullish(),
});
const esquemaOrdemUnica = z.record(z.string(), z.unknown());

const TEMPO_LIMITE_MS = 30_000;

/**
 * Cliente HTTP da API do SAP (a simulada, em `/sap-simulado`): endereço e token vêm da configuração. Resposta fora do formato
 * ou status de erro lança exceção; quem lê o SAP trata isso como "API fora do ar" e não grava nada.
 */
export class ClienteSapHttp implements ClienteSap {
  constructor(
    readonly url: string,
    readonly token: string,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  private async requisitar(caminho: string, consulta: Record<string, string | number> = {}): Promise<Response> {
    if (!this.url) throw new Error("SAP_API_URL não configurada");
    const alvo = new URL(`${this.url.replace(/\/$/, "")}${caminho}`);
    for (const [chave, valor] of Object.entries(consulta)) alvo.searchParams.set(chave, String(valor));
    try {
      return await this.buscar(alvo, {
        headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      throw new Error(`API do SAP inacessível: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro });
    }
  }

  private async lerJson(resposta: Response): Promise<unknown> {
    try {
      return await resposta.json();
    } catch {
      throw new Error("Resposta inválida da API do SAP: o corpo não é um JSON");
    }
  }

  async listarOrdens(opcoes: { alteradasDesde?: Date; pagina: number; tamanho: number }): Promise<PaginaDeOrdens> {
    const resposta = await this.requisitar("/ordens", {
      ...(opcoes.alteradasDesde ? { alteradas_desde: opcoes.alteradasDesde.toISOString() } : {}),
      pagina: opcoes.pagina,
      tamanho: opcoes.tamanho,
    });
    if (!resposta.ok) throw new Error(`API do SAP respondeu ${resposta.status}`);
    const r = esquemaPagina.safeParse(await this.lerJson(resposta));
    if (!r.success) throw new Error("Resposta inválida da API do SAP: esperado {ordens: [...], proxima_pagina?}");
    return { ordens: r.data.ordens as unknown as OrdemSap[], ...(r.data.proxima_pagina ? { proxima_pagina: r.data.proxima_pagina } : {}) };
  }

  async obterOrdem(numeroOrdem: string): Promise<OrdemSap | null> {
    const resposta = await this.requisitar(`/ordens/${encodeURIComponent(numeroOrdem)}`);
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new Error(`API do SAP respondeu ${resposta.status}`);
    const r = esquemaOrdemUnica.safeParse(await this.lerJson(resposta));
    if (!r.success) throw new Error("Resposta inválida da API do SAP: esperada uma ordem");
    return r.data as unknown as OrdemSap;
  }
}
