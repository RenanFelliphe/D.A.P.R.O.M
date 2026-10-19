import * as Crypto from "expo-crypto";

/**
 * O Hermes não tem `crypto`. Os ids de campo (`shared/api/uuid.ts`) nascem no aparelho e precisam de aleatoriedade segura,
 * então o `getRandomValues` e o `randomUUID` do `expo-crypto` entram em `globalThis.crypto` antes de qualquer tela.
 */
const global = globalThis as { crypto?: Partial<typeof Crypto> };
if (!global.crypto) global.crypto = {};
if (typeof global.crypto.getRandomValues !== "function") global.crypto.getRandomValues = Crypto.getRandomValues;
if (typeof global.crypto.randomUUID !== "function") global.crypto.randomUUID = Crypto.randomUUID;
