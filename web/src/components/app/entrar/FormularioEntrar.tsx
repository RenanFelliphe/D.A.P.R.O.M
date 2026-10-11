"use client";

import { useActionState } from "react";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { entrar, type EstadoDoFormulario } from "@/lib/acoes-sessao";

const inicial: EstadoDoFormulario = {};

/** Login por matrícula e senha (o formulário chama a ação `entrar` no servidor). */
export function FormularioEntrar() {
  const [estado, acao, pendente] = useActionState(entrar, inicial);
  return (
    <form className="stack g12" action={acao}>
      <h2>Entrar</h2>
      <Field label="Matrícula" htmlFor="matricula">
        <input className="input mono" id="matricula" name="matricula" autoComplete="username" autoFocus required />
      </Field>
      <Field label="Senha" htmlFor="senha">
        <input className="input" id="senha" name="senha" type="password" autoComplete="current-password" required />
      </Field>
      {estado.erro && (
        <Notice tone="blq" icon="alert">
          {estado.erro}
        </Notice>
      )}
      <button className="btn btn-p btn-block" type="submit" disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
