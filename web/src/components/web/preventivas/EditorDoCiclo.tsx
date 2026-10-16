"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { PerguntaDoChecklist } from "@/lib/checklist-inspecao";
import { chamar, ErroCliente, novoId } from "@/lib/cliente-api";
import { textoDosPontosGanhos, type RespostaComPontos } from "@/lib/gamificacao";
import { descreverIntervalo, rotuloDaBase, type BaseDoCiclo, type DetalheDoPlano, type Intervalo, type PlanoPreventiva } from "@/lib/preventivas";
import { useToast } from "@/state/toast";
import { CampoIntervalo } from "./CampoIntervalo";
import { EditorDoChecklist, type PerguntaEditavel } from "./EditorDoChecklist";

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
  const [intervalo, setIntervalo] = useState<Intervalo | null>(plano.intervalo);
  const [baseDoCiclo, setBaseDoCiclo] = useState<BaseDoCiclo>(plano.base_do_ciclo);
  const [antecedencia, setAntecedencia] = useState(String(plano.antecedencia_dias));
  const [ativo, setAtivo] = useState(plano.ativo);
  const [observacao, setObservacao] = useState(plano.observacao ?? "");
  // A lista de planos traz só o total de perguntas: o checklist vem do detalhe do plano, ao abrir o editor.
  const [perguntas, setPerguntas] = useState<PerguntaEditavel[] | null>(() => (plano.checklist ? comoEditaveis(plano.checklist) : null));
  const [original, setOriginal] = useState<PerguntaDoChecklist[] | null>(plano.checklist ?? null);
  const [erroChecklist, setErroChecklist] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const dias = Number.parseInt(antecedencia, 10);
    if (!Number.isInteger(dias) || dias < 0 || dias > 365) {
      setErro("A antecedência do aviso vai de 0 a 365 dias.");
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const detalhe = await chamar<DetalheDoPlano & RespostaComPontos>("PUT", `/preventivas/${plano.id}`, {
        intervalo,
        base_do_ciclo: baseDoCiclo,
        antecedencia_dias: dias,
        ativo,
        observacao: observacao.trim() || null,
        ...(checklistMudou && { checklist: checklistEditado }),
      });
      // Definir o intervalo de um plano que estava sem pontua o supervisor.
      const pontos = textoDosPontosGanhos(detalhe);
      const salvo = intervalo ? `Ciclo salvo: ${descreverIntervalo(intervalo)}` : "Ciclo salvo sem intervalo";
      exibirAviso(pontos ? `${salvo} · ${pontos}` : salvo);
      aoSalvar(detalhe);
    } catch (falha) {
      setErro(falha instanceof ErroCliente ? falha.message : "Servidor indisponível. Tente de novo.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="prev-editor" onSubmit={salvar}>
      <div className="prev-editor-campos">
        <div className="field">
          <label htmlFor={`${base}-intervalo`}>Intervalo entre ciclos</label>
          <CampoIntervalo id={`${base}-intervalo`} valor={intervalo} aoMudar={setIntervalo} desabilitado={salvando} />
          <span className="small">{intervalo ? `Preventiva ${descreverIntervalo(intervalo)}.` : "Em branco: o plano fica sem contagem e sem alertas."}</span>
        </div>
        <div className="field">
          <label htmlFor={`${base}-base`}>Contar o próximo ciclo a partir</label>
          <select id={`${base}-base`} className="select" value={baseDoCiclo} onChange={(e) => setBaseDoCiclo(e.target.value as BaseDoCiclo)} disabled={salvando}>
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
        <div className="field">
          <label htmlFor={`${base}-antecedencia`}>Avisar com antecedência de</label>
          <div className="row g8" style={{ alignItems: "center" }}>
            <input
              id={`${base}-antecedencia`}
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              value={antecedencia}
              onChange={(e) => setAntecedencia(e.target.value)}
              disabled={salvando}
              style={{ width: 96 }}
            />
            <span className="small">dias do vencimento</span>
          </div>
        </div>
        <div className="field">
          <label htmlFor={`${base}-obs`}>Observação</label>
          <textarea
            id={`${base}-obs`}
            className="textarea"
            rows={2}
            maxLength={500}
            placeholder="Ex.: plano em revisão no SAP"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            disabled={salvando}
          />
        </div>
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
        <input type="checkbox" checked={!ativo} onChange={(e) => setAtivo(!e.target.checked)} disabled={salvando} />
        Pausar o ciclo (sem contagem nem alertas até retomar)
      </label>
      {erro && (
        <span className="entrada-retorno erro" role="alert">
          {erro}
        </span>
      )}
      <div className="row g8 wrap" style={{ justifyContent: "flex-end" }}>
        <Button variant="line" sm onClick={aoCancelar} disabled={salvando}>
          Cancelar
        </Button>
        <Button variant="p" sm type="submit" disabled={salvando || (original === null && erroChecklist === null)}>
          <Icon name={salvando ? "refresh" : "save"} size={16} className={salvando ? "spin" : undefined} />
          {salvando ? "Salvando…" : "Salvar ciclo"}
        </Button>
      </div>
    </form>
  );
}
