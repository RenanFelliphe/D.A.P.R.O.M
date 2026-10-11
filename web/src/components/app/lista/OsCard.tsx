import Link from "next/link";
import type { CSSProperties } from "react";
import { BotaoAviso } from "@/components/ui/Aviso";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { statusOs, type OsApp } from "@/data/os-app";

const numeroOs: CSSProperties = { fontSize: 13, fontWeight: 600 };
const botaoCard: CSSProperties = { textAlign: "left", font: "inherit" };

/** Card de uma OS: link para a tela de destino ou botão que só avisa (OS encerrada, sem destino). */
export function OsCard({ os }: { os: OsApp }) {
  const status = statusOs[os.status];
  const conteudo = (
    <>
      <div className="row between">
        <div className="row">
          <span className="mono" style={numeroOs}>
            OS {os.numero}
          </span>
          <Badge tone="neu">{os.tipo}</Badge>
        </div>
        <Badge tone={status.tone}>{status.rotulo}</Badge>
      </div>
      <div className="t">{os.titulo}</div>
      <div className="m">
        <Icon name={os.icone} size={13} />
        {os.detalhe}
      </div>
    </>
  );

  if (os.href) {
    return (
      <Link className="os-card" href={os.href}>
        {conteudo}
      </Link>
    );
  }
  if (os.aviso) {
    return (
      <BotaoAviso className="os-card" aviso={os.aviso} style={botaoCard}>
        {conteudo}
      </BotaoAviso>
    );
  }
  return (
    <button className="os-card" type="button" style={botaoCard}>
      {conteudo}
    </button>
  );
}
