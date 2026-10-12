import { Icon } from "@/components/ui/Icon";
import type { Colega } from "@/lib/apr";
import { ParticipanteRow } from "./ParticipanteRow";

interface ParticipantesAprProps {
  equipe: Colega[];
  usuarioId: string;
  marcados: string[];
  responsavelId: string;
  aoAlternar: (id: string) => void;
  aoTornarResponsavel: (id: string) => void;
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
            aoTornarResponsavel={() => aoTornarResponsavel(colega.id)}
          />
        ))}
      </div>
      <div className="row g8 small">
        <Icon name="users" size={16} />
        Você é o responsável por padrão e sempre participa. Marque quem mais está presente; a APR precisa de um responsável.
      </div>
    </div>
  );
}
