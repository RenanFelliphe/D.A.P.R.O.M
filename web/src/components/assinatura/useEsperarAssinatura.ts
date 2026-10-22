"use client";

import { useEffect, useEffectEvent } from "react";
import { INTERVALO_DA_CONSULTA_DA_ASSINATURA_MS, type AssinaturaJuridica } from "@/lib/assinatura-juridica";
import { chamar, ErroCliente } from "@/lib/cliente-api";

/**
 * Espera a assinatura no provedor: consulta `GET /assinaturas-juridicas/{id}` (a `api` reconsulta o provedor) a cada
 * `INTERVALO_DA_CONSULTA_DA_ASSINATURA_MS` e na hora em que a aba volta ao foco, enquanto `id` estiver definido, e entrega cada resposta a
 * `aoConsultar`. Para sozinha numa situação final (`assinada`, `recusada` ou `falhou`). Falha de rede não para: tenta de novo na volta
 * seguinte; já uma recusa da `api` (assinatura inexistente, de outra pessoa) para e vai para `aoFalhar`.
 */
export function useEsperarAssinatura(id: string | null, aoConsultar: (assinatura: AssinaturaJuridica) => void, aoFalhar?: (erro: unknown) => void) {
  const receber = useEffectEvent(aoConsultar);
  const falhar = useEffectEvent((erro: unknown) => aoFalhar?.(erro));

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    let consultando = false;

    const parar = () => {
      ativo = false;
      window.clearInterval(temporizador);
    };
    const consultar = async () => {
      if (!ativo || consultando) return;
      consultando = true;
      try {
        const assinatura = await chamar<AssinaturaJuridica>("GET", `/assinaturas-juridicas/${id}`);
        if (!ativo) return;
        if (assinatura.situacao !== "aguardando") parar();
        receber(assinatura);
      } catch (erro) {
        if (ativo && erro instanceof ErroCliente) {
          parar();
          falhar(erro);
        }
      } finally {
        consultando = false;
      }
    };
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void consultar();
    };

    const temporizador = window.setInterval(() => void consultar(), INTERVALO_DA_CONSULTA_DA_ASSINATURA_MS);
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      parar();
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [id]);
}

/**
 * Abre já, no clique, a aba em que a pessoa vai assinar: se a abertura esperasse a resposta da `api`, o navegador a barraria como janela
 * sem pedido. A aba nasce em branco, sem ligação com esta (`opener`), e `levarAbaParaAAssinatura` a aponta para o provedor quando o
 * endereço chega. `null` quando o navegador barrou (a janela de assinatura oferece "Abrir de novo"). Serve também para abrir o PDF
 * assinado, que só se sabe onde está depois de perguntar à `api` (`mensagem` diz o que a aba está abrindo).
 */
export function abrirAbaDeAssinatura(mensagem = "Abrindo a página de assinatura…"): Window | null {
  const aba = window.open("", "_blank");
  if (!aba) return null;
  aba.opener = null;
  try {
    aba.document.title = "Assinatura";
    aba.document.body.textContent = mensagem;
  } catch {
    /* a aba já está em outra origem: segue assim */
  }
  return aba;
}

/** Aponta a aba aberta no clique para a página de assinatura; sem aba (barrada ou já fechada), abre uma nova, que o navegador pode barrar. */
export function levarAbaParaAAssinatura(aba: Window | null, url: string | null) {
  if (!url) {
    aba?.close();
    return;
  }
  if (aba && !aba.closed) aba.location.href = url;
  else window.open(url, "_blank", "noopener");
}
