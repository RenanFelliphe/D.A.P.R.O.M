import { z } from "zod";
import { RegistroIndisponivel, type ClienteRh, type FuncionarioRh, type PaginaDeFuncionarios } from "./rh";

const texto = z.string().nullish();
const esquemaFuncionario = z.object({
  matricula: z.string().min(1),
  nome: z.string().min(1),
  email: z.string().min(1),
  cargo: z.string(),
  centro_trabalho: z.string(),
  setor: z.string(),
  registro_profissional: texto,
  situacao: z.enum(["ativo", "afastado", "desligado"]),
  data_admissao: texto,
  data_nascimento: texto,
  telefone: texto,
  gestor_matricula: texto,
  lotacao: texto,
});
const esquemaPagina = z.object({
  funcionarios: z.array(esquemaFuncionario),
  proxima_pagina: z.number().int().positive().nullish(),
});

const TEMPO_LIMITE_MS = 30_000;

/**
 * Cliente HTTP do registro de funcionários, real ou simulado (`/rh-simulado`): só muda o endereço e o token. Qualquer falha
 * (rede, status de erro, corpo fora do formato) vira `RegistroIndisponivel`; só `404` na consulta de uma matrícula é resposta
 * ("não está no registro").
 */
export class ClienteRhHttp implements ClienteRh {
  constructor(
    readonly url: string,
    readonly token: string,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  private async requisitar(caminho: string, consulta: Record<string, string | number> = {}): Promise<Response> {
    if (!this.url) throw new RegistroIndisponivel("RH_API_URL não configurada");
    const alvo = new URL(`${this.url.replace(/\/$/, "")}${caminho}`);
    for (const [chave, valor] of Object.entries(consulta)) alvo.searchParams.set(chave, String(valor));
    try {
      return await this.buscar(alvo, {
        headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
    } catch (erro) {
      throw new RegistroIndisponivel(`Registro de funcionários inacessível: ${erro instanceof Error ? erro.message : String(erro)}`, { cause: erro });
    }
  }

  private async lerJson(resposta: Response): Promise<unknown> {
    try {
      return await resposta.json();
    } catch {
      throw new RegistroIndisponivel("Resposta inválida do registro de funcionários: o corpo não é um JSON");
    }
  }

  async obterFuncionario(matricula: string): Promise<FuncionarioRh | null> {
    const resposta = await this.requisitar(`/funcionarios/${encodeURIComponent(matricula)}`);
    if (resposta.status === 404) return null;
    if (!resposta.ok) throw new RegistroIndisponivel(`Registro de funcionários respondeu ${resposta.status}`);
    const r = esquemaFuncionario.safeParse(await this.lerJson(resposta));
    if (!r.success) throw new RegistroIndisponivel("Resposta inválida do registro de funcionários: esperado um funcionário");
    return r.data;
  }

  async listarFuncionarios(opcoes: { pagina: number; tamanho: number }): Promise<PaginaDeFuncionarios> {
    const resposta = await this.requisitar("/funcionarios", { pagina: opcoes.pagina, tamanho: opcoes.tamanho });
    if (!resposta.ok) throw new RegistroIndisponivel(`Registro de funcionários respondeu ${resposta.status}`);
    const r = esquemaPagina.safeParse(await this.lerJson(resposta));
    if (!r.success) throw new RegistroIndisponivel("Resposta inválida do registro de funcionários: esperado {funcionarios: [...], proxima_pagina?}");
    return { funcionarios: r.data.funcionarios, ...(r.data.proxima_pagina ? { proxima_pagina: r.data.proxima_pagina } : {}) };
  }
}
