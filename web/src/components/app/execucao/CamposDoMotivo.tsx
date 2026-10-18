"use client";

import { useFormContext } from "react-hook-form";
import type { z } from "zod";
import type { OpcaoDeMotivo } from "@/components/app/execucao/motivos";
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
    if (!valores.motivo) {
      ctx.addIssue({ code: "custom", path: ["motivo"], message: `Escolha o motivo ${deQue}.` });
      return;
    }
    const opcao = opcoes.find((o) => o.valor === valores.motivo);
    if (opcao?.complemento && !opcao.complemento.opcional && !valores.complemento.trim()) ctx.addIssue({ code: "custom", path: ["complemento"], message: opcao.complemento.faltou });
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

/** O complemento só vai no evento quando o motivo escolhido o abre; o opcional (lesão, enfermidade) só vai se foi escrito. */
export function complementoDoMotivo(opcoes: OpcaoDeMotivo[], valores: ValoresDoMotivo): { complemento?: string } {
  const campo = opcoes.find((o) => o.valor === valores.motivo)?.complemento;
  const texto = valores.complemento.trim();
  return campo && (!campo.opcional || texto) ? { complemento: texto } : {};
}
