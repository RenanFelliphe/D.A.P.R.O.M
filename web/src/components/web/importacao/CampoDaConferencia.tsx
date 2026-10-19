import type { ReactNode } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Req } from "@/components/ui/Field";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { EstadoDoCampo } from "./tipos-digitalizacao";

export const ESTADO: Record<EstadoDoCampo, { rotulo: string; tom: BadgeTone; icone: IconName }> = {
  confere: { rotulo: "Confere", tom: "enc", icone: "check" },
  duvidoso: { rotulo: "Confira", tom: "al", icone: "eye" },
  invalido: { rotulo: "Inválido", tom: "blq", icone: "octagon" },
  faltando: { rotulo: "Faltando", tom: "neu", icone: "pencil" },
};

/** O selo do estado que o sistema deu a um campo lido (confere, confira, inválido, faltando). */
export function SeloDoEstado({ estado }: { estado: EstadoDoCampo }) {
  const e = ESTADO[estado];
  return (
    <Badge tone={e.tom}>
      <Icon name={e.icone} size={13} />
      {e.rotulo}
    </Badge>
  );
}

interface CampoProps {
  id: string;
  rotulo: string;
  estado?: EstadoDoCampo;
  obrigatorio?: boolean;
  dica?: string;
  largo?: boolean;
  children: ReactNode;
}

/** Um campo da conferência da Digitalização: o rótulo, o estado que o sistema deu à leitura e a dica. */
export function Campo({ id, rotulo, estado, obrigatorio, dica, largo, children }: CampoProps) {
  return (
    <div className="field" data-faltou={estado === "faltando" || estado === "invalido" || undefined} style={largo ? { gridColumn: "1 / -1" } : undefined}>
      <label htmlFor={id} className="row between g8" style={{ alignItems: "baseline" }}>
        <span>
          {rotulo}
          {obrigatorio && <Req> · obrigatório</Req>}
        </span>
        {estado && <SeloDoEstado estado={estado} />}
      </label>
      {children}
      {dica && <span className="small">{dica}</span>}
    </div>
  );
}
