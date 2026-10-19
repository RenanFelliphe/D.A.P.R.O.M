import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { ErroDeEvento } from "@shared/api/eventos";
import { ErroDaApi, mensagemDoErro } from "@/api/erros";

export interface FalhaDaAcao {
  mensagem: string;
  /** O código da `api` (`continuar_invalido`, `apr_sem_assinaturas`…), quando a falha veio dela. */
  codigo?: string;
}

/** A falha de uma chamada à `api` como o app a mostra: o texto pronto e, se veio da `api`, o código. */
export function falhaDe(e: unknown): FalhaDaAcao {
  return { mensagem: mensagemDoErro(e), codigo: e instanceof ErroDeEvento || e instanceof ErroDaApi ? e.codigo : undefined };
}

/**
 * Executa uma ação assíncrona guardando o "ocupado" e a falha, para a tela mostrá-los. Duas falhas mudam o destino da pessoa e por isso
 * recarregam `GET /me`: a assinatura que ainda não existe (`assinatura_pendente`) e a ausência que começou (`usuario_ausente`).
 */
export function useAcao() {
  const consultas = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<FalhaDaAcao | null>(null);

  const executar = useCallback(
    async (acao: () => Promise<void>) => {
      setOcupado(true);
      setErro(null);
      try {
        await acao();
      } catch (e) {
        const falha = falhaDe(e);
        setErro(falha);
        if (falha.codigo === "assinatura_pendente" || falha.codigo === "usuario_ausente") void consultas.invalidateQueries({ queryKey: ["eu"] });
      } finally {
        setOcupado(false);
      }
    },
    [consultas],
  );

  return { ocupado, erro, limparErro: useCallback(() => setErro(null), []), executar };
}

/** Depois de um evento de campo, o que a tela mostrava (a OS, as faixas da lista, as APRs a assinar, a pontuação) está velho. */
export function useAtualizarDepoisDoEvento() {
  const consultas = useQueryClient();
  return useCallback(
    () => Promise.all([consultas.invalidateQueries({ queryKey: ["os"] }), consultas.invalidateQueries({ queryKey: ["me"] }), consultas.invalidateQueries({ queryKey: ["eu"] })]),
    [consultas],
  );
}
