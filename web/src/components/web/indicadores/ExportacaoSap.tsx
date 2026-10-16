"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel, TableWrap } from "@/components/web/Panel";
import type { OsDoQuadro } from "@/data/quadro";
import { dataDoDia } from "@/lib/formatar";
import { rotas } from "@/lib/rotas";

interface ExportacaoSapProps {
  /** Quantas OS encerradas ainda não foram exportadas. */
  total: number;
  /** As primeiras delas, para a pré-visualização. */
  os: OsDoQuadro[];
}

type Resultado = { tom: "ok" | "info" | "blq"; texto: string };

/** Nome do arquivo no `Content-Disposition` (`attachment; filename="..."`). */
function nomeDoArquivo(cabecalho: string | null) {
  const m = cabecalho?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  return m?.[1] ? decodeURIComponent(m[1]) : "baixa-sap.xlsx";
}

/** Pré-visualização das OS encerradas ainda não exportadas e o botão que gera e baixa a planilha de baixa do SAP. */
export function ExportacaoSap({ total, os }: ExportacaoSapProps) {
  const router = useRouter();
  const [gerando, setGerando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [, iniciar] = useTransition();

  async function exportar() {
    setResultado(null);
    setGerando(true);
    try {
      const resposta = await fetch("/api/exportacoes/sap", { method: "POST", cache: "no-store" });
      if (resposta.status === 401) {
        router.push(rotas.app.entrar);
        return;
      }
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        setResultado({ tom: "blq", texto: corpo?.erro?.mensagem ?? "Não foi possível gerar a planilha" });
        return;
      }
      const aviso = resposta.headers.get("X-Mensagem");
      const arquivo = await resposta.blob();
      const nome = nomeDoArquivo(resposta.headers.get("Content-Disposition"));
      const endereco = URL.createObjectURL(arquivo);
      const link = document.createElement("a");
      link.href = endereco;
      link.download = nome;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(endereco);
      setResultado(
        aviso
          ? { tom: "info", texto: `${aviso}. A planilha baixada traz só os cabeçalhos e os impedimentos.` }
          : { tom: "ok", texto: `Planilha ${nome} baixada. As OS encerradas que estavam pendentes foram marcadas como exportadas.` },
      );
      iniciar(() => router.refresh());
    } catch {
      setResultado({ tom: "blq", texto: "Sem conexão com o servidor. Tente de novo." });
    } finally {
      setGerando(false);
    }
  }

  return (
    <Panel style={{ padding: 20 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2 }}>
          <h2>Exportação para baixa no SAP</h2>
          <span className="muted">
            {total === 0 ? "Nenhuma OS encerrada pendente de exportação" : `${total} ${total === 1 ? "OS encerrada ainda não exportada" : "OS encerradas ainda não exportadas"}`}
          </span>
        </div>
        <button className="btn btn-p btn-sm" type="button" onClick={exportar} disabled={gerando}>
          <Icon name="download" size={16} />
          {gerando ? "Gerando…" : total === 0 ? "Gerar planilha" : `Gerar planilha · ${total} OS`}
        </button>
      </div>
      {resultado && (
        <div role="status">
          <Notice tone={resultado.tom} icon={resultado.tom === "ok" ? "check" : resultado.tom === "info" ? "info" : "alert"}>
            {resultado.texto}
          </Notice>
        </div>
      )}
      <TableWrap>
        <table className="tb">
          <thead>
            <tr>
              <th>Ordem</th>
              <th>Atividade</th>
              <th>Equipe</th>
              <th>Programada</th>
              <th>PDF</th>
            </tr>
          </thead>
          <tbody>
            {os.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted" style={{ padding: "18px 12px" }}>
                  Nenhuma OS encerrada pendente de exportação.
                </td>
              </tr>
            ) : (
              os.map((o) => (
                <tr key={o.id}>
                  <td className="mono">
                    <Link href={rotas.app.os(o.id)}>{o.numero_ordem ?? "sem nº"}</Link>
                  </td>
                  <td>{o.titulo}</td>
                  <td>{o.equipe_nome}</td>
                  <td>{dataDoDia(o.data_fim_prog ?? o.data_inicio_prog)}</td>
                  <td>
                    <Link href={rotas.doc.os(o.id)} style={{ fontWeight: 600 }}>
                      {o.pdf_pronto ? "Abrir" : "Abrir (gera na hora)"}
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </TableWrap>
      {total > os.length && <span className="muted">Mostrando {os.length} de {total} OS.</span>}
      <span className="muted">
        Ao gerar a planilha, as OS são marcadas como exportadas. A baixa no SAP continua manual, usando o link do PDF de cada OS. A planilha também leva a
        aba Devolvidas, com as OS que os supervisores devolveram ao SAP e a justificativa de cada uma; elas saem uma vez só.
      </span>
    </Panel>
  );
}
