"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { ComoVaiFuncionar, type Passo } from "./ComoVaiFuncionar";

const passos: Passo[] = [
  { titulo: "Foto da OS", detalhe: "A imagem fica só neste aparelho; nada foi enviado ao servidor.", estado: "feito" },
  { titulo: "Leitura do texto", detalhe: "O sistema reconhece o texto da folha e localiza o nº da ordem, o tipo, o local, a equipe e as datas.", estado: "proximo" },
  { titulo: "Conferência campo a campo", detalhe: "Você confere cada campo lido com a folha em mãos e corrige o que precisar.", estado: "proximo" },
  { titulo: "OS registrada", detalhe: "A OS entra como liberada, com a foto da folha anexada e a origem “digitalização”.", estado: "proximo" },
];

const SEM_SUPORTE = "Este navegador não dá acesso à câmera por aqui (a câmera só abre com o sistema em HTTPS).";

/** Fora de HTTPS (ou em navegador antigo) `navigator.mediaDevices` nem existe. */
const temCamera = () => typeof navigator.mediaDevices?.getUserMedia === "function";

function motivoDaFalha(erro: unknown): string {
  const nome = erro instanceof DOMException ? erro.name : "";
  if (nome === "NotAllowedError" || nome === "SecurityError") return "O acesso à câmera foi negado. Libere a câmera para este site nas configurações do navegador.";
  if (nome === "NotFoundError" || nome === "OverconstrainedError") return "Nenhuma câmera foi encontrada neste aparelho.";
  if (nome === "NotReadableError") return "A câmera está em uso por outro aplicativo.";
  return "Não foi possível abrir a câmera.";
}

/**
 * Digitalização (só o administrador): abre a câmera traseira, captura a folha da OS e mostra como o fluxo vai seguir. A
 * leitura do texto ainda não existe, então nada é enviado. Sem câmera (permissão negada, sem HTTPS), a foto pode vir do
 * próprio aparelho. Fechar a janela desliga a câmera.
 */
export function JanelaCamera({ aoFechar }: { aoFechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const fotoAtual = useRef<string | null>(null);
  // A janela só é montada depois do clique, no navegador: `navigator` existe aqui.
  const [falha, setFalha] = useState<string | null>(() => (temCamera() ? null : SEM_SUPORTE));
  const [aoVivo, setAoVivo] = useState(false);
  const [foto, setFoto] = useState<string | null>(null);

  useEffect(() => {
    if (!temCamera()) return;
    let ativo = true;
    let fluxo: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (aberto) => {
        if (!ativo) return aberto.getTracks().forEach((t) => t.stop());
        fluxo = aberto;
        if (video.current) {
          video.current.srcObject = aberto;
          await video.current.play().catch(() => undefined);
        }
        setAoVivo(true);
      })
      .catch((erro) => {
        if (ativo) setFalha(motivoDaFalha(erro));
      });
    return () => {
      ativo = false;
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(
    () => () => {
      if (fotoAtual.current) URL.revokeObjectURL(fotoAtual.current);
    },
    [],
  );

  function trocarFoto(nova: Blob | null) {
    if (fotoAtual.current) URL.revokeObjectURL(fotoAtual.current);
    fotoAtual.current = nova ? URL.createObjectURL(nova) : null;
    setFoto(fotoAtual.current);
    if (!nova) void video.current?.play().catch(() => undefined);
  }

  function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const tela = document.createElement("canvas");
    tela.width = v.videoWidth;
    tela.height = v.videoHeight;
    tela.getContext("2d")?.drawImage(v, 0, 0);
    tela.toBlob((imagem) => trocarFoto(imagem), "image/jpeg", 0.85);
  }

  return (
    <JanelaModal titulo="Digitalizar OS em papel" aoFechar={aoFechar} className="dlg-larga">
      {foto && (
        <div className="camera-resultado">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto} alt="Foto da OS capturada" className="camera-foto" />
          <ComoVaiFuncionar passos={passos} />
        </div>
      )}

      <div className="camera" hidden={Boolean(foto || falha)}>
        <video ref={video} playsInline muted aria-label="Imagem da câmera" />
        <div className="camera-guia" aria-hidden="true">
          <span>Enquadre a folha inteira da OS</span>
        </div>
        {!aoVivo && (
          <div className="camera-abrindo" role="status">
            <Icon name="camera" size={24} />
            Abrindo a câmera…
          </div>
        )}
      </div>

      {falha && !foto && (
        <Notice tone="al" icon="camera" style={{ fontSize: 14 }}>
          <strong>{falha}</strong> Você ainda pode tirar a foto pelo aparelho ou escolher uma imagem.
        </Notice>
      )}
      {!foto && !falha && <p className="small">Use boa luz e deixe a folha plana, sem sombra sobre o texto.</p>}

      <input
        ref={campo}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          const escolhida = e.target.files?.[0];
          e.target.value = "";
          if (escolhida) trocarFoto(escolhida);
        }}
      />
      <div className="row between wrap g8">
        {foto ? (
          <Button variant="line" sm onClick={() => (falha ? campo.current?.click() : trocarFoto(null))}>
            <Icon name="refresh" size={16} />
            Refazer foto
          </Button>
        ) : (
          <>
            <Button variant="line" sm onClick={() => campo.current?.click()}>
              <Icon name="image" size={16} />
              {falha ? "Tirar ou escolher foto" : "Escolher imagem"}
            </Button>
            {!falha && (
              <Button variant="p" sm onClick={capturar} disabled={!aoVivo}>
                <Icon name="camera" size={16} />
                Capturar
              </Button>
            )}
          </>
        )}
      </div>
    </JanelaModal>
  );
}
