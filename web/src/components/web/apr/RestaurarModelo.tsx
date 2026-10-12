"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** Desfaz a exclusão (`POST /modelos-apr/{codigo}/restaurar`). As atividades que eram dele não voltam sozinhas. */
export function RestaurarModelo({ codigo, compacto }: { codigo: string; compacto?: boolean }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [ocupado, setOcupado] = useState(false);

  async function restaurar() {
    setOcupado(true);
    try {
      await chamar("POST", `/modelos-apr/${encodeURIComponent(codigo)}/restaurar`);
      exibirAviso(`${codigo} restaurado. Ligue de novo as atividades dele na aba Atividades.`);
      router.refresh();
    } catch (e) {
      exibirAviso(e instanceof Error ? e.message : "Não foi possível restaurar o modelo");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Button variant={compacto ? "line" : "p"} sm onClick={restaurar} disabled={ocupado} style={compacto ? { height: 32 } : undefined}>
      {!compacto && <Icon name="refresh" size={16} />}
      {ocupado ? "Restaurando…" : "Restaurar"}
    </Button>
  );
}
