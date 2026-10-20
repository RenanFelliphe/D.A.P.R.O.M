"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { destinoDaSugestao, ListaDeEquipes } from "./ListaDeEquipes";
import type { EquipeDoServico } from "@/lib/sugestao-materiais";

/**
 * "Equipes do serviço": abre numa janela as equipes que fazem o serviço, com a responsável em destaque (a que recebe as
 * sugestões e as contestações da lista de materiais). Busca ao abrir, para mostrar o ranking de agora.
 */
export function BotaoEquipesDoServico({ codigo, descricao, sm }: { codigo: string; descricao: string; sm?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="line" sm={sm} onClick={() => setAberto(true)}>
        <Icon name="users" size={sm ? 13 : 16} />
        Equipes do serviço
      </Button>
      {aberto && <JanelaDasEquipes codigo={codigo} descricao={descricao} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function JanelaDasEquipes({ codigo, descricao, aoFechar }: { codigo: string; descricao: string; aoFechar: () => void }) {
  const [equipes, setEquipes] = useState<EquipeDoServico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    chamar<{ equipes: EquipeDoServico[] }>("GET", `/sugestoes-materiais/equipes?atividade=${encodeURIComponent(codigo)}`)
      .then((r) => ativo && setEquipes(r.equipes))
      .catch((e) => ativo && setErro(e instanceof ErroCliente ? e.message : "Não foi possível carregar as equipes agora."));
    return () => {
      ativo = false;
    };
  }, [codigo]);

  return (
    <JanelaSobreposta titulo={`Equipes · ${descricao}`} aoFechar={aoFechar}>
      {erro ? (
        <Notice tone="blq" icon="alert" role="alert">
          {erro}
        </Notice>
      ) : equipes ? (
        <div className="stack g12">
          <p className="small muted">{destinoDaSugestao(equipes)} Entre as equipes com o mesmo número de OS, vale a de mais pontos.</p>
          <ListaDeEquipes equipes={equipes} />
        </div>
      ) : (
        <p className="small" role="status" aria-busy="true">
          Carregando as equipes…
        </p>
      )}
    </JanelaSobreposta>
  );
}
