import { pbkdf2Async } from "@noble/hashes/pbkdf2.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";

/**
 * A derivação da senha para o login sem sinal: PBKDF2-HMAC-SHA256, em JavaScript puro (`@noble/hashes`, sem módulo nativo). A versão
 * assíncrona devolve a vez ao app a cada poucas iterações, então a tela não congela enquanto a conta é feita.
 */
export async function derivarSenha(senha: string, salHex: string, iteracoes: number): Promise<string> {
  const chave = await pbkdf2Async(sha256, senha, hexToBytes(salHex), { c: iteracoes, dkLen: 32, asyncTick: 10 });
  return bytesToHex(chave);
}

export { bytesToHex };
