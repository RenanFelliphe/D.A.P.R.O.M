"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { AssinaturaCanvas } from "@/components/ui/AssinaturaCanvas";
import { Button } from "@/components/ui/Button";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { Notice } from "@/components/ui/Notice";
import { useAvisoDePontos } from "@/components/web/gamificacao/PontosGanhos";
import { chamar, enviarArquivo } from "@/lib/cliente-api";
import { data } from "@/lib/formatar";
import type { RespostaComPontos } from "@/lib/gamificacao";

/** Assinatura do perfil: mostra a atual e permite refazê-la. Vale só para as próximas: as já feitas guardam a imagem que usaram. */
export function MinhaAssinatura({ assinaturaPath, assinaturaEm }: { assinaturaPath: string | null; assinaturaEm: string | null }) {
  const router = useRouter();
  const avisarPontos = useAvisoDePontos();
  const [refazendo, setRefazendo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salva, setSalva] = useState(false);

  async function salvar(imagem: Blob) {
    setErro(null);
    try {
      const arquivoId = await enviarArquivo(imagem, "assinatura");
      const resposta = await chamar<RespostaComPontos>("PUT", "/me/assinatura", { arquivo_id: arquivoId });
      // A primeira assinatura cadastrada pontua (uma vez por conta).
      avisarPontos(resposta);
      setSalva(true);
      setRefazendo(false);
      router.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    }
  }

  return (
    <div className="stack g8">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Minha assinatura</h2>
      <div className="card stack g8">
        {assinaturaPath ? (
          <div className="sig-box" style={{ height: 72 }}>
            <ImagemArquivo id={assinaturaPath} alt="Minha assinatura" style={{ width: "100%", height: 64, objectFit: "contain" }} />
          </div>
        ) : (
          <Notice tone="al" icon="alert">
            Você ainda não cadastrou a assinatura. Sem ela, não dá para participar de uma APR nem assinar o encerramento.
          </Notice>
        )}
        {refazendo ? (
          <>
            <AssinaturaCanvas onSalvar={salvar} rotuloSalvar="Salvar assinatura" />
            <div>
              <Button variant="ghost" sm onClick={() => setRefazendo(false)}>
                Cancelar
              </Button>
            </div>
          </>
        ) : (
          <div className="row between g12">
            <span className="small">
              {assinaturaEm ? `Cadastrada em ${data(assinaturaEm)}. ` : ""}Refazer vale só para as próximas: as já feitas guardam a imagem que usaram.
            </span>
            <Button
              variant="line"
              sm
              onClick={() => {
                setSalva(false);
                setRefazendo(true);
              }}
            >
              {assinaturaPath ? "Refazer assinatura" : "Cadastrar assinatura"}
            </Button>
          </div>
        )}
        {salva && (
          <Notice tone="ok" icon="check">
            Assinatura salva.
          </Notice>
        )}
        {erro && (
          <Notice tone="blq" icon="alert">
            {erro}
          </Notice>
        )}
      </div>
    </div>
  );
}
