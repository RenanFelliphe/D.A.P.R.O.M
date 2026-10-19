import * as SecureStore from "expo-secure-store";
import type { ArmazemDeTokens, Tokens } from "./cliente";

const CHAVE_ACESSO = "synqos_access_token";
const CHAVE_RENOVACAO = "synqos_refresh_token";
const CHAVE_EXPIRACAO = "synqos_expira_em";

/**
 * Os tokens ficam no `expo-secure-store` (Keystore do Android), nunca no armazenamento comum. Cada um numa chave, porque o
 * Android guarda cada valor criptografado à parte e um JWT sozinho já passa de 1 KB.
 */
export const armazemSeguro: ArmazemDeTokens = {
  async ler(): Promise<Tokens | null> {
    const [accessToken, refreshToken, expiraEm] = await Promise.all([
      SecureStore.getItemAsync(CHAVE_ACESSO),
      SecureStore.getItemAsync(CHAVE_RENOVACAO),
      SecureStore.getItemAsync(CHAVE_EXPIRACAO),
    ]);
    if (!accessToken || !refreshToken || !expiraEm) return null;
    return { accessToken, refreshToken, expiraEm };
  },
  async gravar(tokens) {
    await Promise.all([
      SecureStore.setItemAsync(CHAVE_ACESSO, tokens.accessToken),
      SecureStore.setItemAsync(CHAVE_RENOVACAO, tokens.refreshToken),
      SecureStore.setItemAsync(CHAVE_EXPIRACAO, tokens.expiraEm),
    ]);
  },
  async apagar() {
    await Promise.all([SecureStore.deleteItemAsync(CHAVE_ACESSO), SecureStore.deleteItemAsync(CHAVE_RENOVACAO), SecureStore.deleteItemAsync(CHAVE_EXPIRACAO)]);
  },
};
