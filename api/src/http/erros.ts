import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Erro de negócio que vira `{erro: {codigo, mensagem}}` com o status HTTP dado. */
export class ErroApi extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly codigo: string,
    mensagem: string,
    public readonly detalhes?: unknown,
  ) {
    super(mensagem);
  }
}

export const naoAutenticado = (mensagem = "Sessão inválida ou expirada") => new ErroApi(401, "nao_autenticado", mensagem);
export const proibido = (mensagem = "Seu perfil não pode fazer isto") => new ErroApi(403, "proibido", mensagem);
export const naoEncontrado = (mensagem = "Registro não encontrado") => new ErroApi(404, "nao_encontrado", mensagem);
export const conflito = (codigo: string, mensagem: string) => new ErroApi(409, codigo, mensagem);
export const invalido = (codigo: string, mensagem: string, detalhes?: unknown) => new ErroApi(422, codigo, mensagem, detalhes);

/** Código do Postgres (23505 = unique, 23503 = foreign key, 23514 = check), mesmo embrulhado pelo Drizzle. */
export function codigoPostgres(erro: unknown): string | undefined {
  let atual: any = erro;
  for (let i = 0; i < 4 && atual; i++) {
    if (typeof atual.code === "string" && /^[0-9A-Z]{5}$/.test(atual.code)) return atual.code;
    atual = atual.cause;
  }
  return undefined;
}

/** Nome da restrição violada (`usuario_matricula_unique`, …), quando o driver informa. */
export function restricaoPostgres(erro: unknown): string | undefined {
  let atual: any = erro;
  for (let i = 0; i < 4 && atual; i++) {
    if (typeof atual.constraint === "string") return atual.constraint;
    atual = atual.cause;
  }
  return undefined;
}

export function tratarErro(erro: unknown, c: Context) {
  if (erro instanceof ErroApi) {
    return c.json(
      { erro: { codigo: erro.codigo, mensagem: erro.message, ...(erro.detalhes ? { detalhes: erro.detalhes } : {}) } },
      erro.status,
    );
  }
  const pg = codigoPostgres(erro);
  if (pg === "23505") return c.json({ erro: { codigo: "duplicado", mensagem: "Registro já cadastrado" } }, 409);
  if (pg === "23503") return c.json({ erro: { codigo: "referencia_invalida", mensagem: "Referência a um registro que não existe" } }, 422);
  if (pg === "23514") return c.json({ erro: { codigo: "regra_do_banco", mensagem: "Dado recusado pelas regras do banco" } }, 422);
  console.error(erro);
  return c.json({ erro: { codigo: "erro_interno", mensagem: "Erro interno" } }, 500);
}
