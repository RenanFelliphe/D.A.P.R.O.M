"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { solicitarConta } from "@/lib/acoes-solicitacao";
import { rotas } from "@/lib/rotas";

const esquema = z.object({
  nome: z.string().trim().min(1, "Informe o nome completo.").max(120, "O nome pode ter no máximo 120 caracteres."),
  email: z.string().trim().min(1, "Informe o e-mail institucional.").email("Informe um e-mail válido, como nome.sobrenome@empresa.com.br."),
  equipe_id: z.string(),
});

/**
 * O pedido de conta de quem trabalha na empresa e ainda não tem uma: o nome, o e-mail institucional e, se souber, a equipe. Vai
 * aos administradores e, com a equipe, a quem responde por ela, que cadastram a pessoa pelo registro de funcionários. A resposta é
 * sempre a mesma (não diz se o e-mail já tem conta). `equipes` vazia: a lista não carregou, e o pedido segue sem equipe.
 */
export function FormularioSolicitarConta({ equipes }: { equipes: { id: string; nome: string }[] }) {
  const [enviadoPara, setEnviadoPara] = useState<string | null>(null);
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { nome: "", email: "", equipe_id: "" });
  const { register, formState } = form;
  const erros = formState.errors;

  if (enviadoPara) {
    return (
      <div className="stack g12" role="status">
        <h2>Pedido enviado</h2>
        <Notice tone="ok" icon="check">
          Recebemos o seu pedido. Quem cadastra as contas vai conferir os seus dados no registro de funcionários e, se estiver tudo certo, criar a conta. A senha provisória chega por quem a criar, e o e-mail {enviadoPara} passa a ser o seu login.
        </Notice>
        <Link className="btn btn-p btn-block" href={rotas.app.entrar}>
          Voltar para a entrada
        </Link>
      </div>
    );
  }

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar(async (v) => {
        const r = await solicitarConta({ nome: v.nome, email: v.email, equipe_id: v.equipe_id || null });
        if (!r.ok) throw new Error(r.erro);
        setEnviadoPara(v.email.trim().toLowerCase());
      })}
    >
      <Link className="login-voltar" href={rotas.app.entrar}>
        <Icon name="left" size={13} />
        Voltar para a entrada
      </Link>
      <h2>Solicitar uma conta</h2>
      <p className="small muted">Para quem trabalha na empresa e ainda não tem conta no SYNQ OS. Um administrador confere os seus dados e cria a conta.</p>
      <Field label="Nome completo" htmlFor="pedido-nome" erro={erros.nome?.message}>
        <input className="input" autoComplete="name" autoFocus {...register("nome")} {...ligarAoErro("pedido-nome", erros.nome?.message)} />
      </Field>
      <Field label="E-mail institucional" htmlFor="pedido-email" erro={erros.email?.message}>
        <input className="input" type="email" autoComplete="email" placeholder="nome.sobrenome@empresa.com.br" {...register("email")} {...ligarAoErro("pedido-email", erros.email?.message)} />
      </Field>
      {equipes.length > 0 && (
        <Field label="Equipe (opcional)" htmlFor="pedido-equipe">
          <select className="input" id="pedido-equipe" {...register("equipe_id")}>
            <option value="">Não sei ou prefiro não informar</option>
            {equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
          <span className="small">Com a equipe, o supervisor dela também recebe o pedido.</span>
        </Field>
      )}
      <ErroDeEnvio mensagem={erroEnvio} />
      <button className="btn btn-p btn-block" type="submit" aria-busy={enviando} disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar pedido"}
      </button>
    </form>
  );
}
