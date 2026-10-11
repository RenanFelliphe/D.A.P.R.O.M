import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";

export interface PassoTrilha {
  rotulo: ReactNode;
  href?: string;
}

/** Trilha de navegação no topo da página (.crumb). O último passo é a página atual. */
export function Trilha({ passos }: { passos: PassoTrilha[] }) {
  return (
    <nav className="crumb" aria-label="Você está em">
      {passos.map((passo, i) => (
        <span key={i} className="row g6">
          {i > 0 && <Icon name="right" size={13} />}
          {passo.href ? <Link href={passo.href}>{passo.rotulo}</Link> : <span>{passo.rotulo}</span>}
        </span>
      ))}
    </nav>
  );
}

interface CabecalhoPaginaProps {
  trilha?: PassoTrilha[];
  /** Título, subtítulo e selos. */
  children: ReactNode;
  /** Ações principais, alinhadas à direita. */
  acoes?: ReactNode;
}

/** Cabeçalho de uma página do técnico: trilha, título e ações. */
export function CabecalhoPagina({ trilha, children, acoes }: CabecalhoPaginaProps) {
  return (
    <>
      {trilha && <Trilha passos={trilha} />}
      <div className="row between wrap" style={{ alignItems: "flex-end" }}>
        <div className="stack g6">{children}</div>
        {acoes && <div className="row g8">{acoes}</div>}
      </div>
    </>
  );
}

/** Duas colunas: conteúdo principal e lateral fixa com resumo e ações (.cols). */
export function Colunas({ principal, lateral }: { principal: ReactNode; lateral: ReactNode }) {
  return (
    <div className="cols">
      <div className="col-main">{principal}</div>
      <aside className="col-side">{lateral}</aside>
    </div>
  );
}

interface PainelAcoesProps {
  titulo?: string;
  style?: CSSProperties;
  children: ReactNode;
}

/** Cartão da lateral com o resumo e as ações principais da tela. */
export function PainelAcoes({ titulo, style, children }: PainelAcoesProps) {
  return (
    <div className="panel" style={{ gap: 14, ...style }}>
      {titulo && <h2>{titulo}</h2>}
      {children}
    </div>
  );
}
