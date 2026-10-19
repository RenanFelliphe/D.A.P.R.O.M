"use client";

import { useState } from "react";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { esquemaDeTrocaDeSenha } from "@/lib/validacao";

const esquema = esquemaDeTrocaDeSenha("senha atual");

/** Troca da própria senha (`POST /auth/trocar-senha`); a nova precisa ter pelo menos 8 caracteres. */
export function TrocarSenha() {
  const [trocada, setTrocada] = useState(false);
  const { form, ref, enviar, enviando, erroEnvio, limparErroEnvio } = useFormulario(esquema, { senha_atual: "", senha_nova: "", confirmacao: "" });
  const { register, formState } = form;
  const erros = formState.errors;

  return (
    <form
      ref={ref}
      noValidate
      className="stack g8"
      onSubmit={enviar(async (v) => {
        setTrocada(false);
        await chamar("POST", "/auth/trocar-senha", { senha_atual: v.senha_atual, senha_nova: v.senha_nova });
        form.reset();
        setTrocada(true);
      })}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Trocar senha</h2>
      <div className="card stack g12">
        <Field label="Senha atual" htmlFor="senha_atual" erro={erros.senha_atual?.message}>
          <input className="input" type="password" autoComplete="current-password" {...register("senha_atual", { onChange: () => { setTrocada(false); limparErroEnvio(); } })} {...ligarAoErro("senha_atual", erros.senha_atual?.message)} />
        </Field>
        <Field label="Senha nova (mínimo de 8 caracteres)" htmlFor="senha_nova" erro={erros.senha_nova?.message}>
          <input className="input" type="password" autoComplete="new-password" {...register("senha_nova")} {...ligarAoErro("senha_nova", erros.senha_nova?.message)} />
        </Field>
        <Field label="Repita a senha nova" htmlFor="confirmacao" erro={erros.confirmacao?.message}>
          <input className="input" type="password" autoComplete="new-password" {...register("confirmacao")} {...ligarAoErro("confirmacao", erros.confirmacao?.message)} />
        </Field>
        <ErroDeEnvio mensagem={erroEnvio} />
        {trocada && (
          <Notice tone="ok" icon="check">
            Senha trocada.
          </Notice>
        )}
        <button className="btn btn-p" type="submit" aria-busy={enviando} disabled={enviando}>
          {enviando ? "Salvando…" : "Trocar senha"}
        </button>
      </div>
    </form>
  );
}
