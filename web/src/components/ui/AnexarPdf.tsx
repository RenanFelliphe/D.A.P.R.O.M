"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ErroCliente, LIMITE_PDF, enviarArquivo, pareceUmPdf } from "@/lib/cliente-api";

interface AnexarPdfProps {
  /** Chamado depois que o PDF subiu: `arquivoId` é o que o evento referencia; `nome`, o nome do arquivo escolhido. */
  onEnviado: (pdf: { arquivoId: string; nome: string }) => void;
  onErro?: (mensagem: string) => void;
  desabilitado?: boolean;
  rotulo?: string;
}

/**
 * Botão "Anexar PDF": abre o seletor de arquivos (no celular, também os documentos baixados) e envia o PDF como evidência
 * (`PUT /arquivos/{id}` com `tipo=pdf`). Um laudo, um certificado ou um atestado, por exemplo.
 */
export function AnexarPdf({ onEnviado, onErro, desabilitado, rotulo = "Anexar PDF" }: AnexarPdfProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    if (!pareceUmPdf(arquivo)) return onErro?.("Escolha um arquivo PDF.");
    if (arquivo.size > LIMITE_PDF) return onErro?.("O PDF passa de 10 MB. Envie um arquivo menor.");
    setEnviando(true);
    try {
      const arquivoId = await enviarArquivo(arquivo, "pdf");
      onEnviado({ arquivoId, nome: arquivo.name || "documento.pdf" });
    } catch (erro) {
      onErro?.(erro instanceof ErroCliente ? erro.message : "Não foi possível enviar o PDF.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <input ref={entrada} type="file" accept="application/pdf,.pdf" hidden onChange={aoEscolher} />
      <button type="button" className="photo-add" onClick={() => entrada.current?.click()} disabled={desabilitado || enviando} style={{ minHeight: 96 }}>
        <Icon name="file" size={22} />
        {enviando ? "Enviando…" : rotulo}
      </button>
    </>
  );
}
