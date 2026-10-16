"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { faltaObservacao, MAX_OBSERVACAO_DO_ITEM, type PerguntaDoChecklist, type RespostaDoItem } from "@/lib/checklist-inspecao";

interface ChecklistDeInspecaoProps {
  perguntas: PerguntaDoChecklist[];
  respostas: Record<string, RespostaDoItem>;
  onChange: (respostas: Record<string, RespostaDoItem>) => void;
  desabilitado?: boolean;
}

const vazia: RespostaDoItem = { marcado: false, observacao: "" };

/**
 * O checklist de inspeção da preventiva, no encerramento: cada pergunta é uma caixa de marcar. A não marcada pede uma
 * observação (sem ela o encerramento não é liberado, mas o item não marcado não impede encerrar: o supervisor é avisado); a
 * marcada aceita uma observação opcional.
 */
export function ChecklistDeInspecao({ perguntas, respostas, onChange, desabilitado }: ChecklistDeInspecaoProps) {
  /** As perguntas marcadas cuja observação opcional o técnico abriu. */
  const [comObservacao, setComObservacao] = useState<Set<string>>(new Set());
  const de = (id: string) => respostas[id] ?? vazia;
  const mudar = (id: string, parte: Partial<RespostaDoItem>) => onChange({ ...respostas, [id]: { ...de(id), ...parte } });
  const marcados = perguntas.filter((p) => de(p.id).marcado).length;

  return (
    <div className="stack g12" data-treino="enc-checklist">
      <div className="row between wrap g8" style={{ alignItems: "center" }}>
        <div className="stack g4">
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Checklist de inspeção</h2>
          <span className="small">
            {marcados} de {perguntas.length} marcados. Marque o que está conforme; o que não estiver pede uma observação.
          </span>
        </div>
        <Button
          variant="line"
          sm
          disabled={desabilitado || marcados === perguntas.length}
          onClick={() => onChange(Object.fromEntries(perguntas.map((p) => [p.id, { ...de(p.id), marcado: true }])))}
        >
          Marcar todos
        </Button>
      </div>
      <ul className="insp-lista">
        {perguntas.map((p) => {
          const r = de(p.id);
          const pendente = faltaObservacao(r);
          const mostraObservacao = !r.marcado || comObservacao.has(p.id) || r.observacao !== "";
          return (
            <li key={p.id} className="insp-item" data-estado={pendente ? "pendente" : undefined}>
              <label className="insp-marca">
                <input type="checkbox" checked={r.marcado} disabled={desabilitado} onChange={(e) => mudar(p.id, { marcado: e.target.checked })} />
                <span>{p.texto}</span>
              </label>
              <div className="insp-obs">
                {mostraObservacao ? (
                  <textarea
                    className="textarea"
                    rows={2}
                    maxLength={MAX_OBSERVACAO_DO_ITEM}
                    value={r.observacao}
                    onChange={(e) => mudar(p.id, { observacao: e.target.value })}
                    disabled={desabilitado}
                    aria-label={`Observação: ${p.texto}`}
                    aria-required={!r.marcado}
                    placeholder={r.marcado ? "Observação (opcional)" : "O que foi encontrado? (obrigatória: o supervisor será avisado)"}
                  />
                ) : (
                  <Button variant="ghost" sm onClick={() => setComObservacao((a) => new Set(a).add(p.id))} disabled={desabilitado}>
                    Adicionar observação
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
