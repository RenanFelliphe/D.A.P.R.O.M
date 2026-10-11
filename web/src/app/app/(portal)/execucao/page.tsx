import type { Metadata } from "next";
import { ExecucaoScreen } from "@/components/app/execucao/ExecucaoScreen";

export const metadata: Metadata = { title: "Execução" };

export default function ExecucaoPage() {
  return <ExecucaoScreen />;
}
