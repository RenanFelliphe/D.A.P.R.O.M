import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Screen } from "@/components/ui/Screen";
import { rotas } from "@/lib/rotas";
import { servicoDoCatalogo } from "@/lib/sugestao-materiais-servidor";
import { codigoDaRota } from "@/lib/treinamento-servico-servidor";

/**
 * As telas de sugestão e contestação da lista de materiais de um serviço (`docs/operacao-de-campo.md`, seção 10.2): o caminho e o nome do
 * serviço valem para todas. São telas de fluxo, sem abas, com a volta para a lista de sugestões.
 */
export default async function MateriaisDoServicoLayout({ children, params }: { children: ReactNode; params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const servico = await servicoDoCatalogo(codigo);
  if (!servico) notFound();

  return (
    <Screen className="sg-pagina">
      <nav className="crumb" aria-label="Caminho">
        <Link href={rotas.app.catalogo}>Catálogo</Link>
        <span aria-hidden="true">/</span>
        <Link href={`${rotas.app.catalogo}?busca=${encodeURIComponent(codigo)}`}>
          <span className="mono">{codigo}</span>
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={rotas.app.sugestoesDeMateriais}>Sugestões de materiais</Link>
      </nav>
      <header className="sg-cabecalho-pagina">
        <span className="lbl">Materiais recomendados</span>
        <h1>{servico.descricao}</h1>
      </header>
      {children}
    </Screen>
  );
}
