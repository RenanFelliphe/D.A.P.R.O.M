"use client";

import { useActionState, startTransition } from "react";
import { z } from "zod";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useFormulario } from "@/components/ui/useFormulario";
import { entrar, type EstadoDoFormulario } from "@/lib/acoes-sessao";

const inicial: EstadoDoFormulario = {};

const esquema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail institucional.").email("Informe um e-mail válido, como nome.sobrenome@empresa.com.br."),
  senha: z.string().min(1, "Informe a senha."),
});

/**
 * Login pelo e-mail institucional e senha. A validação dos campos é no navegador (os erros aparecem junto de cada campo); depois a
 * ação `entrar` roda no servidor. `para`: o endereço pedido antes do login, para onde a pessoa volta.
 */
export function FormularioEntrar({ para }: { para: string | null }) {
  const [estado, acao, pendente] = useActionState(entrar, inicial);
  const { form, ref, enviar } = useFormulario(esquema, { email: estado.email ?? "", senha: "" });
  const { register, formState } = form;
  const erros = formState.errors;
  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar((v) => {
        const dados = new FormData();
        dados.set("email", v.email.trim());
        dados.set("senha", v.senha);
        if (para) dados.set("para", para);
        startTransition(() => acao(dados));
      })}
    >
      <h2>Entrar</h2>
      <Field label="E-mail institucional" htmlFor="email" erro={erros.email?.message}>
        <input
          className="input"
          type="email"
          autoComplete="username"
          autoFocus={!estado.email}
          placeholder="nome.sobrenome@empresa.com.br"
          {...register("email")}
          {...ligarAoErro("email", erros.email?.message)}
        />
      </Field>
      <Field label="Senha" htmlFor="senha" erro={erros.senha?.message}>
        <input className="input" type="password" autoComplete="current-password" autoFocus={!!estado.email} {...register("senha")} {...ligarAoErro("senha", erros.senha?.message)} />
      </Field>
      {estado.erro && (
        <Notice tone="blq" icon="alert">
          {estado.erro}
        </Notice>
      )}
      <button className="btn btn-p btn-block" type="submit" aria-busy={pendente} disabled={pendente}>
        {pendente ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
