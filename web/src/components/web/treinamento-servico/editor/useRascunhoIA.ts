"use client";

import { useState } from "react";
import { chamarEmStream, ErroCliente } from "@/lib/cliente-api";
import type { PedidoDoPlano, ProgressoDaIA, ResultadoDaIA, SituacaoIA } from "@/lib/treinamento-servico";
import type { FalhaDaIA } from "./falhaDaIA";

export interface MensagemDoChatIA {
  de: "admin" | "vitoria";
  texto: string;
}

interface OpcoesDoRascunhoIA {
  /** Ajustar e regerar partem do rascunho gravado: grava as edições da tela antes de pedir. */
  salvarAntes?: () => Promise<boolean>;
  aoConcluir: (resultado: ResultadoDaIA) => void;
}

/**
 * O rascunho de treinamento pela IA (seção 9 do `docs/gamificacao-e-treinamentos.md`): gerar a partir do texto do procedimento, pedir ajustes no
 * chat e regerar uma fase, pelas rotas em streaming da `api`. Guarda o progresso ("Montando a fase 5 de 10…"), quando
 * começou, o erro e a conversa do chat (só na tela: o servidor guarda o rascunho, não a conversa).
 */
export function useRascunhoIA(codigo: string, situacaoInicial: SituacaoIA, { salvarAntes, aoConcluir }: OpcoesDoRascunhoIA) {
  const [situacao, setSituacao] = useState(situacaoInicial);
  const [progresso, setProgresso] = useState<ProgressoDaIA | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [inicio, setInicio] = useState<number | null>(null);
  const [erro, setErro] = useState<FalhaDaIA | null>(null);
  const [conversa, setConversa] = useState<MensagemDoChatIA[]>([]);

  async function chamarIA(acao: "gerar" | "ajustar", corpo: object, pedidoNoChat: string | null) {
    setErro(null);
    setProgresso(null);
    setInicio(Date.now());
    setTrabalhando(true);
    if (pedidoNoChat) setConversa((atual) => [...atual, { de: "admin", texto: pedidoNoChat }]);
    let terminou = false;
    try {
      await chamarEmStream(`/treinamentos/${encodeURIComponent(codigo)}/rascunho/${acao}`, corpo, (evento) => {
        if (terminou) return;
        const dados = JSON.parse(evento.data);
        if (evento.event === "progresso") {
          setProgresso(dados as ProgressoDaIA);
        } else if (evento.event === "final") {
          terminou = true;
          const resultado = dados as ResultadoDaIA;
          setSituacao(resultado.ia);
          const foraDoFormato = resultado.descartados > 0 ? ` ${resultado.descartados === 1 ? "1 item veio" : `${resultado.descartados} itens vieram`} fora do formato e ficou de fora.` : "";
          setConversa((atual) => [...atual, { de: "vitoria", texto: `${resultado.resumo}${foraDoFormato}` }]);
          aoConcluir(resultado);
        } else if (evento.event === "erro") {
          terminou = true;
          setErro(dados as FalhaDaIA);
        }
      });
      if (!terminou) setErro({ codigo: "conexao", mensagem: "A conexão caiu antes do fim. Se a Vitória terminou, o rascunho já está gravado: recarregue a página." });
    } catch (e) {
      setErro(e instanceof ErroCliente ? { codigo: e.codigo, mensagem: e.message } : { codigo: "conexao", mensagem: "Não foi possível falar com o servidor do SYNQ OS agora." });
    } finally {
      setTrabalhando(false);
    }
  }

  return {
    situacao,
    progresso,
    trabalhando,
    inicio,
    erro,
    conversa,
    limparErro: () => setErro(null),
    /** Substitui a explicação e as fases do rascunho pelo que a IA montar a partir do texto. */
    gerar: async (texto: string, plano?: (PedidoDoPlano | null)[]) => {
      setConversa([]);
      await chamarIA("gerar", { texto, plano: plano ?? null }, null);
    },
    ajustar: async (pedido: string) => {
      if (!salvarAntes || (await salvarAntes())) await chamarIA("ajustar", { pedido }, pedido);
    },
    regerarFase: async (indice: number) => {
      if (!salvarAntes || (await salvarAntes())) await chamarIA("ajustar", { fase: indice }, `Refazer a fase ${indice + 1}`);
    },
  };
}

export type RascunhoIA = ReturnType<typeof useRascunhoIA>;
