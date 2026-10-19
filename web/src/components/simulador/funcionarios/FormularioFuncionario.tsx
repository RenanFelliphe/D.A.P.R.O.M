"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import { dataOpcional } from "@/lib/validacao";
import { rotuloDaSituacao, type CatalogoDeFuncionarios, type Funcionario } from "./tipos";

const vazioParaNulo = (v: string) => v.trim() || null;

const esquema = z.object({
  matricula: z.string().trim().min(1, "Informe a matrícula.").max(40, "A matrícula pode ter no máximo 40 caracteres."),
  situacao: z.enum(["ativo", "afastado", "desligado"], "Escolha a situação."),
  nome: z.string().trim().min(1, "Informe o nome completo."),
  email: z.string().trim().min(1, "Informe o e-mail institucional.").email("Informe um e-mail válido, como nome.sobrenome@empresa.com.br."),
  centro: z.string().min(1, "Escolha o setor."),
  cargo: z.string().trim().min(1, "Informe o cargo."),
  registro: z.string(),
  telefone: z.string(),
  admissao: dataOpcional,
  nascimento: dataOpcional,
  gestor: z.string(),
  lotacao: z.string(),
});

/**
 * Cadastro manual e edição de um funcionário do registro (`POST` e `PATCH /rh-simulado/gestao/funcionarios`). A matrícula vem
 * sugerida (a próxima livre) e não muda depois de criada; setor e cargo são escolhidos em listas (o cargo aceita texto livre, com as
 * sugestões do setor). Passar para "Desligado" avisa o SYNQ OS na hora.
 */
export function FormularioFuncionario({ funcionario, catalogo, aoConcluir }: { funcionario?: Funcionario; catalogo: CatalogoDeFuncionarios; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const editando = Boolean(funcionario);
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, {
    matricula: funcionario?.matricula ?? catalogo.proxima_matricula,
    situacao: funcionario?.situacao ?? "ativo",
    nome: funcionario?.nome ?? "",
    email: funcionario?.email ?? "",
    centro: funcionario?.centro_trabalho ?? catalogo.setores[0]?.centro_trabalho ?? "",
    cargo: funcionario?.cargo ?? "",
    registro: funcionario?.registro_profissional ?? "",
    telefone: funcionario?.telefone ?? "",
    admissao: funcionario?.data_admissao ?? "",
    nascimento: funcionario?.data_nascimento ?? "",
    gestor: funcionario?.gestor_matricula ?? "",
    lotacao: funcionario?.lotacao ?? "",
  });
  const { register, formState } = form;
  const erros = formState.errors;
  const [centro] = useValorDoForm(form, "centro");
  const [situacao] = useValorDoForm(form, "situacao");

  const setor = catalogo.setores.find((s) => s.centro_trabalho === centro);
  const desligando = situacao === "desligado" && funcionario?.situacao !== "desligado";

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar(async (v) => {
        const dados = {
          nome: v.nome.trim(),
          email: v.email.trim().toLowerCase(),
          cargo: v.cargo.trim(),
          centro_trabalho: v.centro,
          registro_profissional: vazioParaNulo(v.registro),
          situacao: v.situacao,
          data_admissao: vazioParaNulo(v.admissao),
          data_nascimento: vazioParaNulo(v.nascimento),
          telefone: vazioParaNulo(v.telefone),
          gestor_matricula: vazioParaNulo(v.gestor),
          lotacao: vazioParaNulo(v.lotacao),
        };
        if (funcionario) await chamar("PATCH", `/rh-simulado/gestao/funcionarios/${encodeURIComponent(funcionario.matricula)}`, dados);
        else await chamar("POST", "/rh-simulado/gestao/funcionarios", { ...dados, matricula: v.matricula.trim() });
        exibirAviso(editando ? "Funcionário atualizado." : "Funcionário criado.");
        router.refresh();
        aoConcluir();
      })}
    >
      <div className="grade2">
        <Field label="Matrícula" htmlFor="func-matricula" erro={erros.matricula?.message}>
          <input
            className="input mono"
            {...register("matricula")}
            {...ligarAoErro("func-matricula", erros.matricula?.message)}
            readOnly={editando}
            aria-readonly={editando}
            style={editando ? { background: "var(--surface2)" } : undefined}
            autoComplete="off"
          />
        </Field>
        <Field label="Situação" htmlFor="func-situacao" erro={erros.situacao?.message}>
          <select className="input" {...register("situacao")} {...ligarAoErro("func-situacao", erros.situacao?.message)}>
            {catalogo.situacoes.map((s) => (
              <option key={s} value={s}>
                {rotuloDaSituacao[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Nome completo" htmlFor="func-nome" erro={erros.nome?.message}>
        <input className="input" {...register("nome")} {...ligarAoErro("func-nome", erros.nome?.message)} autoComplete="off" />
      </Field>
      <Field label="E-mail institucional" htmlFor="func-email" erro={erros.email?.message}>
        <input className="input" type="email" {...register("email")} {...ligarAoErro("func-email", erros.email?.message)} autoComplete="off" placeholder="nome.sobrenome@empresa.com.br" />
      </Field>
      <div className="grade2">
        <Field label="Setor" htmlFor="func-setor" erro={erros.centro?.message}>
          <select className="input" {...register("centro")} {...ligarAoErro("func-setor", erros.centro?.message)}>
            {catalogo.setores.map((s) => (
              <option key={s.centro_trabalho} value={s.centro_trabalho}>
                {s.centro_trabalho} · {s.nome}
              </option>
            ))}
          </select>
          {setor && !setor.equipe_no_synq_os && <span className="small">Este setor não tem equipe no SYNQ OS.</span>}
        </Field>
        <Field label="Cargo" htmlFor="func-cargo" erro={erros.cargo?.message}>
          <input className="input" list="cargos-do-setor" {...register("cargo")} {...ligarAoErro("func-cargo", erros.cargo?.message)} autoComplete="off" />
          <datalist id="cargos-do-setor">
            {setor?.cargos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grade2">
        <Field label="Registro profissional (opcional)" htmlFor="func-registro">
          <input className="input" id="func-registro" {...register("registro")} placeholder="CREA ES-050003/D" />
        </Field>
        <Field label="Telefone corporativo" htmlFor="func-telefone">
          <input className="input" id="func-telefone" {...register("telefone")} placeholder="(27) 3200-1234" />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Data de admissão" htmlFor="func-admissao" erro={erros.admissao?.message}>
          <input className="input" type="date" {...register("admissao")} {...ligarAoErro("func-admissao", erros.admissao?.message)} />
        </Field>
        <Field label="Data de nascimento" htmlFor="func-nascimento" erro={erros.nascimento?.message}>
          <input className="input" type="date" {...register("nascimento")} {...ligarAoErro("func-nascimento", erros.nascimento?.message)} />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Gestor imediato (matrícula)" htmlFor="func-gestor">
          <input className="input mono" id="func-gestor" {...register("gestor")} autoComplete="off" />
        </Field>
        <Field label="Lotação" htmlFor="func-lotacao">
          <input className="input" id="func-lotacao" {...register("lotacao")} placeholder="Vila Velha/ES" />
        </Field>
      </div>
      {desligando && (
        <Notice tone="al" icon="alert">
          {funcionario?.conta_no_synq_os
            ? "Este funcionário tem conta no SYNQ OS: ao salvar, o registro avisa o SYNQ OS e a conta é desativada em segundos."
            : "Ao salvar, o registro avisa o SYNQ OS. Como a pessoa não tem conta lá, nada muda."}
        </Notice>
      )}
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" aria-busy={enviando} disabled={enviando}>
          {enviando ? "Salvando…" : editando ? "Salvar" : "Criar funcionário"}
        </Button>
      </div>
    </form>
  );
}
