"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { AVISO_DE_PENDENTE, ordemDosPerfis, type ModoUsuarios } from "@/data/usuarios";
import { chamar } from "@/lib/cliente-api";
import { rotuloDoPerfil, rotuloDaSituacaoRegistro, type Perfil, type SituacaoRegistro, type Usuario } from "@/lib/tipos";
import { useToast } from "@/state/toast";

/** Alfabeto das senhas iniciais da `api` (sem 0/O, 1/l/I), para o admin ditar sem confusão. */
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Sugere uma senha inicial de 10 caracteres com o sorteio criptográfico do navegador. */
export function sugerirSenha(tamanho = 10): string {
  const sorteio = new Uint32Array(tamanho);
  crypto.getRandomValues(sorteio);
  return Array.from(sorteio, (n) => ALFABETO[n % ALFABETO.length]).join("");
}

export interface OpcaoEquipe {
  id: string;
  nome: string;
}

/** Resposta de `GET /rh/funcionarios/{matricula}?email=`: o que o registro de funcionários diz da pessoa. */
interface PreviaDoCadastro {
  funcionario: {
    matricula: string;
    nome: string;
    cargo: string;
    centro_trabalho: string;
    setor: string;
    registro_profissional: string | null;
    situacao: SituacaoRegistro;
  };
  /** A equipe que o setor da pessoa sugere; `null` quando o setor não tem equipe no SYNQ OS. */
  equipe_sugerida: OpcaoEquipe | null;
  conta_existente: boolean;
}

interface FormularioUsuarioProps {
  /** Sem `usuario`, cadastra (consulta o registro e confirma); com ele, edita só o perfil e a equipe (`PATCH /usuarios/{id}`). */
  usuario?: Usuario;
  /** Admin: todas as equipes. Supervisor: só as que ele supervisiona. */
  equipes: OpcaoEquipe[];
  /** Supervisor: só cadastra técnicos, na equipe do setor, e a conta nasce pendente. Não edita ninguém. */
  modo?: ModoUsuarios;
  /** O e-mail já preenchido na consulta ao registro (o cadastro aberto por um pedido de conta). */
  emailInicial?: string;
  aoConcluir: () => void;
}

const SOMENTE_LEITURA = { background: "var(--surface2)" } as const;

/** Etapa 1 do cadastro: a matrícula e o e-mail institucional que a `api` confere no registro de funcionários. */
const esquemaDaConsulta = z.object({
  matricula: z.string().trim().min(1, "Informe a matrícula").max(40, "A matrícula pode ter no máximo 40 caracteres"),
  email: z.string().trim().min(1, "Informe o e-mail institucional").email("Informe um e-mail válido, como nome.sobrenome@empresa.com.br"),
});

/** Perfil e equipe (a equipe vazia é "sem equipe"); a senha só vale no cadastro. */
const esquemaDaEdicao = z.object({
  perfil: z.string().min(1, "Escolha o perfil"),
  equipe_id: z.string(),
});

const esquemaDaConfirmacao = esquemaDaEdicao.extend({
  senha: z.string().min(8, "A senha inicial precisa ter ao menos 8 caracteres").max(72, "A senha inicial pode ter no máximo 72 caracteres"),
});

/** Campo só de leitura: os dados pessoais vêm do registro de funcionários e não se digitam nem se editam aqui. */
function DadoDoRegistro({ rotulo, valor, mono }: { rotulo: string; valor: string | null | undefined; mono?: boolean }) {
  return (
    <Field label={rotulo}>
      <input className={mono ? "input mono" : "input"} value={valor || "—"} readOnly aria-readonly="true" style={SOMENTE_LEITURA} />
    </Field>
  );
}

type CamposPerfilEEquipe = { perfil: string; equipe_id: string };

/** Os dois seletores de perfil e equipe, iguais na edição e no cadastro do admin. O formulário pode ter outros campos além destes. */
function PerfilEEquipe<T extends CamposPerfilEEquipe>({
  form,
  equipes,
  perfilAtual,
  equipeSugerida,
}: {
  form: UseFormReturn<T>;
  equipes: OpcaoEquipe[];
  perfilAtual?: Perfil;
  equipeSugerida?: OpcaoEquipe | null;
}) {
  const { register, formState } = form as unknown as UseFormReturn<CamposPerfilEEquipe>;
  const erros = formState.errors;
  // Um perfil que saiu da lista (o supervisor, legado) continua escolhido, para salvar a equipe não trocar o perfil sem querer.
  const perfis = perfilAtual && !ordemDosPerfis.includes(perfilAtual) ? [perfilAtual, ...ordemDosPerfis] : ordemDosPerfis;
  return (
    <>
      <Field label="Perfil" htmlFor="usuario-perfil" erro={erros.perfil?.message}>
        <select className="input" {...register("perfil")} {...ligarAoErro("usuario-perfil", erros.perfil?.message)}>
          {perfis.map((p) => (
            <option key={p} value={p}>
              {rotuloDoPerfil[p]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Equipe" htmlFor="usuario-equipe" erro={erros.equipe_id?.message}>
        <select className="input" {...register("equipe_id")} {...ligarAoErro("usuario-equipe", erros.equipe_id?.message)}>
          <option value="">Sem equipe</option>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
              {e.id === equipeSugerida?.id ? " (a do setor)" : ""}
            </option>
          ))}
        </select>
        {equipeSugerida === null && <span className="small">O setor não tem equipe no SYNQ OS.</span>}
      </Field>
    </>
  );
}

/** Edição (só o admin): os dados pessoais são do registro; aqui só o perfil e a equipe (`PATCH /usuarios/{id}`). */
function EdicaoDoUsuario({ usuario, equipes, aoConcluir }: { usuario: Usuario; equipes: OpcaoEquipe[]; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquemaDaEdicao, { perfil: usuario.perfil, equipe_id: usuario.equipe_id ?? "" });

  return (
    <form ref={ref} noValidate onSubmit={enviar(async (v) => {
      await chamar("PATCH", `/usuarios/${usuario.id}`, { perfil: v.perfil, equipe_id: v.equipe_id || null });
      exibirAviso("Usuário atualizado.");
      router.refresh();
      aoConcluir();
    })} className="stack g12">
      <Notice tone="info" icon="info">
        Nome, e-mail, cargo e registro profissional vêm do registro de funcionários e não se editam aqui. Para trazer o que mudou lá, use “Atualizar do registro”.
      </Notice>
      <DadoDoRegistro rotulo="Nome" valor={usuario.nome} />
      <div className="grade2">
        <DadoDoRegistro rotulo="Matrícula" valor={usuario.matricula} mono />
        <DadoDoRegistro rotulo="E-mail institucional (é o login)" valor={usuario.email} />
      </div>
      <div className="grade2">
        <DadoDoRegistro rotulo="Cargo" valor={usuario.cargo} />
        <DadoDoRegistro rotulo="Registro profissional" valor={usuario.registro_profissional} />
      </div>
      <div className="grade2">
        <PerfilEEquipe form={form} equipes={equipes} perfilAtual={usuario.perfil} />
      </div>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

/** Cadastro, etapa 1: consultar o registro de funcionários (`GET /rh/funcionarios/{matricula}?email=`). */
function ConsultaDoRegistro({ inicial, aoConsultar, aoConcluir }: { inicial: { matricula: string; email: string }; aoConsultar: (previa: PreviaDoCadastro, dados: { matricula: string; email: string }) => void; aoConcluir: () => void }) {
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquemaDaConsulta, inicial);
  const { register, formState } = form;
  const erros = formState.errors;

  return (
    <form ref={ref} noValidate onSubmit={enviar(async (v) => {
      const dados = { matricula: v.matricula.trim(), email: v.email.trim().toLowerCase() };
      const previa = await chamar<PreviaDoCadastro>("GET", `/rh/funcionarios/${encodeURIComponent(dados.matricula)}?email=${encodeURIComponent(dados.email)}`);
      aoConsultar(previa, dados);
    })} className="stack g12">
      <Notice tone="info" icon="info">
        Só quem está no registro de funcionários da empresa vira usuário. Informe a matrícula e o e-mail institucional da pessoa: o nome, o cargo e o registro profissional vêm de lá.
      </Notice>
      <div className="grade2">
        <Field label="Matrícula" htmlFor="usuario-matricula" erro={erros.matricula?.message}>
          <input className="input mono" autoComplete="off" placeholder="100231" {...register("matricula")} {...ligarAoErro("usuario-matricula", erros.matricula?.message)} />
        </Field>
        <Field label="E-mail institucional (é o login)" htmlFor="usuario-email" erro={erros.email?.message}>
          <input className="input" type="email" autoComplete="off" placeholder="nome.sobrenome@empresa.com.br" {...register("email")} {...ligarAoErro("usuario-email", erros.email?.message)} />
        </Field>
      </div>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={enviando}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" disabled={enviando}>
          {enviando ? "Consultando…" : "Consultar no registro"}
        </Button>
      </div>
    </form>
  );
}

/** Cadastro, etapa 2: conferir a pessoa achada no registro e criar a conta (`POST /usuarios`). */
function ConfirmacaoDoCadastro({
  previa,
  email,
  equipes,
  supervisor,
  aoVoltar,
  aoCriarComoSupervisor,
  aoConcluir,
}: {
  previa: PreviaDoCadastro;
  email: string;
  equipes: OpcaoEquipe[];
  supervisor: boolean;
  aoVoltar: () => void;
  aoCriarComoSupervisor: (criado: { nome: string; email: string; senha: string }) => void;
  aoConcluir: () => void;
}) {
  const router = useRouter();
  const exibirAviso = useToast();
  const f = previa.funcionario;
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquemaDaConfirmacao, {
    perfil: "tecnico",
    equipe_id: previa.equipe_sugerida?.id ?? "",
    senha: supervisor ? sugerirSenha() : "",
  });
  const { register, setValue, formState } = form;
  const erros = formState.errors;
  const nomeDaEquipe = equipes.find((e) => e.id === form.watch("equipe_id"))?.nome ?? previa.equipe_sugerida?.nome ?? "—";

  const dadosDaPessoa = (
    <>
      <DadoDoRegistro rotulo="Nome" valor={f.nome} />
      <div className="grade2">
        <DadoDoRegistro rotulo="Matrícula" valor={f.matricula} mono />
        <DadoDoRegistro rotulo="E-mail institucional (é o login)" valor={email} />
      </div>
      <div className="grade2">
        <DadoDoRegistro rotulo="Cargo" valor={f.cargo} />
        <DadoDoRegistro rotulo="Registro profissional" valor={f.registro_profissional} />
      </div>
      <div className="grade2">
        <DadoDoRegistro rotulo="Setor" valor={f.setor} />
        <DadoDoRegistro rotulo="Situação no registro" valor={rotuloDaSituacaoRegistro[f.situacao]} />
      </div>
    </>
  );

  if (previa.conta_existente) {
    return (
      <div className="stack g12">
        <Notice tone="ok" icon="check">
          Encontrado no registro de funcionários. Confira se é a pessoa certa antes de continuar.
        </Notice>
        {dadosDaPessoa}
        <Notice tone="al" icon="alert">
          Esta pessoa já tem conta no SYNQ OS. Procure-a na lista de usuários.
        </Notice>
        <div className="row g8" style={{ justifyContent: "flex-end" }}>
          <Button variant="line" sm onClick={aoVoltar}>
            Voltar
          </Button>
          <Button variant="p" sm onClick={aoConcluir}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form ref={ref} noValidate onSubmit={enviar(async (v) => {
      // A `api` consulta o registro de novo: os dados gravados são sempre os da consulta feita agora, não os da prévia.
      const base = { matricula: f.matricula, email, senha_inicial: v.senha };
      if (supervisor) {
        await chamar("POST", "/usuarios", { ...base, perfil: "tecnico" });
        router.refresh();
        aoCriarComoSupervisor({ nome: f.nome, email, senha: v.senha });
        return;
      }
      await chamar("POST", "/usuarios", { ...base, perfil: v.perfil, equipe_id: v.equipe_id || null });
      exibirAviso("Usuário criado. A pessoa define a própria senha no primeiro acesso.");
      router.refresh();
      aoConcluir();
    })} className="stack g12">
      <Notice tone="ok" icon="check">
        Encontrado no registro de funcionários. Confira se é a pessoa certa antes de continuar.
      </Notice>
      {dadosDaPessoa}
      <div className="grade2">
        {supervisor ? (
          <Field label="Equipe (a do setor)">
            <input className="input" value={nomeDaEquipe} readOnly aria-readonly="true" style={SOMENTE_LEITURA} />
          </Field>
        ) : (
          <PerfilEEquipe form={form} equipes={equipes} equipeSugerida={previa.equipe_sugerida} />
        )}
      </div>
      <Field label="Senha inicial (mínimo 8 caracteres)" htmlFor="usuario-senha" erro={erros.senha?.message}>
        <div className="row g8">
          <input className="input mono grow" autoComplete="off" {...register("senha")} {...ligarAoErro("usuario-senha", erros.senha?.message)} />
          <Button variant="line" sm onClick={() => setValue("senha", sugerirSenha(), { shouldDirty: true, shouldValidate: Boolean(erros.senha) })}>
            Sugerir
          </Button>
        </div>
        <span className="small">A pessoa troca essa senha no primeiro acesso. Anote-a para repassar: ela não aparece de novo.</span>
      </Field>
      {supervisor && (
        <Notice tone="al" icon="clock">
          {AVISO_DE_PENDENTE}
        </Notice>
      )}
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoVoltar} disabled={enviando}>
          Voltar
        </Button>
        <Button variant="p" sm type="submit" disabled={enviando}>
          {enviando ? "Cadastrando…" : supervisor ? "Cadastrar técnico" : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}

/**
 * Cadastro e edição de usuário. O cadastro é em duas etapas, a partir do registro de funcionários: 1) a matrícula e o e-mail
 * institucional são consultados (`GET /rh/funcionarios/{matricula}?email=`), e a prévia mostra nome, cargo, setor e CREA, que não se
 * digitam; 2) o admin escolhe o perfil, confirma ou troca a equipe (já vem a do setor) e define a senha inicial. O supervisor não
 * escolhe nada disso: cadastra técnico, na equipe do setor, e vê a senha provisória (só desta vez) e o aviso de que o acesso geral
 * espera a liberação de um administrador. A edição (só do admin) muda o perfil e a equipe; o resto vem do registro.
 */
export function FormularioUsuario({ usuario, equipes, modo = "admin", emailInicial, aoConcluir }: FormularioUsuarioProps) {
  const exibirAviso = useToast();
  const supervisor = modo === "supervisor";
  const [previa, setPrevia] = useState<PreviaDoCadastro | null>(null);
  /** O que foi consultado (já normalizado): volta preenchido quando a pessoa "Volta" da etapa 2. */
  const [consultado, setConsultado] = useState({ matricula: "", email: emailInicial ?? "" });
  const [criado, setCriado] = useState<{ nome: string; email: string; senha: string } | null>(null);

  if (criado) {
    return (
      <div className="stack g12">
        <Notice tone="ok" icon="check">
          {criado.nome} foi cadastrado(a). Repasse a senha provisória para {criado.email}: ela aparece só agora, e a pessoa a troca no primeiro acesso.
        </Notice>
        <div className="senha-nova" aria-label="Senha provisória">
          {criado.senha}
        </div>
        <Notice tone="al" icon="clock">
          {AVISO_DE_PENDENTE}
        </Notice>
        <div className="row g8" style={{ justifyContent: "flex-end" }}>
          <Button variant="line" sm onClick={() => navigator.clipboard?.writeText(criado.senha).then(() => exibirAviso("Senha copiada."))}>
            Copiar
          </Button>
          <Button variant="p" sm onClick={aoConcluir}>
            Concluir
          </Button>
        </div>
      </div>
    );
  }

  if (usuario) return <EdicaoDoUsuario usuario={usuario} equipes={equipes} aoConcluir={aoConcluir} />;

  if (!previa) {
    return (
      <ConsultaDoRegistro
        inicial={consultado}
        aoConsultar={(resposta, dados) => {
          setConsultado(dados);
          setPrevia(resposta);
        }}
        aoConcluir={aoConcluir}
      />
    );
  }

  return <ConfirmacaoDoCadastro previa={previa} email={consultado.email} equipes={equipes} supervisor={supervisor} aoVoltar={() => setPrevia(null)} aoCriarComoSupervisor={setCriado} aoConcluir={aoConcluir} />;
}
