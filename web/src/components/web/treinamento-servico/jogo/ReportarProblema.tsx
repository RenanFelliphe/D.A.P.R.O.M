"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamar, ErroCliente } from "@/lib/cliente-api";

const LIMITE = 500;

/**
 * "Reportar problema" de uma fase (seção 3.3 do `vitoria.md`): um texto livre que vira aviso para o admin. Abre por cima da
 * fase, sem sair do jogo; a resposta da fase não muda.
 */
export function ReportarProblema({ atividadeCodigo, fase }: { atividadeCodigo: string; fase: number }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    setErro(null);
    setEnviando(true);
    try {
      await chamar("POST", `/treinamentos/${encodeURIComponent(atividadeCodigo)}/reportes`, { fase, texto: limpo });
      setEnviado(true);
      setTexto("");
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível enviar agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <span className="ts-reportado" role="status">
        <Icon name="check" size={13} />
        Aviso enviado ao admin
      </span>
    );
  }

  return (
    <>
      <button type="button" className="ts-reportar" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
        <Icon name="flag" size={13} />
        <span>Reportar problema</span>
      </button>
      {aberto && (
        <div className="ts-reportar-caixa">
          <label htmlFor={`reporte-${fase}`} className="small">
            O que parece errado nesta fase? O aviso vai para quem cuida dos treinamentos.
          </label>
          <textarea
            id={`reporte-${fase}`}
            className="textarea"
            rows={3}
            maxLength={LIMITE}
            value={texto}
            placeholder="Ex.: a resposta certa desta pergunta parece ser outra."
            onChange={(e) => setTexto(e.target.value)}
          />
          {erro && <span className="field-erro">{erro}</span>}
          <div className="row g8 wrap">
            <Button variant="p" sm onClick={enviar} disabled={enviando || !texto.trim()}>
              {enviando ? "Enviando…" : "Enviar aviso"}
            </Button>
            <Button variant="ghost" sm onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Button>
            <span className="small ts-contador">
              {texto.length}/{LIMITE}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
