"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel, TableWrap } from "@/components/web/Panel";
import { ArquivoProcessado } from "./ArquivoProcessado";
import { LinhasIgnoradas } from "./LinhasIgnoradas";
import type { ResultadoDaPlanilha } from "./tipos";

const LIMITE_MB = 10;

/** Área de enviar a planilha .xlsx exportada do SAP (`POST /importacoes`) e de mostrar o resultado do processamento. */
export function AreaUpload({ podeCadastrarEquipe }: { podeCadastrarEquipe: boolean }) {
  const roteador = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ nome: string; dados: ResultadoDaPlanilha } | null>(null);

  async function enviar(arquivo: File | undefined) {
    if (!arquivo) return;
    setResultado(null);
    if (!arquivo.name.toLowerCase().endsWith(".xlsx")) return setErro("Envie uma planilha no formato .xlsx.");
    if (arquivo.size > LIMITE_MB * 1024 * 1024) return setErro(`A planilha passa de ${LIMITE_MB} MB.`);
    setErro(null);
    setEnviando(true);
    try {
      const form = new FormData();
      form.set("arquivo", arquivo);
      const resposta = await fetch("/api/importacoes", { method: "POST", body: form, cache: "no-store" });
      if (resposta.status === 401) {
        roteador.push("/app/entrar");
        return;
      }
      const texto = await resposta.text();
      let corpo: { erro?: { mensagem?: string } } & Partial<ResultadoDaPlanilha> = {};
      try {
        corpo = texto ? JSON.parse(texto) : {};
      } catch {
        /* resposta que não é JSON */
      }
      if (!resposta.ok) {
        setErro(corpo?.erro?.mensagem ?? "Não foi possível importar a planilha.");
        return;
      }
      setResultado({ nome: arquivo.name, dados: corpo as ResultadoDaPlanilha });
      roteador.refresh();
    } catch {
      setErro("Servidor indisponível. Tente de novo.");
    } finally {
      setEnviando(false);
      if (campo.current) campo.current.value = "";
    }
  }

  function aoSoltar(evento: DragEvent) {
    evento.preventDefault();
    setArrastando(false);
    void enviar(evento.dataTransfer.files[0]);
  }

  return (
    <>
      <div
        className="drop"
        style={arrastando ? { borderColor: "var(--brand)", background: "var(--brand-bg)" } : undefined}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={aoSoltar}
      >
        <span className="ic">
          <Icon name="cloudup" size={24} />
        </span>
        <strong style={{ fontSize: 15 }}>Arraste a planilha .xlsx exportada do SAP</strong>
        <input
          ref={campo}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          aria-label="Planilha .xlsx"
          onChange={(e) => void enviar(e.target.files?.[0])}
        />
        <Button variant="p" sm onClick={() => campo.current?.click()} disabled={enviando}>
          {enviando ? "Importando…" : "Selecionar arquivo"}
        </Button>
        <span className="small">A importação nunca reabre OS encerradas nem altera o que foi feito em campo.</span>
      </div>

      {erro && (
        <Notice tone="blq" icon="alert" style={{ fontSize: 14 }}>
          <span role="alert">{erro}</span>
        </Notice>
      )}

      {resultado && (
        <>
          <ArquivoProcessado
            nome={resultado.nome}
            detalhe="processada agora"
            criadas={resultado.dados.criadas}
            atualizadas={resultado.dados.atualizadas}
            ignoradas={resultado.dados.ignoradas.length}
          />
          {resultado.dados.avisos.length > 0 && (
            <Panel>
              <h2>Avisos · {resultado.dados.avisos.length}</h2>
              <p className="muted">Estas ordens entraram, mas merecem atenção.</p>
              <TableWrap>
                <table className="tb">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Linha</th>
                      <th style={{ width: 110 }}>Ordem</th>
                      <th>Aviso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.dados.avisos.map((a, i) => (
                      <tr key={i}>
                        <td className="mono">{a.linha ?? "—"}</td>
                        <td className="mono">{a.numero_ordem}</td>
                        <td>{a.motivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            </Panel>
          )}
          {resultado.dados.ignoradas.length > 0 && <LinhasIgnoradas ignoradas={resultado.dados.ignoradas} podeCadastrarEquipe={podeCadastrarEquipe} />}
        </>
      )}
    </>
  );
}
