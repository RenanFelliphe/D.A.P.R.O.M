import type { Metadata } from "next";
import { BloqueioScreen } from "@/components/app/bloqueio/BloqueioScreen";

export const metadata: Metadata = { title: "APR bloqueada" };

export default function BloqueioPage() {
  return <BloqueioScreen />;
}
