import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";

/** Resumo dos alertas não lidos, com atalho para a tela de alertas. Sem alertas não aparece. */
export function FaixaAlertas({ total }: { total: number }) {
  if (total === 0) return null;
  return (
    <div className="alert-strip">
      <span className="ic">
        <Icon name="bell" size={18} />
      </span>
      <span style={{ flex: 1, fontSize: 14 }}>
        <strong style={{ fontWeight: 600 }}>{total === 1 ? "1 alerta não lido" : `${total} alertas não lidos`}</strong>
      </span>
      <Link href={rotas.web.alertas} style={{ fontSize: 14, fontWeight: 600 }}>
        Ver alertas
      </Link>
    </div>
  );
}
