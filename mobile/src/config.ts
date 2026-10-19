/** Endereço da `api` (variável `EXPO_PUBLIC_API_URL`, definida no build; ver `.env.example`). Vazio = o app não foi configurado. */
export const URL_DA_API = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");

/**
 * Endereço da web (variável `EXPO_PUBLIC_WEB_URL`, opcional): o "Me leve lá" da Vitória abre nele o que só existe na web (dashboard,
 * catálogo, equipes). Vazio, o app só responde em texto.
 */
export const URL_DA_WEB = (process.env.EXPO_PUBLIC_WEB_URL ?? "").trim().replace(/\/$/, "");
