import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { EquipeDoServico } from "@/lib/sugestao-materiais";

/**
 * As equipes que fazem o serviço, da que mais faz para a que menos faz. A primeira (no empate, a de mais pontos) é a responsável:
 * recebe as sugestões e as contestações da lista de materiais e é quem decide sobre elas.
 */
export function ListaDeEquipes({ equipes }: { equipes: EquipeDoServico[] }) {
  if (equipes.length === 0) {
    return <p className="muted small">Nenhuma equipe tem OS deste serviço ainda. Enquanto isso, a administração avalia as sugestões.</p>;
  }
  return (
    <ol className="sg-equipes" aria-label="Equipes que fazem o serviço">
      {equipes.map((e, i) => (
        <li key={e.equipe_id} className={e.responsavel ? "sg-equipe responsavel" : "sg-equipe"}>
          <span className="sg-equipe-posicao" aria-hidden="true">
            {i + 1}
          </span>
          <span className="sg-equipe-texto">
            <strong>{e.nome}</strong>
            <span className="small">
              {e.os_total === 1 ? "1 OS do serviço" : `${e.os_total} OS do serviço`}
              {e.supervisor_nome ? ` · supervisor ${e.supervisor_nome}` : ""}
            </span>
          </span>
          {e.responsavel && (
            <Badge tone="enc">
              <Icon name="shield" size={13} />
              Responsável
            </Badge>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Uma frase: para quem vai a sugestão deste serviço. */
export function destinoDaSugestao(equipes: EquipeDoServico[]): string {
  const responsavel = equipes.find((e) => e.responsavel);
  return responsavel ? `Quem avalia é o supervisor da equipe ${responsavel.nome}, a que mais faz este serviço.` : "Nenhuma equipe faz este serviço ainda: a administração avalia.";
}
