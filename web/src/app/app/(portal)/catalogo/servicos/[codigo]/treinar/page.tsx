import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { TreinarServico } from "@/components/web/treinamento-servico/TreinarServico";
import { apiOuNulo } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import type { TreinamentoParaJogador, TreinamentoResumo } from "@/lib/treinamento-servico";

export const metadata: Metadata = { title: "Treinar" };

/** O código do serviço vem codificado na URL (pode ter pontos e barras: `8.7.2/8.7.3`). */
function decodificar(valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
}

/**
 * `/app/catalogo/servicos/{codigo}/treinar`: abertura, Parte 1 (a Vitória explicando), Parte 2 (o jogo) e o resultado.
 * Aberta para quem treina, inclusive quem ainda aguarda liberação (a rota da `api` já aceita).
 */
export default async function TreinarServicoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = decodificar((await params).codigo);
  const [treinamento, lista] = await Promise.all([
    apiOuNulo<TreinamentoParaJogador>(`/treinamentos/${encodeURIComponent(codigo)}`),
    apiOuNulo<{ treinamentos: TreinamentoResumo[] }>("/treinamentos"),
  ]);
  if (!treinamento) notFound();
  const resumo = lista?.treinamentos.find((t) => t.atividade_codigo === codigo);

  return (
    <Screen>
      <div className="crumb">
        <Link href={rotas.app.catalogo} style={{ fontWeight: 500 }}>
          Catálogo
        </Link>{" "}
        / <span className="mono">{codigo}</span> / Treinar
      </div>
      <TreinarServico treinamento={treinamento} jaConcluiu={Boolean(resumo?.concluido)} />
    </Screen>
  );
}
