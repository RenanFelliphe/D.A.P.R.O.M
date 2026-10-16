import { Icon } from "@/components/ui/Icon";
import type { Colega } from "@/lib/apr";
import { ParticipanteRow } from "./ParticipanteRow";

interface ParticipantesAprProps {
  equipe: Colega[];
  usuarioId: string;
  marcados: string[];
  responsavelId: string;
  aoAlternar: (id: string) => void;
  /** Ausente quando o responsável é fixo (a OS foi reservada a quem aplica a APR). */
  aoTornarResponsavel?: (id: string) => void;
}

const avatares = [undefined, "av2", "av3"] as const;

/** Seção "Participantes · equipe da OS" com a lista de checkboxes. Você sempre participa; marque quem mais está presente. */
export function ParticipantesApr({ equipe, usuarioId, marcados, responsavelId, aoAlternar, aoTornarResponsavel }: ParticipantesAprProps) {
  return (
    <div className="stack g8" data-treino="apr-participantes">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Participantes · equipe da OS</h2>
      <div className="list-box">
        {equipe.map((colega, i) => (
          <ParticipanteRow
            key={colega.id}
            colega={colega}
            voce={colega.id === usuarioId}
            marcado={marcados.includes(colega.id)}
            responsavel={colega.id === responsavelId}
            avatar={avatares[i % avatares.length]}
            aoAlternar={() => aoAlternar(colega.id)}
            aoTornarResponsavel={aoTornarResponsavel ? () => aoTornarResponsavel(colega.id) : undefined}
          />
        ))}
      </div>
      <div className="row g8 small">
        <Icon name="users" size={16} />
        {aoTornarResponsavel
          ? "Você é o responsável por padrão e sempre participa. Marque quem mais está presente; a APR precisa de um responsável."
          : "Esta OS foi reservada para você: você é o responsável pela APR e sempre participa. Marque quem mais está presente."}
      </div>
    </div>
  );
}
