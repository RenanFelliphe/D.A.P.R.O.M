"use client";

import { useState } from "react";
import { z } from "zod";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { useMinhaAssinatura } from "@/state/minha-assinatura";

const esquema = z.object({ justificativa: z.string().trim().min(1, "Informe a justificativa do cancelamento.") });

/** Cancela a OS de apoio (`POST /os/{id}/cancelar`): pede a justificativa e a assinatura do admin. Só aparece para OS de apoio liberada ou pendente. */
export function CancelarOs({ osId }: { osId: string }) {
  const assinaturaPath = useMinhaAssinatura();
  const [aberto, setAberto] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const { form, ref, enviar } = useFormulario(esquema, { justificativa: "" });
  const { register, formState } = form;
  const erros = formState.errors;
  const [justificativa] = useValorDoForm(form, "justificativa");

  if (!aberto) {
    return (
      <button className="btn btn-od btn-sm" type="button" onClick={() => setAberto(true)} style={{ alignSelf: "flex-start" }}>
        Cancelar OS de apoio
      </button>
    );
  }

  return (
    <form ref={ref} noValidate className="stack g8" onSubmit={enviar(() => setAssinando(true))}>
      <Field label="Justificativa do cancelamento" htmlFor="cancelar-justificativa" labelStyle={{ color: "var(--ink3)" }} erro={erros.justificativa?.message}>
        <textarea className="textarea" rows={3} placeholder="Por que esta OS está sendo cancelada?" {...register("justificativa")} {...ligarAoErro("cancelar-justificativa", erros.justificativa?.message)} />
      </Field>
      <div className="row g8">
        <button className="btn btn-d btn-sm" type="submit">
          Assinar e cancelar
        </button>
        <button className="btn btn-line btn-sm" type="button" onClick={() => setAberto(false)}>
          Voltar
        </button>
      </div>
      {assinando && (
        <JanelaDeAssinatura
          titulo="Cancelar a OS de apoio"
          tom="d"
          resumo="A OS de apoio é cancelada e sai do quadro da equipe."
          rotuloConfirmar="Assinar e cancelar"
          assinaturaPath={assinaturaPath}
          osId={osId}
          aoConfirmar={async () => {
            await chamar("POST", `/os/${osId}/cancelar`, { justificativa: justificativa.trim() });
          }}
          aoFechar={() => setAssinando(false)}
        >
          <p className="small">
            <strong>Justificativa:</strong> {justificativa.trim()}
          </p>
        </JanelaDeAssinatura>
      )}
    </form>
  );
}
