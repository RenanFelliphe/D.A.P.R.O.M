"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BotaoExcluir } from "@/components/web/BotaoExcluir";
import type { Atividade } from "@/data/modelos";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** `PUT /atividades/{codigo}`: o código do plano pode ter pontos, barras e espaços (`8.7.2/8.7.3`), então vai codificado. */
export const caminhoDaAtividade = (codigo: string) => `/atividades/${encodeURIComponent(codigo)}`;

interface LinhaAtividadeProps {
  atividade: Atividade;
  podeEditar: boolean;
}

/** Linha da tabela de atividades; para quem edita (admin), edita a descrição e a marca de provisório no lugar. */
export function LinhaAtividade({ atividade, podeEditar }: LinhaAtividadeProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [editando, setEditando] = useState(false);
  const [descricao, setDescricao] = useState(atividade.descricao);
  const [provisorio, setProvisorio] = useState(atividade.provisorio);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function cancelar() {
    setEditando(false);
    setErro(null);
    setDescricao(atividade.descricao);
    setProvisorio(atividade.provisorio);
  }

  async function salvar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PUT", caminhoDaAtividade(atividade.codigo), { descricao: descricao.trim(), provisorio });
      exibirAviso(`Atividade ${atividade.codigo} salva.`);
      setEditando(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a atividade");
    } finally {
      setOcupado(false);
    }
  }

  async function excluir() {
    await chamar("DELETE", caminhoDaAtividade(atividade.codigo));
    exibirAviso(`Atividade ${atividade.codigo} excluída.`);
    router.refresh();
  }

  if (!editando) {
    return (
      <tr>
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
      <td className="acoes-linha">
        <span className="row g6" style={{ justifyContent: "flex-end", alignItems: "flex-start" }}>
          <BotaoExcluir rotulo="Excluir" pergunta={`Excluir a atividade ${atividade.codigo}?`} aoExcluir={excluir} desabilitado={ocupado} />
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
