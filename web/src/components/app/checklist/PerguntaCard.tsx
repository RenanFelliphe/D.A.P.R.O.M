import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import type { ItemDoModelo, Resposta } from "@/lib/apr";

interface PerguntaCardProps {
  /** Número (base 1) da pergunta. */
  numero: number;
  item: ItemDoModelo;
  /** Resposta já dada, se houver. */
  resposta?: Resposta;
  aoResponder: (resposta: Resposta) => void;
  /** O que vai entre o texto e os botões: na pergunta de clima, a previsão do tempo. */
  extra?: ReactNode;
}

/**
 * Cartão da pergunta atual com o texto e os botões Sim/Não (e NA, só nos itens que o permitem). Todas as perguntas têm a
 * mesma aparência: o técnico não pode saber quais são eliminatórias.
 */
export function PerguntaCard({ numero, item, resposta, aoResponder, extra }: PerguntaCardProps) {
  return (
    <section className="q-card" aria-label="Pergunta atual" data-treino="ck-pergunta" data-treino-item={item.id}>
      <div className="row between">
        <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
          Pergunta {numero}
        </span>
      </div>
      <p className="q">{item.texto}</p>
      {extra}
      <div className="answer" data-treino="ck-resposta" style={item.permite_na ? { gridTemplateColumns: "1fr 1fr 1fr" } : undefined}>
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
