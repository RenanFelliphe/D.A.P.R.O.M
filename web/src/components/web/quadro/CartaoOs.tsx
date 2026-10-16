import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { PilulaPrioridade } from "@/components/web/PilulaPrioridade";
import type { OsDoQuadro } from "@/data/quadro";
import { dataDoDia, diaMes } from "@/lib/formatar";
import { OS_BLOQUEIO, OS_GUIADA } from "@/treino/ids";
import { rotas } from "@/lib/rotas";

/**
 * Cartão de OS do quadro; leva ao detalhe da OS. A ciência e o PDF das encerradas só interessam à gestão. A OS que o supervisor
 * reservou a uma pessoa continua no quadro da equipe, com a marca de quem a fará (`usuarioId` é quem está vendo o quadro).
 */
export function CartaoOs({ os, gestao, usuarioId }: { os: OsDoQuadro; gestao: boolean; usuarioId: string }) {
  const programada = dataDoDia(os.data_fim_prog ?? os.data_inicio_prog).slice(0, 5);
  // O tutorial do campo de treino aponta para as duas OS do roteiro.
  const treino = os.id === OS_GUIADA ? "os-guiada" : os.id === OS_BLOQUEIO ? "os-bloqueio" : undefined;
  return (
    <Link className="bcard" href={rotas.app.os(os.id)} data-treino={treino}>
      <div className="top">
        <span className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
          {os.numero_ordem ?? "Sem nº"}
        </span>
        <span className="t">{os.tipo === "preventiva" ? "Preventiva" : "Corretiva"}</span>
        {os.local_instalacao.critico && (
          <Badge tone="crit" style={{ padding: "0 7px", fontSize: 11 }}>
            Crítico
          </Badge>
        )}
        <PilulaPrioridade prioridade={os.prioridade} compacta />
      </div>
      <div className="tt">{os.titulo}</div>
      <div className="m">
        <Icon name="pin" size={13} />
        {os.local_instalacao.codigo}
      </div>
      <div className="m" style={os.atrasada ? { color: "var(--blq)", fontWeight: 500 } : undefined}>
        <Icon name="clock" size={13} />
        Prog. até {programada}
        {os.atrasada && " · atrasada"}
      </div>
      {os.execucao_aberta_ha_horas !== null && (
        <div className="m" style={{ color: "var(--al)", fontWeight: 600 }}>
          <Icon name="alert" size={13} />
          Execução aberta há {os.execucao_aberta_ha_horas} h
        </div>
      )}
      {os.status === "pendente" && (
        <Badge tone="blq" style={{ alignSelf: "flex-start", borderRadius: 6, fontSize: 12 }}>
          Aguardando nova APR
        </Badge>
      )}
      {os.responsavel && (os.status === "liberada" || os.status === "pendente") && (
        <Badge tone="brand" style={{ alignSelf: "flex-start", borderRadius: 6, fontSize: 12 }}>
          <Icon name="user" size={13} />
          {os.responsavel.id === usuarioId ? "Reservada para você" : `Reservada para ${os.responsavel.nome.split(" ")[0]}`}
        </Badge>
      )}
      {gestao && os.status === "encerrada" && (
        <div className="m" style={{ color: "var(--enc)", fontWeight: 500 }}>
          <Icon name={os.ciencia_em ? "check" : "file"} size={13} />
          {os.ciencia_em ? `Ciente em ${diaMes(os.ciencia_em)}` : "Ciência pendente"}
          {os.pdf_pronto ? " · PDF pronto" : " · PDF pendente"}
        </div>
      )}
    </Link>
  );
}
