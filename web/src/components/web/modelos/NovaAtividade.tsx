"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import { caminhoDaAtividade } from "./LinhaAtividade";

/** Limites da `api` (`PUT /atividades/{codigo}`): o código tem até 200 caracteres. */
const esquema = z.object({
  codigo: z.string().trim().min(1, "Informe o código do plano de manutenção.").max(200, "O código pode ter até 200 caracteres."),
  descricao: z.string().trim().min(1, "Informe a descrição do serviço."),
  provisorio: z.boolean(),
});

/** Cadastra uma atividade nova (`PUT /atividades/{codigo}`): o código do plano do SAP e a descrição do serviço. */
export function NovaAtividade() {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Button variant="p" sm onClick={() => setAberto(true)}>
        <Icon name="plus" size={16} />
        Nova atividade
      </Button>
    );
  }
  return <FormularioNovaAtividade aoFechar={() => setAberto(false)} />;
}

function FormularioNovaAtividade({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { codigo: "", descricao: "", provisorio: false });
  const { register, formState } = form;
  const erros = formState.errors;

  return (
    <form
      ref={ref}
      noValidate
      className="panel"
      style={{ gap: 12 }}
      onSubmit={enviar(async (v) => {
        const codigo = v.codigo.trim();
        await chamar("PUT", caminhoDaAtividade(codigo), { descricao: v.descricao.trim(), provisorio: v.provisorio });
        exibirAviso(`Atividade ${codigo} cadastrada.`);
        aoFechar();
        router.refresh();
      })}
    >
      <h3 style={{ fontSize: 15 }}>Nova atividade</h3>
      <div className="grade2">
        <Field label="Código do plano de manutenção (SAP)" htmlFor="atividade-codigo" erro={erros.codigo?.message}>
          <input className="input" placeholder="8.7.1" disabled={enviando} {...register("codigo")} {...ligarAoErro("atividade-codigo", erros.codigo?.message)} />
        </Field>
        <Field label="Descrição" htmlFor="atividade-descricao" erro={erros.descricao?.message}>
          <input className="input" placeholder="Drenagem de caixa de válvula" disabled={enviando} {...register("descricao")} {...ligarAoErro("atividade-descricao", erros.descricao?.message)} />
        </Field>
      </div>
      <label className="row g8 small">
        <input type="checkbox" disabled={enviando} {...register("provisorio")} />O código é provisório (ainda não confirmado no SAP)
      </label>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoFechar} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" aria-busy={enviando} disabled={enviando}>
          {enviando ? "Salvando…" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
