"use client";

import { useState } from "react";
import { z } from "zod";
import { diaExiste } from "@/lib/validacao";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { dataDoDia } from "@/lib/formatar";
import type { Equipe } from "@/lib/tipos";
import { useMinhaAssinatura } from "@/state/minha-assinatura";

const rotulo = { fontSize: 12 } as const;

const esquema = z.object({
  data: z.string().min(1, "Informe a nova data.").refine(diaExiste, "Informe uma data válida."),
  equipeId: z.string().min(1, "Escolha a equipe."),
  justificativa: z.string().trim().min(1, "Informe a justificativa da reprogramação."),
});

interface CartaoReprogramarProps {
  osId: string;
  /** Data programada atual (`AAAA-MM-DD`). */
  dataAtual: string;
  equipeAtualId: string;
  equipes: Equipe[];
  /** Hoje (`AAAA-MM-DD`): a nova data sugerida quando a atual já passou. */
  hoje: string;
}

/** Cartão de decisão "Reprogramar" (opcional): nova data e, se fizer sentido, nova equipe; a justificativa é obrigatória e a reprogramação é assinada. */
export function CartaoReprogramar({ osId, dataAtual, equipeAtualId, equipes, hoje }: CartaoReprogramarProps) {
  const assinaturaPath = useMinhaAssinatura();
  const [assinando, setAssinando] = useState(false);
  const [feito, setFeito] = useState<string | null>(null);
  const { form, ref, enviar } = useFormulario(esquema, { data: dataAtual >= hoje ? dataAtual : hoje, equipeId: equipeAtualId, justificativa: "" });
  const { register, formState, getValues } = form;
  const erros = formState.errors;
  const [data] = useValorDoForm(form, "data");
  const [equipeId] = useValorDoForm(form, "equipeId");
  const [justificativa] = useValorDoForm(form, "justificativa");

  async function reprogramar() {
    await chamar("POST", `/os/${osId}/reprogramar`, {
      data_inicio_prog: data,
      equipe_id: equipeId !== equipeAtualId ? equipeId : undefined,
      justificativa: justificativa.trim(),
    });
    const nova = equipes.find((e) => e.id === equipeId);
    setFeito(`OS reprogramada para ${dataDoDia(data)}${equipeId !== equipeAtualId && nova ? `, equipe ${nova.nome}` : ""}. A equipe segue podendo fazer uma APR nova.`);
    form.reset({ ...getValues(), justificativa: "" });
  }

  return (
    <form ref={ref} noValidate className="dcard" onSubmit={enviar(() => setAssinando(true))}>
      <div className="hd">
        <span className="ic">
          <Icon name="cal" size={16} />
        </span>
        <h4>Reprogramar</h4>
      </div>
      <p className="muted">
        Nova data ou nova equipe, quando fizer sentido. É opcional: a equipe não precisa esperar para fazer uma nova APR.
      </p>
      <Field label="Nova data" htmlFor="rp-dt" labelStyle={rotulo} erro={erros.data?.message}>
        <input className="select" type="date" {...register("data")} {...ligarAoErro("rp-dt", erros.data?.message)} />
      </Field>
      <Field label="Equipe" htmlFor="rp-eq" labelStyle={rotulo} erro={erros.equipeId?.message}>
        <select className="select" {...register("equipeId")} {...ligarAoErro("rp-eq", erros.equipeId?.message)}>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={
          <>
            Justificativa <Req>· obrigatória</Req>
          </>
        }
        htmlFor="rp-js"
        labelStyle={rotulo}
        erro={erros.justificativa?.message}
      >
        <textarea
          className="textarea"
          {...register("justificativa")}
          {...ligarAoErro("rp-js", erros.justificativa?.message)}
          rows={2}
          style={{ fontSize: 14 }}
          placeholder="Ex.: aguardar a drenagem pela manutenção civil"
        />
      </Field>
      {feito && (
        <Notice tone="ok" icon="check" style={{ fontSize: 13.5 }}>
          {feito}
        </Notice>
      )}
      <Button variant="line" sm type="submit" style={{ height: 44, borderColor: "var(--ink)" }}>
        Assinar e reprogramar
      </Button>
      {assinando && (
        <JanelaDeAssinatura
          titulo="Reprogramar a OS"
          resumo={`A OS passa para ${dataDoDia(data)}${equipeId !== equipeAtualId ? ", com outra equipe" : ""}.`}
          rotuloConfirmar="Assinar e reprogramar"
          assinaturaPath={assinaturaPath}
          aoConfirmar={reprogramar}
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
