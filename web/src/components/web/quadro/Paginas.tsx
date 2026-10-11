import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

interface PaginasProps {
  pagina: number;
  tamanho: number;
  total: number;
  /** Rótulo do que está sendo contado ("OS", "execuções"). */
  unidade?: string;
  /** Endereço de uma página (os demais parâmetros da URL já vêm montados). */
  hrefDa: (pagina: number) => string;
}

const desligado = { opacity: 0.5, pointerEvents: "none" } as const;

/** Paginação simples: anterior, "página x de y" e próxima. Some quando cabe numa página só. */
export function Paginas({ pagina, tamanho, total, unidade = "OS", hrefDa }: PaginasProps) {
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  if (paginas === 1) return null;
  return (
    <nav className="row g12" style={{ justifyContent: "center", alignItems: "center" }} aria-label="Paginação">
      {pagina > 1 ? (
        <Link className="btn btn-line btn-sm" href={hrefDa(pagina - 1)}>
          <Icon name="left" size={16} />
          Anterior
        </Link>
      ) : (
        <span className="btn btn-line btn-sm" aria-disabled style={desligado}>
          <Icon name="left" size={16} />
          Anterior
        </span>
      )}
      <span className="muted">
        Página {pagina} de {paginas} · {total} {unidade}
      </span>
      {pagina < paginas ? (
        <Link className="btn btn-line btn-sm" href={hrefDa(pagina + 1)}>
          Próxima
          <Icon name="right" size={16} />
        </Link>
      ) : (
        <span className="btn btn-line btn-sm" aria-disabled style={desligado}>
          Próxima
          <Icon name="right" size={16} />
        </span>
      )}
    </nav>
  );
}
