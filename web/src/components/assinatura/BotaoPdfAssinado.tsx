"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import { abrirAbaDeAssinatura, levarAbaParaAAssinatura } from "./useEsperarAssinatura";

/** "Baixar PDF assinado": pergunta à `api` onde está o PDF guardado (`GET /assinaturas-juridicas/{id}/pdf`, endereço de poucos minutos) e o abre em outra aba. */
export function BotaoPdfAssinado({ id }: { id: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function abrir() {
    setErro(null);
    // A aba abre já, no clique: depois da consulta à `api` o navegador a barraria.
    const aba = abrirAbaDeAssinatura("Abrindo o PDF assinado…");
    setOcupado(true);
    try {
      const { url } = await chamar<{ url: string }>("GET", `/assinaturas-juridicas/${id}/pdf`);
      levarAbaParaAAssinatura(aba, url);
    } catch (e) {
      aba?.close();
      setErro(e instanceof Error ? e.message : "Não foi possível abrir o PDF assinado.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <span className="stack g4">
      <Button variant="line" sm onClick={() => void abrir()} disabled={ocupado} aria-busy={ocupado}>
        <Icon name="download" size={16} />
        Baixar PDF assinado
      </Button>
      {erro && (
        <span className="small" role="alert">
          {erro}
        </span>
      )}
    </span>
  );
}
