"use client";

import { useRouter } from "next/navigation";
import { useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro, MensagemDeErro } from "@/components/ui/Field";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { inteiroEntre } from "@/lib/validacao";
import { useToast } from "@/state/toast";
import type { CatalogoDeOrdens } from "./tipos";

const LIMITE = 200;
const DIAS_PADRAO = 14;

const linhaNova = (quantidade: string) => ({ quantidade, tipo: "" as const, centro: "", status: "liberada" as const, atividade: "qualquer" as const });

/** Cada linha pede de 1 a 200; juntas, no máximo 200 por envio (a mensagem aparece na primeira linha). Os dias do sorteio vão de 0 a 365. */
const esquema = z
  .object({
    lotes: z.array(
      z.object({
        quantidade: inteiroEntre(1, LIMITE, `Informe a quantidade, um número inteiro de 1 a ${LIMITE}.`),
        tipo: z.enum(["", "corretiva", "preventiva"]),
        centro: z.string(),
        status: z.enum(["liberada", "criada"]),
        atividade: z.enum(["qualquer", "cadastrada", "nova"]),
      }),
    ),
    dias: inteiroEntre(0, 365, "Informe os dias do sorteio, um número inteiro de 0 a 365."),
  })
  .superRefine((v, ctx) => {
    const total = v.lotes.reduce((soma, l) => soma + Number(l.quantidade), 0);
    if (total > LIMITE) ctx.addIssue({ code: "custom", path: ["lotes", 0, "quantidade"], message: `As linhas somam ${total}: no máximo ${LIMITE} ordens por envio.` });
  });

/**
 * Criação aleatória em lotes (`POST /sap-simulado/gestao/ordens/aleatorias`): cada linha pede uma quantidade, com tipo, centro de
 * trabalho, status (liberada ou criada) e atividade (cadastrada no SYNQ OS, nova ou qualquer uma). O início programado é sorteado nos
 * próximos N dias. No máximo 200 por envio: "10 preventivas liberadas para Serviços Especiais e 5 corretivas criadas para Instrumentação"
 * sai num envio só.
 */
export function FormularioOrdensAleatorias({ catalogo, aoConcluir }: { catalogo: CatalogoDeOrdens; aoConcluir: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando: ocupado, erroEnvio } = useFormulario(esquema, { lotes: [linhaNova("10")], dias: String(DIAS_PADRAO) });
  const { register, formState, control } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lotes" });
  const erros = formState.errors;
  const [lotes] = useValorDoForm(form, "lotes");

  const total = lotes.reduce((soma, l) => soma + (Number.isInteger(Number(l.quantidade)) && l.quantidade.trim() !== "" ? Number(l.quantidade) : 0), 0);
  const excede = total > LIMITE;
  const temCadastrada = catalogo.atividades.length > 0;

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar(async (v) => {
        const corpo = v.lotes.map((l) => ({
          quantidade: Number(l.quantidade),
          ...(l.tipo ? { tipo: l.tipo } : {}),
          ...(l.centro ? { centro_trabalho: l.centro } : {}),
          status: l.status,
          atividade: l.atividade,
        }));
        const { criadas } = await chamar<{ criadas: number }>("POST", "/sap-simulado/gestao/ordens/aleatorias", { lotes: corpo, dias: Number(v.dias) });
        exibirAviso(criadas === 1 ? "1 ordem criada." : `${criadas} ordens criadas.`);
        router.refresh();
        aoConcluir();
      })}
    >
      <p className="small">Serviços, locais, números e datas são inventados. A atividade “do SYNQ OS” é sorteada entre as cadastradas lá; a “nova” é um código que o SYNQ OS não conhece, e a leitura o cadastra.</p>
      <div className="stack g8">
        {fields.map((campo, i) => {
          const erro = erros.lotes?.[i]?.quantidade?.message;
          return (
            <div key={campo.id} className="stack g4">
              <div className="sim-lote sim-lote-ordem">
                <label className="field">
                  <span className="small">Quantidade</span>
                  <input className="input" type="number" {...register(`lotes.${i}.quantidade`)} aria-invalid={erro ? true : undefined} aria-label={`Quantidade da linha ${i + 1}`} />
                </label>
                <label className="field">
                  <span className="small">Tipo</span>
                  <select className="input" {...register(`lotes.${i}.tipo`)} aria-label={`Tipo da linha ${i + 1}`}>
                    <option value="">Qualquer</option>
                    <option value="corretiva">Corretiva</option>
                    <option value="preventiva">Preventiva</option>
                  </select>
                </label>
                <label className="field">
                  <span className="small">Centro de trabalho</span>
                  <select className="input" {...register(`lotes.${i}.centro`)} aria-label={`Centro de trabalho da linha ${i + 1}`}>
                    <option value="">Qualquer</option>
                    {catalogo.centros_de_trabalho.map((c) => (
                      <option key={c.centro_trabalho} value={c.centro_trabalho}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="small">Status</span>
                  <select className="input" {...register(`lotes.${i}.status`)} aria-label={`Status da linha ${i + 1}`}>
                    <option value="liberada">Liberada</option>
                    <option value="criada">Criada</option>
                  </select>
                </label>
                <label className="field">
                  <span className="small">Atividade</span>
                  <select className="input" {...register(`lotes.${i}.atividade`)} aria-label={`Atividade da linha ${i + 1}`}>
                    <option value="qualquer">Qualquer</option>
                    <option value="cadastrada" disabled={!temCadastrada}>
                      Do SYNQ OS (cadastrada)
                    </option>
                    <option value="nova">Nova (o SYNQ OS não conhece)</option>
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
      <Field label="Início programado sorteado nos próximos (dias)" htmlFor="ordens-aleatorias-dias" erro={erros.dias?.message}>
        <input className="input" type="number" style={{ maxWidth: 140 }} {...register("dias")} {...ligarAoErro("ordens-aleatorias-dias", erros.dias?.message)} />
      </Field>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoConcluir} disabled={ocupado}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" aria-busy={ocupado} disabled={ocupado}>
          {ocupado ? "Criando…" : total > 0 ? `Criar ${total} ordem${total === 1 ? "" : "s"}` : "Criar ordens"}
        </Button>
      </div>
    </form>
  );
}
