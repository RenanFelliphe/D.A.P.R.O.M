"use client";

import { useState } from "react";
import { AssinaturaCanvas } from "@/components/ui/AssinaturaCanvas";
import { Notice } from "@/components/ui/Notice";
import { chamar, enviarArquivo, ErroCliente } from "@/lib/cliente-api";

/**
 * Quem está logado e ainda não tem assinatura no perfil desenha na hora: a imagem sobe (`PUT /arquivos/{id}`) e vira a
 * assinatura do perfil (`PUT /me/assinatura`); vale para esta APR e para as próximas.
 */
export function CadastrarAssinatura({ aoSalvar }: { aoSalvar: (arquivoId: string) => void }) {
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(imagem: Blob) {
    setErro(null);
    try {
      const arquivoId = await enviarArquivo(imagem, "assinatura");
      await chamar("PUT", "/me/assinatura", { arquivo_id: arquivoId });
      aoSalvar(arquivoId);
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível salvar a assinatura. Tente de novo.");
    }
  }

  return (
    <div className="stack g8">
      <p className="muted">Você ainda não tem assinatura cadastrada. Desenhe-a abaixo: ela fica no seu perfil e vale para esta APR e para as próximas.</p>
      <AssinaturaCanvas onSalvar={salvar} rotuloSalvar="Salvar minha assinatura" />
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
    </div>
  );
}
