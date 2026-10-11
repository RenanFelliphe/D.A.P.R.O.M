"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cx } from "@/lib/cx";

type NumeroPagina = 1 | 2;

interface PaginaContexto {
  pagina: NumeroPagina;
  mostrar: (pagina: NumeroPagina) => void;
}

const PaginaContext = createContext<PaginaContexto | null>(null);

function usePagina(): PaginaContexto {
  const contexto = useContext(PaginaContext);
  if (!contexto) throw new Error("O PDF precisa estar dentro de <PdfPaginasProvider>.");
  return contexto;
}

/** Guarda qual das duas páginas do PDF está à mostra; volta à página 1 ao reabrir o documento. */
export function PdfPaginasProvider({ children }: { children: ReactNode }) {
  const [pagina, mostrar] = useState<NumeroPagina>(1);
  return <PaginaContext value={{ pagina, mostrar }}>{children}</PaginaContext>;
}

const abas: Array<{ pagina: NumeroPagina; rotulo: string }> = [
  { pagina: 1, rotulo: "Página 1 · APR" },
  { pagina: 2, rotulo: "Página 2 · OS" },
];

/** Abas que alternam entre a página da APR e a página da OS. */
export function PdfAbas() {
  const { pagina, mostrar } = usePagina();
  return (
    <div className="pdf-tabs" id="pdf-tabs" role="group" aria-label="Página do PDF">
      {abas.map((aba) => (
        <button key={aba.pagina} type="button" aria-pressed={pagina === aba.pagina} onClick={() => mostrar(aba.pagina)}>
          {aba.rotulo}
        </button>
      ))}
    </div>
  );
}

interface PdfFolhaProps {
  /** Número da página; só a página escolhida nas abas fica visível. */
  pagina: NumeroPagina;
  children: ReactNode;
}

/** Uma página A4 do PDF (.pdf). */
export function PdfFolha({ pagina, children }: PdfFolhaProps) {
  const { pagina: atual } = usePagina();
  return <div className={cx("pdf", pagina !== atual && "off")}>{children}</div>;
}
