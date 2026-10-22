import type { Metadata } from "next";
import { FaixaDaValidacao } from "@/components/web/treinamento-servico/editor/FaixaDaValidacao";
import { RevisaoDoRascunho } from "@/components/web/treinamento-servico/editor/RevisaoDoRascunho";
import { codigoDaRota, materiaisDoCatalogo, rascunhoDoTreinamento, servicoDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Revisão · Treinamento" };

/** Aba Revisão: a revisão do rascunho, item por item, antes de testar e publicar. */
export default async function RevisaoDoTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [servico, rascunho, catalogo] = await Promise.all([servicoDoTreinamento(codigo), rascunhoDoTreinamento(codigo), materiaisDoCatalogo()]);
  const nomes = Object.fromEntries([...catalogo.map((m) => [m.id, m.descricao] as const), ...(servico?.materiais ?? []).map((m) => [m.material_id, m.descricao] as const)]);

  return (
    <FaixaDaValidacao codigo={codigo} travar>
      <RevisaoDoRascunho key={rascunho.versao_id} codigo={codigo} descricao={servico?.descricao ?? codigo} rascunho={rascunho} nomes={nomes} />
    </FaixaDaValidacao>
  );
}
