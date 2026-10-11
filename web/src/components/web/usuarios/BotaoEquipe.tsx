"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaModal } from "@/components/web/JanelaModal";
import { FormularioEquipe, type OpcaoSupervisor } from "./FormularioEquipe";

interface BotaoEquipeProps {
  supervisores: OpcaoSupervisor[];
  /** Sem `equipe`, é o botão "Nova equipe"; com ela, "Editar". */
  equipe?: { id: string; nome: string; centro_trabalho: string; supervisor_id: string | null };
}

/** Botão que abre a janela de criar ou editar uma equipe. */
export function BotaoEquipe({ supervisores, equipe }: BotaoEquipeProps) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="line" sm style={{ height: 32 }} onClick={() => setAberto(true)}>
        {equipe ? (
          "Editar"
        ) : (
          <>
            <Icon name="plus" size={16} />
            Nova equipe
          </>
        )}
      </Button>
      {aberto && (
        <JanelaModal titulo={equipe ? `Editar ${equipe.nome}` : "Nova equipe"} aoFechar={() => setAberto(false)}>
          <FormularioEquipe equipe={equipe} supervisores={supervisores} aoConcluir={() => setAberto(false)} />
        </JanelaModal>
      )}
    </>
  );
}
