import { Assinatura } from "@/components/ui/Assinatura";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { AssinanteApr } from "@/data/aprovada";
import { cx } from "@/lib/cx";

interface AssinaturaCardProps {
  assinante: AssinanteApr;
  confirmada: boolean;
  aoConfirmar: () => void;
}

/** Card de assinatura do perfil: pendente até a pessoa confirmar a rubrica cadastrada. */
export function AssinaturaCard({ assinante, confirmada, aoConfirmar }: AssinaturaCardProps) {
  return (
    <div className="card stack g6">
      <div className="row between">
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {assinante.nome} <span style={{ fontWeight: 400, color: "var(--ink3)" }}>· {assinante.papel}</span>
        </span>
        {confirmada && (
          <span className="ans-ok" style={{ fontSize: 12.5 }}>
            <Icon name="check" size={13} />
            Confirmada 09:24
          </span>
        )}
      </div>
      <div className={cx("sig-box", !confirmada && "pend")}>
        <Assinatura pessoa={assinante.pessoa} />
      </div>
      {!confirmada && (
        <Button variant="line" sm onClick={aoConfirmar}>
          Confirmar assinatura do perfil
        </Button>
      )}
    </div>
  );
}
