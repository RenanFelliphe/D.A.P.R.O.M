import type { Consulta } from "../offline/banco";
import { gravarMeta, lerMeta } from "../offline/copia";

/**
 * "Já vi" da explicação que a Vitória dá na primeira vez que a pessoa chega na conferência. Fica na tabela `meta` do SQLite do aparelho (o
 * mesmo lugar das demais preferências pequenas do app), uma chave por pessoa: quem divide o aparelho com um colega vê a explicação de novo
 * na própria conta. Nenhuma das duas funções lança: sem o armazenamento, a explicação só aparece de novo na próxima vez, e a tela segue.
 */
const chaveDe = (usuarioId: string) => `vitoria_explicou_conferencia:${usuarioId}`;

/** A Vitória já explicou a conferência a esta pessoa? Se não der para saber, vale "já viu" (melhor calar do que repetir a cada abertura). */
export async function jaViAExplicacao(banco: Consulta, usuarioId: string): Promise<boolean> {
  try {
    return (await lerMeta(banco, chaveDe(usuarioId))) !== null;
  } catch {
    return true;
  }
}

/** Guarda que a pessoa leu a explicação. */
export async function guardarQueViAExplicacao(banco: Consulta, usuarioId: string, agora: Date): Promise<void> {
  try {
    await gravarMeta(banco, chaveDe(usuarioId), agora.toISOString());
  } catch {
    /* sem o armazenamento a explicação volta na próxima abertura; nada quebra */
  }
}
