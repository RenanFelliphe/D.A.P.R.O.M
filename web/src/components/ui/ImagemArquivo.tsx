"use client";

import { useEffect, useState } from "react";
import { urlDoArquivo } from "@/lib/cliente-api";

interface ImagemArquivoProps {
  /** Id do arquivo guardado (foto ou assinatura); a URL assinada de 10 minutos é pedida à `api`. */
  id: string | null | undefined;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Mostra uma imagem guardada no Storage pelo id; sem id ou com falha, deixa um espaço vazio. */
export function ImagemArquivo({ id, alt, className, style }: ImagemArquivoProps) {
  const [carregada, setCarregada] = useState<{ id: string; url: string } | null>(null);
  const url = carregada && carregada.id === id ? carregada.url : null;

  useEffect(() => {
    let ativo = true;
    if (id) urlDoArquivo(id).then((u) => ativo && setCarregada({ id, url: u })).catch(() => {});
    return () => {
      ativo = false;
    };
  }, [id]);

  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} className={className} style={style} /> : <span className={className} style={style} aria-hidden />;
}
