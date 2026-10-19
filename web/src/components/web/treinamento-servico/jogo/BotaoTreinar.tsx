"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import type { RankingDoTreinamento, TentativaAberta, TreinamentoParaJogador } from "@/lib/treinamento-servico";
import { useToast } from "@/state/toast";
import { JanelaDoJogo } from "./JanelaDoJogo";

interface BotaoTreinarProps {
  codigo: string;
  /** A versão publicada já lida pela página; sem ela, o botão busca ao tocar (`GET /treinamentos/{codigo}`). */
  treinamento?: TreinamentoParaJogador;
  jaConcluiu: boolean;
  rotulo?: string;
  variant?: "p" | "line";
  sm?: boolean;
  block?: boolean;
  className?: string;
}

/**
 * "Treinar" / "Jogar de novo": abre o treinamento publicado numa janela por cima da tela, sem sair dela (o cartão do
 * catálogo, a tela de espera e a capa `/treinar`). Ao fechar depois de concluir, a tela atualiza o selo de concluído.
 */
export function BotaoTreinar({ codigo, treinamento, jaConcluiu, rotulo, variant = "p", sm, block, className }: BotaoTreinarProps) {
  const roteador = useRouter();
  const exibirAviso = useToast();
  const [aberto, setAberto] = useState<TreinamentoParaJogador | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    if (treinamento) {
      setAberto(treinamento);
      return;
    }
    setCarregando(true);
    try {
      setAberto(await chamar<TreinamentoParaJogador>("GET", `/treinamentos/${encodeURIComponent(codigo)}`));
    } catch (e) {
      exibirAviso(e instanceof ErroCliente ? e.message : "Não foi possível abrir o treinamento agora.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <Button variant={variant} sm={sm} block={block} className={className} onClick={abrir} disabled={carregando} aria-busy={carregando}>
        <Icon name="play" size={sm ? 13 : 16} fill />
        {carregando ? "Abrindo…" : (rotulo ?? (jaConcluiu ? "Jogar de novo" : "Treinar"))}
      </Button>
      {aberto && (
        <JanelaDoJogo
          atividadeCodigo={aberto.atividade_codigo}
          descricao={aberto.descricao}
          explicacao={aberto.explicacao}
          totalFases={aberto.total_fases}
          cenarioPath={aberto.cenario_path}
          assinadoPor={aberto.publicada_por_nome}
          assinadoEm={aberto.publicada_em}
          jaConcluiu={jaConcluiu}
          pontua
          abrirTentativa={() => chamar<TentativaAberta>("POST", `/treinamentos/${encodeURIComponent(aberto.atividade_codigo)}/tentativas`)}
          carregarRanking={() => chamar<RankingDoTreinamento>("GET", `/treinamentos/${encodeURIComponent(aberto.atividade_codigo)}/ranking`)}
          aoFechar={(concluiu) => {
            setAberto(null);
            if (concluiu) roteador.refresh();
          }}
        />
      )}
    </>
  );
}
