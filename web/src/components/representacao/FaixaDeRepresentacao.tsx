import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import type { EquipeRepresentada } from "@/lib/representacao";

/**
 * A faixa de quem está no comando de uma equipe como representante do supervisor: diz de qual equipe, por quê e que, até o
 * supervisor voltar (ou, na equipe sem supervisor, até o admin escolher um), a pessoa faz o que ele faz (aprovar ausências,
 * reservar e devolver OS, dar ciência…). Some sozinha quando ele volta.
 */
export function FaixaDeRepresentacao({ equipes }: { equipes: EquipeRepresentada[] }) {
  if (equipes.length === 0) return null;
  return (
    <div className="aus-faixa" role="status">
      <div className="aus-faixa-texto">
        <Icon name="users" size={18} />
        <span>
          {equipes.map((e, i) => (
            <span key={e.id}>
              {i > 0 && " "}
              <strong>Você responde pela equipe {e.nome}:</strong> {e.rotulo}.{" "}
              {e.motivo === "sem_supervisor" || !e.supervisor_nome
                ? "Até o administrador escolher um supervisor, você faz o que o supervisor faz por ela."
                : `Até ${e.supervisor_nome} voltar, você faz o que o supervisor faz por ela.`}
            </span>
          ))}
        </span>
      </div>
      <Link className="btn btn-line btn-sm" href={rotas.app.equipe(equipes[0]!.id)}>
        {equipes.length === 1 ? "Abrir a equipe" : "Abrir a primeira equipe"}
      </Link>
    </div>
  );
}
