import Link from "next/link";

interface PaginacaoListaProps {
  caminho: string;
  /** Parâmetros da consulta atual (sem `pagina`), preservados nos links. */
  consulta: Record<string, string | undefined>;
  pagina: number;
  tamanho: number;
  total: number;
}

function endereco(caminho: string, consulta: Record<string, string | undefined>, pagina: number) {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(consulta)) if (valor) params.set(chave, valor);
  if (pagina > 1) params.set("pagina", String(pagina));
  const texto = params.toString();
  return texto ? `${caminho}?${texto}` : caminho;
}

/** Rodapé "Mostrando 1–50 de 117" com Anterior e Próxima para as listas paginadas do painel. */
export function PaginacaoLista({ caminho, consulta, pagina, tamanho, total }: PaginacaoListaProps) {
  if (total === 0) return null;
  const de = (pagina - 1) * tamanho + 1;
  const ate = Math.min(total, pagina * tamanho);
  const ultima = Math.max(1, Math.ceil(total / tamanho));
  return (
    <div className="row between wrap" style={{ fontSize: 13.5 }}>
      <span className="muted">{`Mostrando ${de}–${ate} de ${total}`}</span>
      {ultima > 1 && (
        <span className="row g8">
          {pagina > 1 ? (
            <Link className="btn btn-line btn-sm" href={endereco(caminho, consulta, pagina - 1)}>
              Anterior
            </Link>
          ) : null}
          <span className="small">{`Página ${pagina} de ${ultima}`}</span>
          {pagina < ultima ? (
            <Link className="btn btn-line btn-sm" href={endereco(caminho, consulta, pagina + 1)}>
              Próxima
            </Link>
          ) : null}
        </span>
      )}
    </div>
  );
}
