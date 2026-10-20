"use client";

import { useEffect, useState } from "react";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import type { MaterialDoServico } from "@/lib/catalogo";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { APRESENTACAO_DA_SUGESTAO, type EquipeDoServico, type TipoDeSugestao } from "@/lib/sugestao-materiais";
import { AssistenteDeSugestao } from "./AssistenteDeSugestao";

/**
 * "Sugerir lista" e "Contestar lista" numa janela, a partir do cartão do serviço no catálogo: o mesmo assistente da página
 * de sugerir, sem sair do catálogo. Busca as equipes do serviço ao abrir (a revisão diz para quem a sugestão vai); depois de
 * enviar, fecha e o aviso confirma. Monte só quando for abrir.
 */
export function JanelaDeSugestao({
  tipo,
  codigo,
  descricao,
  atual,
  aoFechar,
}: {
  tipo: TipoDeSugestao;
  codigo: string;
  descricao: string;
  atual: MaterialDoServico[];
  aoFechar: () => void;
}) {
  const [equipes, setEquipes] = useState<EquipeDoServico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    chamar<{ equipes: EquipeDoServico[] }>("GET", `/sugestoes-materiais/equipes?atividade=${encodeURIComponent(codigo)}`)
      .then((r) => ativo && setEquipes(r.equipes))
      .catch((e) => ativo && setErro(e instanceof ErroCliente ? e.message : "Não foi possível abrir agora. Tente de novo."));
    return () => {
      ativo = false;
    };
  }, [codigo]);

  const { titulo, texto } = APRESENTACAO_DA_SUGESTAO[tipo];
  return (
    <JanelaSobreposta titulo={`${titulo} · ${descricao}`} aoFechar={aoFechar} className="dlg-lista-servico">
      <p className="muted small">{texto}</p>
      {erro ? (
        <Notice tone="blq" icon="alert" role="alert">
          {erro}
        </Notice>
      ) : equipes ? (
        <AssistenteDeSugestao tipo={tipo} codigo={codigo} descricao={descricao} atual={atual} equipes={equipes} aoEnviar={aoFechar} />
      ) : (
        <p className="small" role="status" aria-busy="true">
          Carregando…
        </p>
      )}
    </JanelaSobreposta>
  );
}
