"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { Avatar } from "@/components/vitoria/Avatar";
import { Panel } from "@/components/web/Panel";
import type { ProgressoDaIA } from "@/lib/treinamento-servico";
import type { RascunhoIA } from "./useRascunhoIA";

/** O tamanho máximo do texto do procedimento que a `api` aceita (`LIMITE_TEXTO_PROCEDIMENTO`). */
const LIMITE_TEXTO = 20_000;

interface PainelRascunhoIAProps {
  ia: RascunhoIA;
  textoOrigem: string | null;
  /** O rascunho já tem explicação ou fases: gerar de novo substitui tudo, então pede confirmação. */
  temConteudo: boolean;
  desabilitado: boolean;
}

/**
 * "Gerar rascunho com a Vitória" e os ajustes pelo chat (seção 3.6 do `vitoria.md`). Some quando a IA não está configurada;
 * com o limite da demonstração esgotado, os botões ficam desativados com o motivo.
 */
export function PainelRascunhoIA({ ia, textoOrigem, temConteudo, desabilitado }: PainelRascunhoIAProps) {
  const [texto, setTexto] = useState(textoOrigem ?? "");
  const [pedido, setPedido] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const { situacao, trabalhando, erro, conversa, progresso } = ia;
  if (!situacao.disponivel) return null;

  const textoValido = texto.trim().length >= 40;
  const bloqueado = desabilitado || trabalhando;

  async function gerar() {
    setConfirmando(false);
    await ia.gerar(texto);
  }

  async function pedirAjuste(e: FormEvent) {
    e.preventDefault();
    const limpo = pedido.trim();
    if (!limpo) return;
    setPedido("");
    await ia.ajustar(limpo);
  }

  return (
    <Panel style={{ gap: 14 }}>
      <div className="row g12" style={{ alignItems: "center" }}>
        <Avatar tamanho={52} />
        <div className="stack g4">
          <h2 style={{ fontSize: 15.5 }}>Rascunho com a Vitória (IA)</h2>
          <span className="small muted">
            Cole o texto do procedimento: ferramentas, passos e normas. A Vitória usa só esse texto e os materiais do serviço no catálogo, e marca de que trecho saiu
            cada item. Você revisa, corrige e assina antes de publicar.
          </span>
        </div>
      </div>

      <Field label="Texto do procedimento">
        <textarea className="input" rows={8} maxLength={LIMITE_TEXTO} value={texto} disabled={bloqueado} onChange={(e) => setTexto(e.target.value)} />
      </Field>
      <div className="row between wrap g8" style={{ alignItems: "center" }}>
        <span className="small muted">
          {situacao.usa_ia
            ? `Rodadas deste treinamento: ${situacao.rodadas_usadas} de ${situacao.limite_rodadas}`
            : `Treinamentos com IA: ${situacao.treinamentos_usados} de ${situacao.limite_treinamentos}`}
          {" · "}
          {texto.length.toLocaleString("pt-BR")} de {LIMITE_TEXTO.toLocaleString("pt-BR")} caracteres
        </span>
        {confirmando ? (
          <div className="row g6 wrap">
            <Button variant="d" sm disabled={bloqueado} onClick={gerar}>
              Substituir e gerar
            </Button>
            <Button variant="line" sm onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
          </div>
        ) : (
          <Button variant="p" disabled={bloqueado || !textoValido || !situacao.pode_gerar} onClick={() => (temConteudo ? setConfirmando(true) : gerar())}>
            {situacao.usa_ia ? "Gerar de novo com a Vitória" : "Gerar rascunho com a Vitória"}
          </Button>
        )}
      </div>
      {confirmando && (
        <Notice tone="al" icon="alert">
          Gerar substitui a explicação e as fases do rascunho atual.{situacao.usa_ia ? " Gerar de novo gasta uma rodada." : ""}
        </Notice>
      )}
      {situacao.motivo && !trabalhando && <span className="small muted">{situacao.motivo}.</span>}
      {!textoValido && texto.length > 0 && <span className="small muted">Cole o procedimento inteiro: ao menos algumas frases.</span>}

      {trabalhando && <ProgressoDaVitoria progresso={progresso} />}
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}

      {situacao.usa_ia && (
        <div className="stack g8">
          <h3 style={{ fontSize: 14 }}>Ajustes pelo chat</h3>
          {conversa.length === 0 ? (
            <span className="small muted">Peça mudanças em português, por exemplo &ldquo;encurte a explicação&rdquo; ou &ldquo;faça uma fase sobre aterramento&rdquo;.</span>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
              {conversa.map((m, i) => (
                <li
                  key={i}
                  style={{
                    alignSelf: m.de === "admin" ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    padding: "6px 10px",
                    borderRadius: 10,
                    fontSize: 13.5,
                    background: m.de === "admin" ? "var(--brand)" : "var(--chip)",
                    color: m.de === "admin" ? "#fff" : undefined,
                  }}
                >
                  {m.texto}
                </li>
              ))}
            </ul>
          )}
          <form className="row g6" onSubmit={pedirAjuste}>
            <input
              className="input"
              style={{ flex: 1 }}
              maxLength={1000}
              placeholder="Escreva o ajuste que você quer"
              value={pedido}
              disabled={bloqueado || !situacao.pode_ajustar}
              onChange={(e) => setPedido(e.target.value)}
            />
            <Button type="submit" variant="line" disabled={bloqueado || !situacao.pode_ajustar || !pedido.trim()}>
              Pedir ajuste
            </Button>
          </form>
        </div>
      )}
    </Panel>
  );
}

/** "Montando a fase 5 de 10…", a barra (quando a IA já disse quantos itens vêm) e o tempo corrido: a geração leva minutos. */
function ProgressoDaVitoria({ progresso }: { progresso: ProgressoDaIA | null }) {
  const total = progresso && progresso.total_passos !== null && progresso.total_fases !== null ? progresso.total_passos + progresso.total_fases : null;
  const feitos = progresso ? progresso.passos_prontos + progresso.fases_prontas : 0;
  const fracao = total ? Math.min(1, feitos / total) : null;
  return (
    <div className="stack g6" role="status" aria-live="polite">
      <div className="row between" style={{ alignItems: "center" }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{progresso?.mensagem ?? "Chamando a Vitória…"}</span>
        <span className="small muted">{progresso ? `${progresso.segundos} s` : ""}</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "var(--line2)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.round((fracao ?? 0.08) * 100)}%`, background: "var(--brand)", transition: "width 0.4s ease" }} />
      </div>
      <span className="small muted">Leva alguns minutos, e a Vitória pode pensar um bom tempo antes do primeiro item. Pode sair da tela: o rascunho é gravado quando ela terminar.</span>
    </div>
  );
}
