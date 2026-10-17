"use client";

import { useState } from "react";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Icon } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import { textoDosPontosGanhos, type RespostaComPontos } from "@/lib/gamificacao";
import { useMinhaAssinatura } from "@/state/minha-assinatura";
import { useToast } from "@/state/toast";

/**
 * "Dar ciência" do supervisor da equipe, na OS encerrada (`POST /os/{id}/ciencia`): ele assina com a assinatura do perfil, que vai
 * para o PDF da OS. Depois a tela recarrega com "Ciente em…".
 */
export function BotaoCiencia({ osId }: { osId: string }) {
  const exibirAviso = useToast();
  const assinaturaPath = useMinhaAssinatura();
  const [aberta, setAberta] = useState(false);

  async function darCiencia() {
    const resposta = await chamar<RespostaComPontos>("POST", `/os/${osId}/ciencia`);
    // Ciência até 72 h depois do encerramento pontua o supervisor.
    const pontos = textoDosPontosGanhos(resposta);
    if (pontos) exibirAviso(`Ciência registrada · ${pontos}`);
  }

  return (
    <>
      <button className="btn btn-p btn-sm" type="button" onClick={() => setAberta(true)} style={{ alignSelf: "flex-start" }}>
        <Icon name="check" size={16} />
        Assinar e dar ciência
      </button>
      {aberta && (
        <JanelaDeAssinatura
          titulo="Dar ciência"
          resumo="Você viu a execução desta OS e dá ciência dela. A sua assinatura vai para o PDF da OS, que é gerado de novo."
          rotuloConfirmar="Assinar e dar ciência"
          assinaturaPath={assinaturaPath}
          aoConfirmar={darCiencia}
          aoFechar={() => setAberta(false)}
        />
      )}
    </>
  );
}
