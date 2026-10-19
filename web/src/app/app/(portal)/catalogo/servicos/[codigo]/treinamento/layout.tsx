import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Screen } from "@/components/ui/Screen";
import { editaCatalogo } from "@/components/web/catalogo/secao";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { codigoDaRota, servicoDoTreinamento, versoesDoTreinamento } from "@/lib/treinamento-servico-servidor";

/**
 * O treinamento de serviço do admin (seção 3.5 do `vitoria.md`): o caminho, o título e a situação (no ar, rascunho em edição)
 * valem para todas as telas. As abas ficam em `(painel)`; Criar, Gerar e Publicar são telas de fluxo, sem abas, com a volta
 * para a visão geral.
 */
export default async function TreinamentoServicoLayout({ children, params }: { children: ReactNode; params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const { usuario } = await usuarioAtual();
  if (!editaCatalogo(usuario)) redirect(rotas.app.catalogo);

  const servico = await servicoDoTreinamento(codigo);
  if (!servico) notFound();
  const versoes = await versoesDoTreinamento(codigo);
  const publicada = versoes.find((v) => v.estado === "publicada");
  const rascunho = versoes.find((v) => v.estado === "rascunho");

  return (
    <Screen className="ts-pagina">
      <nav className="crumb" aria-label="Caminho">
        <Link href={rotas.app.catalogo}>Catálogo</Link>
        <span aria-hidden="true">/</span>
        <span className="mono">{codigo}</span>
        <span aria-hidden="true">/</span>
        <Link href={rotas.app.treinamentoServico(codigo)}>Treinamento</Link>
      </nav>
      <header className="ts-cabecalho">
        <div className="ts-cabecalho-texto">
          <span className="lbl">Treinamento de serviço</span>
          <h1>{servico.descricao}</h1>
        </div>
        <div className="ts-cabecalho-selos">
          {publicada ? <Badge tone="enc">No ar · versão {publicada.versao}</Badge> : <Badge tone="neu">Não publicado</Badge>}
          {rascunho && <Badge tone="al">Rascunho · versão {rascunho.versao}</Badge>}
        </div>
      </header>
      {children}
    </Screen>
  );
}
