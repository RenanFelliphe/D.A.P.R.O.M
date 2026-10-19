/**
 * Por quanto tempo o aparelho aceita a pessoa sem falar com o servidor (o login sem sinal e a abertura do app sem sinal): **7 dias**
 * desde a última vez que o servidor confirmou a conta (um login ou um `GET /me` com sinal). É o que limita quanto tempo quem foi
 * desativado ainda consegue abrir o app, já que a desativação só chega ao aparelho quando ele fala com o servidor.
 */
export const JANELA_SEM_SINAL_DIAS = 7;
export const JANELA_SEM_SINAL_MS = JANELA_SEM_SINAL_DIAS * 86_400_000;

/** Tolerância para o relógio do aparelho ter sido atrasado um pouco; mais que isso, a data não é confiável e a confirmação não vale. */
const TOLERANCIA_DO_RELOGIO_MS = 3_600_000;

/** A confirmação (ISO) ainda vale em `agora`? Data ilegível ou no futuro (relógio atrasado) não vale. */
export function dentroDaJanela(confirmadoEm: string, agora: Date): boolean {
  const quando = Date.parse(confirmadoEm);
  if (!Number.isFinite(quando)) return false;
  const idade = agora.getTime() - quando;
  return idade >= -TOLERANCIA_DO_RELOGIO_MS && idade <= JANELA_SEM_SINAL_MS;
}
