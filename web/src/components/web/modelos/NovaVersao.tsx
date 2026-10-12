"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";

/** Cria o rascunho da versão seguinte copiando a publicada (`POST /modelos-apr/{codigo}/versoes` sem corpo) e abre o editor. */
export function NovaVersao({ codigo }: { codigo: string }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setOcupado(true);
    setErro(null);
    try {
      const criada = await chamar<{ id: string; versao: number }>("POST", `/modelos-apr/${encodeURIComponent(codigo)}/versoes`, {});
      exibirAviso(`Rascunho da v${criada.versao} criado a partir da versão em uso.`);
      router.push(rotas.web.modelo(codigo, criada.versao));
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a nova versão");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="stack g8" style={{ alignItems: "flex-end" }}>
      <Button variant="p" sm onClick={criar} disabled={ocupado}>
        <Icon name="plus" size={16} />
        {ocupado ? "Criando…" : "Nova versão"}
      </Button>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
    </div>
  );
}
