import type { Metadata } from "next";
import { ChecklistScreen } from "@/components/app/checklist/ChecklistScreen";

export const metadata: Metadata = { title: "Checklist da APR" };

export default function ChecklistPage() {
  return <ChecklistScreen />;
}
