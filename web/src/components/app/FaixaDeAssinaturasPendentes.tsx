import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import type { AssinaturaJuridica } from "@/lib/assinatura-juridica";
import { rotas } from "@/lib/rotas";

/**
 * Faixa "atos aguardando a assinatura com validade jurídica": os atos feitos sem sinal, que valeram com a assinatura desenhada e agora
 * pedem a assinatura no provedor (`GET /assinaturas-juridicas?situacao=pendente_offline`). Leva à lista; sem pendência não desenha nada.
 * É um aviso de apoio: se a consulta falhar, a tela segue sem ele.
 */
export async function FaixaDeAssinaturasPendentes() {
  let total = 0;
  try {
    total = (await api<{ assinaturas: AssinaturaJuridica[] }>("/assinaturas-juridicas", { consulta: { situacao: "pendente_offline" } })).assinaturas.length;
  } catch {
    return null;
  }
  if (total === 0) return null;

  return (
    <section className="notice n-al" aria-label="Atos aguardando a assinatura com validade jurídica" data-treino="faixa-assinaturas-pendentes">
      <Icon name="shield" size={18} />
      <div className="row between wrap g8" style={{ width: "100%" }}>
        <span>
          <strong>{total === 1 ? "1 ato feito sem sinal aguarda" : `${total} atos feitos sem sinal aguardam`} a assinatura com validade jurídica.</strong> Eles valeram com a sua assinatura
          desenhada; assine no provedor, agora que há sinal.
        </span>
        <Link className="btn btn-p btn-sm" href={rotas.app.assinaturasPendentes}>
          Ver e assinar
        </Link>
      </div>
    </section>
  );
}
