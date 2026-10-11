import type { Metadata } from "next";
import { EntrarHero } from "@/components/app/entrar/EntrarHero";
import { LinkAviso } from "@/components/ui/Aviso";
import { LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { rotas } from "@/lib/telas";

export const metadata: Metadata = { title: "Entrar" };

export default function EntrarPage() {
  return (
    <div className="login">
      <EntrarHero />
      <div className="login-side">
        <div className="login-card">
          <h2>Entrar</h2>
          <Field label="Matrícula" htmlFor="matricula">
            <input className="input mono" id="matricula" defaultValue="10482" />
          </Field>
          <Field label="Senha" htmlFor="senha">
            <input className="input" id="senha" type="password" defaultValue="senhaficticia" />
          </Field>
          <LinkButton variant="p" block href={rotas.app.lista}>
            Entrar
          </LinkButton>
          <Notice tone="off" icon="wifioff" iconSize={22}>
            <strong>Sem conexão agora.</strong> Você entrou online neste aparelho há 2 dias, então o acesso offline está
            liberado. Ele vale por até 7 dias sem sinal.
          </Notice>
        </div>
        <div className="login-foot">
          <LinkAviso aviso="A recuperação de senha exige conexão com a internet." style={{ fontWeight: 500 }}>
            Esqueci a senha
          </LinkAviso>
          <span>Dados fictícios · v0.1</span>
        </div>
      </div>
    </div>
  );
}
