"use client";

import { Icon } from "@/components/ui/Icon";
import type { Equipe } from "@/lib/tipos";
import { FormularioApoio } from "@/components/web/apoio/FormularioApoio";
import type { Atividade, LocalEscolhido } from "@/components/web/apoio/tipos";

interface CartaoApoioProps {
  osId: string;
  numeroOrdem: string | null;
  tituloDaOs: string;
  /** Como a OS original fica enquanto o apoio resolve ("pendente", "liberada"). */
  situacaoDaOriginal: string;
  local: LocalEscolhido;
  equipes: Equipe[];
  atividades: Atividade[];
  hoje: string;
  /** Equipes do usuário, se ele é supervisor: só ele abre OS de uma delas pelo link da confirmação. */
  equipesDoSupervisor: string[] | null;
}

/** Cartão de decisão "Abrir OS de apoio" (destaque principal): `POST /os` com `os_origem_id` apontando para a OS original. */
export function CartaoApoio({ osId, numeroOrdem, tituloDaOs, situacaoDaOriginal, local, equipes, atividades, hoje, equipesDoSupervisor }: CartaoApoioProps) {
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
        Outra equipe resolve antes. A OS original continua {situacaoDaOriginal} e você recebe um aviso quando o apoio terminar.
      </p>
      <FormularioApoio
        prefixo="ap"
        equipes={equipes}
        atividades={atividades}
        osOrigemId={osId}
        localInicial={local}
        tituloInicial={`Apoio à ${referencia}: ${tituloDaOs}`}
        descricaoInicial={`Apoio para liberar a ${referencia}.`}
        hoje={hoje}
        rotuloEnviar="Criar OS de apoio"
        mensagemCriada={`OS de apoio criada. A original continua ${situacaoDaOriginal}.`}
        podeAbrirOs={(equipeId) => equipesDoSupervisor === null || equipesDoSupervisor.includes(equipeId)}
      />
    </div>
  );
}
