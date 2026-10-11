"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { FormularioNovaOs } from "@/components/web/os-nova/FormularioNovaOs";
import type { Atividade } from "@/components/web/os-nova/tipos";
import { Panel } from "@/components/web/Panel";
import type { Equipe } from "@/lib/tipos";

/** Cria uma OS que ainda não está no SAP (corretiva urgente): o local vem do cadastro ou é cadastrado ali mesmo. */
export function OsManual({ equipes, atividades, hoje }: { equipes: Equipe[]; atividades: Atividade[]; hoje: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <Panel style={{ gap: 10 }}>
      <h2>OS fora do SAP</h2>
      <p className="muted">
        Para uma corretiva urgente que ainda não está no SAP, crie a OS manualmente. Ela entra no quadro e fica disponível para a equipe.
      </p>
      {aberto ? (
        <>
          <FormularioNovaOs
            prefixo="om"
            equipes={equipes}
            atividades={atividades}
            hoje={hoje}
            permitirNovoLocal
            mostrarSolicitante
            rotuloEnviar="Criar OS manual"
            mensagemCriada="OS manual criada e liberada para a equipe."
            podeAbrirOs={() => true}
          />
          <div>
            <Button variant="ghost" sm onClick={() => setAberto(false)}>
              Fechar o formulário
            </Button>
          </div>
        </>
      ) : (
        <Button variant="line" sm onClick={() => setAberto(true)}>
          <Icon name="plus" size={16} />
          Nova OS manual
        </Button>
      )}
    </Panel>
  );
}
