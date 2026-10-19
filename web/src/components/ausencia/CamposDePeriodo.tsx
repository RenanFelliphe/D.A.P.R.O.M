"use client";

import { useId } from "react";
import { z } from "zod";
import { CampoDeCelula, Field, ligarAoErro } from "@/components/ui/Field";
import { somarDias } from "@/lib/ausencia";
import { dataDoDia, hoje } from "@/lib/formatar";
import { diaExiste } from "@/lib/validacao";
import { retornoDoPeriodo, type PeriodoDigitado } from "../../../../shared/api/ausencia-periodo";

/** O período digitado e as contas dele vivem em `shared/api/ausencia-periodo.ts` (o app `mobile` usa o mesmo código). */
export { periodoParaApi, periodoVazio, retornoDoPeriodo, type PeriodoDigitado } from "../../../../shared/api/ausencia-periodo";

/** O período como valor de um formulário (React Hook Form); `conferirPeriodo` diz o que está errado. */
export const esquemaDoPeriodo = z.object({ inicio: z.string(), modo: z.enum(["dias", "retorno"]), dias: z.string(), retorno: z.string() });

/**
 * Confere o período digitado e põe cada mensagem no campo dela, para o `superRefine` do esquema do formulário. `caminho` é onde o período
 * está nos valores do formulário; `minimoDoInicio` (por padrão, hoje) é o primeiro dia que o início pode ter.
 */
export function conferirPeriodo(p: PeriodoDigitado, ctx: z.RefinementCtx, caminho: string[], minimoDoInicio = hoje()) {
  const problema = (campo: keyof PeriodoDigitado, message: string) => ctx.addIssue({ code: "custom", path: [...caminho, campo], message });
  if (!p.inicio) problema("inicio", "Informe o primeiro dia de ausência.");
  else if (!diaExiste(p.inicio)) problema("inicio", "Informe uma data válida.");
  else if (p.inicio < minimoDoInicio) problema("inicio", "O primeiro dia não pode ser anterior a hoje.");
  if (p.modo === "dias") {
    const dias = Number(p.dias);
    if (p.dias.trim() === "" || !Number.isInteger(dias) || dias < 1 || dias > 365) problema("dias", "Informe os dias corridos, um número inteiro de 1 a 365.");
  } else if (!p.retorno) problema("retorno", "Informe a data de retorno.");
  else if (!diaExiste(p.retorno)) problema("retorno", "Informe uma data válida.");
  else if (p.inicio && diaExiste(p.inicio) && p.retorno <= p.inicio) problema("retorno", "O retorno precisa ser depois do primeiro dia de ausência.");
}

/** As mensagens de erro de cada campo do período (as de `conferirPeriodo`), vindas do formulário. */
export type ErrosDoPeriodo = Partial<Record<"inicio" | "dias" | "retorno", string>>;

interface CamposDePeriodoProps {
  valor: PeriodoDigitado;
  aoMudar: (v: PeriodoDigitado) => void;
  erros?: ErrosDoPeriodo;
}

/** Início, e os dias corridos ou a data de retorno: os dois formatos dizem a mesma coisa, e o outro é calculado aqui. */
export function CamposDePeriodo({ valor, aoMudar, erros = {} }: CamposDePeriodoProps) {
  const id = useId();
  const retorno = retornoDoPeriodo(valor);
  const mudar = (parte: Partial<PeriodoDigitado>) => aoMudar({ ...valor, ...parte });
  return (
    <div className="stack g12">
      <Field label="Primeiro dia de ausência" htmlFor={`${id}-inicio`} erro={erros.inicio}>
        <input {...ligarAoErro(`${id}-inicio`, erros.inicio)} className="input" type="date" min={hoje()} value={valor.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
      </Field>
      <div className="stack g8">
        <span className="lbl">Até quando</span>
        <div className="row g12 wrap">
          <label className="row g8 small">
            <input type="radio" name={`${id}-modo`} checked={valor.modo === "dias"} onChange={() => mudar({ modo: "dias" })} />
            Número de dias
          </label>
          <label className="row g8 small">
            <input type="radio" name={`${id}-modo`} checked={valor.modo === "retorno"} onChange={() => mudar({ modo: "retorno" })} />
            Data de retorno
          </label>
        </div>
        {valor.modo === "dias" ? (
          <CampoDeCelula id={`${id}-dias`} erro={erros.dias}>
            <input
              {...ligarAoErro(`${id}-dias`, erros.dias)}
              className="input"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              placeholder="Dias corridos (1 a 365)"
              aria-label="Dias corridos"
              value={valor.dias}
              onChange={(e) => mudar({ dias: e.target.value })}
            />
          </CampoDeCelula>
        ) : (
          <CampoDeCelula id={`${id}-retorno`} erro={erros.retorno}>
            <input
              {...ligarAoErro(`${id}-retorno`, erros.retorno)}
              className="input"
              type="date"
              min={valor.inicio ? somarDias(valor.inicio, 1) : hoje()}
              aria-label="Data de retorno"
              value={valor.retorno}
              onChange={(e) => mudar({ retorno: e.target.value })}
            />
          </CampoDeCelula>
        )}
        <span className="small muted" aria-live="polite">
          {retorno ? `Volta ao trabalho em ${dataDoDia(retorno)} (o retorno é o primeiro dia de volta).` : "O retorno é o primeiro dia de volta ao trabalho."}
        </span>
      </div>
    </div>
  );
}
