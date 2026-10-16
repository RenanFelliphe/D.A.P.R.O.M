import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { PilulaPrioridade } from "@/components/web/PilulaPrioridade";
import { aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import type { OsDetalhe } from "@/data/detalhe";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus } from "@/lib/tipos";

/**
 * Trilha, identificação da OS (número, status, tipo, criticidade, atraso) e, se houver, as ações de gestão (`acoes`).
 * `secao` é o nome da lista de onde a pessoa veio: "Ordem de Serviço" na gestão, "OS da equipe" no técnico.
 */
export function DetalheCabecalho({ os, secao = "Ordem de Serviço", acoes }: { os: OsDetalhe; secao?: string; acoes?: ReactNode }) {
  const numero = os.numero_ordem ?? "sem número";
  const a = aparenciaDoStatus[os.status];
  return (
    <>
      <div className="crumb">
        <Link href={rotas.app.lista} style={{ fontWeight: 500 }}>
          {secao}
        </Link>{" "}
        / <span className="mono">OS {numero}</span>
      </div>
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack g6">
          <div className="row wrap g8">
            <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
              OS {numero}
            </span>
            <Badge tone={a.tom}>
              {os.status === "encerrada" && <Icon name="check" size={13} />}
              {rotuloDoStatus[os.status]}
            </Badge>
            <Badge tone="neu">
              {os.tipo === "preventiva" ? "Preventiva" : "Corretiva"}
              {os.tipo_atividade ? ` · ${os.tipo_atividade}` : ""}
            </Badge>
            {os.origem === "apoio" && <Badge tone="neu">OS de apoio</Badge>}
            {os.local_instalacao.critico && <Badge tone="crit">Local crítico</Badge>}
            <PilulaPrioridade prioridade={os.prioridade} />
            {os.atrasada && <Badge tone="blq">Atrasada</Badge>}
            {os.responsavel && (os.status === "liberada" || os.status === "pendente") && (
              <Badge tone="brand">
                <Icon name="user" size={13} />
                Reservada para {os.responsavel.nome}
              </Badge>
            )}
          </div>
          <h1>{os.titulo}</h1>
          <span className="muted" style={{ fontSize: 14 }}>
            {os.local_instalacao.codigo}
            {os.local_instalacao.endereco ? ` — ${os.local_instalacao.endereco}` : ""} · {os.equipe.nome}
          </span>
          {acoes && <div className="row wrap g8">{acoes}</div>}
        </div>
      </div>
    </>
  );
}
