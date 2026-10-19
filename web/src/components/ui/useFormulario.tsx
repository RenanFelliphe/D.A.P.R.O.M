"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useForm, useWatch, type DefaultValues, type FieldValues, type Path, type PathValue, type Resolver, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Notice } from "./Notice";

/**
 * Leva o foco para o primeiro campo com erro (na ordem em que aparecem na tela) e o traz para a vista. Os campos com erro são
 * os que o `Field` marca com `data-erro`; vale também para os que não são um controle simples (fotos, checklist). Dentro do
 * campo, vai para o controle marcado com `data-foco-erro` (o item do checklist que falta) ou, sem ele, para o primeiro.
 */
export function focarPrimeiroErro(raiz: HTMLElement | null) {
  const campo = (raiz ?? document).querySelector<HTMLElement>("[data-erro]");
  if (!campo) return;
  const alvo = campo.querySelector<HTMLElement>("[data-foco-erro]") ?? campo.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])");
  (alvo ?? campo).focus({ preventScroll: true });
  campo.scrollIntoView({ block: "center", behavior: "smooth" });
}

/**
 * Formulário com React Hook Form e um esquema Zod. O botão de enviar não fica desativado por falta de campo: ao tentar enviar
 * com erro, a mensagem aparece junto de cada campo (`Field erro=…`) e o foco vai para o primeiro. Uma falha da `api` (a
 * `mensagem` do `ErroDeEvento`/`ErroCliente` já vem pronta) fica em `erroEnvio`, para o `ErroDeEnvio` mostrar acima do botão.
 *
 * Uso: `<form ref={ref} noValidate onSubmit={enviar(async (valores) => { … })}>`. O esquema não deve ter transformações (o
 * valor digitado é o valor enviado).
 */
export function useFormulario<T extends FieldValues>(esquema: z.ZodType<T>, valoresIniciais: DefaultValues<T>) {
  const form = useForm<T>({ resolver: zodResolver(esquema as never) as unknown as Resolver<T>, defaultValues: valoresIniciais, shouldFocusError: false, reValidateMode: "onChange" });
  const ref = useRef<HTMLFormElement>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = (acao: (valores: T) => Promise<unknown> | unknown) =>
    form.handleSubmit(
      async (valores) => {
        setErroEnvio(null);
        setEnviando(true);
        try {
          await acao(valores);
        } catch (e) {
          setErroEnvio(mensagemDoErro(e));
        } finally {
          setEnviando(false);
        }
      },
      () => {
        setErroEnvio(null);
        requestAnimationFrame(() => focarPrimeiroErro(ref.current));
      },
    );

  /**
   * Valida sem enviar, para quem faz o envio por outro caminho (a `JanelaDeAssinatura` chama antes de assinar): a mensagem aparece
   * junto de cada campo e o foco vai para o primeiro. Devolve se o formulário está válido.
   */
  const validar = async () => {
    const valido = await form.trigger();
    if (!valido) requestAnimationFrame(() => focarPrimeiroErro(ref.current));
    return valido;
  };

  return { form, ref, enviar, validar, enviando, erroEnvio, limparErroEnvio: () => setErroEnvio(null) };
}

/**
 * Um valor do formulário que não é um controle simples (lista de fotos, respostas do checklist) lido e alterado como um
 * `useState`: `[valor, definir]`, em que `definir` aceita o valor ou uma função do valor mais recente (as fotos chegam depois,
 * com o GPS). Depois de um erro, cada mudança revalida o campo, e a mensagem some quando ele ficar certo.
 */
export function useValorDoForm<T extends FieldValues, K extends Path<T>>(form: UseFormReturn<T>, nome: K): [PathValue<T, K>, Dispatch<SetStateAction<PathValue<T, K>>>] {
  const valor = useWatch({ control: form.control, name: nome }) as PathValue<T, K>;
  const definir = useCallback<Dispatch<SetStateAction<PathValue<T, K>>>>(
    (proximo) => {
      const atual = form.getValues(nome);
      const novo = typeof proximo === "function" ? (proximo as (anterior: PathValue<T, K>) => PathValue<T, K>)(atual) : proximo;
      form.setValue(nome, novo, { shouldDirty: true, shouldValidate: Boolean(form.getFieldState(nome).error) });
    },
    [form, nome],
  );
  return [valor, definir];
}

/**
 * Para o que se valida fora dos campos do formulário (respostas e evidências que vivem no rascunho): depois da primeira tentativa de
 * enviar, revalida sempre que `dependencia` mudar, para a mensagem sumir assim que o que faltava for preenchido.
 */
export function useRevalidarQuando<T extends FieldValues>(form: UseFormReturn<T>, dependencia: unknown) {
  const { submitCount } = form.formState;
  const { trigger } = form;
  useEffect(() => {
    if (submitCount > 0) void trigger();
  }, [dependencia, submitCount, trigger]);
}

/** A falha devolvida pela `api` ao enviar, num aviso visível acima do botão; nada quando não há erro. */
export function ErroDeEnvio({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <Notice tone="blq" icon="alert" role="alert">
      {mensagem}
    </Notice>
  );
}
