import type { ReactNode } from "react";

interface ShellProps {
  topbar: ReactNode;
  menu: ReactNode;
  children: ReactNode;
}

/** Estrutura desktop das áreas logadas: barra superior fixa, menu lateral e conteúdo. */
export function Shell({ topbar, menu, children }: ShellProps) {
  return (
    <div className="shell">
      {topbar}
      <div className="shell-body">
        {menu}
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
