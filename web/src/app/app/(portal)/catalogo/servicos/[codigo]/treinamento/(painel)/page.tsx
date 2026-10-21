import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FaixaDaValidacao } from "@/components/web/treinamento-servico/editor/FaixaDaValidacao";
import { VisaoGeral } from "@/components/web/treinamento-servico/editor/VisaoGeral";
import { rotas } from "@/lib/rotas";
import { codigoDaRota, rascunhoSeHouver, reportesDoTreinamento, servicoDoTreinamento, validacaoDoTreinamento, versoesDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Treinamento de serviço" };

/**
 * `/app/catalogo/servicos/{codigo}/treinamento` (admin): a visão geral. Sem nada criado ainda, vai direto para a escolha
 * entre gerar com a Vitória e criar à mão. Não abre rascunho novo só por passar aqui.
 */
export default async function VisaoGeralDoTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [servico, versoes, rascunho, reportes, validacao] = await Promise.all([
    servicoDoTreinamento(codigo),
    versoesDoTreinamento(codigo),
    rascunhoSeHouver(codigo),
    reportesDoTreinamento(codigo),
    validacaoDoTreinamento(codigo),
  ]);
  const publicada = versoes.find((v) => v.estado === "publicada") ?? null;
  const vazio = !rascunho || rascunho.explicacao.length + rascunho.fases.length === 0;
  if (!publicada && vazio) redirect(rotas.app.treinamentoServico(codigo, "criar"));

  return (
    <FaixaDaValidacao codigo={codigo}>
      <VisaoGeral codigo={codigo} descricao={servico?.descricao ?? codigo} rascunho={rascunho} publicada={publicada} problemasAbertos={reportes.filter((r) => !r.tratado_em).length} validacao={validacao} />
    </FaixaDaValidacao>
  );
}
