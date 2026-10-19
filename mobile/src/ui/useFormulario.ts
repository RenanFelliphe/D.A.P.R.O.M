import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useForm, useWatch, type DefaultValues, type FieldValues, type Path, type PathValue, type Resolver, type UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import { mensagemDoErro } from "@/api/erros";

/**
 * Formulário com React Hook Form e um esquema Zod (o padrão da Reunião 3, igual ao da web). O botão de enviar nunca fica
 * desativado por falta de campo: ao tentar enviar com erro, a mensagem aparece junto de cada campo (`CampoDeFormulario`) e o foco
 * vai para o primeiro. Uma falha da `api` fica em `erroEnvio`, para o `Aviso` mostrar acima do botão. O esquema não deve ter
 * transformações (o valor digitado é o valor enviado).
 *
 * Uso: `<Botao enviando={enviando} aoPressionar={enviar(async (valores) => { … })} />`.
 */
export function useFormulario<T extends FieldValues>(esquema: z.ZodType<T>, valoresIniciais: DefaultValues<T>) {
  const form = useForm<T>({ resolver: zodResolver(esquema as never) as unknown as Resolver<T>, defaultValues: valoresIniciais, shouldFocusError: true, reValidateMode: "onChange" });
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = (acao: (valores: T) => Promise<unknown> | unknown) => () =>
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
      () => setErroEnvio(null),
    )();

  return { form, enviar, enviando, erroEnvio, limparErroEnvio: () => setErroEnvio(null) };
}

/**
 * Um campo do formulário que não é um `TextInput` (a lista de participantes, as fotos) com a cara do `useState`: `[valor, definir]`,
 * em que `definir` aceita o valor ou uma função do valor mais recente (as fotos chegam depois, com o GPS). Depois de um erro, cada
 * mudança revalida o campo, e a mensagem some quando ele ficar certo.
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

