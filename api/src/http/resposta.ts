import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Colunas `jsonb` definidas pelo cliente: as chaves delas passam como vieram. */
const OPACOS = new Set(["pae", "payload", "dados_inspecao", "detalhe_ignoradas", "detalhes"]);

const paraSnake = (chave: string) => chave.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

/** `numeroOrdem` → `numero_ordem` em todo o corpo: o Drizzle devolve camelCase e a API fala snake_case. */
export function emSnakeCase(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(emSnakeCase);
  if (valor && typeof valor === "object" && Object.getPrototypeOf(valor) === Object.prototype) {
    const saida: Record<string, unknown> = {};
    for (const [chave, v] of Object.entries(valor)) {
      const nova = paraSnake(chave);
      saida[nova] = OPACOS.has(nova) ? v : emSnakeCase(v);
    }
    return saida;
  }
  return valor;
}

/** Toda resposta JSON de sucesso passa por aqui (chaves em snake_case). */
export function responder(c: Context, corpo: unknown, status: ContentfulStatusCode = 200) {
  return c.json(emSnakeCase(corpo) as object, status);
}
