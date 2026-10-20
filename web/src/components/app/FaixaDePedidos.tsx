"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ContagemDoPedido } from "@/components/app/execucao/ContagemDoPedido";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { ROTULO_DO_PEDIDO, type PedidoParaResponder } from "@/lib/execucao-pedidos";
import { rotas } from "@/lib/rotas";

/** De quanto em quanto tempo a página, aberta em qualquer tela, pergunta se um participante pediu algo ao responsável (não há push). */
const PERGUNTAR_A_CADA_MS = 10_000;

/**
 * A faixa no alto de toda tela de campo para o responsável por uma execução: "[nome] pediu para encerrar a OS 123 — 1:42", com o atalho
 * para a execução, onde ele aprova ou recusa. Só pergunta com a aba visível: com a aba fechada o pedido vence e é aprovado sozinho (é o que
 * a funcionalidade pretende: a equipe não depende do aparelho do responsável). A tela da própria execução já mostra o pedido, com os botões.
 */
export function FaixaDePedidos() {
  const caminho = usePathname();
  const [pedidos, setPedidos] = useState<PedidoParaResponder[]>([]);
  const vistos = useRef(new Set<string>());

  useEffect(() => {
    let ativo = true;
    const perguntar = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { pedidos: abertos } = await chamar<{ pedidos: PedidoParaResponder[] }>("GET", "/me/pedidos-abertos");
        if (!ativo) return;
        setPedidos(abertos);
        // Um pedido novo chama a atenção também com o aparelho: vibra onde o navegador permite.
        const novo = abertos.some((p) => !vistos.current.has(p.id));
        abertos.forEach((p) => vistos.current.add(p.id));
        if (novo && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([0, 400, 200, 400]);
      } catch {
        /* sem sinal ou sessão em transição: tenta de novo na próxima volta */
      }
    };
    void perguntar();
    const temporizador = window.setInterval(() => void perguntar(), PERGUNTAR_A_CADA_MS);
    document.addEventListener("visibilitychange", perguntar);
    return () => {
      ativo = false;
      window.clearInterval(temporizador);
      document.removeEventListener("visibilitychange", perguntar);
    };
  }, []);

  const lista = useMemo(() => pedidos.filter((p) => !caminho.includes(`/os/${p.os_id}/execucao`)), [pedidos, caminho]);
  if (lista.length === 0) return null;
  return (
    <div className="stack g8" style={{ marginBottom: 12 }}>
      {lista.map((p) => (
        <Notice key={p.id} tone="al" icon="clock" role="status">
          <strong>
            {p.solicitante.nome} pediu para {ROTULO_DO_PEDIDO[p.tipo]} — <ContagemDoPedido restanteMs={p.restante_ms} />
          </strong>{" "}
          OS {p.numero_ordem ?? p.titulo}. Sem resposta em 2 minutos, o pedido é aprovado sozinho.{" "}
          <Link href={rotas.app.execucao(p.os_id)}>Responder</Link>
        </Notice>
      ))}
    </div>
  );
}
