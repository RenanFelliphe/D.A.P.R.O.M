"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { trocarSenha, type EstadoDoFormulario } from "@/lib/acoes-sessao";

const inicial: EstadoDoFormulario = {};

/** "Defina sua senha": no primeiro acesso, ou depois de o admin redefinir, só a troca de senha está liberada. */
export function FormularioTrocarSenha() {
  const [estado, acao, pendente] = useActionState(trocarSenha, inicial);
  return (
    <form className="stack g12" action={acao}>
      <h2>Defina sua senha</h2>
      <Notice tone="info" icon="info">
        Você entrou com uma senha provisória. Escolha uma senha nova (mínimo de 8 caracteres) para continuar.
      </Notice>
      <Field label="Senha provisória" htmlFor="senha_atual">
        <input className="input" id="senha_atual" name="senha_atual" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Senha nova" htmlFor="senha_nova">
        <input className="input" id="senha_nova" name="senha_nova" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Repita a senha nova" htmlFor="confirmacao">
        <input className="input" id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      {estado.erro && (
        <Notice tone="blq" icon="alert">
          {estado.erro}
        </Notice>
      )}
      <button className="btn btn-p btn-block" type="submit" disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
