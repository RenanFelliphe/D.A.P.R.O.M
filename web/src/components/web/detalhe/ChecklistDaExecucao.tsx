import { Icon } from "@/components/ui/Icon";
import type { ItemDaInspecao } from "@/lib/checklist-inspecao";

const rotuloMedida = { color: "var(--ink4)" } as const;

/**
 * O checklist de inspeção como foi respondido no encerramento da execução: a pergunta de então (a execução guarda uma cópia),
 * a caixa e a observação. Os itens não marcados ficam em destaque; "não respondida" é a pergunta que o aparelho não conhecia.
 */
export function ChecklistDaExecucao({ itens }: { itens: ItemDaInspecao[] }) {
  const naoMarcados = itens.filter((i) => i.marcado === false).length;
  return (
    <div className="stack g8">
      <div className="small" style={rotuloMedida}>
        Checklist de inspeção · {naoMarcados === 0 ? "todos os itens marcados" : naoMarcados === 1 ? "1 item não marcado" : `${naoMarcados} itens não marcados`}
      </div>
      <ul className="insp-lista">
        {itens.map((i, n) => (
          <li key={n} className="insp-item" data-estado={i.marcado === false ? "pendente" : undefined}>
            <div className="insp-resposta">
              <span className="insp-caixa" data-marcado={String(i.marcado)} role="img" aria-label={i.marcado === true ? "Marcado" : i.marcado === false ? "Não marcado" : "Não respondida"}>
                {i.marcado === true && <Icon name="check" size={16} />}
                {i.marcado === false && <Icon name="x" size={16} />}
                {i.marcado === null && "?"}
              </span>
              <span className="stack g4">
                <span>{i.pergunta}</span>
                {i.marcado === null && <span className="small">Não respondida (o encerramento veio da fila offline sem esta pergunta).</span>}
                {i.observacao && <span className="small">Obs.: {i.observacao}</span>}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
