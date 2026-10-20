import { Icon, type IconName } from "@/components/ui/Icon";
import { textoDaQuantidade, totalDeMudancas, type MudancaDeItem } from "@/lib/sugestao-materiais";

const MARCAS: Record<MudancaDeItem["tipo"], { icone: IconName | null; rotulo: string }> = {
  adicionado: { icone: "plus", rotulo: "Adicionado" },
  removido: { icone: "x", rotulo: "Removido" },
  alterado: { icone: "pencil", rotulo: "Alterado" },
  igual: { icone: null, rotulo: "Sem mudança" },
};

function Linha({ m }: { m: MudancaDeItem }) {
  const { icone, rotulo } = MARCAS[m.tipo];
  const antes = m.antes ? textoDaQuantidade(m.antes.quantidade, m.unidade) : null;
  const depois = m.depois ? textoDaQuantidade(m.depois.quantidade, m.unidade) : null;
  const observacao = (m.depois ?? m.antes)?.observacao;
  return (
    <li className={`sg-linha sg-${m.tipo}`}>
      <span className="sg-marca" title={rotulo}>
        {icone ? <Icon name={icone} size={13} /> : null}
        <span className="sg-oculto">{rotulo}: </span>
      </span>
      <span className="sg-texto">
        <strong>{m.descricao}</strong>
        <span className="small sg-detalhe">
          {m.tipo === "alterado" ? (
            <>
              {antes} <Icon name="right" size={13} /> {depois}
              {m.antes?.observacao !== m.depois?.observacao ? " · observação alterada" : ""}
            </>
          ) : m.tipo === "removido" ? (
            antes
          ) : (
            depois
          )}
          {observacao ? ` · ${observacao}` : ""}
        </span>
      </span>
    </li>
  );
}

/**
 * O que a lista proposta muda na lista do serviço: o que entra, o que sai e o que muda de quantidade, e, abaixo, o que continua
 * igual. Com `soMudancas`, só o que muda. O cálculo é o de `diferencaDeListas` (o mesmo da `api` e do app).
 */
export function DiferencaDeListas({ mudancas, soMudancas = false, vazio = "Nenhuma mudança." }: { mudancas: MudancaDeItem[]; soMudancas?: boolean; vazio?: string }) {
  const quantas = totalDeMudancas(mudancas);
  const linhas = soMudancas ? mudancas.filter((m) => m.tipo !== "igual") : mudancas;
  if (linhas.length === 0) return <p className="muted small">{vazio}</p>;
  return (
    <div className="stack g8">
      <span className="small sg-resumo">{quantas === 0 ? "Nenhuma mudança na lista." : quantas === 1 ? "1 mudança na lista." : `${quantas} mudanças na lista.`}</span>
      <ul className="sg-lista" aria-label="O que muda na lista">
        {linhas.map((m) => (
          <Linha key={`${m.tipo}-${m.chave}`} m={m} />
        ))}
      </ul>
    </div>
  );
}
