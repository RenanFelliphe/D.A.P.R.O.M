import type { RespostaMe } from "@shared/api/tipos";
import type { Consulta } from "./banco";
import { gravarMeta, lerMeta } from "./copia";

/**
 * Quem é a pessoa, para abrir o app sem sinal: o último `GET /me` que o servidor respondeu, guardado no banco do aparelho (tabela
 * `meta`), com o instante em que ele respondeu. Sem sinal, é ele que diz o destino da conta (lista de OS, assinatura por cadastrar...)
 * e quem é a pessoa logada. Vale por 7 dias (`janela.ts`); a decisão de usá-lo é do `sessao/eu.ts`.
 */

const CHAVE_ULTIMO = "identidade_ultimo_usuario";
const chaveDoEu = (usuarioId: string) => `identidade_eu:${usuarioId}`;

export interface EuGuardado {
  eu: RespostaMe;
  /** Quando o servidor respondeu este `GET /me` (ISO). */
  confirmadoEm: string;
}

/** Guarda o `GET /me` que o servidor acabou de responder e marca a pessoa como a última a usar o aparelho. */
export async function guardarEu(c: Consulta, eu: RespostaMe, agora: Date): Promise<void> {
  const guardado: EuGuardado = { eu, confirmadoEm: agora.toISOString() };
  await gravarMeta(c, chaveDoEu(eu.usuario.id), JSON.stringify(guardado));
  await gravarMeta(c, CHAVE_ULTIMO, eu.usuario.id);
}

/** O `GET /me` guardado de uma pessoa, ou (com `null`) o da última a usar o aparelho. */
export async function lerEu(c: Consulta, usuarioId: string | null): Promise<EuGuardado | null> {
  const id = usuarioId ?? (await lerMeta(c, CHAVE_ULTIMO));
  if (!id) return null;
  const texto = await lerMeta(c, chaveDoEu(id));
  if (!texto) return null;
  try {
    const g = JSON.parse(texto) as Partial<EuGuardado>;
    return g.eu?.usuario && typeof g.confirmadoEm === "string" ? { eu: g.eu, confirmadoEm: g.confirmadoEm } : null;
  } catch {
    return null;
  }
}

/** Quem entrou sem sinal passa a ser "a última pessoa" do aparelho (o app aberto sem sinal mostra a dela). */
export const definirUltimoUsuario = (c: Consulta, usuarioId: string) => gravarMeta(c, CHAVE_ULTIMO, usuarioId);

/** O servidor recusou a conta: o que o aparelho guardava dela deixa de valer. */
export async function esquecerEu(c: Consulta, usuarioId: string): Promise<void> {
  await c.executar("DELETE FROM meta WHERE chave = ?", [chaveDoEu(usuarioId)]);
  await c.executar("DELETE FROM meta WHERE chave = ? AND valor = ?", [CHAVE_ULTIMO, usuarioId]);
}
