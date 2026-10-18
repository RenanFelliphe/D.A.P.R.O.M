"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { z } from "zod";
import { CamposDoMotivo, complementoDoMotivo, regraDoMotivo } from "@/components/app/execucao/CamposDoMotivo";
import { MOTIVOS_DA_SUSPENSAO } from "@/components/app/execucao/motivos";
import { Button } from "@/components/ui/Button";
import { Field, Req, ligarAoErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { Notice } from "@/components/ui/Notice";
import { enviarEvento } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import type { Situacao } from "./situacao";
import { paraCampoDataHora } from "./tempo";
import { useAgora } from "./useAgora";

/**
 * Execução esquecida de outro dia: antes de qualquer coisa o técnico a suspende, informando a hora real do fim e o motivo (é uma
 * suspensão, então o motivo é obrigatório como na janela de suspender). A `api` recusa iniciar outra enquanto isso. Nada é
 * encerrado sozinho. Esta suspensão não grava a localização: o aparelho não está mais onde a execução parou.
 */
export function SuspenderEsquecida({ execucao }: { execucao: Extract<Situacao, { tipo: "esquecida" }>["execucao"] }) {
  const router = useRouter();
  const agora = useAgora();
  const inicio = new Date(execucao.inicio);

  const esquema = useMemo(
    () =>
      z
        .object({ fim: z.string(), motivo: z.string(), complemento: z.string() })
        .superRefine((valores, ctx) => {
          const fim = valores.fim ? new Date(valores.fim) : null;
          const inicio = new Date(execucao.inicio);
          if (!fim || Number.isNaN(fim.getTime())) ctx.addIssue({ code: "custom", path: ["fim"], message: "Informe a hora real em que você parou." });
          else if (fim < inicio) ctx.addIssue({ code: "custom", path: ["fim"], message: "O fim precisa ser depois do início da execução." });
          else if (agora !== null && fim.getTime() > agora + 60_000) ctx.addIssue({ code: "custom", path: ["fim"], message: "O fim não pode estar no futuro." });
          regraDoMotivo(MOTIVOS_DA_SUSPENSAO, "da suspensão")(valores, ctx);
        }),
    [execucao.inicio, agora],
  );
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { fim: "", motivo: "", complemento: "" });
  const erros = form.formState.errors;

  const suspender = enviar(async (valores) => {
    await enviarEvento({
      tipo: "execucao_suspensa",
      os_id: execucao.os_id,
      payload: { execucao_id: execucao.id, fim: new Date(valores.fim).toISOString(), motivo: valores.motivo, ...complementoDoMotivo(MOTIVOS_DA_SUSPENSAO, valores) },
    });
    router.refresh();
  });

  return (
    <FormProvider {...form}>
      <form ref={ref} noValidate onSubmit={suspender} className="panel stack g12" style={{ maxWidth: 560 }}>
        <h2>Suspender a execução de ontem</h2>
        <Notice tone="al" icon="clock">
          A OS <strong>{execucao.numero_ordem ?? execucao.titulo}</strong> ficou em execução desde {dataHora(execucao.inicio)} e não foi suspensa. Informe a hora
          real em que você parou e o motivo para poder seguir; a OS fica pendente e uma nova APR retoma o trabalho.
        </Notice>
        <Field
          label={
            <>
              Hora real do fim <Req style={{ color: "var(--exe)" }}>· obrigatória</Req>
            </>
          }
          htmlFor="fim"
          erro={erros.fim?.message}
        >
          <input
            className="input"
            type="datetime-local"
            min={paraCampoDataHora(inicio)}
            max={agora === null ? undefined : paraCampoDataHora(new Date(agora))}
            disabled={enviando}
            style={{ maxWidth: 260 }}
            {...form.register("fim")}
            {...ligarAoErro("fim", erros.fim?.message)}
          />
        </Field>
        <CamposDoMotivo opcoes={MOTIVOS_DA_SUSPENSAO} deQue="da suspensão" desabilitado={enviando} />
        <ErroDeEnvio mensagem={erroEnvio} />
        <Button type="submit" variant="p" disabled={enviando} aria-busy={enviando}>
          {enviando ? "Suspendendo…" : "Suspender a execução"}
        </Button>
      </form>
    </FormProvider>
  );
}
