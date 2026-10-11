import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/telas";

/** Resumo dos alertas não lidos, com atalho para a tela de alertas. */
export function FaixaAlertas() {
  return (
    <div className="alert-strip">
      <span className="ic">
        <Icon name="bell" size={18} />
      </span>
      <span style={{ flex: 1, fontSize: 14 }}>
        <strong style={{ fontWeight: 600 }}>3 alertas não lidos:</strong> 2 impedimentos (Rede Vila Velha e Rede Serra
        Norte) e 1 OS de apoio encerrada.
      </span>
      <Link href={rotas.web.alertas} style={{ fontSize: 14, fontWeight: 600 }}>
        Ver alertas
      </Link>
    </div>
  );
}
