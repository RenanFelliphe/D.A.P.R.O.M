"use client";

import { useEffect, useRef, useState } from "react";

interface AssinaturaCanvasProps {
  /** Chamado com a imagem PNG desenhada quando o usuário confirma. */
  onSalvar: (imagem: Blob) => void | Promise<void>;
  desabilitado?: boolean;
  rotuloSalvar?: string;
}

/** Área para desenhar a assinatura com mouse, caneta ou dedo; "Limpar" refaz e "Salvar" entrega um PNG. */
export function AssinaturaCanvas({ onSalvar, desabilitado, rotuloSalvar = "Salvar assinatura" }: AssinaturaCanvasProps) {
  const tela = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [temTraco, setTemTraco] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const c = tela.current!;
    const ctx = c.getContext("2d")!;
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#17212B";
  }, []);

  const ponto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = tela.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  function comecar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (desabilitado) return;
    tela.current!.setPointerCapture(e.pointerId);
    desenhando.current = true;
    const { x, y } = ponto(e);
    const ctx = tela.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    setTemTraco(true);
  }
  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    const { x, y } = ponto(e);
    const ctx = tela.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  const terminar = () => {
    desenhando.current = false;
  };

  function limpar() {
    const c = tela.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setTemTraco(false);
  }

  async function salvar() {
    const imagem = await new Promise<Blob | null>((ok) => tela.current!.toBlob(ok, "image/png"));
    if (!imagem) return;
    setSalvando(true);
    try {
      await onSalvar(imagem);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="stack g8">
      <canvas
        ref={tela}
        width={600}
        height={180}
        className="sig"
        style={{ width: "100%", maxWidth: 420, aspectRatio: "600 / 180", touchAction: "none", cursor: "crosshair", padding: 0 }}
        onPointerDown={comecar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        aria-label="Área para desenhar a assinatura"
      />
      <div className="row g8">
        <button type="button" className="btn btn-line btn-sm" onClick={limpar} disabled={!temTraco || salvando}>
          Limpar
        </button>
        <button type="button" className="btn btn-p btn-sm" onClick={salvar} disabled={!temTraco || desabilitado || salvando}>
          {salvando ? "Salvando…" : rotuloSalvar}
        </button>
      </div>
    </div>
  );
}
