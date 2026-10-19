import type { Metadata } from "next";
import { EditorDasFases } from "@/components/web/treinamento-servico/editor/EditorDasFases";
import { codigoDaRota, materiaisDoCatalogo, rascunhoDoTreinamento, servicoDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Fases do jogo · Treinamento" };

/** Aba Fases do jogo: a Parte 2 do treinamento. Os materiais do serviço e do catálogo dão nome aos itens do Selecione com os materiais do serviço. */
export default async function FasesDoTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [servico, rascunho, catalogo] = await Promise.all([servicoDoTreinamento(codigo), rascunhoDoTreinamento(codigo), materiaisDoCatalogo()]);
  const doServico = (servico?.materiais ?? []).filter((m) => m.ativo).map((m) => ({ id: m.material_id, descricao: m.descricao, categoria: m.categoria }));
  const nomes = Object.fromEntries([...catalogo.map((m) => [m.id, m.descricao] as const), ...(servico?.materiais ?? []).map((m) => [m.material_id, m.descricao] as const)]);

  return <EditorDasFases key={rascunho.versao_id} codigo={codigo} descricao={servico?.descricao ?? codigo} rascunho={rascunho} materiaisDoServico={doServico} nomes={nomes} />;
}
