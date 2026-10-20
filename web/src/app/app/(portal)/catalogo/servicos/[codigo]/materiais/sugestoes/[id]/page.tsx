import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { AvaliacaoDaSugestao } from "@/components/web/sugestao/AvaliacaoDaSugestao";
import { rotas } from "@/lib/rotas";
import { sugestaoDeMateriais } from "@/lib/sugestao-materiais-servidor";
import { codigoDaRota } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Sugestão de materiais" };

/** Uma sugestão ou contestação: o que muda na lista e, para quem avalia, aceitar, ajustar ou recusar. */
export default async function SugestaoDeMateriaisPage({ params }: { params: Promise<{ codigo: string; id: string }> }) {
  const { codigo: codigoBruto, id } = await params;
  const codigo = codigoDaRota(codigoBruto);
  const sugestao = await sugestaoDeMateriais(id);
  if (!sugestao) notFound();
  // O endereço sempre leva ao serviço certo: a sugestão manda no código.
  if (sugestao.atividade_codigo !== codigo) redirect(rotas.app.sugestaoDeMateriais(sugestao.atividade_codigo, sugestao.id));

  return (
    <>
      <Link className="ts-voltar" href={rotas.app.sugestoesDeMateriais}>
        <Icon name="left" size={16} />
        Voltar às sugestões
      </Link>
      <AvaliacaoDaSugestao sugestao={sugestao} />
    </>
  );
}
