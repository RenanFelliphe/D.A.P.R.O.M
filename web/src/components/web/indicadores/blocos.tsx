import type { ReactNode } from "react";

/** Peças comuns dos dashboards de Indicadores e exportação. */

export const porcentagem = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);
export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** `▲ 25% vs. 30 dias anteriores (8)`, sem variação ou sem base de comparação. */
export function comparacao(atual: number, anterior: number, rotuloAnterior: string) {
  if (anterior === 0) return `${rotuloAnterior}: nenhuma${atual === 0 ? " também" : ""}`;
  const variacao = Math.round(((atual - anterior) / anterior) * 100);
  if (variacao === 0) return `Sem variação vs. ${rotuloAnterior} (${anterior})`;
  return `${variacao > 0 ? "▲" : "▼"} ${Math.abs(variacao)}% vs. ${rotuloAnterior} (${anterior})`;
}

/** Bloco do dashboard com título e descrição. */
export function Secao({ id, titulo, descricao, children }: { id: string; titulo: string; descricao: string; children: ReactNode }) {
  return (
    <section className="stack g12" aria-labelledby={id}>
      <div className="stack" style={{ gap: 2 }}>
        <h2 id={id} className="secao-t">
          {titulo}
        </h2>
        <span className="muted">{descricao}</span>
      </div>
      {children}
    </section>
  );
}

/** Título e descrição no topo de um painel. */
export function CabecalhoDoBloco({ titulo, descricao }: { titulo: ReactNode; descricao: ReactNode }) {
  return (
    <div className="stack" style={{ gap: 2 }}>
      <h2>{titulo}</h2>
      <span className="muted">{descricao}</span>
    </div>
  );
}

interface MedidorProps {
  rotulo: ReactNode;
  parte: number;
  todo: number;
  cor: string;
  /** Texto à direita do número, ex.: "1 de 3 preventivas". */
  detalhe: string;
  /** Sem base (`todo` zero): o que dizer no lugar da porcentagem. */
  vazio: string;
}

/** Uma razão contra o todo (meta): a porcentagem em destaque, o detalhe ao lado e a barra no trilho. */
export function Medidor({ rotulo, parte, todo, cor, detalhe, vazio }: MedidorProps) {
  const pct = porcentagem(parte, todo);
  return (
    <li>
      <div className="row between g8" style={{ alignItems: "baseline" }}>
        <span>{rotulo}</span>
        <span style={{ whiteSpace: "nowrap" }}>
          {todo === 0 ? (
            <span className="small">{vazio}</span>
          ) : (
            <>
              <strong>{pct}%</strong> <span className="small">· {detalhe}</span>
            </>
          )}
        </span>
      </div>
      <div className="trilho" aria-hidden="true">
        {todo > 0 && <i style={{ width: `${pct}%`, background: cor }}></i>}
      </div>
    </li>
  );
}
