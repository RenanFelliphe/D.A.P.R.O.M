import type { Alerta } from "@shared/api/alertas";

/**
 * Os seis avisos da conferência da execução (aberta, cobrança, escolher, assinar, ressalva, prazo esgotado). Para `shared/` são avisos
 * de OS e levam à conferência da web; no app, todos levam à tela da conferência.
 */
export const ehAvisoDeConferencia = (a: Pick<Alerta, "tipo">): boolean => a.tipo.startsWith("conferencia_");
