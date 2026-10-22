import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { ROTULO_DA_SITUACAO_DA_ASSINATURA_JURIDICA, type SituacaoDaAssinaturaJuridica } from "@/lib/assinatura-juridica";

const TOM: Record<SituacaoDaAssinaturaJuridica, BadgeTone> = {
  pendente_offline: "al",
  aguardando: "exe",
  assinada: "lib",
  recusada: "blq",
  falhou: "blq",
};

/** O selo da situação de uma assinatura com validade jurídica. */
export function SeloDaAssinatura({ situacao }: { situacao: SituacaoDaAssinaturaJuridica }) {
  return <Badge tone={TOM[situacao]}>{ROTULO_DA_SITUACAO_DA_ASSINATURA_JURIDICA[situacao]}</Badge>;
}
