/**
 * UUID v4 para os ids que nascem no cliente (APR, eventos, fotos, assinaturas). `crypto.randomUUID` só existe em contexto
 * seguro (HTTPS ou localhost): aberto pelo IP da rede em HTTP, como num celular na demonstração, ele não existe. Nesse
 * caso o id é montado no mesmo formato com `crypto.getRandomValues`, que existe em qualquer contexto. No app (Hermes) não há
 * `crypto` até o `mobile` instalar o `getRandomValues` do `expo-crypto` em `globalThis.crypto`; sem nenhum dos dois, o id sai
 * de `Math.random` (só para o teste e a unidade, nunca em produção).
 */
export function novoUuid(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (typeof c?.randomUUID === "function") return c.randomUUID();
  const b = new Uint8Array(16);
  if (typeof c?.getRandomValues === "function") c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40; // versão 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
