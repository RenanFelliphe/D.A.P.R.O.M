"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";
import { caminhoDaAtividade } from "./LinhaAtividade";

/** Cadastra uma atividade nova (`PUT /atividades/{codigo}`): o código do plano do SAP, a descrição e o modelo de APR. */
export function NovaAtividade({ modelos }: { modelos: string[] }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [modelo, setModelo] = useState("");
  const [provisorio, setProvisorio] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PUT", caminhoDaAtividade(codigo.trim()), { descricao: descricao.trim(), modelo_apr_codigo: modelo || null, provisorio });
      exibirAviso(`Atividade ${codigo.trim()} cadastrada.`);
      setCodigo("");
      setDescricao("");
      setModelo("");
      setProvisorio(false);
      setAberto(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar a atividade");
    } finally {
      setOcupado(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="p" sm onClick={() => setAberto(true)}>
        <Icon name="plus" size={16} />
        Nova atividade
      </Button>
    );
  }

  return (
    <form onSubmit={enviar} className="panel" style={{ gap: 12 }}>
      <h3 style={{ fontSize: 15 }}>Nova atividade</h3>
      <div className="grade2">
        <Field label="Código do plano de manutenção (SAP)">
          <input className="input" required value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="8.7.1" />
        </Field>
        <Field label="Modelo de APR">
          <select className="input" value={modelo} onChange={(e) => setModelo(e.target.value)}>
            <option value="">Sem modelo ainda</option>
            {modelos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Descrição">
        <input className="input" required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Drenagem de caixa de válvula" />
      </Field>
      <label className="row g8 small">
        <input type="checkbox" checked={provisorio} onChange={(e) => setProvisorio(e.target.checked)} />O código é provisório (ainda não confirmado no SAP)
      </label>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={() => setAberto(false)} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" disabled={ocupado || !codigo.trim() || !descricao.trim()}>
          {ocupado ? "Salvando…" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
