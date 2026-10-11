import { GestaoShell } from "@/components/shell/GestaoShell";

/** Painel de gestão: barra superior e menu lateral em volta das telas. */
export default function WebLayout({ children }: LayoutProps<"/web">) {
  return <GestaoShell>{children}</GestaoShell>;
}
