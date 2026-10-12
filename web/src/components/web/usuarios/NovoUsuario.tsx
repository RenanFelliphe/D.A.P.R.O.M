"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { ModoUsuarios } from "@/data/usuarios";
import { JanelaModal } from "@/components/web/JanelaModal";
import { FormularioUsuario, type OpcaoEquipe } from "./FormularioUsuario";

/** Botão "Novo usuário" (admin) ou "Novo técnico" (supervisor) e a janela com o formulário de cadastro. */
export function NovoUsuario({ equipes, modo = "admin" }: { equipes: OpcaoEquipe[]; modo?: ModoUsuarios }) {
  const [aberto, setAberto] = useState(false);
  const rotulo = modo === "supervisor" ? "Novo técnico" : "Novo usuário";
  return (
    <>
      <Button variant="p" sm onClick={() => setAberto(true)}>
        <Icon name="plus" size={16} />
        {rotulo}
      </Button>
      {aberto && (
        <JanelaModal titulo={rotulo} aoFechar={() => setAberto(false)}>
          <FormularioUsuario equipes={equipes} modo={modo} aoConcluir={() => setAberto(false)} />
        </JanelaModal>
      )}
    </>
  );
}
