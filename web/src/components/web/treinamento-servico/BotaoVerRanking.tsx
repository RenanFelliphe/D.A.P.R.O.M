"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import type { RankingDoTreinamento as Ranking } from "@/lib/treinamento-servico";
import { RankingDoTreinamento } from "./RankingDoTreinamento";

/**
 * "Ver ranking": abre numa janela o ranking do treinamento de um serviço (quem já concluiu, pela nota da primeira
 * conclusão), sem precisar jogar. Fica ao lado de "Jogar treinamento" no cartão do catálogo. Busca ao abrir, para mostrar
 * sempre o ranking de agora.
 */
export function BotaoVerRanking({ codigo, descricao, sm }: { codigo: string; descricao: string; sm?: boolean }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Button variant="line" sm={sm} onClick={() => setAberto(true)}>
        <Icon name="trophy" size={sm ? 13 : 16} />
        Ver ranking
      </Button>
      {aberto && <JanelaDoRanking codigo={codigo} descricao={descricao} aoFechar={() => setAberto(false)} />}
    </>
  );
}

function JanelaDoRanking({ codigo, descricao, aoFechar }: { codigo: string; descricao: string; aoFechar: () => void }) {
  const [ranking, setRanking] = useState<Ranking | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    chamar<Ranking>("GET", `/treinamentos/${encodeURIComponent(codigo)}/ranking`)
      .then((r) => ativo && setRanking(r))
      .catch((e) => ativo && setErro(e instanceof ErroCliente ? e.message : "Não foi possível carregar o ranking agora."));
    return () => {
      ativo = false;
    };
  }, [codigo]);

  return (
    <JanelaSobreposta titulo={`Ranking · ${descricao}`} aoFechar={aoFechar}>
      {erro ? (
        <Notice tone="blq" icon="alert" role="alert">
          {erro}
        </Notice>
      ) : ranking ? (
        <RankingDoTreinamento ranking={ranking} />
      ) : (
        <p className="small" role="status" aria-busy="true">
          Carregando o ranking…
        </p>
      )}
    </JanelaSobreposta>
  );
}
