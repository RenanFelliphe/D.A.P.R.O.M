"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { AssinaturaCanvas } from "@/components/ui/AssinaturaCanvas";
import { Notice } from "@/components/ui/Notice";
import { useAvisoDePontos } from "@/components/web/gamificacao/PontosGanhos";
import { chamar, enviarArquivo } from "@/lib/cliente-api";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";

/** Cadastro da assinatura, a primeira coisa depois da liberação: desenha, envia a imagem e grava no perfil (`PUT /me/assinatura`). */
export function FormularioAssinatura() {
  const router = useRouter();
  const avisarPontos = useAvisoDePontos();
  const [erro, setErro] = useState<string | null>(null);

  async function salvar(imagem: Blob) {
    setErro(null);
    try {
      const arquivoId = await enviarArquivo(imagem, "assinatura");
      const resposta = await chamar<RespostaComPontos>("PUT", "/me/assinatura", { arquivo_id: arquivoId });
      // A primeira assinatura cadastrada pontua o técnico (uma vez por conta).
      avisarPontos(resposta);
      router.replace(rotas.app.lista);
      router.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    }
  }

  return (
    <div className="stack g12">
      <h2>Cadastre a sua assinatura</h2>
      <p className="muted">
        É o primeiro passo para usar o sistema: ela valida o que você faz, como aplicar uma APR, encerrar uma execução ou dar ciência
        numa OS. Desenhe com o mouse, a caneta ou o dedo. Você poderá refazê-la no perfil, e as ações já assinadas guardam a imagem que usaram.
      </p>
      <AssinaturaCanvas onSalvar={salvar} rotuloSalvar="Salvar e continuar" />
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
    </div>
  );
}
