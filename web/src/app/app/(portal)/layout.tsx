import { TecnicoShell } from "@/components/shell/TecnicoShell";

/** Área do técnico: barra superior e menu lateral em volta das telas de OS, APR, execução e fila. */
export default function PortalLayout({ children }: LayoutProps<"/app">) {
  return <TecnicoShell>{children}</TecnicoShell>;
}
