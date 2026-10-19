import type { Metadata } from "next";
import { ListaDeProblemas } from "@/components/web/treinamento-servico/editor/ListaDeProblemas";
import { codigoDaRota, reportesDoTreinamento } from "@/lib/treinamento-servico-servidor";

export const metadata: Metadata = { title: "Problemas reportados · Treinamento" };

/** Aba Problemas: o que os técnicos reportaram nas fases deste treinamento. */
export default async function ProblemasDoTreinamentoPage({ params }: { params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  return <ListaDeProblemas reportes={await reportesDoTreinamento(codigo)} />;
}
