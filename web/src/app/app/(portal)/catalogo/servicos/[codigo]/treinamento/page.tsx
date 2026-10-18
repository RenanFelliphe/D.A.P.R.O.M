import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { editaCatalogo } from "@/components/web/catalogo/secao";
import { EditorTreinamentoServico } from "@/components/web/treinamento-servico/EditorTreinamentoServico";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { ServicoDaOs } from "@/lib/catalogo";
import { rotas } from "@/lib/rotas";
import type { RascunhoDoEditor, ReporteDeTreinamento, SituacaoIA, VersaoAnterior } from "@/lib/treinamento-servico";

export const metadata: Metadata = { title: "Treinamento de serviço" };

function decodificar(valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

/**
 * `/app/catalogo/servicos/{codigo}/treinamento` (admin): o editor do treinamento de serviço, seção 3.5 do `vitoria.md`.
 * Uma página própria, como o editor de modelo de APR, não um modal.
 */
export default async function TreinamentoServicoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = decodificar((await params).codigo);
  const { usuario } = await usuarioAtual();
  if (!editaCatalogo(usuario)) redirect(rotas.app.catalogo);

  const servico = await apiOuNulo<ServicoDaOs>(`/catalogo/servicos/${encodeURIComponent(codigo)}`);
  if (!servico) notFound();

  const [rascunho, { versoes }, { reportes }] = await Promise.all([
    api<RascunhoDoEditor & { ia: SituacaoIA }>(`/treinamentos/${encodeURIComponent(codigo)}/rascunho`),
    api<{ versoes: VersaoAnterior[] }>(`/treinamentos/${encodeURIComponent(codigo)}/versoes`),
    api<{ reportes: ReporteDeTreinamento[] }>("/treinamentos/reportes", { consulta: { tamanho: 200 } }),
  ]);
  const reportesDoServico = reportes.filter((r) => r.atividade_codigo === codigo);

  return (
    <Screen>
      <div className="crumb">
        <Link href={rotas.app.catalogo} style={{ fontWeight: 500 }}>
          Catálogo
        </Link>{" "}
        / <span className="mono">{codigo}</span> / Treinamento
      </div>
      <h1>Treinamento de {servico.descricao}</h1>
      <EditorTreinamentoServico codigo={codigo} descricao={servico.descricao} rascunhoInicial={rascunho} versoesIniciais={versoes} reportesIniciais={reportesDoServico} situacaoIA={rascunho.ia} />
    </Screen>
  );
}
