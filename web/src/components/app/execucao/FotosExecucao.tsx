"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { AdicionarFoto } from "@/components/ui/AdicionarFoto";
import { Req } from "@/components/ui/Field";
import { hora } from "@/lib/formatar";
import { novoId } from "@/lib/cliente-api";

/** Foto já enviada (`PUT /arquivos/{id}`), pronta para virar uma evidência do evento. */
export interface FotoDaExecucao {
  /** Id da evidência. */
  id: string;
  arquivoId: string;
  previa: string;
  capturadaEm: string;
  latitude?: number;
  longitude?: number;
}

/** Evidência no formato do payload dos eventos de execução. */
export const comoEvidencia = (f: FotoDaExecucao) => ({
  id: f.id,
  arquivo_id: f.arquivoId,
  capturada_em: f.capturadaEm,
  ...(f.latitude !== undefined && f.longitude !== undefined ? { latitude: f.latitude, longitude: f.longitude } : {}),
});

/** Posição do aparelho, se o usuário permitir; segue sem ela se negado, indisponível ou demorada. */
function posicaoAtual(): Promise<{ latitude: number; longitude: number } | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((ok) =>
    navigator.geolocation.getCurrentPosition(
      (p) => ok({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => ok(null),
      { timeout: 8000, maximumAge: 60_000 },
    ),
  );
}

interface FotosExecucaoProps {
  fotos: FotoDaExecucao[];
  onChange: Dispatch<SetStateAction<FotoDaExecucao[]>>;
  /** Máximo de fotos (a `api` aceita 10 por execução). */
  maximo?: number;
  desabilitado?: boolean;
}

/** Grade de fotos já anexadas (com prévia) e botão para adicionar mais; o GPS é pedido só ao anexar. */
export function FotosExecucao({ fotos, onChange, maximo = 10, desabilitado }: FotosExecucaoProps) {
  const [erro, setErro] = useState<string | null>(null);

  function anexar({ arquivoId, previa }: { arquivoId: string; previa: string }) {
    setErro(null);
    const foto: FotoDaExecucao = { id: novoId(), arquivoId, previa, capturadaEm: new Date().toISOString() };
    onChange((anteriores) => [...anteriores, foto]);
    // A posição chega depois: atualiza só esta foto, sobre a lista mais recente.
    void posicaoAtual().then((pos) => {
      if (pos) onChange((anteriores) => anteriores.map((f) => (f.id === foto.id ? { ...f, ...pos } : f)));
    });
  }

  return (
    <div className="field">
      <div className="row between">
        <label>
          Fotos <Req style={{ color: "var(--exe)" }}>· de 1 a {maximo}</Req>
        </label>
        <span className="small">
          {fotos.length} {fotos.length === 1 ? "foto" : "fotos"} · com data e hora
        </span>
      </div>
      <div className="photo-grid">
        {fotos.map((f) => (
          <div key={f.id} className="photo sq" style={{ padding: 0, position: "relative", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.previa} alt={`Foto das ${hora(f.capturadaEm)}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <span className="mono" style={{ position: "absolute", left: 6, bottom: 6, background: "rgba(0,0,0,.55)", color: "#fff", borderRadius: 4, padding: "1px 5px" }}>
              {hora(f.capturadaEm)}
              {f.latitude !== undefined ? " · GPS" : ""}
            </span>
            <button
              type="button"
              aria-label="Remover foto"
              disabled={desabilitado}
              onClick={() => onChange((anteriores) => anteriores.filter((x) => x.id !== f.id))}
              style={{ position: "absolute", right: 4, top: 4, background: "rgba(0,0,0,.55)", color: "#fff", border: 0, borderRadius: 4, width: 22, height: 22, cursor: "pointer" }}
            >
              ×
            </button>
          </div>
        ))}
        {fotos.length < maximo && <AdicionarFoto onEnviada={anexar} onErro={setErro} desabilitado={desabilitado} />}
      </div>
      {erro && (
        <span className="small" role="alert" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
    </div>
  );
}
