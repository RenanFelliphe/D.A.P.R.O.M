"use client";

import { useEffect, useId, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { z } from "zod";
import { Field, ligarAoErro, Req } from "@/components/ui/Field";

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
  /** O que impede o envio: a recusa da imagem escolhida ou a falta dela. Aparece logo abaixo do campo, em vermelho. */
  erro?: string | null;
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
      erro={erro ?? undefined}
    >
      <div className="campo-imagem">
        {mostrada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mostrada} alt="Prévia da imagem" width={64} height={64} />
        ) : (
          <span className="campo-imagem-vazia" aria-hidden />
        )}
        <input {...ligarAoErro(id, erro ?? undefined)} type="file" accept={TIPOS_ACEITOS.join(",")} disabled={desabilitado} onChange={(e) => void escolher(e.target.files?.[0] ?? null)} />
      </div>
      <span className="small muted">PNG, JPEG ou WebP, até 5 MB, quadrada (512 × 512 é o recomendado).</span>
    </Field>
  );
}

/** O valor de uma imagem no formulário: o arquivo escolhido, ou `null` enquanto não há (ou se foi recusado). */
export const arquivoDeImagem = z.custom<File | null>((v) => v === null || v instanceof File);

/**
 * Regra do esquema Zod de uma imagem (`.superRefine(regraDaImagem("imagem", true, "Escolha a imagem do troféu."))`): a recusa
 * que o `CampoImagemDoForm` guardou em `recusa_<campo>` (formato, tamanho, proporção) e, sendo obrigatória, a falta do arquivo.
 */
export function regraDaImagem(campo: string, obrigatoria: boolean, mensagemDeFalta: string) {
  return (valores: Record<string, unknown>, ctx: z.RefinementCtx) => {
    const recusa = valores[`recusa_${campo}`];
    if (typeof recusa === "string" && recusa !== "") ctx.addIssue({ code: "custom", path: [`recusa_${campo}`], message: recusa });
    else if (obrigatoria && !valores[campo]) ctx.addIssue({ code: "custom", path: [campo], message: mensagemDeFalta });
  };
}

/**
 * O `CampoImagem` ligado ao formulário do `FormProvider` que o envolve: o arquivo fica em `campo` e a recusa em `recusa_<campo>`
 * (a recusa aparece assim que a imagem é escolhida; a falta da imagem, só ao tentar enviar).
 */
export function CampoImagemDoForm({ campo, ...resto }: { campo: string } & Omit<CampoImagemProps, "arquivo" | "aoEscolher" | "aoRecusar" | "erro">) {
  const { control, setValue, getFieldState, formState } = useFormContext();
  const arquivo = (useWatch({ control, name: campo }) as File | null | undefined) ?? null;
  const recusa = `recusa_${campo}`;
  const mensagem = (formState.errors[recusa]?.message ?? formState.errors[campo]?.message) as string | undefined;
  return (
    <CampoImagem
      {...resto}
      arquivo={arquivo}
      erro={mensagem}
      aoEscolher={(novo) => setValue(campo, novo, { shouldDirty: true, shouldValidate: Boolean(getFieldState(campo, formState).error) })}
      aoRecusar={(motivo) => setValue(recusa, motivo ?? "", { shouldValidate: true })}
    />
  );
}
