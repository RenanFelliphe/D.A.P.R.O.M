import type { PerguntaDoChecklist } from "@/lib/checklist-inspecao";

/**
 * O checklist de inspeção da OS preventiva: as perguntas que o técnico marca no encerramento, para saber o que vai verificar
 * antes de sair. Some quando a OS não tem checklist (corretiva, ou plano sem perguntas).
 */
export function ChecklistDaOsCard({ perguntas }: { perguntas: PerguntaDoChecklist[] }) {
  if (perguntas.length === 0) return null;
  return (
    <div className="card stack g8" data-treino="os-checklist">
      <div className="row between" style={{ gap: 12, alignItems: "baseline" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Checklist de inspeção</h2>
        <span className="small">{perguntas.length === 1 ? "1 pergunta" : `${perguntas.length} perguntas`}</span>
      </div>
      <span className="small" style={{ color: "var(--ink4)" }}>
        Você vai marcar cada item ao encerrar a OS. O item não marcado pede uma observação e avisa o supervisor.
      </span>
      <ol className="stack g6" style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
        {perguntas.map((p) => (
          <li key={p.id}>{p.texto}</li>
        ))}
      </ol>
    </div>
  );
}
