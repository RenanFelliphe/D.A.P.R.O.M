"use client";

import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";

const esquema = z.object({ motivo: z.string().trim().min(1, "Diga por que você recusa a APR: o motivo é obrigatório.") });

/**
 * O direito de recusa: quem não concorda com a APR (ou não está em condições de fazer o serviço) sai dela, deixando o motivo, que
 * fica registrado e é avisado ao supervisor. O motivo é obrigatório: sem ele, a mensagem aparece junto do campo.
 */
export function JanelaDeRecusa({ aoRecusar, aoFechar }: { aoRecusar: (motivo: string) => Promise<void>; aoFechar: () => void }) {
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { motivo: "" });
  const erro = form.formState.errors.motivo?.message;

  return (
    <JanelaSobreposta titulo="Recusar a APR" aoFechar={enviando ? () => undefined : aoFechar} dataTreino="apr-recusar-janela">
      <form ref={ref} noValidate className="stack g12" onSubmit={enviar(({ motivo }) => aoRecusar(motivo.trim()))}>
        <Notice tone="al" icon="alert">
          <strong>Direito de recusa.</strong> Você sai desta APR e não assina. O supervisor é avisado na hora, com o seu motivo. Se o responsável recusar, ou sobrarem menos
          de 2 participantes, será preciso fazer uma APR nova.
        </Notice>
        <Field label="Motivo da recusa" htmlFor="motivo-recusa" erro={erro}>
          <textarea
            className="textarea"
            rows={4}
            maxLength={500}
            placeholder="Por que você não concorda com esta APR?"
            disabled={enviando}
            {...form.register("motivo")}
            {...ligarAoErro("motivo-recusa", erro)}
          />
        </Field>
        <ErroDeEnvio mensagem={erroEnvio} />
        <div className="row g8 wrap">
          <Button type="submit" variant="d" disabled={enviando} aria-busy={enviando}>
            {enviando ? "Enviando…" : "Recusar a APR"}
          </Button>
          <Button variant="ghost" onClick={aoFechar} disabled={enviando}>
            Voltar
          </Button>
        </div>
      </form>
    </JanelaSobreposta>
  );
}
