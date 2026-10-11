"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { ErroCliente, enviarArquivo } from "@/lib/cliente-api";

interface AdicionarFotoProps {
  /** Chamado depois que a foto subiu: `arquivoId` é o que o evento referencia; `previa` é um endereço local para exibir. */
  onEnviada: (foto: { arquivoId: string; previa: string }) => void;
  onErro?: (mensagem: string) => void;
  desabilitado?: boolean;
  rotulo?: string;
}

/** Botão "Adicionar foto": abre a câmera (celular) ou o seletor de arquivos, comprime e envia (`PUT /arquivos/{id}`). */
export function AdicionarFoto({ onEnviada, onErro, desabilitado, rotulo = "Adicionar foto" }: AdicionarFotoProps) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function aoEscolher(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    setEnviando(true);
    try {
      const arquivoId = await enviarArquivo(arquivo, "foto");
      onEnviada({ arquivoId, previa: URL.createObjectURL(arquivo) });
    } catch (erro) {
      onErro?.(erro instanceof ErroCliente ? erro.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <input ref={entrada} type="file" accept="image/*" capture="environment" hidden onChange={aoEscolher} />
      <button type="button" className="photo-add" onClick={() => entrada.current?.click()} disabled={desabilitado || enviando} style={{ minHeight: 96 }}>
        <Icon name="camera" size={22} />
        {enviando ? "Enviando…" : rotulo}
      </button>
    </>
  );
}
