import { Icon } from "@/components/ui/Icon";
import { participantesApr } from "@/data/nova-apr-app";
import { ParticipanteRow } from "./ParticipanteRow";

/** Seção "Participantes · equipe da OS" com a lista de checkboxes. */
export function ParticipantesApr() {
  return (
    <div className="stack g8">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Participantes · equipe da OS</h2>
      <div className="list-box">
        {participantesApr.map((p) => (
          <ParticipanteRow key={p.matricula} participante={p} />
        ))}
      </div>
      <div className="row g8 small">
        <Icon name="users" size={16} />
        Você é o responsável. Marque quem mais participa da atividade.
      </div>
    </div>
  );
}
