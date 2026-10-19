"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { z } from "zod";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import type { ResponsavelDaOs } from "@/lib/tipos";

interface AtribuicaoDaOsProps {
  osId: string;
  /** Quem está com a OS reservada agora; `null` = a OS é da equipe toda. */
  responsavel: ResponsavelDaOs | null;
  /** Os técnicos ativos da equipe da OS, a quem o supervisor pode reservá-la. */
  colegas: ResponsavelDaOs[];
}

const esquema = z.object({ escolhido: z.string().min(1, "Escolha a pessoa a quem reservar a OS.") });

/**
 * Atribuição individual (`PUT` e `DELETE /os/{id}/responsavel`): o supervisor da equipe reserva a OS a uma pessoa. A OS segue no
 * quadro da equipe, com a marca; só o responsável inicia a APR e a execução. Vale enquanto a OS não começou.
 */
export function AtribuicaoDaOs({ osId, responsavel, colegas }: AtribuicaoDaOsProps) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { escolhido: "" });
  const { register, formState } = form;
  const erros = formState.errors;
  // "Liberar para a equipe toda" não leva campo: tem o próprio estado e o próprio erro.
  const [liberando, setLiberando] = useState(false);
  const [erroAoLiberar, setErroAoLiberar] = useState<string | null>(null);
  const ocupado = enviando || liberando;

  async function liberar() {
    setErroAoLiberar(null);
    setLiberando(true);
    try {
      await chamar("DELETE", `/os/${osId}/responsavel`);
      iniciar(() => router.refresh());
    } catch (e) {
      setErroAoLiberar(e instanceof Error ? e.message : "Não foi possível liberar a OS");
    } finally {
      setLiberando(false);
    }
  }

  const opcoes = colegas.filter((c) => c.id !== responsavel?.id);

  return (
    <Panel style={{ gap: 10 }}>
      <h2>Quem faz esta OS</h2>
      {responsavel ? (
        <p>
          Reservada para <strong>{responsavel.nome}</strong>. A OS continua no quadro da equipe, mas só essa pessoa inicia a APR e a execução.
        </p>
      ) : (
        <p className="muted">Hoje a OS é da equipe toda: qualquer pessoa dela pode iniciar a APR. Reserve a uma pessoa para garantir quem vai fazê-la.</p>
      )}
      <form
        ref={ref}
        noValidate
        className="stack g8"
        onSubmit={enviar(async (v) => {
          setErroAoLiberar(null);
          await chamar("PUT", `/os/${osId}/responsavel`, { usuario_id: v.escolhido });
          form.reset({ escolhido: "" });
          iniciar(() => router.refresh());
        })}
      >
        <Field label={responsavel ? "Trocar o responsável" : "Reservar para"} htmlFor={`responsavel-${osId}`} labelStyle={{ color: "var(--ink3)" }} erro={erros.escolhido?.message}>
          <select className="select" disabled={ocupado || opcoes.length === 0} {...register("escolhido")} {...ligarAoErro(`responsavel-${osId}`, erros.escolhido?.message)}>
            <option value="">{opcoes.length === 0 ? "Nenhuma outra pessoa na equipe" : "Escolha a pessoa"}</option>
            {opcoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </Field>
        <ErroDeEnvio mensagem={erroEnvio ?? erroAoLiberar} />
        <div className="row wrap g8">
          <button className="btn btn-p btn-sm" type="submit" aria-busy={enviando} disabled={ocupado || opcoes.length === 0}>
            {enviando ? "Salvando…" : responsavel ? "Trocar responsável" : "Reservar a OS"}
          </button>
          {responsavel && (
            <button className="btn btn-line btn-sm" type="button" disabled={ocupado} onClick={() => void liberar()}>
              Liberar para a equipe toda
            </button>
          )}
        </div>
      </form>
    </Panel>
  );
}
