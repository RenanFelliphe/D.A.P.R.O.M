"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaModal } from "@/components/web/JanelaModal";
import type { SituacaoDoCiclo } from "@/lib/preventivas";
import { PainelPreventivas } from "./PainelPreventivas";

interface BotaoPreventivasProps {
  /** Vencidas + próximas do vencimento: o selo do botão. */
  atencao: number;
  /** A equipe filtrada no quadro (a janela abre só com os planos dela). */
  equipeId?: string;
  /** Abre a janela ao carregar (`?preventivas=1`, o atalho do alerta de ciclo). */
  abrirAoCarregar?: boolean;
  situacaoInicial?: SituacaoDoCiclo;
}

/** Botão "OS preventivas" do quadro: abre a janela com o tempo até o próximo ciclo de cada preventiva. */
export function BotaoPreventivas({ atencao, equipeId, abrirAoCarregar = false, situacaoInicial }: BotaoPreventivasProps) {
  const [aberta, setAberta] = useState(abrirAoCarregar);
  return (
    <>
      <Button variant="line" sm onClick={() => setAberta(true)} aria-haspopup="dialog">
        <Icon name="clock" size={16} />
        OS preventivas
        {atencao > 0 && (
          <span className="prev-selo" aria-label={`${atencao} pedem atenção`}>
            {atencao}
          </span>
        )}
      </Button>
      {aberta && (
        <JanelaModal titulo="OS preventivas: intervalo entre ciclos" aoFechar={() => setAberta(false)} className="dlg-preventivas">
          <PainelPreventivas equipeId={equipeId} situacaoInicial={situacaoInicial} />
        </JanelaModal>
      )}
    </>
  );
}
