"use client";

import { Icon } from "@/components/ui/Icon";
import type { Equipe } from "@/lib/tipos";
import { FormularioNovaOs } from "@/components/web/os-nova/FormularioNovaOs";
import type { Atividade, LocalEscolhido } from "@/components/web/os-nova/tipos";

interface CartaoApoioProps {
  osId: string;
  numeroOrdem: string | null;
  tituloDaOs: string;
  local: LocalEscolhido;
  equipes: Equipe[];
  atividades: Atividade[];
  hoje: string;
  /** Equipe do usuário, se ele é supervisor: só ele abre OS da própria equipe pelo link da confirmação. */
  equipeDoSupervisor: string | null;
}

/** Cartão de decisão "Abrir OS de apoio" (destaque principal): `POST /os` com `os_origem_id` apontando para a OS do alerta. */
export function CartaoApoio({ osId, numeroOrdem, tituloDaOs, local, equipes, atividades, hoje, equipeDoSupervisor }: CartaoApoioProps) {
  const referencia = numeroOrdem ? `OS ${numeroOrdem}` : "OS de origem";
  return (
    <div className="dcard main">
      <div className="hd">
        <span className="ic">
          <Icon name="users" size={16} />
        </span>
        <h4>Abrir OS de apoio</h4>
      </div>
      <p className="muted">
        Outra equipe resolve antes. A OS original continua pendente e você recebe um aviso quando o apoio terminar.
      </p>
      <FormularioNovaOs
        prefixo="ap"
        equipes={equipes}
        atividades={atividades}
        osOrigemId={osId}
        localInicial={local}
        tituloInicial={`Apoio à ${referencia}: ${tituloDaOs}`}
        descricaoInicial={`Apoio para liberar a ${referencia}.`}
        hoje={hoje}
        rotuloEnviar="Criar OS de apoio"
        mensagemCriada="OS de apoio criada. A original continua pendente."
        podeAbrirOs={(equipeId) => equipeDoSupervisor === null || equipeId === equipeDoSupervisor}
      />
    </div>
  );
}
