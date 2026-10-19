import type { Metadata } from "next";
import { EditorDaExplicacao } from "@/components/web/treinamento-servico/editor/EditorDaExplicacao";
import { codigoDaRota, rascunhoDoTreinamento, servicoDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Explicação · Treinamento" };

/** Aba Explicação: a Parte 1 do treinamento (cenário e passos). Abrir aqui cria o rascunho, se ainda não houver. */
export default async function ExplicacaoDoTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [servico, rascunho] = await Promise.all([servicoDoTreinamento(codigo), rascunhoDoTreinamento(codigo)]);
  return <EditorDaExplicacao key={rascunho.versao_id} codigo={codigo} descricao={servico?.descricao ?? codigo} rascunho={rascunho} />;
}
