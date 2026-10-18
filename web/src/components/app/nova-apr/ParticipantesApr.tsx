import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { MIN_PARTICIPANTES, type Colega } from "@/lib/apr";
import { ParticipanteRow } from "./ParticipanteRow";

interface ParticipantesAprProps {
  equipe: Colega[];
  usuarioId: string;
  marcados: string[];
  responsavelId: string;
  aoAlternar: (id: string) => void;
  /** Ausente quando o responsável é fixo (a OS foi reservada a quem aplica a APR). */
  aoTornarResponsavel?: (id: string) => void;
  /** Por que não dá para continuar (menos de 2 participantes): em destaque, no lugar da escolha, e o foco vem para cá. */
  erro?: string;
}

const avatares = [undefined, "av2", "av3"] as const;

/**
 * Seção "Participantes · equipe da OS" com a lista de checkboxes. Você sempre participa; marque quem mais está presente: a APR
 * exige ao menos 2 participantes (ninguém executa sozinho) e não tem máximo. Equipe com só 1 pessoa disponível não consegue iniciar
 * a APR, e a seção diz isso sem esperar o clique.
 */
export function ParticipantesApr({ equipe, usuarioId, marcados, responsavelId, aoAlternar, aoTornarResponsavel, erro }: ParticipantesAprProps) {
  const sozinho = equipe.length < MIN_PARTICIPANTES;
  return (
    <div className="stack g8" data-treino="apr-participantes" data-erro={erro ? "" : undefined}>
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Participantes · equipe da OS</h2>
      {sozinho && (
        <Notice tone="blq" icon="users">
          <strong>Não dá para iniciar a APR: só há 1 pessoa disponível na equipe desta OS.</strong> A APR precisa de ao menos {MIN_PARTICIPANTES} participantes, porque ninguém executa o
          serviço sozinho. Quem está ausente, desligado ou sem acesso não entra. Fale com o seu supervisor para incluir outra pessoa na equipe.
        </Notice>
      )}
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
      {erro && !sozinho && (
        <Notice tone="blq" icon="alert" role="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8 small">
        <Icon name="users" size={16} />
        {aoTornarResponsavel
          ? `Você é o responsável por padrão e sempre participa. Marque ao menos mais um colega (a APR exige ${MIN_PARTICIPANTES} participantes, sem máximo); a APR precisa de um responsável.`
          : `Esta OS foi reservada para você: você é o responsável pela APR e sempre participa. Marque ao menos mais um colega (a APR exige ${MIN_PARTICIPANTES} participantes, sem máximo).`}
      </div>
    </div>
  );
}
