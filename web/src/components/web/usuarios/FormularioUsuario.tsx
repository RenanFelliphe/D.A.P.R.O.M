"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
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
  /** A equipe que o setor da pessoa sugere; `null` quando o setor não tem equipe no SYNC OS. */
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
  aoConcluir: () => void;
}

const SOMENTE_LEITURA = { background: "var(--surface2)" } as const;

/** Campo só de leitura: os dados pessoais vêm do registro de funcionários e não se digitam nem se editam aqui. */
function DadoDoRegistro({ rotulo, valor, mono }: { rotulo: string; valor: string | null | undefined; mono?: boolean }) {
  return (
    <Field label={rotulo}>
      <input className={mono ? "input mono" : "input"} value={valor || "—"} readOnly aria-readonly="true" style={SOMENTE_LEITURA} />
    </Field>
  );
}

/**
 * Cadastro e edição de usuário. O cadastro é em duas etapas, a partir do registro de funcionários: 1) a matrícula e o e-mail
 * institucional são consultados (`GET /rh/funcionarios/{matricula}?email=`), e a prévia mostra nome, cargo, setor e CREA, que não se
 * digitam; 2) o admin escolhe o perfil, confirma ou troca a equipe (já vem a do setor) e define a senha inicial. O supervisor não
 * escolhe nada disso: cadastra técnico, na equipe do setor, e vê a senha provisória (só desta vez) e o aviso de que o acesso geral
 * espera a liberação de um administrador. A edição (só do admin) muda o perfil e a equipe; o resto vem do registro.
 */
export function FormularioUsuario({ usuario, equipes, modo = "admin", aoConcluir }: FormularioUsuarioProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const supervisor = modo === "supervisor";
  const [previa, setPrevia] = useState<PreviaDoCadastro | null>(null);
  const [criado, setCriado] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [matricula, setMatricula] = useState("");
  const [email, setEmail] = useState("");
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "tecnico");
  const [equipeId, setEquipeId] = useState(usuario?.equipe_id ?? "");
  const [senha, setSenha] = useState(() => (supervisor && !usuario ? sugerirSenha() : ""));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function consultar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setOcupado(true);
    try {
      const resposta = await chamar<PreviaDoCadastro>("GET", `/rh/funcionarios/${encodeURIComponent(matricula.trim())}?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      setPrevia(resposta);
      setEquipeId(resposta.equipe_sugerida?.id ?? "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar o registro de funcionários");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (!previa) return;
    setErro(null);
    if (senha.length < 8) return setErro("A senha inicial precisa ter ao menos 8 caracteres");
    setOcupado(true);
    try {
      // A `api` consulta o registro de novo: os dados gravados são sempre os da consulta feita agora, não os da prévia.
      const base = { matricula: previa.funcionario.matricula, email: email.trim().toLowerCase(), senha_inicial: senha };
      if (supervisor) {
        await chamar("POST", "/usuarios", { ...base, perfil: "tecnico" });
        router.refresh();
        setCriado({ nome: previa.funcionario.nome, email: base.email, senha });
        return;
      }
      await chamar("POST", "/usuarios", { ...base, perfil, equipe_id: equipeId || null });
      exibirAviso("Usuário criado. A pessoa define a própria senha no primeiro acesso.");
      router.refresh();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar o usuário");
    } finally {
      setOcupado(false);
    }
  }

  async function salvarEdicao(evento: FormEvent) {
    evento.preventDefault();
    if (!usuario) return;
    setErro(null);
    setOcupado(true);
    try {
      await chamar("PATCH", `/usuarios/${usuario.id}`, { perfil, equipe_id: equipeId || null });
      exibirAviso("Usuário atualizado.");
      router.refresh();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o usuário");
    } finally {
      setOcupado(false);
    }
  }

  const mensagemDeErro = erro && (
    <Notice tone="blq" icon="alert">
      {erro}
    </Notice>
  );

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

  // ---- edição (só o admin): os dados pessoais são do registro; aqui só o perfil e a equipe ----
  if (usuario) {
    return (
      <form onSubmit={salvarEdicao} className="stack g12">
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
          <Field label="Perfil">
            <select className="input" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
              {ordemDosPerfis.map((p) => (
                <option key={p} value={p}>
                  {rotuloDoPerfil[p]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Equipe">
            <select className="input" value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
              <option value="">Sem equipe</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {mensagemDeErro}
        <div className="row g8" style={{ justifyContent: "flex-end" }}>
          <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
            Cancelar
          </Button>
          <Button variant="p" sm type="submit" disabled={ocupado}>
            {ocupado ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    );
  }

  // ---- cadastro, etapa 1: consultar o registro ----
  if (!previa) {
    return (
      <form onSubmit={consultar} className="stack g12">
        <Notice tone="info" icon="info">
          Só quem está no registro de funcionários da empresa vira usuário. Informe a matrícula e o e-mail institucional da pessoa: o nome, o cargo e o registro profissional vêm de lá.
        </Notice>
        <div className="grade2">
          <Field label="Matrícula">
            <input className="input mono" required value={matricula} onChange={(e) => setMatricula(e.target.value)} autoComplete="off" placeholder="100231" />
          </Field>
          <Field label="E-mail institucional (é o login)">
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="nome.sobrenome@empresa.com.br" />
          </Field>
        </div>
        {mensagemDeErro}
        <div className="row g8" style={{ justifyContent: "flex-end" }}>
          <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
            Cancelar
          </Button>
          <Button variant="p" sm type="submit" disabled={ocupado}>
            {ocupado ? "Consultando…" : "Consultar no registro"}
          </Button>
        </div>
      </form>
    );
  }

  // ---- cadastro, etapa 2: confirmar ----
  const f = previa.funcionario;
  const nomeDaEquipe = equipes.find((e) => e.id === equipeId)?.nome ?? previa.equipe_sugerida?.nome ?? "—";
  return (
    <form onSubmit={confirmar} className="stack g12">
      <Notice tone="ok" icon="check">
        Encontrado no registro de funcionários. Confira se é a pessoa certa antes de continuar.
      </Notice>
      <DadoDoRegistro rotulo="Nome" valor={f.nome} />
      <div className="grade2">
        <DadoDoRegistro rotulo="Matrícula" valor={f.matricula} mono />
        <DadoDoRegistro rotulo="E-mail institucional (é o login)" valor={email.trim().toLowerCase()} />
      </div>
      <div className="grade2">
        <DadoDoRegistro rotulo="Cargo" valor={f.cargo} />
        <DadoDoRegistro rotulo="Registro profissional" valor={f.registro_profissional} />
      </div>
      <div className="grade2">
        <DadoDoRegistro rotulo="Setor" valor={f.setor} />
        <DadoDoRegistro rotulo="Situação no registro" valor={rotuloDaSituacaoRegistro[f.situacao]} />
      </div>

      {previa.conta_existente ? (
        <>
          <Notice tone="al" icon="alert">
            Esta pessoa já tem conta no SYNC OS. Procure-a na lista de usuários.
          </Notice>
          <div className="row g8" style={{ justifyContent: "flex-end" }}>
            <Button variant="line" sm onClick={() => setPrevia(null)}>
              Voltar
            </Button>
            <Button variant="p" sm onClick={aoConcluir}>
              Fechar
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grade2">
            {supervisor ? (
              <Field label="Equipe (a do setor)">
                <input className="input" value={nomeDaEquipe} readOnly aria-readonly="true" style={SOMENTE_LEITURA} />
              </Field>
            ) : (
              <>
                <Field label="Perfil">
                  <select className="input" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
                    {ordemDosPerfis.map((p) => (
                      <option key={p} value={p}>
                        {rotuloDoPerfil[p]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Equipe">
                  <select className="input" value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
                    <option value="">Sem equipe</option>
                    {equipes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                        {e.id === previa.equipe_sugerida?.id ? " (a do setor)" : ""}
                      </option>
                    ))}
                  </select>
                  {!previa.equipe_sugerida && <span className="small">O setor {f.setor} não tem equipe no SYNC OS.</span>}
                </Field>
              </>
            )}
          </div>
          <Field label="Senha inicial (mínimo 8 caracteres)">
            <div className="row g8">
              <input className="input mono grow" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" />
              <Button variant="line" sm onClick={() => setSenha(sugerirSenha())}>
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
          {mensagemDeErro}
          <div className="row g8" style={{ justifyContent: "flex-end" }}>
            <Button variant="line" sm onClick={() => setPrevia(null)} disabled={ocupado}>
              Voltar
            </Button>
            <Button variant="p" sm type="submit" disabled={ocupado}>
              {ocupado ? "Cadastrando…" : supervisor ? "Cadastrar técnico" : "Criar usuário"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
