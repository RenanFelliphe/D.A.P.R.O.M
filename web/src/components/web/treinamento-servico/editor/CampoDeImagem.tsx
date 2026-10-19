"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { enviarArquivo } from "@/lib/cliente-api";

interface CampoDeImagemProps {
  rotulo: string;
  ajuda: string;
  arquivoId: string | null | undefined;
  aoMudar: (arquivoId: string | null) => void;
  /** `larga` para o cenário (a capa do treinamento), em proporção de banner. */
  larga?: boolean;
}

/** Uma imagem opcional do treinamento (o cenário ou a de um passo): a prévia, "Escolher", "Trocar" e "Tirar". */
export function CampoDeImagem({ rotulo, ajuda, arquivoId, aoMudar, larga }: CampoDeImagemProps) {
  const id = useId();
  const seletor = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(arquivo: File) {
    setErro(null);
    setEnviando(true);
    try {
      aoMudar(await enviarArquivo(arquivo, "treinamento_imagem"));
    } catch {
      setErro("Não foi possível enviar a imagem. Tente outra ou de novo.");
    } finally {
      setEnviando(false);
      if (seletor.current) seletor.current.value = "";
    }
  }

  return (
    <div className={larga ? "ts-imagem ts-imagem-larga" : "ts-imagem"}>
      <span className="ts-imagem-previa">{arquivoId ? <ImagemArquivo id={arquivoId} alt={rotulo} /> : <Icon name="image" size={22} />}</span>
      <div className="ts-imagem-texto">
        <label htmlFor={id} className="ts-imagem-rotulo">
          {rotulo}
        </label>
        <span className="small">{ajuda}</span>
        <div className="row g6 wrap">
          <Button variant="line" sm onClick={() => seletor.current?.click()} disabled={enviando}>
            <Icon name="upload" size={13} />
            {enviando ? "Enviando…" : arquivoId ? "Trocar" : "Escolher imagem"}
          </Button>
          {arquivoId && (
            <Button variant="ghost" sm onClick={() => aoMudar(null)} disabled={enviando}>
              Tirar
            </Button>
          )}
        </div>
        {erro && <span className="field-erro">{erro}</span>}
      </div>
      <input
        ref={seletor}
        id={id}
        type="file"
        accept="image/*"
        className="sr"
        tabIndex={-1}
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) escolher(arquivo);
        }}
      />
    </div>
  );
}
