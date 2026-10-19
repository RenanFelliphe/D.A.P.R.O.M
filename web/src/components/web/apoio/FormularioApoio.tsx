"use client";

import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro, Req } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { diaExiste } from "@/lib/validacao";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import type { Equipe } from "@/lib/tipos";
import { SeletorLocal } from "./SeletorLocal";
import { PRIORIDADES, type Atividade, type LocalEscolhido } from "./tipos";

const rotulo = { fontSize: 12 } as const;

const esquema = z.object({
  tipo: z.enum(["corretiva", "preventiva"]),
  prioridade: z.string(),
  atividade: z.string(),
  titulo: z.string().trim().min(1, "Informe o título da OS."),
  descricao: z.string(),
  local: z.custom<LocalEscolhido | null>().refine((v): boolean => v !== null, "Escolha o local de instalação."),
  equipeId: z.string().min(1, "Escolha a equipe."),
  data: z.string().min(1, "Informe a data programada.").refine(diaExiste, "Informe uma data válida."),
});

interface FormularioApoioProps {
  /** Distingue os ids dos campos quando houver mais de um formulário na página. */
  prefixo: string;
  equipes: Equipe[];
  atividades: Atividade[];
  /** A OS que este apoio destrava (`os_origem_id`). */
  osOrigemId: string;
  localInicial?: LocalEscolhido | null;
  tituloInicial?: string;
  descricaoInicial?: string;
  /** Hoje (`AAAA-MM-DD`), como data inicial sugerida. */
  hoje: string;
  rotuloEnviar: string;
  /** Texto da confirmação depois de criada. */
  mensagemCriada: string;
  /** Se quem criou pode abrir a OS nova (o supervisor só enxerga as OS da própria equipe). */
  podeAbrirOs: (equipeId: string) => boolean;
}

/** Formulário da OS de apoio: a única OS que nasce no sistema, ligada à OS que ela destrava (`POST /os` com `os_origem_id`). */
export function FormularioApoio(p: FormularioApoioProps) {
  const [criada, setCriada] = useState<{ id: string; equipeId: string } | null>(null);
  const valoresIniciais = { tipo: "corretiva" as const, prioridade: "", atividade: "", titulo: p.tituloInicial ?? "", descricao: p.descricaoInicial ?? "", local: p.localInicial ?? null, equipeId: "", data: p.hoje };
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, valoresIniciais);
  const { register, formState, getValues, setValue } = form;
  const erros = formState.errors;
  const [local, definirLocal] = useValorDoForm(form, "local");

  function escolherAtividade(codigo: string) {
    setValue("atividade", codigo);
    const a = p.atividades.find((x) => x.codigo === codigo);
    if (a && !getValues("titulo").trim()) setValue("titulo", a.descricao, { shouldValidate: Boolean(formState.errors.titulo) });
  }

  function outra() {
    setCriada(null);
    form.reset({ ...getValues(), titulo: p.tituloInicial ?? "", descricao: p.descricaoInicial ?? "", atividade: "", prioridade: "" });
  }

  if (criada) {
    return (
      <div className="stack g8">
        <Notice tone="ok" icon="check" style={{ fontSize: 14 }}>
          {p.mensagemCriada}
        </Notice>
        <div className="row g8 wrap">
          {p.podeAbrirOs(criada.equipeId) && (
            <Link href={rotas.app.os(criada.id)} style={{ fontSize: 14, fontWeight: 600 }}>
              Abrir a OS nova
            </Link>
          )}
          <Button variant="ghost" sm onClick={outra}>
            Criar outra
          </Button>
        </div>
      </div>
    );
  }

  const id = (campo: string) => `${p.prefixo}-${campo}`;
  return (
    <form
      ref={ref}
      className="stack g12"
      noValidate
      onSubmit={enviar(async (v) => {
        const nova = await chamar<{ id: string }>("POST", "/os", {
          tipo: v.tipo,
          titulo: v.titulo.trim(),
          descricao: v.descricao.trim() || undefined,
          codigo_atividade: v.atividade || undefined,
          local_instalacao_id: v.local!.id,
          equipe_id: v.equipeId,
          data_inicio_prog: v.data,
          prioridade: v.prioridade || undefined,
          os_origem_id: p.osOrigemId,
        });
        setCriada({ id: nova.id, equipeId: v.equipeId });
      })}
    >
      <div className="row g8 wrap">
        <Field label="Tipo" htmlFor={id("tp")} labelStyle={rotulo} className="grow">
          <select className="select" {...register("tipo")} id={id("tp")}>
            <option value="corretiva">Corretiva</option>
            <option value="preventiva">Preventiva</option>
          </select>
        </Field>
        <Field label="Prioridade" htmlFor={id("pr")} labelStyle={rotulo} className="grow">
          <select className="select" {...register("prioridade")} id={id("pr")}>
            <option value="">Sem prioridade</option>
            {PRIORIDADES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field
        label={
          <>
            Atividade <Req>· define a lista de materiais</Req>
          </>
        }
        htmlFor={id("at")}
        labelStyle={rotulo}
      >
        <select className="select" {...register("atividade", { onChange: (e) => escolherAtividade(e.target.value) })} id={id("at")}>
          <option value="">Sem atividade</option>
          {p.atividades.map((a) => (
            <option key={a.codigo} value={a.codigo}>
              {a.descricao}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label={
          <>
            Título <Req>· obrigatório</Req>
          </>
        }
        htmlFor={id("ti")}
        labelStyle={rotulo}
        erro={erros.titulo?.message}
      >
        <input className="input" {...register("titulo")} {...ligarAoErro(id("ti"), erros.titulo?.message)} />
      </Field>
      <Field label="Descrição" htmlFor={id("ds")} labelStyle={rotulo}>
        <textarea className="textarea" {...register("descricao")} id={id("ds")} rows={2} style={{ fontSize: 14 }} />
      </Field>
      <SeletorLocal prefixo={p.prefixo} valor={local} onChange={definirLocal} erro={erros.local?.message} />
      <div className="row g8 wrap">
        <Field label="Equipe" htmlFor={id("eq")} labelStyle={rotulo} className="grow" erro={erros.equipeId?.message}>
          <select className="select" {...register("equipeId")} {...ligarAoErro(id("eq"), erros.equipeId?.message)}>
            <option value="">Escolha a equipe</option>
            {p.equipes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Data programada" htmlFor={id("dt")} labelStyle={rotulo} className="grow" erro={erros.data?.message}>
          <input className="input" type="date" {...register("data")} {...ligarAoErro(id("dt"), erros.data?.message)} style={{ height: 40 }} />
        </Field>
      </div>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div>
        <Button type="submit" variant="p" sm style={{ height: 44 }} aria-busy={enviando} disabled={enviando}>
          {enviando ? "Criando…" : p.rotuloEnviar}
        </Button>
      </div>
    </form>
  );
}
