import { NovoUsuario } from "./NovoUsuario";
import type { OpcaoEquipe } from "./FormularioUsuario";

/** Título da tela e botão de novo usuário. */
export function CabecalhoUsuarios({ equipes }: { equipes: OpcaoEquipe[] }) {
  return (
    <div className="row between wrap" style={{ alignItems: "flex-end" }}>
      <div className="stack g4">
        <h1>Equipes e usuários</h1>
        <span className="muted" style={{ fontSize: 14, maxWidth: 760 }}>
          O administrador cria as contas e define perfil e equipe. Não há autocadastro.
        </span>
      </div>
      <NovoUsuario equipes={equipes} />
    </div>
  );
}
