import { Casca, exigirGestao } from "@/components/shell/Casca";

/** O PDF gerado é aberto dentro do painel de gestão. */
export default async function DocLayout({ children }: LayoutProps<"/doc">) {
  await exigirGestao();
  return <Casca>{children}</Casca>;
}
