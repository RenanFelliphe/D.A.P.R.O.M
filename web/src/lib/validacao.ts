import { z } from "zod";

/** Um dia que existe, no formato `AAAA-MM-DD` (o `input type="date"` devolve assim; 30/02 e anos de 5 dígitos não passam). */
export function diaExiste(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [a, m, d] = valor.split("-").map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}

/** Data opcional: vazia vale; preenchida, precisa ser um dia que existe. */
export const dataOpcional = z.string().refine((v) => v === "" || diaExiste(v), "Informe uma data válida.");

/** Quantidade inteira digitada (guardada como texto no formulário), entre `minimo` e `maximo`. */
export function inteiroEntre(minimo: number, maximo: number, mensagem: string) {
  return z.string().refine((v) => {
    const n = Number(v);
    return v.trim() !== "" && Number.isInteger(n) && n >= minimo && n <= maximo;
  }, mensagem);
}

/** A troca de senha (no primeiro acesso e no perfil): a nova tem pelo menos 8 caracteres e a repetição confere. */
export const esquemaDeTrocaDeSenha = (rotuloDaAtual: string) =>
  z
    .object({
      senha_atual: z.string().min(1, `Informe a ${rotuloDaAtual}.`),
      senha_nova: z.string().min(8, "A senha nova precisa ter pelo menos 8 caracteres."),
      confirmacao: z.string().min(1, "Repita a senha nova."),
    })
    .superRefine((v, ctx) => {
      if (v.confirmacao && v.senha_nova.length >= 8 && v.confirmacao !== v.senha_nova) ctx.addIssue({ code: "custom", path: ["confirmacao"], message: "A confirmação não confere com a senha nova." });
    });
