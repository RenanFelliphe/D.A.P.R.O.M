import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { cores } from "@/tema/tema";

export type NomeDeIcone = ComponentProps<typeof Ionicons>["name"];

/** Ícone do app (Ionicons, que já vem com o Expo). */
export function Icone({ nome, tamanho = 18, cor = cores.tinta3 }: { nome: NomeDeIcone; tamanho?: number; cor?: string }) {
  return <Ionicons name={nome} size={tamanho} color={cor} />;
}
