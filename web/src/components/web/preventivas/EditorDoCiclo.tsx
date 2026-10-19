"use client";

import { useEffect, useId, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ErroDeEnvio, useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import type { PerguntaDoChecklist } from "@/lib/checklist-inspecao";
import { chamar, novoId } from "@/lib/cliente-api";
import { textoDosPontosGanhos, type RespostaComPontos } from "@/lib/gamificacao";
import { descreverIntervalo, rotuloDaBase, type BaseDoCiclo, type DetalheDoPlano, type Intervalo, type PlanoPreventiva } from "@/lib/preventivas";
import { inteiroEntre } from "@/lib/validacao";
import { useToast } from "@/state/toast";
import { CampoIntervalo } from "./CampoIntervalo";
import { EditorDoChecklist, type PerguntaEditavel } from "./EditorDoChecklist";

const esquema = z.object({
  intervalo: z.custom<Intervalo | null>(),
  baseDoCiclo: z.custom<BaseDoCiclo>(),
  antecedencia: inteiroEntre(0, 365, "A antecedência do aviso vai de 0 a 365 dias."),
  pausar: z.boolean(),
  observacao: z.string().trim().max(500, "A observação pode ter até 500 caracteres."),
});

const comoEditaveis = (checklist: PerguntaDoChecklist[]): PerguntaEditavel[] => checklist.map((p) => ({ chave: novoId(), id: p.id, texto: p.texto }));

interface EditorDoCicloProps {
  plano: PlanoPreventiva;
  aoSalvar: (detalhe: DetalheDoPlano) => void;
  aoCancelar: () => void;
}

/**
 * Regras do ciclo de um plano (admin e supervisor da equipe): o intervalo, de onde ele é contado, com quantos dias de
 * antecedência o aviso sai, a pausa e uma observação, e o checklist de inspeção que o técnico preenche ao encerrar cada OS do plano.
 * Salvar confere o ciclo na hora: o vencimento novo pode já gerar o alerta.
 */
export function EditorDoCiclo({ plano, aoSalvar, aoCancelar }: EditorDoCicloProps) {
  const base = useId();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando: salvando, erroEnvio } = useFormulario(esquema, {
    intervalo: plano.intervalo,
    baseDoCiclo: plano.base_do_ciclo,
    antecedencia: String(plano.antecedencia_dias),
    pausar: !plano.ativo,
    observacao: plano.observacao ?? "",
  });
  const { register, formState } = form;
  const erros = formState.errors;
  const [intervalo, setIntervalo] = useValorDoForm(form, "intervalo");
  const [baseDoCiclo] = useValorDoForm(form, "baseDoCiclo");
  // A lista de planos traz só o total de perguntas: o checklist vem do detalhe do plano, ao abrir o editor.
  const [perguntas, setPerguntas] = useState<PerguntaEditavel[] | null>(() => (plano.checklist ? comoEditaveis(plano.checklist) : null));
  const [original, setOriginal] = useState<PerguntaDoChecklist[] | null>(plano.checklist ?? null);
  const [erroChecklist, setErroChecklist] = useState<string | null>(null);

  useEffect(() => {
    if (original !== null) return;
    let vivo = true;
    chamar<DetalheDoPlano>("GET", `/preventivas/${plano.id}`)
      .then((d) => {
        if (!vivo) return;
        const checklist = d.plano.checklist ?? [];
        setOriginal(checklist);
        setPerguntas(comoEditaveis(checklist));
      })
      .catch(() => vivo && setErroChecklist("Não foi possível carregar o checklist. Feche e abra o editor para tentar de novo."));
    return () => {
      vivo = false;
    };
  }, [plano.id, original]);

  /** O checklist como vai para a `api`: sem as linhas em branco, com o `id` das perguntas que já existiam. */
  const checklistEditado = (perguntas ?? []).map((p) => ({ id: p.id, texto: p.texto.trim() })).filter((p) => p.texto !== "");
  const checklistMudou =
    original !== null && JSON.stringify(checklistEditado) !== JSON.stringify(original.map((p) => ({ id: p.id, texto: p.texto })));

  const salvar = enviar(async (v) => {
    const detalhe = await chamar<DetalheDoPlano & RespostaComPontos>("PUT", `/preventivas/${plano.id}`, {
      intervalo: v.intervalo,
      base_do_ciclo: v.baseDoCiclo,
      antecedencia_dias: Number(v.antecedencia),
      ativo: !v.pausar,
      observacao: v.observacao.trim() || null,
      ...(checklistMudou && { checklist: checklistEditado }),
    });
    // Definir o intervalo de um plano que estava sem pontua o supervisor.
    const pontos = textoDosPontosGanhos(detalhe);
    const salvo = v.intervalo ? `Ciclo salvo: ${descreverIntervalo(v.intervalo)}` : "Ciclo salvo sem intervalo";
    exibirAviso(pontos ? `${salvo} · ${pontos}` : salvo);
    aoSalvar(detalhe);
  });

  return (
    <form ref={ref} noValidate className="prev-editor" onSubmit={salvar}>
      <div className="prev-editor-campos">
        <div className="field">
          <label htmlFor={`${base}-intervalo`}>Intervalo entre ciclos</label>
          <CampoIntervalo id={`${base}-intervalo`} valor={intervalo} aoMudar={setIntervalo} desabilitado={salvando} />
          <span className="small">{intervalo ? `Preventiva ${descreverIntervalo(intervalo)}.` : "Em branco: o plano fica sem contagem e sem alertas."}</span>
        </div>
        <div className="field">
          <label htmlFor={`${base}-base`}>Contar o próximo ciclo a partir</label>
          <select id={`${base}-base`} className="select" disabled={salvando} {...register("baseDoCiclo")}>
            {(Object.keys(rotuloDaBase) as BaseDoCiclo[]).map((b) => (
              <option key={b} value={b}>
                {rotuloDaBase[b]}
              </option>
            ))}
          </select>
          <span className="small">
            {baseDoCiclo === "execucao" ? "O ciclo só recomeça quando a equipe executa a OS." : "Calendário fixo: o ciclo segue a data programada, mesmo se a OS atrasar."}
          </span>
        </div>
        <Field label="Avisar com antecedência de" htmlFor={`${base}-antecedencia`} erro={erros.antecedencia?.message}>
          <div className="row g8" style={{ alignItems: "center" }}>
            <input
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              disabled={salvando}
              style={{ width: 96 }}
              {...register("antecedencia")}
              {...ligarAoErro(`${base}-antecedencia`, erros.antecedencia?.message)}
            />
            <span className="small">dias do vencimento</span>
          </div>
        </Field>
        <Field label="Observação" htmlFor={`${base}-obs`} erro={erros.observacao?.message}>
          <textarea
            className="textarea"
            rows={2}
            maxLength={500}
            placeholder="Ex.: plano em revisão no SAP"
            disabled={salvando}
            {...register("observacao")}
            {...ligarAoErro(`${base}-obs`, erros.observacao?.message)}
          />
        </Field>
      </div>
      <div className="field">
        <label htmlFor={`${base}-checklist`}>Checklist de inspeção</label>
        <span className="small">
          As perguntas que o técnico marca ao encerrar cada OS deste plano. O item não marcado pede uma observação e avisa o supervisor da equipe. Sem
          perguntas, a OS encerra sem checklist.
        </span>
        {erroChecklist ? (
          <span className="entrada-retorno erro" role="alert">
            {erroChecklist}
          </span>
        ) : perguntas === null ? (
          <span className="small">Carregando o checklist…</span>
        ) : (
          <EditorDoChecklist id={`${base}-checklist`} perguntas={perguntas} aoMudar={setPerguntas} desabilitado={salvando} />
        )}
      </div>
      <label className="row g8" style={{ fontSize: 14, cursor: "pointer", alignItems: "center" }}>
        <input type="checkbox" disabled={salvando} {...register("pausar")} />
        Pausar o ciclo (sem contagem nem alertas até retomar)
      </label>
      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8 wrap" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" aria-busy={salvando} disabled={salvando || (original === null && erroChecklist === null)}>
          <Icon name={salvando ? "refresh" : "save"} size={16} className={salvando ? "spin" : undefined} />
          {salvando ? "Salvando…" : "Salvar ciclo"}
        </Button>
      </div>
    </form>
  );
}
