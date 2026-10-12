"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ordemDosPerfis } from "@/data/usuarios";
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
  equipes: OpcaoEquipe[];
  aoConcluir: () => void;
}

/** Formulário de usuário do administrador: cria (`POST /usuarios`) ou edita (`PATCH /usuarios/{id}`). */
export function FormularioUsuario({ usuario, equipes, aoConcluir }: FormularioUsuarioProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const editando = Boolean(usuario);
  const [nome, setNome] = useState(usuario?.nome ?? "");
  const [matricula, setMatricula] = useState("");
  const [email, setEmail] = useState(usuario?.email ?? "");
  const [perfil, setPerfil] = useState<Perfil>(usuario?.perfil ?? "tecnico");
  const [equipeId, setEquipeId] = useState(usuario?.equipe_id ?? "");
  const [cargo, setCargo] = useState(usuario?.cargo ?? "");
  const [registro, setRegistro] = useState(usuario?.registro_profissional ?? "");
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    if (!editando && senha.length < 8) return setErro("A senha inicial precisa ter ao menos 8 caracteres");

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
        await chamar("PATCH", `/usuarios/${usuario.id}`, comum);
        exibirAviso("Usuário atualizado.");
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
        <Field label="Perfil">
          <select className="input" value={perfil} onChange={(e) => setPerfil(e.target.value as Perfil)}>
            {ordemDosPerfis.map((p) => (
              <option key={p} value={p}>
                {rotuloDoPerfil[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grade2">
        <Field label="E-mail institucional (é o login)">
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="nome.sobrenome@empresa.com.br" />
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
          {ocupado ? "Salvando…" : editando ? "Salvar" : "Criar usuário"}
        </Button>
      </div>
    </form>
  );
}
