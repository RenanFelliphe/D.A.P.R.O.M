"use client";

import { useId } from "react";
import { Field } from "@/components/ui/Field";
import { somarDias } from "@/lib/ausencia";
import { dataDoDia, hoje } from "@/lib/formatar";
import { retornoDoPeriodo, type PeriodoDigitado } from "../../../../shared/api/ausencia-periodo";

/** O período digitado e as contas dele vivem em `shared/api/ausencia-periodo.ts` (o app `mobile` usa o mesmo código). */
export { periodoParaApi, periodoVazio, retornoDoPeriodo, type PeriodoDigitado } from "../../../../shared/api/ausencia-periodo";

interface CamposDePeriodoProps {
  valor: PeriodoDigitado;
  aoMudar: (v: PeriodoDigitado) => void;
}

/** Início, e os dias corridos ou a data de retorno: os dois formatos dizem a mesma coisa, e o outro é calculado aqui. */
export function CamposDePeriodo({ valor, aoMudar }: CamposDePeriodoProps) {
  const id = useId();
  const retorno = retornoDoPeriodo(valor);
  const mudar = (parte: Partial<PeriodoDigitado>) => aoMudar({ ...valor, ...parte });
  return (
    <div className="stack g12">
      <Field label="Primeiro dia de ausência" htmlFor={`${id}-inicio`}>
        <input id={`${id}-inicio`} className="input" type="date" min={hoje()} value={valor.inicio} onChange={(e) => mudar({ inicio: e.target.value })} />
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
          <input
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
        ) : (
          <input
            className="input"
            type="date"
            min={valor.inicio ? somarDias(valor.inicio, 1) : hoje()}
            aria-label="Data de retorno"
            value={valor.retorno}
            onChange={(e) => mudar({ retorno: e.target.value })}
          />
        )}
        <span className="small muted" aria-live="polite">
          {retorno ? `Volta ao trabalho em ${dataDoDia(retorno)} (o retorno é o primeiro dia de volta).` : "O retorno é o primeiro dia de volta ao trabalho."}
        </span>
      </div>
    </div>
  );
}
