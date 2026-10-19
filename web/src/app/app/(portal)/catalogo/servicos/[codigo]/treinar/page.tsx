import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Screen } from "@/components/ui/Screen";
import { CapaDoTreinamento } from "@/components/web/treinamento-servico/CapaDoTreinamento";
import { apiOuNulo, usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";
import { ehAdmin } from "@/lib/tipos";
import type { RankingDoTreinamento, TreinamentoParaJogador, TreinamentoResumo } from "@/lib/treinamento-servico";
import { codigoDaRota } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Treinar" };

/**
 * `/app/catalogo/servicos/{codigo}/treinar`: a capa do treinamento publicado (o que é, quanto leva, quem assinou e a situação
 * de quem treina) e o ranking de quem já concluiu. O jogo abre numa janela por cima. Aberta para quem treina, inclusive quem aguarda liberação; os avisos e a
 * Vitória levam para cá.
 */
export default async function TreinarServicoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [{ usuario }, treinamento, lista, ranking] = await Promise.all([
    usuarioAtual(),
    apiOuNulo<TreinamentoParaJogador>(`/treinamentos/${encodeURIComponent(codigo)}`),
    apiOuNulo<{ treinamentos: TreinamentoResumo[] }>("/treinamentos"),
    apiOuNulo<RankingDoTreinamento>(`/treinamentos/${encodeURIComponent(codigo)}/ranking`),
  ]);
  if (!treinamento) notFound();
  const resumo = lista?.treinamentos.find((t) => t.atividade_codigo === codigo) ?? null;

  return (
    <Screen className="ts-pagina">
      <nav className="crumb" aria-label="Caminho">
        <Link href={rotas.app.catalogo}>Catálogo</Link>
        <span aria-hidden="true">/</span>
        <span className="mono">{codigo}</span>
        <span aria-hidden="true">/</span>
        <span>Treinar</span>
      </nav>
      <CapaDoTreinamento treinamento={treinamento} resumo={resumo} ranking={ranking} admin={ehAdmin(usuario)} />
    </Screen>
  );
}
