import type { Metadata } from "next";
import { PaginaBusca } from "@/components/busca/PaginaBusca";

export const metadata: Metadata = { title: "Busca" };

export default async function BuscaPage({ searchParams }: PageProps<"/web/busca">) {
  return <PaginaBusca area="web" consulta={await searchParams} />;
}
