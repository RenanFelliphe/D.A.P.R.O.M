import Link from "next/link";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { diaMes } from "@/lib/formatar";
import { rotuloDaOs, rotuloDoTipo, statusDaOs, type OsResumo } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { OS_BLOQUEIO, OS_GUIADA } from "@/treino/ids";

const numeroOs: CSSProperties = { fontSize: 13, fontWeight: 600 };

/** Ícone e texto da linha de detalhe do card, conforme o status. */
function linhaDeDetalhe(os: OsResumo): { icone: IconName; texto: string } {
  const partes: string[] = [];
  if (os.status === "pendente") partes.push("Faça uma APR nova para retomar");
  else if (os.status === "em_execucao") partes.push("Em execução");
  else if (os.status === "encerrada") partes.push(os.pdf_pronto ? "Encerrada · PDF gerado" : "Encerrada");
  else if (os.status === "cancelada") partes.push("Cancelada");
  else if (os.data_inicio_prog) partes.push(`Prog. ${diaMes(`${os.data_inicio_prog}T12:00:00Z`)}`);
  if (os.prioridade && (os.status === "liberada" || os.status === "pendente")) partes.push(`Prioridade ${os.prioridade.toLowerCase()}`);
  partes.push(os.local_instalacao.codigo);
  const icone: IconName = os.status === "pendente" ? "lock" : os.status === "em_execucao" ? "user" : os.status === "liberada" ? "clock" : "file";
  return { icone, texto: partes.join(" · ") };
}

/** Card de uma OS: leva ao detalhe. */
export function OsCard({ os }: { os: OsResumo }) {
  const status = statusDaOs[os.status];
  const detalhe = linhaDeDetalhe(os);
  return (
    <Link className="os-card" href={rotas.app.os(os.id)} data-treino={os.id === OS_GUIADA ? "os-guiada" : os.id === OS_BLOQUEIO ? "os-bloqueio" : undefined}>
      <div className="row between">
        <div className="row wrap">
          <span className="mono" style={numeroOs}>
            {rotuloDaOs(os)}
          </span>
          <Badge tone="neu">{rotuloDoTipo[os.tipo]}</Badge>
          {os.local_instalacao.critico && <Badge tone="crit">Local crítico</Badge>}
          {os.atrasada && <Badge tone="al">Atrasada</Badge>}
        </div>
        <Badge tone={status.tone}>{status.rotulo}</Badge>
      </div>
      <div className="t">{os.titulo}</div>
      <div className="m">
        <Icon name={detalhe.icone} size={13} />
        {detalhe.texto}
      </div>
    </Link>
  );
}
