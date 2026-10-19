"use client";

import { useActionState, startTransition } from "react";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useFormulario } from "@/components/ui/useFormulario";
import { trocarSenha, type EstadoDoFormulario } from "@/lib/acoes-sessao";
import { esquemaDeTrocaDeSenha } from "@/lib/validacao";

const inicial: EstadoDoFormulario = {};
const esquema = esquemaDeTrocaDeSenha("senha provisória");

/** "Defina sua senha": no primeiro acesso, ou depois de o admin redefinir, só a troca de senha está liberada. */
export function FormularioTrocarSenha() {
  const [estado, acao, pendente] = useActionState(trocarSenha, inicial);
  const { form, ref, enviar } = useFormulario(esquema, { senha_atual: "", senha_nova: "", confirmacao: "" });
  const { register, formState } = form;
  const erros = formState.errors;
  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar((v) => {
        const dados = new FormData();
        dados.set("senha_atual", v.senha_atual);
        dados.set("senha_nova", v.senha_nova);
        dados.set("confirmacao", v.confirmacao);
        startTransition(() => acao(dados));
      })}
    >
      <h2>Defina sua senha</h2>
      <Notice tone="info" icon="info">
        Você entrou com uma senha provisória. Escolha uma senha nova (mínimo de 8 caracteres) para continuar.
      </Notice>
      <Field label="Senha provisória" htmlFor="senha_atual" erro={erros.senha_atual?.message}>
        <input className="input" type="password" autoComplete="current-password" {...register("senha_atual")} {...ligarAoErro("senha_atual", erros.senha_atual?.message)} />
      </Field>
      <Field label="Senha nova" htmlFor="senha_nova" erro={erros.senha_nova?.message}>
        <input className="input" type="password" autoComplete="new-password" {...register("senha_nova")} {...ligarAoErro("senha_nova", erros.senha_nova?.message)} />
      </Field>
      <Field label="Repita a senha nova" htmlFor="confirmacao" erro={erros.confirmacao?.message}>
        <input className="input" type="password" autoComplete="new-password" {...register("confirmacao")} {...ligarAoErro("confirmacao", erros.confirmacao?.message)} />
      </Field>
      {estado.erro && (
        <Notice tone="blq" icon="alert">
          {estado.erro}
        </Notice>
      )}
      <button className="btn btn-p btn-block" type="submit" aria-busy={pendente} disabled={pendente}>
        {pendente ? "Salvando…" : "Salvar senha"}
      </button>
    </form>
  );
}
