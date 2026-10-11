import type { Metadata } from "next";
import { SyncScreen } from "@/components/app/sync/SyncScreen";

export const metadata: Metadata = { title: "Fila e sincronização" };

export default function SyncPage() {
  return <SyncScreen />;
}
