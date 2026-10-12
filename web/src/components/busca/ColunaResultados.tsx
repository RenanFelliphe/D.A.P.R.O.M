import Link from "next/link";
import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/Icon";

interface ColunaResultadosProps {
  /** Identifica a seção (liga o título à região para quem usa leitor de tela). */
  id: string;
  titulo: string;
  icone: IconName;
  total: number;
  vazio: string;
  /** Itens em grade de cartões (equipes), em vez de lista. */
  grade?: boolean;
  /** Paginação da seção, abaixo da lista. */
  paginacao?: ReactNode;
  children: ReactNode;
}

/** Seção de resultados da busca: cabeçalho com o total, a lista (ou o aviso de que não achou nada) e a paginação. */
export function ColunaResultados({ id, titulo, icone, total, vazio, grade, paginacao, children }: ColunaResultadosProps) {
  return (
    <section className="busca-coluna" aria-labelledby={id}>
      <header className="busca-coluna-cab">
        <Icon name={icone} size={18} />
        <h2 id={id}>{titulo}</h2>
        <span className="busca-total" aria-label={`${total} ${total === 1 ? "resultado" : "resultados"}`}>
          {total}
        </span>
      </header>
      {total === 0 ? (
        <div className="busca-vazio">
          <Icon name="info" size={18} />
          <span>{vazio}</span>
        </div>
      ) : (
        <>
          <div className={grade ? "busca-lista grade" : "busca-lista"}>{children}</div>
          {paginacao}
        </>
      )}
    </section>
  );
}

interface PaginadorProps {
  pagina: number;
  tamanho: number;
  total: number;
  href: (pagina: number) => string;
}

/** "11–20 de 37" com Anterior e Próxima (os dois ficam sempre no lugar; o que não vale aparece apagado). Some quando cabe numa página só. */
export function Paginador({ pagina, tamanho, total, href }: PaginadorProps) {
  const ultima = Math.max(1, Math.ceil(total / tamanho));
  if (ultima === 1) return null;
  const de = (pagina - 1) * tamanho + 1;
  const ate = Math.min(total, pagina * tamanho);
  return (
    <nav className="busca-paginador" aria-label="Paginação">
      <span className="small">{`${de}–${ate} de ${total}`}</span>
      <span className="row g8">
        {pagina > 1 ? (
          <Link className="btn btn-line btn-sm" href={href(pagina - 1)} scroll={false}>
            <Icon name="left" size={16} />
            Anterior
          </Link>
        ) : (
          <span className="btn btn-line btn-sm is-off" aria-disabled="true">
            <Icon name="left" size={16} />
            Anterior
          </span>
        )}
        {pagina < ultima ? (
          <Link className="btn btn-line btn-sm" href={href(pagina + 1)} scroll={false}>
            Próxima
            <Icon name="right" size={16} />
          </Link>
        ) : (
          <span className="btn btn-line btn-sm is-off" aria-disabled="true">
            Próxima
            <Icon name="right" size={16} />
          </span>
        )}
      </span>
    </nav>
  );
}
