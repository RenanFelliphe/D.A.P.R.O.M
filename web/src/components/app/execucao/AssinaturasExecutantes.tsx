"use client";

import { useState } from "react";
import { AssinaturaCanvas } from "@/components/ui/AssinaturaCanvas";
import { Button } from "@/components/ui/Button";
import { Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { chamar, enviarArquivo } from "@/lib/cliente-api";
import type { ParticipanteDaApr } from "./tempo";
import { mensagemDoErro } from "./useAcao";

interface AssinaturasExecutantesProps {
  participantes: ParticipanteDaApr[];
  /** Quem está logado: só ele pode desenhar a assinatura na hora, se ainda não tiver. */
  usuarioId: string;
  /** Assinatura atual do perfil de quem está logado. */
  minhaAssinatura: string | null;
  onMinhaAssinatura: (arquivoId: string) => void;
  /** Ids dos participantes que já confirmaram a assinatura. */
  confirmadas: Set<string>;
  onAlternar: (usuarioId: string) => void;
  desabilitado?: boolean;
}

/** Assinaturas de todos os participantes da APR: cada um confirma com a assinatura que tem no perfil. */
export function AssinaturasExecutantes({ participantes, usuarioId, minhaAssinatura, onMinhaAssinatura, confirmadas, onAlternar, desabilitado }: AssinaturasExecutantesProps) {
  const [erro, setErro] = useState<string | null>(null);

  async function salvarMinha(imagem: Blob) {
    setErro(null);
    try {
      const arquivoId = await enviarArquivo(imagem, "assinatura");
      await chamar("PUT", "/me/assinatura", { arquivo_id: arquivoId });
      onMinhaAssinatura(arquivoId);
    } catch (e) {
      setErro(mensagemDoErro(e));
    }
  }

  return (
    <div className="field">
      <div className="row between">
        <label>
          Assinaturas dos executantes <Req style={{ color: "var(--exe)" }}>· de todos</Req>
        </label>
        <span className="small">
          {confirmadas.size} de {participantes.length} confirmadas
        </span>
      </div>
      {participantes.map((p) => {
        const eu = p.usuario_id === usuarioId;
        const assinatura = eu ? minhaAssinatura : p.assinatura_path;
        const confirmada = confirmadas.has(p.usuario_id);
        return (
          <div key={p.usuario_id} className="sig">
            {assinatura ? (
              <div className="sig-box" style={confirmada ? undefined : { opacity: 0.55 }}>
                <ImagemArquivo id={assinatura} alt={`Assinatura de ${p.nome}`} style={{ width: "100%", height: 56, objectFit: "contain" }} />
              </div>
            ) : eu ? (
              <div className="stack g8">
                <span className="small">Você ainda não tem assinatura no perfil. Desenhe-a agora; ela fica guardada para as próximas.</span>
                <AssinaturaCanvas onSalvar={salvarMinha} rotuloSalvar="Salvar minha assinatura" />
              </div>
            ) : (
              <div className="sig-box pend">
                <span className="small">Sem assinatura cadastrada</span>
              </div>
            )}
            <div className="who row between g12">
              <span>
                {p.nome} · mat. {p.matricula} · {p.funcao === "responsavel" ? "responsável" : "executor"}
              </span>
              {assinatura ? (
                <Button variant={confirmada ? "line" : "p"} sm onClick={() => onAlternar(p.usuario_id)} disabled={desabilitado}>
                  {confirmada ? (
                    <>
                      <Icon name="check" size={16} /> Confirmada
                    </>
                  ) : (
                    "Confirmar assinatura"
                  )}
                </Button>
              ) : (
                !eu && (
                  <span className="small" style={{ color: "var(--blq)" }}>
                    {p.nome.split(" ")[0]} precisa cadastrar a assinatura no perfil para encerrar.
                  </span>
                )
              )}
            </div>
          </div>
        );
      })}
      {erro && (
        <span className="small" role="alert" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
