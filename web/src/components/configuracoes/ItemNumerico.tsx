"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { z } from "zod";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { caminhoDaConfiguracao, type ConfiguracaoNumerica } from "@/lib/configuracoes";
import { dataHora } from "@/lib/formatar";
import { inteiroEntre } from "@/lib/validacao";

/**
 * Um valor numérico do sistema (um horário ou um limite): o rótulo, a explicação, o campo com a faixa permitida, o padrão e, se o admin
 * já o mudou, o botão de voltar ao padrão. Cada item salva sozinho (`PUT /configuracoes/sistema/{chave}`) e vale na hora.
 */
export function ItemNumerico({ item }: { item: ConfiguracaoNumerica }) {
  const router = useRouter();
  const [salvo, setSalvo] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [erroAoRestaurar, setErroAoRestaurar] = useState<string | null>(null);
  const esquema = useMemo(() => z.object({ valor: inteiroEntre(item.min, item.max, `Informe um número inteiro de ${item.min} a ${item.max}.`) }), [item.min, item.max]);
  const { form, ref, enviar, enviando, erroEnvio, limparErroEnvio } = useFormulario(esquema, { valor: String(item.valor) });
  const erro = form.formState.errors.valor?.message;
  const alterado = form.watch("valor").trim() !== String(item.valor);
  const idDoCampo = `cfg-${item.chave}`;

  async function restaurar() {
    setRestaurando(true);
    setErroAoRestaurar(null);
    setSalvo(false);
    try {
      await chamar("DELETE", caminhoDaConfiguracao(item.chave));
      form.reset({ valor: String(item.padrao) });
      router.refresh();
    } catch (e) {
      setErroAoRestaurar(mensagemDoErro(e));
    } finally {
      setRestaurando(false);
    }
  }

  return (
    <form
      ref={ref}
      noValidate
      className="cfg-item"
      data-treino={`cfg-${item.chave}`}
      onSubmit={enviar(async (v) => {
        setSalvo(false);
        await chamar("PUT", caminhoDaConfiguracao(item.chave), { valor: Number(v.valor) });
        form.reset({ valor: v.valor });
        setSalvo(true);
        router.refresh();
      })}
    >
      <div className="cfg-item-texto">
        <strong>{item.rotulo}</strong>
        <p>{item.descricao}</p>
        <span className="cfg-ajuda">
          Padrão: {item.padrao} {item.unidade}
          {item.personalizado && item.atualizado_em ? ` · alterado em ${dataHora(item.atualizado_em)}` : ""}
        </span>
      </div>
      <div className="cfg-item-controle">
        <Field label={`Valor (${item.unidade})`} htmlFor={idDoCampo} erro={erro}>
          <div className="cfg-valor">
            <input
              className="input"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("valor", {
                onChange: () => {
                  setSalvo(false);
                  setErroAoRestaurar(null);
                  limparErroEnvio();
                },
              })}
              {...ligarAoErro(idDoCampo, erro)}
            />
            <span className="cfg-unidade">
              de {item.min} a {item.max}
            </span>
          </div>
        </Field>
        <ErroDeEnvio mensagem={erroEnvio ?? erroAoRestaurar} />
        {salvo && (
          <Notice tone="ok" icon="check" role="status">
            Salvo. Já vale.
          </Notice>
        )}
        <div className="cfg-acoes">
          <button className="btn btn-p btn-sm" type="submit" aria-busy={enviando} disabled={enviando || !alterado}>
            {enviando ? "Salvando…" : "Salvar"}
          </button>
          {item.personalizado && (
            <button className="btn btn-line btn-sm" type="button" onClick={() => void restaurar()} disabled={restaurando || enviando}>
              {restaurando ? "Voltando…" : `Voltar ao padrão (${item.padrao})`}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
