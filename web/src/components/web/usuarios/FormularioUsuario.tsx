"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { AVISO_DE_PENDENTE, ordemDosPerfis, type ModoUsuarios } from "@/data/usuarios";
import { chamar } from "@/lib/cliente-api";
import { rotuloDoPerfil, type Perfil, type Usuario } from "@/lib/tipos";
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

interface FormularioUsuarioProps {
  /** Sem `usuario`, cria; com ele, edita (`PATCH /usuarios/{id}`). */
  usuario?: Usuario;
  /** Admin: todas as equipes. Supervisor: só as que ele supervisiona. */
  equipes: OpcaoEquipe[];
  /** Supervisor: só cadastra técnicos (sem campo de perfil, nasce pendente) e edita nome, cargo e registro dos pendentes que criou. */
  modo?: ModoUsuarios;
  aoConcluir: () => void;
}

/**
 * Formulário de usuário: cria (`POST /usuarios`) ou edita (`PATCH /usuarios/{id}`). O administrador define perfil e equipe; o
 * supervisor cadastra técnicos nas equipes dele e, ao salvar, vê a senha provisória (só desta vez) e o aviso de que o acesso geral
 * espera a liberação de um administrador.
 */
export function FormularioUsuario({ usuario, equipes, modo = "admin", aoConcluir }: FormularioUsuarioProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const editando = Boolean(usuario);
  const supervisor = modo === "supervisor";
  const [criado, setCriado] = useState<{ nome: string; email: string; senha: string } | null>(null);
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [matricula, setMatricula] = useState("");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "tecnico");
  // O supervisor com uma só equipe não escolhe: ela já vem marcada.
  const [equipeId, setEquipeId] = useState(usuario?.equipe_id ?? (supervisor && equipes.length === 1 ? equipes[0]!.id : ""));
  const [cargo, setCargo] = useState(usuario?.cargo ?? "");
  const [registro, setRegistro] = useState(usuario?.registro_profissional ?? "");
  const [senha, setSenha] = useState(() => (supervisor && !usuario ? sugerirSenha() : ""));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (!editando && senha.length < 8) return setErro("A senha inicial precisa ter ao menos 8 caracteres");
    if (supervisor && !editando && !equipeId) return setErro("Escolha a equipe do técnico");

    const comum = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      perfil,
      equipe_id: equipeId || null,
      cargo: cargo.trim() || null,
      registro_profissional: registro.trim() || null,
    };
    setOcupado(true);
    try {
      if (usuario) {
        // O supervisor só altera nome, cargo e registro profissional do pendente que cadastrou.
        await chamar("PATCH", `/usuarios/${usuario.id}`, supervisor ? { nome: comum.nome, cargo: comum.cargo, registro_profissional: comum.registro_profissional } : comum);
        exibirAviso("Usuário atualizado.");
      } else if (supervisor) {
        await chamar("POST", "/usuarios", { ...comum, perfil: "tecnico", matricula: matricula.trim(), senha_inicial: senha });
        router.refresh();
        setCriado({ nome: comum.nome, email: comum.email, senha });
        return;
      } else {
        await chamar("POST", "/usuarios", { ...comum, matricula: matricula.trim(), senha_inicial: senha });
        exibirAviso("Usuário criado. A pessoa define a própria senha no primeiro acesso.");
      }
      router.refresh();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o usuário");
    } finally {
      setOcupado(false);
    }
  }

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

  const equipeUnica = supervisor && equipes.length === 1 ? equipes[0]! : null;
  const nomeDaEquipe = equipes.find((e) => e.id === equipeId)?.nome ?? equipeUnica?.nome ?? "—";

  return (
    <form onSubmit={enviar} className="stack g12">
      <Field label="Nome">
        <input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
      </Field>
      <div className="grade2">
        <Field label="Matrícula">
          {editando ? (
            <input className="input mono" value={usuario!.matricula} readOnly aria-readonly="true" style={{ background: "var(--surface2)" }} />
          ) : (
            <input className="input mono" required value={matricula} onChange={(e) => setMatricula(e.target.value)} autoComplete="off" placeholder="10482" />
          )}
        </Field>
        {supervisor ? (
          <Field label="E-mail institucional (é o login)">
            {editando ? (
              <input className="input" value={usuario?.email ?? "—"} readOnly aria-readonly="true" style={{ background: "var(--surface2)" }} />
            ) : (
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="nome.sobrenome@empresa.com.br" />
            )}
          </Field>
        ) : (
          <Field label="Perfil">
            <select className="input" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
              {ordemDosPerfis.map((p) => (
                <option key={p} value={p}>
                  {rotuloDoPerfil[p]}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="grade2">
        {!supervisor && (
          <Field label="E-mail institucional (é o login)">
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="nome.sobrenome@empresa.com.br" />
          </Field>
        )}
        {supervisor && (editando || equipeUnica) ? (
          <Field label="Equipe">
            <input className="input" value={nomeDaEquipe} readOnly aria-readonly="true" style={{ background: "var(--surface2)" }} />
          </Field>
        ) : (
          <Field label="Equipe">
            <select className="input" required={supervisor} value={equipeId} onChange={(e) => setEquipeId(e.target.value)}>
              <option value="">{supervisor ? "Escolha a equipe" : "Sem equipe"}</option>
              {equipes.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <div className="grade2">
        <Field label="Cargo (impresso sob a assinatura)">
          <input className="input" value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Técnico em Elétrica" />
        </Field>
        <Field label="Registro profissional">
          <input className="input" value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="CREA: ES-050003/D" />
        </Field>
      </div>
      {!editando && (
        <Field label="Senha inicial (mínimo 8 caracteres)">
          <div className="row g8">
            <input className="input mono grow" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" />
            <Button variant="line" sm onClick={() => setSenha(sugerirSenha())}>
              Sugerir
            </Button>
          </div>
          <span className="small">A pessoa troca essa senha no primeiro acesso. Anote-a para repassar: ela não aparece de novo.</span>
        </Field>
      )}
      {supervisor && !editando && (
        <Notice tone="al" icon="clock">
          {AVISO_DE_PENDENTE}
        </Notice>
      )}
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" disabled={ocupado}>
          {ocupado ? "Salvando…" : editando ? "Salvar" : supervisor ? "Cadastrar técnico" : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
