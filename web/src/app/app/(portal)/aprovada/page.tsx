import type { Metadata } from "next";
import { AprovadaScreen } from "@/components/app/aprovada/AprovadaScreen";

export const metadata: Metadata = { title: "APR aprovada" };

export default function AprovadaPage() {
  return <AprovadaScreen />;
}
