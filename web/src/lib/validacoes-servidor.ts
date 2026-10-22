import { cache } from "react";
import { api } from "@/lib/api";
import type { Validacoes } from "@/lib/validacoes";

/** A fila do supervisor (`GET /me/validacoes`), uma vez por requisição: a página e o selo do menu pedem a mesma coisa. */
export const minhasValidacoes = cache(() => api<Validacoes>("/me/validacoes"));
