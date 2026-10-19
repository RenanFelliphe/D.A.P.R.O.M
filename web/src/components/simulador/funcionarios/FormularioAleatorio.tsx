"use client";

import { useRouter } from "next/navigation";
import { useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { MensagemDeErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { inteiroEntre } from "@/lib/validacao";
import { useToast } from "@/state/toast";
import { rotuloDaSituacao, type CatalogoDeFuncionarios } from "./tipos";

const LIMITE = 200;

const linhaNova = (quantidade: string) => ({ quantidade, centro: "", cargo: "", situacao: "ativo" as const });

/** Cada linha pede de 1 a 200; juntas, no máximo 200 por envio (a mensagem aparece na primeira linha). */
const esquema = z
  .object({
    lotes: z.array(
      z.object({
        quantidade: inteiroEntre(1, LIMITE, `Informe a quantidade, um número inteiro de 1 a ${LIMITE}.`),
        centro: z.string(),
        cargo: z.string(),
        situacao: z.enum(["ativo", "afastado", "desligado"]),
      }),
    ),
  })
  .superRefine((v, ctx) => {
    const total = v.lotes.reduce((soma, l) => soma + Number(l.quantidade), 0);
    if (total > LIMITE) ctx.addIssue({ code: "custom", path: ["lotes", 0, "quantidade"], message: `As linhas somam ${total}: no máximo ${LIMITE} funcionários por envio.` });
  });

/**
 * Criação aleatória em lotes (`POST /rh-simulado/gestao/funcionarios/aleatorios`): cada linha pede uma quantidade, com setor, cargo e
 * situação opcionais, então "10 mecânicos e 5 eletricistas" sai num envio só. No máximo 200 por envio.
 */
export function FormularioAleatorio({ catalogo, aoConcluir }: { catalogo: CatalogoDeFuncionarios; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando: ocupado, erroEnvio } = useFormulario(esquema, { lotes: [linhaNova("10")] });
  const { register, formState, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lotes" });
  const erros = formState.errors;
  const [lotes, definirLotes] = useValorDoForm(form, "lotes");

  const total = lotes.reduce((soma, l) => soma + (Number.isInteger(Number(l.quantidade)) && l.quantidade.trim() !== "" ? Number(l.quantidade) : 0), 0);
  const excede = total > LIMITE;

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar(async (v) => {
        const corpo = v.lotes.map((l) => ({
          quantidade: Number(l.quantidade),
          ...(l.centro ? { centro_trabalho: l.centro } : {}),
          ...(l.cargo ? { cargo: l.cargo } : {}),
          ...(l.situacao !== "ativo" ? { situacao: l.situacao } : {}),
        }));
        const { criados } = await chamar<{ criados: number }>("POST", "/rh-simulado/gestao/funcionarios/aleatorios", { lotes: corpo });
        exibirAviso(criados === 1 ? "1 funcionário criado." : `${criados} funcionários criados.`);
        router.refresh();
        aoConcluir();
      })}
    >
      <p className="small">Nomes, datas e e-mails são inventados. Deixe o setor ou o cargo em branco para sortear.</p>
      <div className="stack g8">
        {fields.map((campo, i) => {
          const centro = lotes[i]?.centro ?? "";
          const cargos = catalogo.setores.find((s) => s.centro_trabalho === centro)?.cargos ?? [];
          const erro = erros.lotes?.[i]?.quantidade?.message;
          return (
            <div key={campo.id} className="stack g4">
              <div className="sim-lote">
                <label className="field">
                  <span className="small">Quantidade</span>
                  <input
                    className="input"
                    type="number"
                    {...register(`lotes.${i}.quantidade`)}
                    aria-invalid={erro ? true : undefined}
                    aria-label={`Quantidade da linha ${i + 1}`}
                  />
                </label>
                <label className="field">
                  <span className="small">Setor</span>
                  <select
                    className="input"
                    {...register(`lotes.${i}.centro`, { onChange: () => definirLotes((atual) => atual.map((l, k) => (k === i ? { ...l, cargo: "" } : l))) })}
                    aria-label={`Setor da linha ${i + 1}`}
                  >
                    <option value="">Qualquer</option>
                    {catalogo.setores.map((s) => (
                      <option key={s.centro_trabalho} value={s.centro_trabalho}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="small">Cargo</span>
                  <select className="input" {...register(`lotes.${i}.cargo`)} disabled={!centro} aria-label={`Cargo da linha ${i + 1}`}>
                    <option value="">{centro ? "Qualquer do setor" : "Escolha o setor"}</option>
                    {cargos.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="small">Situação</span>
                  <select className="input" {...register(`lotes.${i}.situacao`)} aria-label={`Situação da linha ${i + 1}`}>
                    {catalogo.situacoes.map((s) => (
                      <option key={s} value={s}>
                        {rotuloDaSituacao[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="ibtn del" aria-label={`Remover a linha ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}>
                  ×
                </button>
              </div>
              {erro && (
                <div data-erro tabIndex={-1}>
                  <MensagemDeErro>{`Linha ${i + 1}: ${erro}`}</MensagemDeErro>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="row between wrap">
        <Button variant="line" sm onClick={() => append(linhaNova("5"))}>
          Adicionar linha
        </Button>
        <span className={excede ? "small" : "muted"} style={excede ? { color: "var(--blq)" } : undefined}>
          Total: {total} de no máximo {LIMITE}
        </span>
      </div>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" aria-busy={ocupado} disabled={ocupado}>
          {ocupado ? "Criando…" : total > 0 ? `Criar ${total} funcionário${total === 1 ? "" : "s"}` : "Criar funcionários"}
        </Button>
      </div>
    </form>
  );
}
