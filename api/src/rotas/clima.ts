import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { previsaoDoTempo } from "../dominio/clima";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { invalido } from "../http/erros";
import { responder } from "../http/resposta";
import { lerConsulta } from "../http/validacao";

const esquemaClima = z
  .object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    janela: z.enum(["expediente", "proximas_horas"]).default("proximas_horas"),
  })
  .refine((q) => (q.latitude === undefined) === (q.longitude === undefined), { message: "Informe a latitude e a longitude juntas, ou nenhuma" });

const esquemaBuscaDeCidade = z.object({ busca: z.string().trim().min(2).max(80) });

/**
 * A previsão do tempo (`docs/operacao-de-campo.md`, seção 4.7), para todo perfil liberado. `GET /clima` nunca falha por causa do
 * provedor: sem resposta dele devolve `disponivel: false`, e as telas dizem "Previsão indisponível" sem avisar nem bloquear nada.
 * `GET /clima/cidades` é do admin, para escolher a cidade padrão em Configurações.
 */
export function rotasClima(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/clima", autenticar(), async (c) => {
    return responder(c, await previsaoDoTempo(deps, lerConsulta(c, esquemaClima)));
  });

  r.get("/clima/cidades", autenticar(), exigirPerfil("admin"), async (c) => {
    const { busca } = lerConsulta(c, esquemaBuscaDeCidade);
    try {
      return responder(c, { cidades: await deps.clima.buscarCidades(busca) });
    } catch (erro) {
      console.warn(`Busca de cidades indisponível: ${erro instanceof Error ? erro.message : String(erro)}`);
      throw invalido("busca_indisponivel", "A busca de cidades está indisponível agora. Tente de novo em instantes.");
    }
  });

  return r;
}
