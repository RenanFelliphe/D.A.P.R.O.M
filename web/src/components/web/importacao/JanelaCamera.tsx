"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { enviarFormulario, ErroCliente } from "@/lib/cliente-api";
import { abrirFoto, paraJpeg, qualidadeDaImagem } from "@/lib/qualidade-da-foto";
import { ComoVaiFuncionar, type Passo } from "./ComoVaiFuncionar";
import { MAX_FOTOS_POR_ENVIO, type Digitalizacao } from "./tipos-digitalizacao";

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

/** Uma folha fotografada, já em JPEG, na orientação certa e reduzida; `avisos` é o que a medida de luz e nitidez achou. */
interface Folha {
  id: number;
  blob: Blob;
  url: string;
  avisos: string[];
}

function passosDoEnvio(folhas: number): Passo[] {
  return [
    {
      titulo: "Fotos das folhas",
      detalhe: "Uma foto por folha, na ordem: a OS, a folha de execução e, se vier junto, a APR. O sistema avisa na hora se a foto está escura ou tremida.",
      estado: folhas > 0 ? "feito" : "proximo",
    },
    { titulo: "Leitura", detalhe: "As fotos viram um PDF e seguem o mesmo caminho do PDF escaneado: o OCR lê o impresso e a IA lê só o que foi escrito à mão.", estado: "proximo" },
    { titulo: "Conferência campo a campo", detalhe: "Você confere cada campo lido com a foto ao lado e corrige o que precisar. Nada é gravado antes.", estado: "proximo" },
    { titulo: "OS registrada", detalhe: "A OS entra encerrada, só como histórico, com as fotos anexadas e a origem “digitalização”. Não pontua nem entra nos indicadores de tempo.", estado: "proximo" },
  ];
}

interface JanelaCameraProps {
  aoFechar: () => void;
  /** As fotos subiram e a leitura começou: a tela acompanha a digitalização `id`. */
  aoEnviada: (id: string) => void;
}

/**
 * Digitalização por câmera (só o administrador), para 1 ou 2 folhas avulsas: tira uma foto por folha (ou escolhe imagens do
 * aparelho), vê na hora se a foto está escura ou tremida, reordena, gira e remove, e manda ler. Cada foto é normalizada aqui
 * (orientação do EXIF, no máximo 2.800 px, JPEG); a `api` junta as fotos num PDF, e dali em diante o caminho é o do PDF escaneado.
 * Sem câmera (permissão negada, sem HTTPS), as fotos podem vir do próprio aparelho. Fechar a janela desliga a câmera.
 */
export function JanelaCamera({ aoFechar, aoEnviada }: JanelaCameraProps) {
  const video = useRef<HTMLVideoElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const nativa = useRef<HTMLInputElement>(null);
  const proximoId = useRef(1);
  const urls = useRef(new Set<string>());
  // A janela só é montada depois do clique, no navegador: `navigator` existe aqui.
  const [falha, setFalha] = useState<string | null>(() => (temCamera() ? null : SEM_SUPORTE));
  const [aoVivo, setAoVivo] = useState(false);
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!temCamera()) return;
    let ativo = true;
    let fluxo: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
      .then(async (aberto) => {
        if (!ativo) return aberto.getTracks().forEach((t) => t.stop());
        fluxo = aberto;
        if (video.current) {
          video.current.srcObject = aberto;
          await video.current.play().catch(() => undefined);
        }
        setAoVivo(true);
      })
      .catch((e) => {
        if (ativo) setFalha(motivoDaFalha(e));
      });
    return () => {
      ativo = false;
      fluxo?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    const guardadas = urls.current;
    return () => guardadas.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const vagas = MAX_FOTOS_POR_ENVIO - folhas.length;

  function guardar(blob: Blob, avisos: string[]): Folha {
    const url = URL.createObjectURL(blob);
    urls.current.add(url);
    return { id: proximoId.current++, blob, url, avisos };
  }

  function soltar(url: string) {
    URL.revokeObjectURL(url);
    urls.current.delete(url);
  }

  async function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth || vagas <= 0) return;
    setErro(null);
    const tela = document.createElement("canvas");
    tela.width = v.videoWidth;
    tela.height = v.videoHeight;
    tela.getContext("2d")?.drawImage(v, 0, 0);
    try {
      const blob = await paraJpeg(tela);
      setFolhas((atuais) => [...atuais, guardar(blob, qualidadeDaImagem(tela).avisos)]);
    } catch {
      setErro("Não foi possível guardar a foto. Tente de novo.");
    }
  }

  async function escolher(arquivos: FileList | null) {
    const lista = Array.from(arquivos ?? []);
    if (lista.length === 0) return;
    setErro(null);
    setOcupado(true);
    const novas: Folha[] = [];
    let recusadas = 0;
    for (const arquivo of lista.slice(0, Math.max(vagas, 0))) {
      try {
        const tela = await abrirFoto(arquivo);
        novas.push(guardar(await paraJpeg(tela), qualidadeDaImagem(tela).avisos));
      } catch {
        recusadas++;
      }
    }
    setFolhas((atuais) => [...atuais, ...novas]);
    setOcupado(false);
    const demais = lista.length - Math.max(vagas, 0);
    if (recusadas > 0) setErro(`${recusadas === 1 ? "Uma imagem não pôde ser aberta" : `${recusadas} imagens não puderam ser abertas`}: use fotos JPEG ou PNG.`);
    else if (demais > 0) setErro(`No máximo ${MAX_FOTOS_POR_ENVIO} fotos por envio: ${demais === 1 ? "uma ficou de fora" : `${demais} ficaram de fora`}. Para mais folhas, escaneie e envie o PDF.`);
  }

  async function girar(folha: Folha) {
    setOcupado(true);
    setErro(null);
    try {
      const tela = await abrirFoto(folha.blob, 90);
      const nova = guardar(await paraJpeg(tela), qualidadeDaImagem(tela).avisos);
      soltar(folha.url);
      // A foto girada ocupa o lugar da antiga (o id novo só serve de chave).
      setFolhas((atuais) => atuais.map((f) => (f.id === folha.id ? nova : f)));
    } catch {
      setErro("Não foi possível girar a foto.");
    } finally {
      setOcupado(false);
    }
  }

  function remover(folha: Folha) {
    soltar(folha.url);
    setFolhas((atuais) => atuais.filter((f) => f.id !== folha.id));
  }

  function mover(indice: number, passo: -1 | 1) {
    setFolhas((atuais) => {
      const destino = indice + passo;
      if (destino < 0 || destino >= atuais.length) return atuais;
      const copia = [...atuais];
      [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
      return copia;
    });
  }

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const form = new FormData();
      folhas.forEach((f, i) => form.append("fotos", f.blob, `folha-${i + 1}.jpg`));
      const criada = await enviarFormulario<Digitalizacao>("/digitalizacoes", form);
      aoEnviada(criada.id);
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Servidor indisponível. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const comAviso = folhas.filter((f) => f.avisos.length > 0).length;

  return (
    <JanelaModal titulo="Digitalizar folhas pela câmera" aoFechar={aoFechar} className="dlg-larga">
      <p className="small">
        Para 1 ou 2 folhas avulsas (até {MAX_FOTOS_POR_ENVIO} por envio). Para um acervo, escaneie e envie o PDF. Tire <strong>uma foto por folha</strong>, na ordem: a OS, a folha de execução e a APR.
      </p>

      <div className="camera" hidden={Boolean(falha)}>
        <video ref={video} playsInline muted aria-label="Imagem da câmera" />
        <div className="camera-guia" aria-hidden="true">
          <span>Enquadre a folha inteira</span>
        </div>
        {!aoVivo && (
          <div className="camera-abrindo" role="status">
            <Icon name="camera" size={24} />
            Abrindo a câmera…
          </div>
        )}
      </div>

      {falha && (
        <Notice tone="al" icon="camera" style={{ fontSize: 14 }}>
          <strong>{falha}</strong> Você ainda pode tirar a foto pelo aparelho ou escolher imagens.
        </Notice>
      )}
      {!falha && <p className="small">Use boa luz e deixe a folha plana, sem sombra nem reflexo sobre o texto.</p>}

      <input
        ref={galeria}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Imagens das folhas"
        onChange={(e) => {
          const escolhidas = e.target.files;
          void escolher(escolhidas).finally(() => {
            e.target.value = "";
          });
        }}
      />
      <input
        ref={nativa}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        aria-label="Foto pela câmera do aparelho"
        onChange={(e) => {
          const escolhidas = e.target.files;
          void escolher(escolhidas).finally(() => {
            e.target.value = "";
          });
        }}
      />

      {folhas.length > 0 && (
        <div className="stack g8">
          <span className="lbl">
            {folhas.length === 1 ? "1 folha fotografada" : `${folhas.length} folhas fotografadas`}
            {comAviso > 0 && ` · ${comAviso === 1 ? "1 pede" : `${comAviso} pedem`} atenção`}
          </span>
          <ol className="camera-folhas">
            {folhas.map((f, i) => (
              <li key={f.id} className="camera-folha" data-aviso={f.avisos.length > 0 || undefined}>
                <a href={f.url} target="_blank" rel="noreferrer" title="Abrir a foto em tamanho real">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`Foto da folha ${i + 1}`} />
                </a>
                <strong className="small">Folha {i + 1}</strong>
                {f.avisos.map((a) => (
                  <span key={a} className="small camera-folha-aviso">
                    <Icon name="alert" size={13} />
                    {a}
                  </span>
                ))}
                <div className="row g6">
                  <Button variant="line" sm aria-label={`Mover a folha ${i + 1} para antes`} disabled={i === 0 || enviando} onClick={() => mover(i, -1)}>
                    <Icon name="left" size={16} />
                  </Button>
                  <Button variant="line" sm aria-label={`Mover a folha ${i + 1} para depois`} disabled={i === folhas.length - 1 || enviando} onClick={() => mover(i, 1)}>
                    <Icon name="right" size={16} />
                  </Button>
                  <Button variant="line" sm aria-label={`Girar a folha ${i + 1}`} disabled={ocupado || enviando} onClick={() => void girar(f)}>
                    <Icon name="refresh" size={16} />
                  </Button>
                  <Button variant="line" sm aria-label={`Remover a folha ${i + 1} e refazer`} disabled={enviando} onClick={() => remover(f)}>
                    <Icon name="trash" size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <details className="conferencia-mais">
        <summary>Como vai funcionar</summary>
        <ComoVaiFuncionar titulo="Do papel ao sistema" passos={passosDoEnvio(folhas.length)} />
      </details>

      {erro && (
        <span className="entrada-retorno erro" role="alert">
          {erro}
        </span>
      )}

      <div className="row between wrap g8">
        <div className="row g8 wrap">
          <Button variant="line" sm onClick={() => galeria.current?.click()} disabled={vagas <= 0 || ocupado || enviando}>
            <Icon name="image" size={16} />
            Escolher imagens
          </Button>
          {falha ? (
            <Button variant="line" sm onClick={() => nativa.current?.click()} disabled={vagas <= 0 || ocupado || enviando}>
              <Icon name="camera" size={16} />
              Tirar foto pelo aparelho
            </Button>
          ) : (
            <Button variant="line" sm onClick={() => void capturar()} disabled={!aoVivo || vagas <= 0 || ocupado || enviando}>
              <Icon name="camera" size={16} />
              {folhas.length === 0 ? "Capturar" : `Capturar a folha ${folhas.length + 1}`}
            </Button>
          )}
        </div>
        <Button variant="p" sm onClick={() => void enviar()} disabled={folhas.length === 0 || ocupado || enviando}>
          <Icon name={enviando ? "refresh" : "upload"} size={16} className={enviando ? "spin" : undefined} />
          {enviando ? "Enviando…" : folhas.length > 1 ? `Enviar ${folhas.length} folhas para leitura` : "Enviar a folha para leitura"}
        </Button>
      </div>
    </JanelaModal>
  );
}
