"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConviteFeito } from "@/lib/apr-convite";
import { chamar, ErroCliente } from "@/lib/cliente-api";

/** O convite vale por minutos: quem convida o acompanha ao vivo, relendo a cada poucos segundos. */
const RELER_A_CADA_MS = 5_000;

/**
 * Os convites que o responsável fez hoje nesta OS (`GET /os/{id}/apr-convites`), o último de cada pessoa, e as ações sobre eles. Se a
 * consulta falha (sem sinal, servidor fora), `convites` fica `undefined`: a tela segue pelo presencial de sempre, sem cobrar convite.
 */
export function useConvitesDaOs(osId: string, ativo: boolean) {
  const [convites, setConvites] = useState<ConviteFeito[] | undefined>(undefined);

  const reler = useCallback(async () => {
    try {
      setConvites((await chamar<{ convites: ConviteFeito[] }>("GET", `/os/${osId}/apr-convites`)).convites);
    } catch {
      setConvites(undefined);
    }
  }, [osId]);

  useEffect(() => {
    if (!ativo) return;
    // A primeira leitura vai para o próximo ciclo: o estado só muda dentro de um callback, nunca direto no efeito.
    const primeiro = setTimeout(() => void reler(), 0);
    const intervalo = setInterval(() => void reler(), RELER_A_CADA_MS);
    return () => {
      clearTimeout(primeiro);
      clearInterval(intervalo);
    };
  }, [ativo, reler]);

  const convidar = useCallback(
    async (usuarios: string[]) => {
      await chamar("POST", `/os/${osId}/apr-convites`, { usuarios });
      await reler();
    },
    [osId, reler],
  );
  const desfazer = useCallback(
    async (id: string) => {
      await chamar("DELETE", `/apr-convites/${id}`);
      await reler();
    },
    [reler],
  );

  return { convites, convidar, desfazer };
}

/** O texto de um erro dos convites: o da `api` (já em português) ou o de falta de conexão. */
export const mensagemDoConvite = (e: unknown) => (e instanceof ErroCliente ? e.message : "Não foi possível falar com o servidor. Confira o sinal e tente de novo.");
