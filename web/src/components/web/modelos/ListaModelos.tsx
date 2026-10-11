import Link from "next/link";
import type { ResumoModelo } from "@/data/modelos";
import { rotas } from "@/lib/rotas";

export interface GrupoModelo {
  codigo: string;
  titulo: string;
  versoes: ResumoModelo[];
}

/** Agrupa as versões (já ordenadas por código e versão decrescente) por código do modelo. */
export function agruparModelos(modelos: ResumoModelo[]): GrupoModelo[] {
  const grupos = new Map<string, GrupoModelo>();
  for (const m of modelos) {
    const grupo = grupos.get(m.codigo);
    if (grupo) grupo.versoes.push(m);
    else grupos.set(m.codigo, { codigo: m.codigo, titulo: m.titulo, versoes: [m] });
  }
  return [...grupos.values()];
}

/** Lista lateral de modelos de APR: um item por código, com a versão em uso e o rascunho, se houver. */
export function ListaModelos({ grupos, atual }: { grupos: GrupoModelo[]; atual?: string }) {
  if (grupos.length === 0) return <p className="muted">Nenhum modelo de APR cadastrado.</p>;
  return (
    <div className="alist mlist" id="ml-list">
      {grupos.map((g) => {
        const publicada = g.versoes.find((v) => !v.rascunho);
        const rascunho = g.versoes.find((v) => v.rascunho);
        const versoes = [publicada ? `v${publicada.versao}` : null, rascunho ? `rascunho v${rascunho.versao}` : null]
          .filter(Boolean)
          .join(" · ");
        return (
          <Link
            key={g.codigo}
            href={`${rotas.web.modelos}?codigo=${encodeURIComponent(g.codigo)}`}
            aria-current={g.codigo === atual ? "true" : undefined}
          >
            <span className="tp">
              <b>{g.codigo}</b>
              <span>{versoes}</span>
            </span>
            <span className="tt">{g.titulo}</span>
            <span className="small">{`${(publicada ?? rascunho!).itens_total} itens`}</span>
          </Link>
        );
      })}
    </div>
  );
}
