import { Icon } from "@/components/ui/Icon";
import { etapasDaConferencia } from "@/lib/conferencia";
import type { ConferenciaDaApi } from "@/lib/conferencia";

/** A trilha de passos da conferência: sincronizar, comparar ou escolher, ciências ou assinaturas e o fim. O passo atual fica em destaque. */
export function EtapasDaConferencia({ conferencia }: { conferencia: Pick<ConferenciaDaApi, "estado" | "tipo"> }) {
  return (
    <ol className="cf-etapas" aria-label="Etapas da conferência">
      {etapasDaConferencia(conferencia).map((e, i) => (
        <li key={e.rotulo} className={e.situacao} aria-current={e.situacao === "atual" ? "step" : undefined}>
          <span className="cf-numero">{e.situacao === "feita" ? <Icon name="check" size={13} /> : i + 1}</span>
          <span>{e.rotulo}</span>
        </li>
      ))}
    </ol>
  );
}
