import type { Alerta } from "@shared/api/alertas";
import { alvoDoAlerta } from "@shared/api/alertas";
import { ehAvisoDeConferencia } from "../conferencia/aviso";

/**
 * Para onde o aviso leva dentro do app, ou `null` quando o que ele pede só existe na web (a equipe, a conta de outra pessoa, o
 * treinamento, a ausência de um colega que o supervisor responde). O aviso da APR leva às assinaturas; o da OS, ao detalhe; o da
 * própria ausência, à tela das ausências; os da sugestão de materiais, à sugestão; os seis da conferência da execução, à conferência da
 * OS. O `materiais_atualizados` (a lista de um serviço mudou) não leva a lugar nenhum: a lista nova já está no detalhe da OS, e o app não
 * tem a tela do catálogo.
 */
export function destinoDoAvisoNoApp(a: Pick<Alerta, "tipo" | "os_id" | "destinatario_id" | "usuario_alvo_id" | "sugestao_id">): string | null {
  if (ehAvisoDeConferencia(a)) return a.os_id ? `/os/${a.os_id}/conferencia` : null;
  if (a.tipo === "apr_para_assinar") return a.os_id ? `/os/${a.os_id}/aprovada` : null;
  if (alvoDoAlerta(a) === "sugestao") return a.sugestao_id ? `/materiais/${a.sugestao_id}` : "/materiais";
  switch (alvoDoAlerta(a)) {
    case "os":
      return a.os_id ? `/os/${a.os_id}` : null;
    case "ausencia":
      return a.usuario_alvo_id === a.destinatario_id ? "/ausencias" : null;
    default:
      return null;
  }
}
