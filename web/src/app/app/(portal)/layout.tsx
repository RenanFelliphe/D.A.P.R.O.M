import { Casca } from "@/components/shell/Casca";

/** Telas compartilhadas (quadro, detalhe da OS, perfil, equipe e busca) e as de campo (APR, execução, treino): a casca única por perfil. */
export default function PortalLayout({ children }: LayoutProps<"/app">) {
  return <Casca>{children}</Casca>;
}
