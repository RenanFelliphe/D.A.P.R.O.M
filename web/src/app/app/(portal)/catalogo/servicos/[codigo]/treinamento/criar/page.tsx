import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { EscolhaDeCriacao } from "@/components/web/treinamento-servico/editor/EscolhaDeCriacao";
import { rotas } from "@/lib/rotas";
import { codigoDaRota, rascunhoDoTreinamento, servicoDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Criar treinamento" };

/** Criar: a escolha entre gerar o rascunho com a Vitória (e validar depois) e criar à mão. */
export default async function CriarTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [servico, rascunho] = await Promise.all([servicoDoTreinamento(codigo), rascunhoDoTreinamento(codigo)]);
  const temAlgo = rascunho.tem_publicada || rascunho.explicacao.length + rascunho.fases.length > 0;

  return (
    <>
      <Link className="ts-voltar" href={temAlgo ? rotas.app.treinamentoServico(codigo) : rotas.app.catalogo}>
        <Icon name="left" size={16} />
        {temAlgo ? "Voltar à visão geral" : "Voltar ao catálogo"}
      </Link>
      <EscolhaDeCriacao codigo={codigo} descricao={servico?.descricao ?? codigo} rascunho={rascunho} />
    </>
  );
}
