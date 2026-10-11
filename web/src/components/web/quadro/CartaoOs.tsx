import Link from "next/link";
import type { CSSProperties } from "react";
import { BotaoAviso } from "@/components/ui/Aviso";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { OsQuadro } from "@/data/quadro";

const estiloDetalhe = {
  exe: { color: "var(--exe)", fontWeight: 500 },
  enc: { color: "var(--enc)", fontWeight: 500 },
  ink2: { color: "var(--ink2)" },
} satisfies Record<string, CSSProperties>;

function Conteudo({ os }: { os: OsQuadro }) {
  return (
    <>
      <div className="top">
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {os.os}
        </span>
        <span className="t">{os.tipo}</span>
        {os.critico && (
          <Badge tone="crit" style={{ padding: "0 7px", fontSize: 11 }}>
            Crítico
          </Badge>
        )}
      </div>
      <div className="tt">{os.titulo}</div>
      <div className="m">
        <Icon name="pin" size={13} />
        {os.local}
      </div>
      <div className="m" style={os.detalheTom ? estiloDetalhe[os.detalheTom] : undefined}>
        {os.detalheIcone && <Icon name={os.detalheIcone} size={13} />}
        {os.detalhe}
      </div>
      {os.selo && (
        <Badge tone="blq" style={{ alignSelf: "flex-start", borderRadius: 6, fontSize: 12 }}>
          {os.selo}
        </Badge>
      )}
    </>
  );
}

/** Cartão de OS do quadro: link quando há destino, botão que só avisa caso contrário. */
export function CartaoOs({ os }: { os: OsQuadro }) {
  if (os.href) {
    return (
      <Link className="bcard" href={os.href}>
        <Conteudo os={os} />
      </Link>
    );
  }
  if (os.aviso) {
    return (
      <BotaoAviso className="bcard" aviso={os.aviso}>
        <Conteudo os={os} />
      </BotaoAviso>
    );
  }
  return (
    <button className="bcard" type="button">
      <Conteudo os={os} />
    </button>
  );
}
