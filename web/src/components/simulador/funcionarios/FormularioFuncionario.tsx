"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import { rotuloDaSituacao, type CatalogoDeFuncionarios, type Funcionario, type SituacaoFuncionario } from "./tipos";

const vazioParaNulo = (v: string) => v.trim() || null;

/**
 * Cadastro manual e edição de um funcionário do registro (`POST` e `PATCH /rh-simulado/gestao/funcionarios`). A matrícula vem
 * sugerida (a próxima livre) e não muda depois de criada; setor e cargo são escolhidos em listas (o cargo aceita texto livre, com as
 * sugestões do setor). Passar para "Desligado" avisa o SYNC OS na hora.
 */
export function FormularioFuncionario({ funcionario, catalogo, aoConcluir }: { funcionario?: Funcionario; catalogo: CatalogoDeFuncionarios; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const editando = Boolean(funcionario);
  const [matricula, setMatricula] = useState(funcionario?.matricula ?? catalogo.proxima_matricula);
  const [nome, setNome] = useState(funcionario?.nome ?? "");
  const [email, setEmail] = useState(funcionario?.email ?? "");
  const [centro, setCentro] = useState(funcionario?.centro_trabalho ?? catalogo.setores[0]?.centro_trabalho ?? "");
  const [cargo, setCargo] = useState(funcionario?.cargo ?? "");
  const [registro, setRegistro] = useState(funcionario?.registro_profissional ?? "");
  const [situacao, setSituacao] = useState<SituacaoFuncionario>(funcionario?.situacao ?? "ativo");
  const [admissao, setAdmissao] = useState(funcionario?.data_admissao ?? "");
  const [nascimento, setNascimento] = useState(funcionario?.data_nascimento ?? "");
  const [telefone, setTelefone] = useState(funcionario?.telefone ?? "");
  const [gestor, setGestor] = useState(funcionario?.gestor_matricula ?? "");
  const [lotacao, setLotacao] = useState(funcionario?.lotacao ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const setor = catalogo.setores.find((s) => s.centro_trabalho === centro);
  const desligando = situacao === "desligado" && funcionario?.situacao !== "desligado";

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setOcupado(true);
    const dados = {
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      cargo: cargo.trim(),
      centro_trabalho: centro,
      registro_profissional: vazioParaNulo(registro),
      situacao,
      data_admissao: vazioParaNulo(admissao),
      data_nascimento: vazioParaNulo(nascimento),
      telefone: vazioParaNulo(telefone),
      gestor_matricula: vazioParaNulo(gestor),
      lotacao: vazioParaNulo(lotacao),
    };
    try {
      if (funcionario) await chamar("PATCH", `/rh-simulado/gestao/funcionarios/${encodeURIComponent(funcionario.matricula)}`, dados);
      else await chamar("POST", "/rh-simulado/gestao/funcionarios", { ...dados, matricula: matricula.trim() });
      exibirAviso(editando ? "Funcionário atualizado." : "Funcionário criado.");
      router.refresh();
      aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o funcionário");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form onSubmit={enviar} className="stack g12">
      <div className="grade2">
        <Field label="Matrícula">
          <input className="input mono" required value={matricula} onChange={(e) => setMatricula(e.target.value)} readOnly={editando} aria-readonly={editando} style={editando ? { background: "var(--surface2)" } : undefined} autoComplete="off" />
        </Field>
        <Field label="Situação">
          <select className="input" value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoFuncionario)}>
            {catalogo.situacoes.map((s) => (
              <option key={s} value={s}>
                {rotuloDaSituacao[s]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Nome completo">
        <input className="input" required value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
      </Field>
      <Field label="E-mail institucional">
        <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" placeholder="nome.sobrenome@empresa.com.br" />
      </Field>
      <div className="grade2">
        <Field label="Setor">
          <select className="input" value={centro} onChange={(e) => setCentro(e.target.value)}>
            {catalogo.setores.map((s) => (
              <option key={s.centro_trabalho} value={s.centro_trabalho}>
                {s.centro_trabalho} · {s.nome}
              </option>
            ))}
          </select>
          {setor && !setor.equipe_no_sync_os && <span className="small">Este setor não tem equipe no SYNC OS.</span>}
        </Field>
        <Field label="Cargo">
          <input className="input" required list="cargos-do-setor" value={cargo} onChange={(e) => setCargo(e.target.value)} autoComplete="off" />
          <datalist id="cargos-do-setor">
            {setor?.cargos.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="grade2">
        <Field label="Registro profissional (opcional)">
          <input className="input" value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="CREA ES-050003/D" />
        </Field>
        <Field label="Telefone corporativo">
          <input className="input" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(27) 3200-1234" />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Data de admissão">
          <input className="input" type="date" value={admissao} onChange={(e) => setAdmissao(e.target.value)} />
        </Field>
        <Field label="Data de nascimento">
          <input className="input" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} />
        </Field>
      </div>
      <div className="grade2">
        <Field label="Gestor imediato (matrícula)">
          <input className="input mono" value={gestor} onChange={(e) => setGestor(e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Lotação">
          <input className="input" value={lotacao} onChange={(e) => setLotacao(e.target.value)} placeholder="Vila Velha/ES" />
        </Field>
      </div>
      {desligando && (
        <Notice tone="al" icon="alert">
          {funcionario?.conta_no_sync_os
            ? "Este funcionário tem conta no SYNC OS: ao salvar, o registro avisa o SYNC OS e a conta é desativada em segundos."
            : "Ao salvar, o registro avisa o SYNC OS. Como a pessoa não tem conta lá, nada muda."}
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
          {ocupado ? "Salvando…" : editando ? "Salvar" : "Criar funcionário"}
        </Button>
      </div>
    </form>
  );
}
