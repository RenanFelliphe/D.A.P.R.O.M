"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaModal } from "@/components/web/JanelaModal";
import { FormularioUsuario, type OpcaoEquipe } from "./FormularioUsuario";

/** Botão "Novo usuário" e a janela com o formulário de cadastro. */
export function NovoUsuario({ equipes }: { equipes: OpcaoEquipe[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="p" sm onClick={() => setAberto(true)}>
        <Icon name="plus" size={16} />
        Novo usuário
      </Button>
      {aberto && (
        <JanelaModal titulo="Novo usuário" aoFechar={() => setAberto(false)}>
          <FormularioUsuario equipes={equipes} aoConcluir={() => setAberto(false)} />
        </JanelaModal>
      )}
    </>
  );
}
