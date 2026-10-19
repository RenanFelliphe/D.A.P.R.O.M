"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Avatar } from "@/components/vitoria/Avatar";
import { CarregandoComVitoria } from "./CarregandoComVitoria";
import type { RascunhoIA } from "./useRascunhoIA";

const SUGESTOES = ["Encurte a explicação para 5 passos", "Faça uma fase de decisão sobre vazamento", "Deixe as perguntas mais diretas"];

/**
 * "Ajustes com a Vitória" (seção 3.9.4 do `vitoria.md`): pedidos em português que refazem o rascunho, até o limite de
 * rodadas. A conversa fica só na tela; o rascunho volta gravado, com as pendências recalculadas.
 */
export function ChatDeAjustes({ ia, desabilitado }: { ia: RascunhoIA; desabilitado?: boolean }) {
  const [pedido, setPedido] = useState("");
  const lista = useRef<HTMLUListElement>(null);
  const { situacao, conversa, trabalhando, erro, progresso } = ia;
  const bloqueado = desabilitado || trabalhando || !situacao.pode_ajustar;

  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: "smooth" });
  }, [conversa.length, trabalhando]);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const limpo = pedido.trim();
    if (!limpo) return;
    setPedido("");
    await ia.ajustar(limpo);
  }

  return (
    <section className="panel ts-chat" aria-labelledby="titulo-chat">
      <div className="ts-chat-cab">
        <Avatar tamanho={40} />
        <div className="stack">
          <h3 id="titulo-chat">Ajustes com a Vitória</h3>
          <span className="small">
            {situacao.rodadas_usadas} de {situacao.limite_rodadas} rodadas usadas neste treinamento
          </span>
        </div>
      </div>
      <ul ref={lista} className="ts-chat-msgs">
        <li className="ts-msg ts-msg-vitoria">Quer mudar algo no rascunho inteiro? Peça em português e eu refaço. Para uma fase só, use &ldquo;Regerar com a Vitória&rdquo; nela.</li>
        {conversa.map((m, i) => (
          <li key={i} className={m.de === "admin" ? "ts-msg ts-msg-admin" : "ts-msg ts-msg-vitoria"}>
            {m.texto}
          </li>
        ))}
        {trabalhando && (
          <li className="ts-msg ts-msg-vitoria ts-msg-carregando">
            <CarregandoComVitoria progresso={progresso} compacto />
          </li>
        )}
      </ul>
      {erro && (
        <Notice tone="blq" icon="alert" role="alert">
          {erro}
        </Notice>
      )}
      {!trabalhando && situacao.pode_ajustar && conversa.length === 0 && (
        <div className="ts-sugestoes" aria-label="Sugestões de pedido">
          {SUGESTOES.map((s) => (
            <button key={s} type="button" className="ts-sugestao" onClick={() => setPedido(s)} disabled={bloqueado}>
              {s}
            </button>
          ))}
        </div>
      )}
      <form className="ts-chat-form" onSubmit={enviar}>
        <input className="input" maxLength={1000} placeholder="Escreva o ajuste que você quer" value={pedido} disabled={bloqueado} onChange={(e) => setPedido(e.target.value)} aria-label="Pedido de ajuste" />
        <Button type="submit" variant="p" disabled={bloqueado || !pedido.trim()} aria-label="Enviar o pedido">
          <Icon name="right" size={16} />
        </Button>
      </form>
      {!situacao.pode_ajustar && situacao.motivo && <span className="small">{situacao.motivo}.</span>}
    </section>
  );
}
