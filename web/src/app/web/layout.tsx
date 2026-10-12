import { Casca, exigirGestao } from "@/components/shell/Casca";

/** Telas de gestão (APR, indicadores, usuários, auditoria, alertas): a casca única, só para admin e supervisor. */
export default async function WebLayout({ children }: LayoutProps<"/web">) {
  await exigirGestao();
  return <Casca>{children}</Casca>;
}
