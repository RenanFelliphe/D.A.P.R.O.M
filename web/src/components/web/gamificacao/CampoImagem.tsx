"use client";

import { useEffect, useId, useMemo } from "react";
import { Field, Req } from "@/components/ui/Field";

/** O limite que a `api` aceita para a imagem de uma patente ou conquista. */
export const LIMITE_DA_IMAGEM = 5 * 1024 * 1024;
const TIPOS_ACEITOS = ["image/png", "image/jpeg", "image/webp"];

/** Lê a largura e a altura da imagem escolhida; `null` se o navegador não a decodifica. */
function medir(arquivo: File): Promise<{ largura: number; altura: number } | null> {
  return new Promise((resolver) => {
    const url = URL.createObjectURL(arquivo);
    const imagem = new Image();
    imagem.onload = () => {
      resolver({ largura: imagem.naturalWidth, altura: imagem.naturalHeight });
      URL.revokeObjectURL(url);
    };
    imagem.onerror = () => {
      resolver(null);
      URL.revokeObjectURL(url);
    };
    imagem.src = url;
  });
}

/**
 * Confere o arquivo antes de enviar (a `api` confere de novo): PNG, JPEG ou WebP, até 5 MB e quadrada. Devolve a mensagem de
 * recusa, ou `null` se o arquivo serve.
 */
export async function recusarImagem(arquivo: File): Promise<string | null> {
  if (!TIPOS_ACEITOS.includes(arquivo.type)) return "Use uma imagem PNG, JPEG ou WebP.";
  if (arquivo.size > LIMITE_DA_IMAGEM) return "A imagem tem mais de 5 MB.";
  const lado = await medir(arquivo);
  if (!lado) return "Não foi possível ler a imagem.";
  if (lado.largura !== lado.altura) return `A imagem precisa ser quadrada (512 × 512 é o recomendado); esta tem ${lado.largura} × ${lado.altura}.`;
  return null;
}

interface CampoImagemProps {
  rotulo?: string;
  arquivo: File | null;
  aoEscolher: (arquivo: File | null) => void;
  /** A imagem que já existe (na edição); aparece até a pessoa escolher outra. */
  urlAtual?: string | null;
  obrigatoria?: boolean;
  desabilitado?: boolean;
  /** Mensagem de recusa da imagem escolhida. */
  erro: string | null;
  aoRecusar: (mensagem: string | null) => void;
}

/** O campo da imagem (patente ou conquista): escolhe o arquivo, mostra a prévia e confere o formato antes do envio. */
export function CampoImagem({ rotulo = "Imagem", arquivo, aoEscolher, urlAtual, obrigatoria, desabilitado, erro, aoRecusar }: CampoImagemProps) {
  const id = useId();
  // A prévia é o arquivo escolhido; o endereço temporário é liberado quando ele muda ou a janela fecha.
  const previa = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : null), [arquivo]);
  useEffect(() => () => (previa ? URL.revokeObjectURL(previa) : undefined), [previa]);

  async function escolher(novo: File | null) {
    if (!novo) {
      aoEscolher(null);
      aoRecusar(null);
      return;
    }
    const motivo = await recusarImagem(novo);
    aoRecusar(motivo);
    aoEscolher(motivo ? null : novo);
  }

  const mostrada = previa ?? urlAtual;
  return (
    <Field
      label={
        <>
          {rotulo} {obrigatoria ? <Req>· obrigatória</Req> : <Req>· opcional</Req>}
        </>
      }
      htmlFor={id}
    >
      <div className="campo-imagem">
        {mostrada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mostrada} alt="Prévia da imagem" width={64} height={64} />
        ) : (
          <span className="campo-imagem-vazia" aria-hidden />
        )}
        <input id={id} type="file" accept={TIPOS_ACEITOS.join(",")} disabled={desabilitado} onChange={(e) => void escolher(e.target.files?.[0] ?? null)} />
      </div>
      <span className="small muted">PNG, JPEG ou WebP, até 5 MB, quadrada (512 × 512 é o recomendado).</span>
      {erro && (
        <span role="alert" className="small" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </Field>
  );
}
