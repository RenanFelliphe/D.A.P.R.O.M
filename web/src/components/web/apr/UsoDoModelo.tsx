import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Panel } from "@/components/web/Panel";
import { aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import type { UsoDoModelo as Uso } from "@/data/modelos";
import { data } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus } from "@/lib/tipos";

const ATIVIDADES_VISIVEIS = 6;

/**
 * Onde o modelo é usado: as atividades ligadas a ele (o caminho da OS até o modelo), as OS abertas dessas atividades e
 * as APRs já respondidas em qualquer versão.
 */
export function UsoDoModelo({ uso }: { uso: Uso }) {
  const { atividades, os_abertas: abertas, aprs } = uso;
  const tabela = `${rotas.web.atividades}?modelo=${encodeURIComponent(uso.codigo)}`;
  return (
    <Panel style={{ padding: 16, gap: 14 }}>
      <h2 style={{ fontSize: 15 }}>Onde é usado</h2>
      <div className="uso-num">
        <span>
          <b>{atividades.length}</b> {atividades.length === 1 ? "atividade" : "atividades"}
        </span>
        <span>
          <b>{abertas.total}</b> OS {abertas.total === 1 ? "aberta" : "abertas"}
        </span>
        <span>
          <b>{aprs.total}</b> {aprs.total === 1 ? "APR" : "APRs"}
        </span>
      </div>

      <section className="stack g6" aria-label="Atividades ligadas">
        <h3 className="uso-t">Atividades ligadas</h3>
        {atividades.length === 0 ? (
          <span className="small">Nenhuma: o modelo só é usado quando o técnico o escolhe numa OS sem atividade mapeada.</span>
        ) : (
          <ul className="uso-lista">
            {atividades.slice(0, ATIVIDADES_VISIVEIS).map((a) => (
              <li key={a.codigo}>
                <span className="mono">{a.codigo}</span>
                <span>{a.descricao}</span>
              </li>
            ))}
          </ul>
        )}
        <Link href={atividades.length > 0 ? tabela : `${rotas.web.atividades}?sem_modelo=true`} className="small" style={{ fontWeight: 600 }}>
          {atividades.length > ATIVIDADES_VISIVEIS ? `Ver as ${atividades.length} na tabela` : atividades.length > 0 ? "Ver na tabela" : "Ligar atividades"}
        </Link>
      </section>

      <section className="stack g6" aria-label="OS abertas">
        <h3 className="uso-t">OS abertas</h3>
        {abertas.total === 0 ? (
          <span className="small">Nenhuma OS aberta das atividades deste modelo.</span>
        ) : (
          <ul className="uso-lista">
            {abertas.recentes.map((o) => (
              <li key={o.id}>
                <Link href={rotas.app.os(o.id)} className="mono">
                  {o.numero_ordem ? `OS ${o.numero_ordem}` : "OS de apoio"}
                </Link>
                <span>
                  <Badge tone={aparenciaDoStatus[o.status].tom} style={{ padding: "0 7px", fontSize: 11 }}>
                    {rotuloDoStatus[o.status]}
                  </Badge>{" "}
                  {o.titulo} · {o.equipe}
                </span>
              </li>
            ))}
          </ul>
        )}
        {abertas.total > abertas.recentes.length && <span className="small">{`e mais ${abertas.total - abertas.recentes.length}`}</span>}
      </section>

      <section className="stack g6" aria-label="APRs respondidas">
        <h3 className="uso-t">APRs respondidas</h3>
        <span className="small">
          {aprs.total === 0
            ? "Nenhuma ainda."
            : `${aprs.total} no total, ${aprs.bloqueadas} ${aprs.bloqueadas === 1 ? "bloqueada" : "bloqueadas"} · a última em ${data(aprs.ultima_em)}`}
        </span>
      </section>
    </Panel>
  );
}
