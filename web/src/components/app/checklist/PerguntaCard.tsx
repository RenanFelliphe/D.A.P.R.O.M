import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { PerguntaApr, Resposta } from "@/data/checklist";

const tagEliminatorio: CSSProperties = { border: "1px solid #E8A9A2", background: "#FDF0EE", color: "var(--blq)" };

/** Selo do tipo da pergunta: eliminatória, alerta (registra, não bloqueia) ou medida preventiva. */
function TagPergunta({ pergunta }: { pergunta: PerguntaApr }) {
  if (pergunta.tipo === "elim") {
    return (
      <span className="badge" style={tagEliminatorio}>
        <Icon name="octagon" size={13} />
        Eliminatório
      </span>
    );
  }
  return (
    <Badge tone="al">
      <Icon name="alert" size={13} />
      {pergunta.critica ? "Alerta · registra, não bloqueia" : "Medida preventiva"}
    </Badge>
  );
}

interface PerguntaCardProps {
  /** Número (base 1) da pergunta. */
  numero: number;
  pergunta: PerguntaApr;
  /** Resposta já dada, se houver. */
  resposta?: Resposta;
  aoResponder: (resposta: Resposta) => void;
}

/** Cartão da pergunta atual com o texto, a dica e os botões Sim/Não. */
export function PerguntaCard({ numero, pergunta, resposta, aoResponder }: PerguntaCardProps) {
  return (
    <section className="q-card" aria-label="Pergunta atual">
      <div className="row between">
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
          Pergunta {numero}
        </span>
        <TagPergunta pergunta={pergunta} />
      </div>
      <p className="q">{pergunta.texto}</p>
      {pergunta.dica && (
        <p className="muted" style={{ fontSize: 13.5 }}>
          {pergunta.dica}
        </p>
      )}
      <div className="answer">
        <button type="button" aria-pressed={resposta === "sim"} onClick={() => aoResponder("sim")}>
          <Icon name="check" size={22} />
          Sim
        </button>
        <button type="button" aria-pressed={resposta === "nao"} onClick={() => aoResponder("nao")}>
          <Icon name="x" size={22} />
          Não
        </button>
      </div>
    </section>
  );
}
