import { GestaoShell } from "@/components/shell/GestaoShell";

/** O PDF gerado é aberto dentro do painel de gestão. */
export default function DocLayout({ children }: LayoutProps<"/doc">) {
  return <GestaoShell>{children}</GestaoShell>;
}
