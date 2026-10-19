import { getRandomBytes } from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { criarCredenciais, type ArmazemDeTexto } from "./credenciais";
import { bytesToHex, derivarSenha } from "./derivar-senha";

const CHAVE = "synqos_credenciais";

/** As credenciais do login sem sinal ficam no `expo-secure-store` (Keystore do Android), junto dos tokens. */
const armazem: ArmazemDeTexto = {
  ler: () => SecureStore.getItemAsync(CHAVE),
  gravar: (texto) => SecureStore.setItemAsync(CHAVE, texto),
  apagar: () => SecureStore.deleteItemAsync(CHAVE),
};

export const credenciais = criarCredenciais({
  armazem,
  derivar: derivarSenha,
  novoSal: () => bytesToHex(getRandomBytes(16)),
  agora: () => new Date(),
});
