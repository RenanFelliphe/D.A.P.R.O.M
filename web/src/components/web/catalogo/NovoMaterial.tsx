"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { CATEGORIAS, rotuloDaCategoria } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** Os limites são os da `api` (`POST /catalogo/materiais`); o código do SAP é opcional. */
const esquema = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição do material").max(200, "A descrição pode ter até 200 caracteres"),
  categoria: z.enum(["material", "ferramenta", "epi"], "Escolha a categoria"),
  unidade: z.string().trim().min(1, "Informe a unidade (un, m, kg…)").max(20, "A unidade pode ter até 20 caracteres"),
  codigo: z.string().trim().max(40, "O código do SAP pode ter até 40 caracteres"),
});

/** Cadastra um material, ferramenta ou EPI no catálogo (`POST /catalogo/materiais`). A página monta o `datalist` das unidades. */
export function NovoMaterial() {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Button variant="p" sm onClick={() => setAberto(true)}>
        <Icon name="plus" size={16} />
        Novo material
      </Button>
    );
  }
  return <FormularioNovoMaterial aoFechar={() => setAberto(false)} />;
}

function FormularioNovoMaterial({ aoFechar }: { aoFechar: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { descricao: "", categoria: "material", unidade: "un", codigo: "" });
  const { register, formState } = form;
  const erros = formState.errors;

  return (
    <form
      ref={ref}
      noValidate
      className="panel"
      style={{ gap: 12, width: "100%" }}
      onSubmit={enviar(async (valores) => {
        const descricao = valores.descricao.trim();
        await chamar("POST", "/catalogo/materiais", { codigo: valores.codigo.trim() || null, descricao, unidade: valores.unidade.trim(), categoria: valores.categoria });
        exibirAviso(`"${descricao}" cadastrado.`);
        aoFechar();
        router.refresh();
      })}
    >
      <h3 style={{ fontSize: 15 }}>Novo material, ferramenta ou EPI</h3>
      <div className="grade2">
        <Field label="Descrição" htmlFor="material-descricao" erro={erros.descricao?.message}>
          <input className="input" maxLength={200} placeholder="Luva de vaqueta" disabled={enviando} {...register("descricao")} {...ligarAoErro("material-descricao", erros.descricao?.message)} />
        </Field>
        <Field label="Categoria" htmlFor="material-categoria" erro={erros.categoria?.message}>
          <select className="select" disabled={enviando} {...register("categoria")} {...ligarAoErro("material-categoria", erros.categoria?.message)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {rotuloDaCategoria[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unidade" htmlFor="material-unidade" erro={erros.unidade?.message}>
          <input className="input" maxLength={20} list="unidades-material" disabled={enviando} {...register("unidade")} {...ligarAoErro("material-unidade", erros.unidade?.message)} />
        </Field>
        <Field label="Código no SAP (opcional)" htmlFor="material-codigo" erro={erros.codigo?.message}>
          <input className="input mono" maxLength={40} placeholder="10002345" disabled={enviando} {...register("codigo")} {...ligarAoErro("material-codigo", erros.codigo?.message)} />
        </Field>
      </div>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8">
        <Button variant="p" sm type="submit" aria-busy={enviando} disabled={enviando}>
          {enviando ? "Salvando…" : "Cadastrar"}
        </Button>
        <Button variant="line" sm onClick={aoFechar} disabled={enviando}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
