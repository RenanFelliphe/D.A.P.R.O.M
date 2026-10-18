"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/**
 * Reativar a conta de quem foi readmitido, em um clique, direto do aviso (`PATCH /usuarios/{id}` com `ativo: true`). A `api`
 * confere o registro de funcionários de novo: se a pessoa voltou a ser desligada ou está afastada, a recusa aparece aqui.
 */
export function BotaoReativarConta({ usuarioId, nome }: { usuarioId: string; nome: string }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function reativar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PATCH", `/usuarios/${usuarioId}`, { ativo: true });
      exibirAviso(`${nome} foi reativado(a): a pessoa já pode entrar de novo.`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reativar a conta");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="stack g8">
      <div className="row wrap g8">
        <Button variant="p" onClick={reativar} disabled={ocupado}>
          {ocupado ? "Reativando…" : "Reativar a conta"}
        </Button>
      </div>
      {erro && (
        <Notice tone="blq" icon="alert" style={{ fontSize: 14 }}>
          {erro}
        </Notice>
      )}
    </div>
  );
}
