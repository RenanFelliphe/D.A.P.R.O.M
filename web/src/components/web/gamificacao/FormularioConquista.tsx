"use client";

import { useMemo } from "react";
import { FormProvider } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { arquivoDeImagem, CampoImagemDoForm, regraDaImagem } from "@/components/web/gamificacao/CampoImagem";
import { chamar, enviarFormulario } from "@/lib/cliente-api";
import type { Conquista, CriterioDeConquista } from "@/lib/gamificacao";
import { inteiroEntre } from "@/lib/validacao";

interface FormularioConquistaProps {
  /** A conquista que está sendo editada; sem ela, o formulário cria uma nova. */
  conquista?: Conquista;
  criterios: CriterioDeConquista[];
  /** As patentes que podem ser a meta nos critérios de patente. */
  patentes: { id: string; nome: string }[];
  aoConcluir: (mensagem: string) => void;
  aoCancelar: () => void;
}

/**
 * O esquema depende dos critérios: só o critério escolhido diz se a meta é uma quantidade ou uma patente, e a conquista de equipe
 * não tem pontos. Os limites são os da `api` (título 80, descrição 300, pontos de 0 a 1000).
 */
function esquemaDaConquista(criterios: CriterioDeConquista[], editando: boolean) {
  const quantidade = inteiroEntre(1, 1_000_000, "Informe a quantidade da meta, um número inteiro de 1 em diante.");
  const pontos = inteiroEntre(0, 1000, "Informe os pontos, um número inteiro de 0 a 1000.");
  return z
    .object({
      titulo: z.string().trim().min(1, "Informe o título da conquista.").max(80, "O título pode ter até 80 caracteres."),
      descricao: z.string().trim().min(1, "Informe a descrição da conquista.").max(300, "A descrição pode ter até 300 caracteres."),
      criterio: z.string().min(1, "Escolha o critério da meta."),
      quantidade: z.string(),
      patenteId: z.string(),
      pontos: z.string(),
      ativa: z.boolean(),
      imagem: arquivoDeImagem,
      recusa_imagem: z.string(),
    })
    .superRefine((v, ctx) => {
      const info = criterios.find((c) => c.codigo === v.criterio);
      if (info?.pede_quantidade && !quantidade.safeParse(v.quantidade).success) ctx.addIssue({ code: "custom", path: ["quantidade"], message: "Informe a quantidade da meta, um número inteiro de 1 em diante." });
      if (info?.pede_patente && !v.patenteId) ctx.addIssue({ code: "custom", path: ["patenteId"], message: "Escolha a patente da meta." });
      if (info?.tipo !== "equipe" && !pontos.safeParse(v.pontos).success) ctx.addIssue({ code: "custom", path: ["pontos"], message: "Informe os pontos, um número inteiro de 0 a 1000." });
      regraDaImagem("imagem", !editando, "Escolha a imagem do troféu.")(v, ctx);
    });
}

/**
 * Cadastro de uma conquista (na `JanelaModal`): título, descrição, a meta (um critério e a quantidade, ou a patente), os pontos,
 * se está ativa e a imagem do troféu. O critério diz se a conquista é de pessoa ou de equipe (a de equipe nunca dá pontos).
 * Criar ou mudar a meta vale também para o passado: quem já bateu a meta recebe na hora.
 */
export function FormularioConquista({ conquista, criterios, patentes, aoConcluir, aoCancelar }: FormularioConquistaProps) {
  const esquema = useMemo(() => esquemaDaConquista(criterios, Boolean(conquista)), [criterios, conquista]);
  const { form, ref, enviar, enviando: ocupado, erroEnvio } = useFormulario(esquema, {
    titulo: conquista?.titulo ?? "",
    descricao: conquista?.descricao ?? "",
    criterio: conquista?.criterio ?? criterios[0]?.codigo ?? "",
    quantidade: String(conquista?.quantidade ?? 1),
    patenteId: conquista?.patente?.id ?? patentes[0]?.id ?? "",
    pontos: String(conquista?.pontos ?? 25),
    ativa: conquista?.ativa ?? true,
    imagem: null,
    recusa_imagem: "",
  });
  const { register, formState, setValue } = form;
  const erros = formState.errors;
  const [criterio] = useValorDoForm(form, "criterio");

  const info = criterios.find((c) => c.codigo === criterio);
  const deEquipe = info?.tipo === "equipe";
  // Pessoa e equipe não se trocam depois de criada: na edição só aparecem os critérios do mesmo tipo.
  const opcoes = conquista ? criterios.filter((c) => c.tipo === conquista.tipo) : criterios;
  const pessoas = opcoes.filter((c) => c.tipo === "pessoa");
  const equipes = opcoes.filter((c) => c.tipo === "equipe");

  return (
    <FormProvider {...form}>
      <form
        ref={ref}
        noValidate
        className="stack g12"
        onSubmit={enviar(async (v) => {
          if (!info) return;
          const campos = {
            titulo: v.titulo.trim(),
            descricao: v.descricao.trim(),
            criterio: v.criterio,
            quantidade: info.pede_quantidade ? Number(v.quantidade) : 1,
            patente_id: info.pede_patente ? v.patenteId : null,
            pontos: deEquipe ? 0 : Number(v.pontos),
            ativa: v.ativa,
          };
          if (!conquista) {
            const corpo = new FormData();
            for (const [chave, valor] of Object.entries(campos)) if (valor !== null) corpo.set(chave, String(valor));
            corpo.set("imagem", v.imagem!);
            await enviarFormulario("/gamificacao/conquistas", corpo);
            aoConcluir(`Conquista "${campos.titulo}" criada. Quem já cumpria a meta recebeu na hora.`);
            return;
          }
          await chamar("PATCH", `/gamificacao/conquistas/${conquista.id}`, campos);
          if (v.imagem) {
            const corpo = new FormData();
            corpo.set("imagem", v.imagem);
            await enviarFormulario(`/gamificacao/conquistas/${conquista.id}/imagem`, corpo, "PUT");
          }
          aoConcluir(`Conquista "${campos.titulo}" salva.`);
        })}
      >
        <Field label="Título" htmlFor="conquista-titulo" erro={erros.titulo?.message}>
          <input className="input" maxLength={80} placeholder="Olho vivo" disabled={ocupado} {...register("titulo")} {...ligarAoErro("conquista-titulo", erros.titulo?.message)} />
        </Field>
        <Field label="Descrição" htmlFor="conquista-descricao" erro={erros.descricao?.message}>
          <textarea className="textarea" rows={2} maxLength={300} placeholder="Cinquenta análises antes de pôr a mão no serviço." disabled={ocupado} {...register("descricao")} {...ligarAoErro("conquista-descricao", erros.descricao?.message)} />
        </Field>
        <div className="grade2">
          <Field label="Meta: critério" htmlFor="conquista-criterio" erro={erros.criterio?.message}>
            <select
              className="select"
              disabled={ocupado}
              {...register("criterio", { onChange: (e) => criterios.find((c) => c.codigo === e.target.value)?.tipo === "equipe" && setValue("pontos", "0") })}
              {...ligarAoErro("conquista-criterio", erros.criterio?.message)}
            >
              {pessoas.length > 0 && (
                <optgroup label="Pessoa">
                  {pessoas.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.rotulo}
                    </option>
                  ))}
                </optgroup>
              )}
              {equipes.length > 0 && (
                <optgroup label="Equipe">
                  {equipes.map((c) => (
                    <option key={c.codigo} value={c.codigo}>
                      {c.rotulo}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </Field>
          {info?.pede_patente ? (
            <Field label="Meta: patente" htmlFor="conquista-patente" erro={erros.patenteId?.message}>
              <select className="select" disabled={ocupado} {...register("patenteId")} {...ligarAoErro("conquista-patente", erros.patenteId?.message)}>
                {patentes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Field>
          ) : info?.pede_quantidade ? (
            <Field label={`Meta: quantidade (${info.unidade})`} htmlFor="conquista-quantidade" erro={erros.quantidade?.message}>
              <input className="input" inputMode="numeric" disabled={ocupado} {...register("quantidade")} {...ligarAoErro("conquista-quantidade", erros.quantidade?.message)} />
            </Field>
          ) : (
            <Field label="Meta" htmlFor="conquista-fixa">
              <input id="conquista-fixa" className="input" value="Uma vez" disabled readOnly />
            </Field>
          )}
          <Field label={deEquipe ? "Pontos (a de equipe não dá pontos)" : "Pontos que a pessoa ganha (25 fácil, 50 média, 100 difícil)"} htmlFor="conquista-pontos" erro={deEquipe ? undefined : erros.pontos?.message}>
            <input className="input" inputMode="numeric" disabled={ocupado || deEquipe} {...register("pontos")} {...ligarAoErro("conquista-pontos", deEquipe ? undefined : erros.pontos?.message)} />
          </Field>
          <Field label="Situação" htmlFor="conquista-ativa">
            <label className="campo-marca">
              <input id="conquista-ativa" type="checkbox" disabled={ocupado} {...register("ativa")} />
              Ativa (a desativada deixa de ser dada; quem a tem continua com ela)
            </label>
          </Field>
        </div>
        <CampoImagemDoForm campo="imagem" rotulo="Imagem do troféu" urlAtual={conquista?.imagem_url} obrigatoria={!conquista} desabilitado={ocupado} />
        <ErroDeEnvio mensagem={erroEnvio} />
        <div className="row g8">
          <Button variant="p" type="submit" aria-busy={ocupado} disabled={ocupado}>
            {ocupado ? "Salvando…" : conquista ? "Salvar" : "Criar conquista"}
          </Button>
          <Button variant="line" onClick={aoCancelar} disabled={ocupado}>
            Cancelar
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
