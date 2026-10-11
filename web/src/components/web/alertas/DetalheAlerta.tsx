import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import type { Alerta } from "@/data/alertas";
import { rotas } from "@/lib/telas";
import { BotaoMarcarComoLido } from "./BotaoMarcarComoLido";
import { DetalheBloqueio } from "./DetalheBloqueio";

/** Painel de detalhe do alerta: variante de bloqueio (com decisão) ou informativa. */
export function DetalheAlerta({ alerta }: { alerta: Alerta }) {
  const bloqueio = alerta.natureza === "bloq";
  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g6" style={{ minWidth: 0 }}>
          <div className="row wrap g8">
            <Badge tone={bloqueio ? "blq" : "lib"}>
              <Icon name={bloqueio ? "octagon" : "refresh"} size={13} />
              {alerta.badge}
            </Badge>
            <Badge tone="neu">{alerta.naoLido ? "Não lido" : "Lido"}</Badge>
          </div>
          <h2 style={{ fontSize: 21, lineHeight: 1.25 }}>
            <span className="mono">OS {alerta.os}</span> — {alerta.titulo}
          </h2>
        </div>
        <Link href={rotas.web.detalhe} style={{ fontSize: 14, fontWeight: 600 }}>
          Abrir OS
        </Link>
      </div>
      {alerta.natureza === "bloq" ? (
        <DetalheBloqueio alerta={alerta} />
      ) : (
        <>
          <Notice tone="info" icon="info" style={{ fontSize: 14.5 }}>
            {alerta.mensagem}
          </Notice>
          <div className="row g8">
            <LinkButton variant="p" sm href={rotas.web.detalhe}>
              {alerta.acao}
            </LinkButton>
            <BotaoMarcarComoLido />
          </div>
        </>
      )}
    </Panel>
  );
}
