import type { Metadata } from "next";
import { ListaCabecalho } from "@/components/app/lista/ListaCabecalho";
import { ListaOsFiltravel } from "@/components/app/lista/ListaOsFiltravel";
import { Screen } from "@/components/ui/Screen";

export const metadata: Metadata = { title: "OS da equipe" };

export default function ListaPage() {
  return (
    <Screen>
      <ListaCabecalho />
      <ListaOsFiltravel />
    </Screen>
  );
}
