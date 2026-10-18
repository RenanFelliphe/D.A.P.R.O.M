"use client";

import { useState } from "react";
import { chamarEmStream, ErroCliente } from "@/lib/cliente-api";
import type { ProgressoDaIA, ResultadoDaIA, SituacaoIA } from "@/lib/treinamento-servico";

export interface MensagemDoChatIA {
  de: "admin" | "vitoria";
  texto: string;
}

/**
 * O rascunho de treinamento pela IA no editor (seção 3.6 do `vitoria.md`): gerar a partir do texto do procedimento, pedir
 * ajustes no chat e regerar uma fase, pelas rotas em streaming da `api`. Guarda o progresso ("Montando a fase 5 de 10…"),
 * o erro e a conversa do chat (só na tela: o servidor guarda o rascunho, não a conversa). Ajustar e regerar partem do
 * rascunho gravado, então `salvarAntes` grava as edições da tela primeiro.
 */
export function useRascunhoIA(codigo: string, situacaoInicial: SituacaoIA, salvarAntes: () => Promise<boolean>, aoConcluir: (resultado: ResultadoDaIA) => void) {
  const [situacao, setSituacao] = useState(situacaoInicial);
  const [progresso, setProgresso] = useState<ProgressoDaIA | null>(null);
  const [trabalhando, setTrabalhando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [conversa, setConversa] = useState<MensagemDoChatIA[]>([]);

  async function chamarIA(acao: "gerar" | "ajustar", corpo: object, pedidoNoChat: string | null) {
    setErro(null);
    setProgresso(null);
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
          const foraDoFormato = resultado.descartados > 0 ? ` ${resultado.descartados} item(ns) vieram fora do formato e ficaram de fora.` : "";
          setConversa((atual) => [...atual, { de: "vitoria", texto: `${resultado.resumo}${foraDoFormato}` }]);
          aoConcluir(resultado);
        } else if (evento.event === "erro") {
          terminou = true;
          setErro((dados as { mensagem: string }).mensagem);
        }
      });
      if (!terminou) setErro("A conexão caiu antes do fim. Se a Vitória terminou, o rascunho já está gravado: recarregue a página.");
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível falar com o servidor agora.");
    } finally {
      setTrabalhando(false);
      setProgresso(null);
    }
  }

  return {
    situacao,
    progresso,
    trabalhando,
    erro,
    conversa,
    /** Substitui a explicação e as fases do rascunho pelo que a IA montar a partir do texto. */
    gerar: async (texto: string) => {
      setConversa([]);
      await chamarIA("gerar", { texto }, null);
    },
    ajustar: async (pedido: string) => {
      if (await salvarAntes()) await chamarIA("ajustar", { pedido }, pedido);
    },
    regerarFase: async (indice: number) => {
      if (await salvarAntes()) await chamarIA("ajustar", { fase: indice }, `Refazer a fase ${indice + 1}`);
    },
  };
}

export type RascunhoIA = ReturnType<typeof useRascunhoIA>;
