"use client";

import { useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { arquivoDeImagem, CampoImagemDoForm, regraDaImagem } from "@/components/web/gamificacao/CampoImagem";
import { chamar, enviarFormulario } from "@/lib/cliente-api";
import type { Patente } from "@/lib/gamificacao";
import { inteiroEntre } from "@/lib/validacao";

interface FormularioPatenteProps {
  /** A patente que está sendo editada; sem ela, o formulário cria uma nova. */
  patente?: Patente;
  aoConcluir: (mensagem: string) => void;
  aoCancelar: () => void;
}

const COR_PADRAO = "#9DB4C0";

/** Os limites são os da `api`: nome até 40, descrição até 300, cor `#RRGGBB`, pontos inteiros de 0 em diante. As duas imagens são obrigatórias só ao criar. */
function esquemaDaPatente(editando: boolean) {
  return z
    .object({
      nome: z.string().trim().min(1, "Informe o nome da patente.").max(40, "O nome pode ter até 40 caracteres."),
      pontosNecessarios: inteiroEntre(0, 10_000_000, "Informe os pontos necessários, um número inteiro de 0 em diante."),
      cor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor no formato #RRGGBB, como #9DB4C0."),
      descricao: z.string().trim().max(300, "A descrição pode ter até 300 caracteres."),
      ativa: z.boolean(),
      imagem: arquivoDeImagem,
      recusa_imagem: z.string(),
      imagemEquipe: arquivoDeImagem,
      recusa_imagemEquipe: z.string(),
    })
    .superRefine((v, ctx) => {
      regraDaImagem("imagem", !editando, "Escolha a imagem das pessoas.")(v, ctx);
      regraDaImagem("imagemEquipe", !editando, "Escolha a imagem das equipes.")(v, ctx);
    });
}

/**
 * Cadastro de uma patente (na `JanelaModal`): nome, pontuação necessária, cor, descrição, se está ativa e as duas imagens, a das
 * pessoas e a das equipes. Cada uma é escolhida à parte e as duas só ficam iguais se o admin escolher o mesmo arquivo nos dois
 * campos. Criar envia tudo junto (`POST /gamificacao/patentes`, multipart); editar muda os campos (`PATCH`) e troca só a imagem
 * que a pessoa escolheu de novo (`PUT .../imagem` e `PUT .../imagem-equipe`).
 */
export function FormularioPatente({ patente, aoConcluir, aoCancelar }: FormularioPatenteProps) {
  const esquema = useMemo(() => esquemaDaPatente(Boolean(patente)), [patente]);
  const { form, ref, enviar, enviando: ocupado, erroEnvio } = useFormulario(esquema, {
    nome: patente?.nome ?? "",
    pontosNecessarios: patente ? String(patente.pontos_necessarios) : "",
    cor: patente?.cor ?? COR_PADRAO,
    descricao: patente?.descricao ?? "",
    ativa: patente?.ativa ?? true,
    imagem: null,
    recusa_imagem: "",
    imagemEquipe: null,
    recusa_imagemEquipe: "",
  });
  const { register, formState, setValue } = form;
  const erros = formState.errors;
  const [cor] = useValorDoForm(form, "cor");
  const corValida = /^#[0-9A-Fa-f]{6}$/.test(cor);

  return (
    <FormProvider {...form}>
      <form
        ref={ref}
        noValidate
        className="stack g12"
        onSubmit={enviar(async (v) => {
          const nome = v.nome.trim();
          if (!patente) {
            const corpo = new FormData();
            corpo.set("nome", nome);
            corpo.set("pontos_necessarios", v.pontosNecessarios);
            corpo.set("cor", v.cor);
            corpo.set("descricao", v.descricao.trim());
            corpo.set("ativa", String(v.ativa));
            corpo.set("imagem", v.imagem!);
            corpo.set("imagem_equipe", v.imagemEquipe!);
            await enviarFormulario("/gamificacao/patentes", corpo);
            aoConcluir(`Patente "${nome}" criada.`);
            return;
          }
          await chamar("PATCH", `/gamificacao/patentes/${patente.id}`, { nome, pontos_necessarios: Number(v.pontosNecessarios), cor: v.cor, descricao: v.descricao.trim(), ativa: v.ativa });
          if (v.imagem) {
            const corpo = new FormData();
            corpo.set("imagem", v.imagem);
            await enviarFormulario(`/gamificacao/patentes/${patente.id}/imagem`, corpo, "PUT");
          }
          if (v.imagemEquipe) {
            const corpo = new FormData();
            corpo.set("imagem_equipe", v.imagemEquipe);
            await enviarFormulario(`/gamificacao/patentes/${patente.id}/imagem-equipe`, corpo, "PUT");
          }
          aoConcluir(`Patente "${nome}" salva.`);
        })}
      >
        <div className="grade2">
          <Field label="Nome" htmlFor="patente-nome" erro={erros.nome?.message}>
            <input className="input" maxLength={40} placeholder="Ouro" disabled={ocupado} {...register("nome")} {...ligarAoErro("patente-nome", erros.nome?.message)} />
          </Field>
          <Field label="Pontos necessários na temporada" htmlFor="patente-pontos" erro={erros.pontosNecessarios?.message}>
            <input className="input" inputMode="numeric" placeholder="1500" disabled={ocupado} {...register("pontosNecessarios")} {...ligarAoErro("patente-pontos", erros.pontosNecessarios?.message)} />
          </Field>
          <Field label="Cor (destaca o nome e a barra)" htmlFor="patente-cor" erro={erros.cor?.message}>
            <div className="campo-cor">
              <input aria-label="Escolher a cor" type="color" disabled={ocupado} value={corValida ? cor : COR_PADRAO} onChange={(e) => setValue("cor", e.target.value.toUpperCase(), { shouldDirty: true, shouldValidate: Boolean(erros.cor) })} />
              <input className="input mono" maxLength={7} disabled={ocupado} {...register("cor", { setValueAs: (v: string) => v.toUpperCase() })} {...ligarAoErro("patente-cor", erros.cor?.message)} />
            </div>
          </Field>
          <Field label="Situação" htmlFor="patente-ativa">
            <label className="campo-marca">
              <input id="patente-ativa" type="checkbox" disabled={ocupado} {...register("ativa")} />
              Ativa (a desativada deixa de ser atribuída, mas continua no histórico)
            </label>
          </Field>
        </div>
        <Field label="Descrição (opcional)" htmlFor="patente-descricao" erro={erros.descricao?.message}>
          <textarea className="textarea" rows={2} maxLength={300} disabled={ocupado} {...register("descricao")} {...ligarAoErro("patente-descricao", erros.descricao?.message)} />
        </Field>
        <div className="grade2">
          <CampoImagemDoForm campo="imagem" rotulo="Imagem das pessoas" urlAtual={patente?.imagem_url} obrigatoria={!patente} desabilitado={ocupado} />
          <CampoImagemDoForm campo="imagemEquipe" rotulo="Imagem das equipes" urlAtual={patente?.imagem_equipe_url} obrigatoria={!patente} desabilitado={ocupado} />
        </div>
        <span className="small muted">
          A imagem das pessoas aparece no ranking de pessoas, no perfil e na barra; a das equipes, no ranking de equipes e na equipe. Elas só ficam iguais se você escolher o mesmo arquivo nos dois campos.
        </span>
        <ErroDeEnvio mensagem={erroEnvio} />
        <div className="row g8">
          <Button variant="p" type="submit" aria-busy={ocupado} disabled={ocupado}>
            {ocupado ? "Salvando…" : patente ? "Salvar" : "Criar patente"}
          </Button>
          <Button variant="line" onClick={aoCancelar} disabled={ocupado}>
            Cancelar
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
