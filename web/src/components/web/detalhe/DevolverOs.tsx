"use client";

import { useState } from "react";
import { z } from "zod";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import { useMinhaAssinatura } from "@/state/minha-assinatura";

const esquema = z.object({ justificativa: z.string().trim().min(1, "Informe a justificativa da devolução.") });

/**
 * Devolve a OS ao SAP (`POST /os/{id}/devolver`): o supervisor escreve a justificativa (o erro que viu na ordem) e assina; a OS sai
 * do quadro da equipe e a justificativa vai na próxima planilha de baixa, que o SAP usa para corrigir a ordem. O SYNQ OS não
 * escreve no SAP. Só aparece para a OS liberada, que ainda não foi iniciada.
 */
export function DevolverOs({ osId }: { osId: string }) {
  const assinaturaPath = useMinhaAssinatura();
  const [aberto, setAberto] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const { form, ref, enviar } = useFormulario(esquema, { justificativa: "" });
  const { register, formState } = form;
  const erros = formState.errors;
  const [justificativa] = useValorDoForm(form, "justificativa");
  const idDoCampo = `devolver-${osId}`;

  return (
    <Panel style={{ gap: 10 }}>
      <h2>Devolver ao SAP</h2>
      <p className="muted">A ordem está com algum erro? Devolva com uma justificativa: a OS sai do quadro da equipe e a justificativa vai na planilha de baixa para o SAP corrigir.</p>
      {!aberto ? (
        <button className="btn btn-od btn-sm" type="button" onClick={() => setAberto(true)} style={{ alignSelf: "flex-start" }}>
          Devolver a OS
        </button>
      ) : (
        <form ref={ref} noValidate className="stack g8" onSubmit={enviar(() => setAssinando(true))}>
          <Field label="Justificativa da devolução" htmlFor={idDoCampo} labelStyle={{ color: "var(--ink3)" }} erro={erros.justificativa?.message}>
            <textarea className="textarea" rows={3} placeholder="O que está errado na ordem?" {...register("justificativa")} {...ligarAoErro(idDoCampo, erros.justificativa?.message)} />
          </Field>
          <div className="row g8">
            <button className="btn btn-d btn-sm" type="submit">
              Assinar e devolver
            </button>
            <button className="btn btn-line btn-sm" type="button" onClick={() => setAberto(false)}>
              Voltar
            </button>
          </div>
        </form>
      )}
      {assinando && (
        <JanelaDeAssinatura
          titulo="Devolver a OS ao SAP"
          tom="d"
          resumo="A OS sai do quadro da equipe e a sua justificativa vai na próxima planilha de baixa."
          rotuloConfirmar="Assinar e devolver"
          assinaturaPath={assinaturaPath}
          osId={osId}
          aoConfirmar={async () => {
            await chamar("POST", `/os/${osId}/devolver`, { justificativa: justificativa.trim() });
          }}
          aoFechar={() => setAssinando(false)}
        >
          <p className="small">
            <strong>Justificativa:</strong> {justificativa.trim()}
          </p>
        </JanelaDeAssinatura>
      )}
    </Panel>
  );
}
