"use client";

import { useEffect, useState } from "react";
import { urlDoArquivo } from "@/lib/cliente-api";

/** Resolve o id do arquivo (cenário ou passo da explicação) para a URL assinada antes de mostrar. */
export function ImagemDoTreinamento({ arquivoId, alt, style }: { arquivoId: string; alt: string; style?: React.CSSProperties }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    urlDoArquivo(arquivoId)
      .then((u) => ativo && setUrl(u))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [arquivoId]);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária (10 min); next/image exigiria configurar o domínio do Storage.
  return <img src={url} alt={alt} style={{ maxWidth: "100%", borderRadius: 10, ...style }} />;
}
