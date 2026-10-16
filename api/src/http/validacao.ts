import type { Context } from "hono";
import { z } from "zod";
import { ErroApi, naoEncontrado } from "./erros";

z.config(z.locales.pt());

export const uuid = z.string().uuid();

/** E-mail institucional: é o login, então vale em minúsculas e sem espaços nas pontas (como é gravado e comparado). */
export const emailInstitucional = z.string().trim().toLowerCase().email("E-mail inválido");

function falhar(erro: z.ZodError): never {
  const primeira = erro.issues[0];
  const campo = primeira?.path.join(".");
  const mensagem = primeira ? (campo ? `${campo}: ${primeira.message}` : primeira.message) : "Requisição inválida";
  throw new ErroApi(
    422,
    "validacao",
    mensagem,
    erro.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
  );
}

/** Valida um valor qualquer (por exemplo, o payload de um evento) com o mesmo formato de erro dos demais. */
export function validar<T extends z.ZodType>(esquema: T, bruto: unknown): z.infer<T> {
  const r = esquema.safeParse(bruto);
  if (!r.success) falhar(r.error);
  return r.data;
}

/** Corpo JSON como veio, sem validar (quem chama valida); JSON malformado é `400`. */
export async function lerJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new ErroApi(400, "json_invalido", "O corpo da requisição não é um JSON válido");
  }
}

/** Corpo JSON validado; JSON malformado é `400`, campo inválido é `422`. */
export async function lerCorpo<T extends z.ZodType>(c: Context, esquema: T): Promise<z.infer<T>> {
  return validar(esquema, await lerJson(c));
}

export function lerConsulta<T extends z.ZodType>(c: Context, esquema: T): z.infer<T> {
  return validar(esquema, c.req.query());
}

/** `:id` da rota; um id que não é UUID é um registro que não existe. */
export function lerId(c: Context, nome = "id"): string {
  const r = uuid.safeParse(c.req.param(nome));
  if (!r.success) throw naoEncontrado();
  return r.data;
}

/** `?lido=true` → true; ausente → undefined. */
export const booleanoDaConsulta = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

/** Texto obrigatório e não vazio depois do `trim`. */
export const textoObrigatorio = z.string().trim().min(1);
/** `AAAA-MM-DD`, como as colunas `date`. */
export const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");
/** Instante ISO 8601 com fuso; vira `Date`. */
export const instanteIso = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v));

/** `AAAA-MM-DD` de um dia que existe (2026-02-30 não). */
export const dataExistente = dataIso.refine((v) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
}, "Data inexistente");
