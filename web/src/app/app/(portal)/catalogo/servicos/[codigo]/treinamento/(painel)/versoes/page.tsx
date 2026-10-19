import type { Metadata } from "next";
import { ListaDeVersoes } from "@/components/web/treinamento-servico/editor/ListaDeVersoes";
import { codigoDaRota, versoesDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Versões · Treinamento" };

/** Aba Versões: o histórico, com quem assinou cada publicação. */
export default async function VersoesDoTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  return <ListaDeVersoes codigo={codigo} versoes={await versoesDoTreinamento(codigo)} />;
}
