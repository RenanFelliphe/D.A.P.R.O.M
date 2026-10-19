import type { Alerta } from "@shared/api/alertas";
import { alvoDoAlerta } from "@shared/api/alertas";

/**
 * Para onde o aviso leva dentro do app, ou `null` quando o que ele pede só existe na web (a equipe, a conta de outra pessoa, o
 * treinamento, a ausência de um colega que o supervisor responde). O aviso da APR leva às assinaturas; o da OS, ao detalhe; o da
 * própria ausência, à tela das ausências.
 */
export function destinoDoAvisoNoApp(a: Pick<Alerta, "tipo" | "os_id" | "destinatario_id" | "usuario_alvo_id">): string | null {
  if (a.tipo === "apr_para_assinar") return a.os_id ? `/os/${a.os_id}/aprovada` : null;
  switch (alvoDoAlerta(a)) {
    case "os":
      return a.os_id ? `/os/${a.os_id}` : null;
    case "ausencia":
      return a.usuario_alvo_id === a.destinatario_id ? "/ausencias" : null;
    default:
      return null;
  }
}
