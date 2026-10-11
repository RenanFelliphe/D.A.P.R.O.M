"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Atividade } from "@/data/modelos";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** `PUT /atividades/{codigo}`: o código do plano pode ter pontos, barras e espaços (`8.7.2/8.7.3`), então vai codificado. */
export const caminhoDaAtividade = (codigo: string) => `/atividades/${encodeURIComponent(codigo)}`;

interface LinhaAtividadeProps {
  atividade: Atividade;
  /** Códigos de modelo com versão publicada (a `api` só aceita esses). */
  modelos: string[];
  podeEditar: boolean;
}

/** Linha da tabela "atividade → modelo"; para a Segurança do Trabalho, edita descrição, modelo e a marca de provisório no lugar. */
export function LinhaAtividade({ atividade, modelos, podeEditar }: LinhaAtividadeProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(atividade.descricao);
  const [modelo, setModelo] = useState(atividade.modelo_apr_codigo ?? "");
  const [provisorio, setProvisorio] = useState(atividade.provisorio);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // o modelo atual pode ter deixado de ser publicado (ou nunca ter sido): mantém a opção para não perdê-lo sem querer
  const opcoes = atividade.modelo_apr_codigo && !modelos.includes(atividade.modelo_apr_codigo) ? [atividade.modelo_apr_codigo, ...modelos] : modelos;

  function cancelar() {
    setEditando(false);
    setErro(null);
    setDescricao(atividade.descricao);
    setModelo(atividade.modelo_apr_codigo ?? "");
    setProvisorio(atividade.provisorio);
  }

  async function salvar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PUT", caminhoDaAtividade(atividade.codigo), { descricao: descricao.trim(), modelo_apr_codigo: modelo || null, provisorio });
      exibirAviso(`Atividade ${atividade.codigo} salva.`);
      setEditando(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a atividade");
    } finally {
      setOcupado(false);
    }
  }

  if (!editando) {
    return (
      <tr className={atividade.modelo_apr_codigo ? undefined : "al"}>
        <td className="mono">
          {atividade.codigo}
          {atividade.provisorio && (
            <>
              {" "}
              <Badge tone="al" style={{ padding: "0 7px", fontSize: 11 }}>
                Provisório
              </Badge>
            </>
          )}
        </td>
        <td>{atividade.descricao}</td>
        <td className="mono" style={{ color: atividade.modelo_apr_codigo ? "var(--brand)" : "var(--blq)", fontWeight: 600 }}>
          {atividade.modelo_apr_codigo ?? "Sem modelo"}
        </td>
        {podeEditar && (
          <td className="acoes-linha">
            <Button variant="line" sm style={{ height: 32 }} onClick={() => setEditando(true)}>
              Editar
            </Button>
          </td>
        )}
      </tr>
    );
  }

  return (
    <tr className="nw">
      <td className="mono">
        {atividade.codigo}
        <label className="row g6 small" style={{ marginTop: 6 }}>
          <input type="checkbox" checked={provisorio} onChange={(e) => setProvisorio(e.target.checked)} />
          Provisório
        </label>
      </td>
      <td>
        <input className="input" style={{ height: 36, fontSize: 13.5 }} aria-label="Descrição" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        {erro && (
          <div role="alert" className="small" style={{ color: "var(--blq)", marginTop: 4 }}>
            {erro}
          </div>
        )}
      </td>
      <td>
        <select className="select" aria-label="Modelo de APR" value={modelo} onChange={(e) => setModelo(e.target.value)}>
          <option value="">Sem modelo</option>
          {opcoes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="acoes-linha">
        <span className="row g6" style={{ justifyContent: "flex-end" }}>
          <Button variant="p" sm style={{ height: 32 }} onClick={salvar} disabled={ocupado || !descricao.trim()}>
            {ocupado ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="line" sm style={{ height: 32 }} onClick={cancelar} disabled={ocupado}>
            Cancelar
          </Button>
        </span>
      </td>
    </tr>
  );
}
