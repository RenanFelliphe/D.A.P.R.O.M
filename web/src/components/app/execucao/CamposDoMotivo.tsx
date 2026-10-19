"use client";

import { useFormContext } from "react-hook-form";
import type { z } from "zod";
import type { OpcaoDeMotivo } from "@/components/app/execucao/motivos";
import { faltaNoMotivo } from "@/lib/execucao-motivos";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";

/** Os campos do motivo obrigatório: a escolha e o complemento que alguns motivos abrem. */
export interface ValoresDoMotivo {
  motivo: string;
  complemento: string;
}

/**
 * Regra do esquema Zod do motivo (`.superRefine(regraDoMotivo(opcoes, "da pausa"))`): o motivo é obrigatório e, nos que abrem
 * um campo (aguardando, outro), o complemento também. A mensagem diz o que falta, no campo certo.
 */
export const regraDoMotivo =
  (opcoes: OpcaoDeMotivo[], deQue: string) =>
  (valores: ValoresDoMotivo, ctx: z.RefinementCtx) => {
    const falta = faltaNoMotivo(opcoes, deQue, valores);
    if (falta) ctx.addIssue({ code: "custom", path: [falta.campo], message: falta.mensagem });
  };

interface CamposDoMotivoProps {
  opcoes: OpcaoDeMotivo[];
  /** "da pausa", "da suspensão": o nome do grupo para os leitores de tela. */
  deQue: string;
  desabilitado?: boolean;
}

/**
 * A lista de motivos como opções, o campo que alguns abrem ("o que ou quem", "descrição") e, para lesão e enfermidade, o aviso de
 * que o supervisor é avisado na hora. Usa o formulário do `FormProvider` que o envolve.
 */
export function CamposDoMotivo({ opcoes, deQue, desabilitado }: CamposDoMotivoProps) {
  const { register, watch, formState } = useFormContext<ValoresDoMotivo>();
  const erros = formState.errors;
  const escolhido = opcoes.find((o) => o.valor === watch("motivo"));

  return (
    <>
      <Field label="Motivo" erro={erros.motivo?.message}>
        <div className="list-box" role="radiogroup" aria-label={`Motivo ${deQue}`}>
          {opcoes.map((opcao) => (
            <label key={opcao.valor} className="list-row" style={{ minHeight: 48, cursor: "pointer" }}>
              <input type="radio" value={opcao.valor} {...register("motivo")} disabled={desabilitado} />
              <span>{opcao.rotulo}</span>
            </label>
          ))}
        </div>
      </Field>
      {escolhido?.complemento && (
        <Field label={escolhido.complemento.rotulo} htmlFor="complemento" erro={erros.complemento?.message}>
          <textarea
            className="textarea"
            rows={3}
            placeholder={escolhido.complemento.dica}
            maxLength={300}
            disabled={desabilitado}
            {...register("complemento")}
            {...ligarAoErro("complemento", erros.complemento?.message)}
          />
        </Field>
      )}
      {escolhido?.avisaSupervisor && (
        <Notice tone="al" icon="alert">
          <strong>O supervisor será avisado na hora</strong> (no sino e por e-mail), porque{" "}
          {escolhido.valor === "lesao" ? "a lesão no trabalho, mesmo leve, é acidente de trabalho" : "a enfermidade no serviço precisa ser registrada"}. O motivo também consta no
          relatório da execução.
        </Notice>
      )}
    </>
  );
}

export { complementoDoMotivo } from "@/lib/execucao-motivos";
