import type { ReactNode } from "react";

interface ShellProps {
  /** Faixa fixa acima da barra superior (campo de treino). */
  faixa?: ReactNode;
  topbar: ReactNode;
  menu: ReactNode;
  children: ReactNode;
}

/** Estrutura desktop das áreas logadas: barra superior fixa, menu lateral e conteúdo. */
export function Shell({ faixa, topbar, menu, children }: ShellProps) {
  return (
    <div className={faixa ? "shell em-treino" : "shell"}>
      {faixa}
      {topbar}
      <div className="shell-body">
        {menu}
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
