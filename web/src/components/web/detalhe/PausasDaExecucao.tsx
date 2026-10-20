import { Badge } from "@/components/ui/Badge";
import type { PausaDaExecucao } from "@/data/detalhe";
import { duracao, hora } from "@/lib/formatar";
import { descreverMotivo, ehMotivoDeSaude, rotuloDoMotivoDaPausa } from "@/lib/motivos-de-parada";
import { LocalizacaoNoMapa } from "./LocalizacaoNoMapa";

const rotuloMedida = { color: "var(--ink4)" } as const;

/**
 * As pausas da execução, uma a uma: início, fim, quanto durou, o motivo com o complemento ("Aguardando: peça do almoxarifado") e a
 * localização. Lesão e enfermidade ficam em destaque (acidente de trabalho em potencial). Não entram no tempo líquido.
 */
export function PausasDaExecucao({ pausas, executorId }: { pausas: PausaDaExecucao[]; executorId?: string }) {
  if (pausas.length === 0) return null;
  return (
    <div className="stack g8" style={{ fontSize: 13.5 }}>
      <div className="small" style={rotuloMedida}>
        Pausas (não entram no tempo líquido)
      </div>
      {pausas.map((p) => {
        const minutos = p.fim ? (new Date(p.fim).getTime() - new Date(p.inicio).getTime()) / 60_000 : null;
        const saude = ehMotivoDeSaude(p.motivo);
        return (
          <div key={p.id} className="stack g4" style={{ paddingBottom: 8, borderBottom: "1px solid var(--line2)" }}>
            <span className="row wrap g8" style={{ alignItems: "center" }}>
              <span>
                <span className="mono">{hora(p.inicio)}</span> às <span className="mono">{p.fim ? hora(p.fim) : "…"}</span>
                {minutos !== null && ` · ${duracao(minutos)}`}
                {p.fim === null && " · ainda aberta"}
                {p.iniciada_por && p.iniciada_por.id !== executorId && ` · pausou ${p.iniciada_por.nome}`}
                {p.encerrada_por && p.encerrada_por.id !== executorId && p.fim && ` · retomou ${p.encerrada_por.nome}`}
              </span>
              <Badge tone={saude ? "blq" : "neu"}>{descreverMotivo(rotuloDoMotivoDaPausa, p.motivo, p.complemento)}</Badge>
              {saude && <span style={{ color: "var(--blq)", fontWeight: 600 }}>ocorrência de saúde</span>}
            </span>
            <LocalizacaoNoMapa titulo="Localização da pausa" ponto={p.localizacao} compacta />
          </div>
        );
      })}
    </div>
  );
}
