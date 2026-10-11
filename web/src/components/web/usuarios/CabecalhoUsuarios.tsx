import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

/** Título da tela e botão de novo usuário. */
export function CabecalhoUsuarios() {
  return (
    <div className="row between wrap" style={{ alignItems: "flex-end" }}>
      <div className="stack g4">
        <h1>Equipes e usuários</h1>
        <span className="muted" style={{ fontSize: 14, maxWidth: 760 }}>
          O administrador cria as contas e define perfil e equipe. Não há autocadastro.
        </span>
      </div>
      <Button variant="p" sm aviso="Abriria o formulário de novo usuário, com matrícula, perfil, equipe e senha inicial.">
        <Icon name="plus" size={16} />
        Novo usuário
      </Button>
    </div>
  );
}
