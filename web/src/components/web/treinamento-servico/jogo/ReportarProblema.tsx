"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";

const LIMITE = 500;

const esquema = z.object({
  texto: z.string().trim().min(1, "Escreva o que parece errado nesta fase.").max(LIMITE, `O aviso pode ter até ${LIMITE} caracteres.`),
});

/**
 * "Reportar problema" de uma fase (seção 3.3 do `vitoria.md`): um texto livre que vira aviso para o admin. Abre por cima da
 * fase, sem sair do jogo; a resposta da fase não muda.
 */
export function ReportarProblema({ atividadeCodigo, fase }: { atividadeCodigo: string; fase: number }) {
  const [aberto, setAberto] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { texto: "" });
  const { register, formState } = form;
  const erros = formState.errors;
  const [texto] = useValorDoForm(form, "texto");

  if (enviado) {
    return (
      <span className="ts-reportado" role="status">
        <Icon name="check" size={13} />
        Aviso enviado ao admin
      </span>
    );
  }

  return (
    <>
      <button type="button" className="ts-reportar" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <Icon name="flag" size={13} />
        <span>Reportar problema</span>
      </button>
      {aberto && (
        <form
          ref={ref}
          noValidate
          className="ts-reportar-caixa"
          onSubmit={enviar(async (v) => {
            await chamar("POST", `/treinamentos/${encodeURIComponent(atividadeCodigo)}/reportes`, { fase, texto: v.texto.trim() });
            setEnviado(true);
            form.reset({ texto: "" });
          })}
        >
          <Field label="O que parece errado nesta fase? O aviso vai para quem cuida dos treinamentos." htmlFor={`reporte-${fase}`} labelStyle={{ fontSize: 12 }} erro={erros.texto?.message}>
            <textarea
              className="textarea"
              rows={3}
              maxLength={LIMITE}
              placeholder="Ex.: a resposta certa desta pergunta parece ser outra."
              {...register("texto")}
              {...ligarAoErro(`reporte-${fase}`, erros.texto?.message)}
            />
          </Field>
          {erroEnvio && <span className="field-erro">{erroEnvio}</span>}
          <div className="row g8 wrap">
            <Button variant="p" sm type="submit" aria-busy={enviando} disabled={enviando}>
              {enviando ? "Enviando…" : "Enviar aviso"}
            </Button>
            <Button variant="ghost" sm onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <span className="small ts-contador">
              {texto.length}/{LIMITE}
            </span>
          </div>
        </form>
      )}
    </>
  );
}
