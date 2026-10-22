"use client";

import { interpretarRespostaDoEvento, montarEnvioDoEvento, type EventoDeCampo, type RespostaEventos } from "./eventos";
import { novoUuid } from "./uuid";

/**
 * A `api` vista do navegador, por `/api/*` (o handler em `app/api/[...caminho]` junta o token do cookie `httpOnly`).
 * Para componentes de cliente: gravações (eventos, arquivos, edições) e consultas que dependem da interação.
 */

export class ErroCliente extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const novoId = novoUuid;

async function lerResposta(resposta: Response) {
  const texto = await resposta.text();
  let dados: { erro?: { codigo?: string; mensagem?: string } } & Record<string, unknown> = {};
  try {
    dados = texto ? JSON.parse(texto) : {};
  } catch {
    /* corpo que não é JSON */
  }
  if (resposta.status === 401 && typeof window !== "undefined") {
    // Sessão perdida: recarrega na tela de entrada (navegação completa, para descartar o estado da tela).
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/app/entrar");
  }
  if (resposta.status === 403 && dados?.erro?.codigo === "aguardando_liberacao" && typeof window !== "undefined") {
    // Rede de segurança: a casca do técnico pendente não dispara chamadas da `api` real, mas se uma escapar, leva à tela de espera.
    if (window.location.pathname !== "/app/aguardando") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/app/aguardando");
    }
    throw new ErroCliente(403, "aguardando_liberacao", "Seu acesso ainda está aguardando liberação de um administrador. Enquanto isso, use o Campo de treino.");
  }
  if (!resposta.ok) throw new ErroCliente(resposta.status, dados?.erro?.codigo ?? "erro", dados?.erro?.mensagem ?? "Erro ao falar com o servidor");
  return dados;
}

/** `enviarFormulario("/importacoes", form)`: POST multipart (arquivos); `"PUT"` troca um arquivo já enviado. Lança `ErroCliente` com a mensagem da `api`. */
export async function enviarFormulario<T = unknown>(caminho: string, form: FormData, metodo: "POST" | "PUT" = "POST"): Promise<T> {
  return lerResposta(await fetch(`/api${caminho}`, { method: metodo, body: form, cache: "no-store" })) as Promise<T>;
}

/** `chamar("POST", "/os/123/ciencia")`; o corpo vai como JSON. Lança `ErroCliente` com a mensagem da `api`. */
export async function chamar<T = unknown>(metodo: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", caminho: string, corpo?: unknown): Promise<T> {
  const resposta = await fetch(`/api${caminho}`, {
    method: metodo,
    headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    cache: "no-store",
  });
  return lerResposta(resposta) as Promise<T>;
}

export interface EventoDeStream {
  event: string;
  data: string;
}

/**
 * Como `chamar`, mas para rotas que respondem em streaming (SSE), como `POST /vitoria/mensagens`: entrega cada evento a
 * `aoReceber` assim que chega, sem esperar o fim da resposta. O proxy (`app/api/[...caminho]/route.ts`) já repassa o
 * corpo da `api` como stream, sem buffer. Uma resposta de erro (não streaming) passa pelo mesmo tratamento de `chamar`
 * e lança `ErroCliente`.
 */
export async function chamarEmStream(caminho: string, corpo: unknown, aoReceber: (evento: EventoDeStream) => void): Promise<void> {
  const resposta = await fetch(`/api${caminho}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), cache: "no-store" });
  if (!resposta.ok || !resposta.body) {
    await lerResposta(resposta);
    return;
  }
  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let restante = "";
  while (true) {
    const { done, value } = await leitor.read();
    if (done) break;
    restante += decodificador.decode(value, { stream: true });
    const blocos = restante.split("\n\n");
    restante = blocos.pop() ?? "";
    for (const bloco of blocos) {
      if (!bloco.trim()) continue;
      const linhas = bloco.split("\n");
      const event = linhas.find((l) => l.startsWith("event: "))?.slice("event: ".length) ?? "message";
      const data = linhas
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice("data: ".length))
        .join("\n");
      aoReceber({ event, data });
    }
  }
}

const LADO_MAXIMO = 1600;
const QUALIDADE_JPEG = 0.7;

/** Reduz a foto para ~1600 px e JPEG 70% (≈300 KB), como pede o `docs/especificacao.md`, seção 3.4; formatos que o navegador não decodifica passam como vieram. */
export async function comprimirFoto(arquivo: Blob): Promise<Blob> {
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
    const tela = document.createElement("canvas");
    tela.width = Math.round(imagem.width * escala);
    tela.height = Math.round(imagem.height * escala);
    tela.getContext("2d")!.drawImage(imagem, 0, 0, tela.width, tela.height);
    const jpeg = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", QUALIDADE_JPEG));
    return jpeg ?? arquivo;
  } catch {
    return arquivo;
  }
}

/** Maior PDF que a `api` aceita como evidência. */
export const LIMITE_PDF = 10 * 1024 * 1024;

/** O arquivo escolhido é um PDF? Pelo tipo que o navegador declara ou, se ele não declarar, pela extensão. */
export const pareceUmPdf = (arquivo: File) => arquivo.type === "application/pdf" || (!arquivo.type && /\.pdf$/i.test(arquivo.name));

/**
 * Envia uma foto, uma assinatura, um PDF de evidência ou a imagem de um treinamento de serviço (`PUT /arquivos/{id}`) com
 * um id gerado aqui e devolve o id, que os eventos (ou o editor do treinamento) referenciam (`arquivo_id`). Fotos e
 * imagens de treinamento são comprimidas antes; o PDF vai como está (a `api` confere o conteúdo e o limite de 10 MB).
 * Reenviar o mesmo id e conteúdo não tem efeito.
 */
export async function enviarArquivo(arquivo: Blob, tipo: "foto" | "assinatura" | "pdf" | "treinamento_imagem", id: string = novoId()): Promise<string> {
  const comprimir = tipo === "foto" || tipo === "treinamento_imagem";
  const conteudo = comprimir ? await comprimirFoto(arquivo) : arquivo;
  const nome = comprimir ? "foto.jpg" : tipo === "pdf" ? "documento.pdf" : "assinatura.png";
  const form = new FormData();
  form.set("arquivo", new File([conteudo], nome, { type: tipo === "pdf" ? "application/pdf" : conteudo.type || "image/png" }));
  form.set("tipo", tipo);
  await lerResposta(await fetch(`/api/arquivos/${id}`, { method: "PUT", body: form }));
  return id;
}

/** Endereço assinado (10 min) de um arquivo guardado (`GET /arquivos/{id}/url`). */
export async function urlDoArquivo(id: string): Promise<string> {
  return (await chamar<{ url: string }>("GET", `/arquivos/${id}/url`)).url;
}

/** O formato do evento, a resposta da `api` e a leitura dela vivem em `shared/api/eventos.ts` (o app usa o mesmo código). */
export { ErroDeEvento, type EventoDeCampo, type RespostaEventos } from "./eventos";

/**
 * Envia UM evento de campo (`POST /eventos`) e devolve a resposta da `api` (`aprs`, `os`, `alertas`). Se o evento não foi
 * aplicado, lança `ErroDeEvento` com a mensagem pronta ("Preencha a APR antes de iniciar", "Falta evidência em 1
 * item(ns)"…). Fotos e assinaturas precisam ter subido antes com `enviarArquivo`.
 */
export async function enviarEvento(evento: EventoDeCampo): Promise<RespostaEventos & { id: string }> {
  const { id, corpo } = montarEnvioDoEvento(evento);
  return interpretarRespostaDoEvento(await chamar<RespostaEventos>("POST", "/eventos", corpo), id);
}
