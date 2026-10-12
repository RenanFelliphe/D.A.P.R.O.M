import type { ModoUsuarios } from "@/data/usuarios";
import { NovoUsuario } from "./NovoUsuario";
import type { OpcaoEquipe } from "./FormularioUsuario";

/** Título da tela e botão de novo usuário (admin) ou novo técnico (supervisor, com `equipes` só as dele). */
export function CabecalhoUsuarios({ equipes, modo = "admin" }: { equipes: OpcaoEquipe[]; modo?: ModoUsuarios }) {
  const supervisor = modo === "supervisor";
  return (
    <div className="row between wrap" style={{ alignItems: "flex-end" }}>
      <div className="stack g4">
        <h1>{supervisor ? "Minha equipe" : "Equipes e usuários"}</h1>
        <span className="muted" style={{ fontSize: 14, maxWidth: 760 }}>
          {supervisor
            ? "Cadastre os técnicos das equipes que você supervisiona. O acesso geral só é liberado depois que um administrador aprovar; enquanto isso a pessoa pode fazer o campo de treino."
            : "O administrador cria as contas e define perfil e equipe. Não há autocadastro: o supervisor cadastra técnicos, que ficam pendentes até a liberação."}
        </span>
      </div>
      <NovoUsuario equipes={equipes} modo={modo} />
    </div>
  );
}
