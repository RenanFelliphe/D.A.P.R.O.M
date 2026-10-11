import type { Metadata } from "next";
import { AlertasScreen } from "@/components/web/alertas/AlertasScreen";

export const metadata: Metadata = { title: "Alertas e impedimento" };

export default function AlertasPage() {
  return <AlertasScreen />;
}
