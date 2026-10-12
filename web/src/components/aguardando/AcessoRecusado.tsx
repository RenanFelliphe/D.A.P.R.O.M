import { EntrarHero } from "@/components/app/entrar/EntrarHero";
import { Icon } from "@/components/ui/Icon";
import { sair } from "@/lib/acoes-sessao";

/** Tela inteira (sem menu) para quem tem a sessão aberta mas teve o cadastro recusado: mostra o motivo e só permite sair. */
export function AcessoRecusado({ motivo }: { motivo: string | null }) {
  return (
    <div className="login">
      <EntrarHero />
      <div className="login-side">
        <div className="login-card stack g12" role="alert">
          <div className="aguardando-icone aguardando-recusado" aria-hidden="true">
            <Icon name="lock" size={24} />
          </div>
          <h2>Seu cadastro foi recusado</h2>
          <p className="muted">Um administrador não aprovou o seu acesso ao sistema.</p>
          {motivo && (
            <p className="aguardando-motivo">
              <strong>Motivo:</strong> {motivo}
            </p>
          )}
          <p className="small">Procure o seu supervisor para corrigir o cadastro.</p>
          <form action={sair}>
            <button className="btn btn-p btn-block" type="submit">
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
