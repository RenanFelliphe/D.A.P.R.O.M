"use client";

import { useState } from "react";
import { ErroCliente, ErroDeEvento } from "@/lib/cliente-api";

/** Mensagem para o usuário de qualquer falha de uma chamada à `api` (as da `api` já vêm prontas). */
export function mensagemDoErro(erro: unknown) {
  if (erro instanceof ErroDeEvento || erro instanceof ErroCliente) return erro.message;
  return "Não foi possível falar com o servidor. Tente de novo.";
}

/** Executa uma ação assíncrona guardando o estado de "ocupado" e a mensagem de erro, para mostrá-los na tela. */
export function useAcao() {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<{ mensagem: string; codigo?: string } | null>(null);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro({ mensagem: mensagemDoErro(e), codigo: e instanceof ErroDeEvento ? e.codigo : undefined });
    } finally {
      setOcupado(false);
    }
  }

  return { ocupado, erro, limparErro: () => setErro(null), executar };
}
