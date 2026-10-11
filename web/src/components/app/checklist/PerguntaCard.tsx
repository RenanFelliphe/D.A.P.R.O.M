import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { ItemDoModelo, Resposta } from "@/lib/apr";

const tagEliminatorio: CSSProperties = { border: "1px solid #E8A9A2", background: "#FDF0EE", color: "var(--blq)" };

/** Selo do tipo da pergunta: eliminatória, alerta (registra, não bloqueia) ou medida preventiva. */
function TagPergunta({ item }: { item: ItemDoModelo }) {
  if (item.tipo === "eliminatorio") {
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
      {item.resposta_bloqueante ? "Alerta · registra, não bloqueia" : "Medida preventiva"}
    </Badge>
  );
}

interface PerguntaCardProps {
  /** Número (base 1) da pergunta. */
  numero: number;
  item: ItemDoModelo;
  /** Resposta já dada, se houver. */
  resposta?: Resposta;
  aoResponder: (resposta: Resposta) => void;
}

/** Cartão da pergunta atual com o texto e os botões Sim/Não (e NA, só nos itens que o permitem). */
export function PerguntaCard({ numero, item, resposta, aoResponder }: PerguntaCardProps) {
  return (
    <section className="q-card" aria-label="Pergunta atual">
      <div className="row between">
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
          Pergunta {numero}
        </span>
        <TagPergunta item={item} />
      </div>
      <p className="q">{item.texto}</p>
      <div className="answer" style={item.permite_na ? { gridTemplateColumns: "1fr 1fr 1fr" } : undefined}>
        <button type="button" aria-pressed={resposta === "sim"} onClick={() => aoResponder("sim")}>
          <Icon name="check" size={22} />
          Sim
        </button>
        <button type="button" aria-pressed={resposta === "nao"} onClick={() => aoResponder("nao")}>
          <Icon name="x" size={22} />
          Não
        </button>
        {item.permite_na && (
          <button type="button" aria-pressed={resposta === "na"} onClick={() => aoResponder("na")}>
            NA
          </button>
        )}
      </div>
    </section>
  );
}
