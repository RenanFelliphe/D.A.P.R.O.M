"use client";

import { useState, type FormEvent } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";

/** Troca da própria senha (`POST /auth/trocar-senha`); a nova precisa ter pelo menos 8 caracteres. */
export function TrocarSenha() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [trocada, setTrocada] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const form = new FormData(formulario);
    const atual = String(form.get("senha_atual") ?? "");
    const nova = String(form.get("senha_nova") ?? "");
    setTrocada(false);
    if (nova.length < 8) return setErro("A senha nova precisa ter pelo menos 8 caracteres.");
    if (nova !== form.get("confirmacao")) return setErro("A confirmação não confere com a senha nova.");
    setOcupado(true);
    setErro(null);
    try {
      await chamar("POST", "/auth/trocar-senha", { senha_atual: atual, senha_nova: nova });
      formulario.reset();
      setTrocada(true);
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="stack g8" onSubmit={enviar}>
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Trocar senha</h2>
      <div className="card stack g12">
        <Field label="Senha atual" htmlFor="senha_atual">
          <input className="input" id="senha_atual" name="senha_atual" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="Senha nova (mínimo de 8 caracteres)" htmlFor="senha_nova">
          <input className="input" id="senha_nova" name="senha_nova" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Repita a senha nova" htmlFor="confirmacao">
          <input className="input" id="confirmacao" name="confirmacao" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        {erro && (
          <Notice tone="blq" icon="alert">
            {erro}
          </Notice>
        )}
        {trocada && (
          <Notice tone="ok" icon="check">
            Senha trocada.
          </Notice>
        )}
        <button className="btn btn-p" type="submit" disabled={ocupado}>
          {ocupado ? "Salvando…" : "Trocar senha"}
        </button>
      </div>
    </form>
  );
}
