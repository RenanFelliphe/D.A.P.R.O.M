"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { urlDoArquivo } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import type { DocumentoDeEvidencia } from "@/lib/tipos";

export const nomeDoDocumento = (d: Pick<DocumentoDeEvidencia, "nome">) => d.nome?.trim() || "Documento em PDF";

/**
 * Abre o PDF guardado numa aba nova. A URL assinada (10 minutos) é pedida só no clique; a aba abre antes, ainda vazia,
 * para o navegador não tratá-la como janela indesejada.
 */
async function abrirDocumento(arquivoId: string) {
  const aba = window.open("", "_blank");
  try {
    const url = await urlDoArquivo(arquivoId);
    if (aba) aba.location.href = url;
    else window.location.assign(url);
  } catch (erro) {
    aba?.close();
    throw erro;
  }
}

/** Lista de PDFs anexados (laudo, atestado, relatório): nome, quando foi anexado e o link que abre o arquivo. */
export function DocumentosAnexados({ documentos, rotulo = "Documentos em PDF" }: { documentos: DocumentoDeEvidencia[]; rotulo?: string }) {
  const [erro, setErro] = useState<string | null>(null);
  if (documentos.length === 0) return null;
  return (
    <div className="stack g6">
      <span className="small" style={{ fontWeight: 600 }}>
        {rotulo}
      </span>
      <ul className="doc-lista">
        {documentos.map((d) => (
          <li key={d.id} className="doc-item">
            <Icon name="file" size={16} />
            <span className="doc-nome">
              <button type="button" className="doc-abrir" title="Abrir o PDF numa aba nova" onClick={() => abrirDocumento(d.arquivo_path).catch(() => setErro("Não foi possível abrir o PDF."))}>
                {nomeDoDocumento(d)}
              </button>
            </span>
            <span className="small mono">{dataHora(d.capturada_em)}</span>
          </li>
        ))}
      </ul>
      {erro && (
        <span className="small" role="alert" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
