"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import type { CatalogoDeFuncionarios, Funcionario } from "./tipos";

const esquema = z.object({
  nome: z.string().trim().min(1, "Informe o nome completo."),
  email: z.string().trim().min(1, "Informe o e-mail institucional.").email("Informe um e-mail válido, como nome.sobrenome@empresa.com.br."),
  centro: z.string(),
});

/**
 * Criação rápida (`POST /rh-simulado/gestao/funcionarios/rapido`): só o nome, o e-mail e, se quiser, a equipe do SYNQ OS (o setor
 * com o centro de trabalho dela). O resto é sorteado como no aleatório: a próxima matrícula livre, o cargo do setor, as datas, o
 * telefone, o gestor e a lotação. Sem equipe, o setor também é sorteado. O aviso mostra a matrícula, que é o que o cadastro no
 * SYNQ OS pede junto com o e-mail.
 */
export function FormularioRapido({ catalogo, aoConcluir }: { catalogo: CatalogoDeFuncionarios; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { nome: "", email: "", centro: "" });
  const { register, formState } = form;
  const erros = formState.errors;
  const comEquipe = catalogo.setores.filter((s) => s.equipe_no_synq_os);

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar(async (v) => {
        const { funcionario } = await chamar<{ funcionario: Funcionario }>("POST", "/rh-simulado/gestao/funcionarios/rapido", {
          nome: v.nome.trim(),
          email: v.email.trim().toLowerCase(),
          ...(v.centro ? { centro_trabalho: v.centro } : {}),
        });
        exibirAviso(`${funcionario.nome} criado(a): matrícula ${funcionario.matricula}, ${funcionario.cargo} em ${funcionario.setor}.`);
        router.refresh();
        aoConcluir();
      })}
    >
      <p className="small muted">Informe o nome e o e-mail; o sistema sorteia a matrícula, o cargo, as datas e o resto.</p>
      <Field label="Nome completo" htmlFor="rapido-nome" erro={erros.nome?.message}>
        <input className="input" {...register("nome")} {...ligarAoErro("rapido-nome", erros.nome?.message)} autoComplete="off" />
      </Field>
      <Field label="E-mail institucional" htmlFor="rapido-email" erro={erros.email?.message}>
        <input className="input" type="email" {...register("email")} {...ligarAoErro("rapido-email", erros.email?.message)} autoComplete="off" placeholder="nome.sobrenome@empresa.com.br" />
      </Field>
      <Field label="Equipe (opcional)" htmlFor="rapido-equipe">
        <select className="input" id="rapido-equipe" {...register("centro")}>
          <option value="">Sorteada pelo sistema</option>
          {comEquipe.map((s) => (
            <option key={s.centro_trabalho} value={s.centro_trabalho}>
              {s.equipe_no_synq_os} · {s.centro_trabalho}
            </option>
          ))}
        </select>
        <span className="small">Sem equipe, o setor é sorteado entre todos, inclusive os que não têm equipe no SYNQ OS.</span>
      </Field>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" aria-busy={enviando} disabled={enviando}>
          {enviando ? "Criando…" : "Criar funcionário"}
        </Button>
      </div>
    </form>
  );
}
