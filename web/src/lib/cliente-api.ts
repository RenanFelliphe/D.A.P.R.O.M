"use client";

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

/** `enviarFormulario("/importacoes", form)`: POST multipart (arquivos). Lança `ErroCliente` com a mensagem da `api`. */
export async function enviarFormulario<T = unknown>(caminho: string, form: FormData): Promise<T> {
  return lerResposta(await fetch(`/api${caminho}`, { method: "POST", body: form, cache: "no-store" })) as Promise<T>;
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

const LADO_MAXIMO = 1600;
const QUALIDADE_JPEG = 0.7;

/** Reduz a foto para ~1600 px e JPEG 70% (≈300 KB), como a especificação pede; formatos que o navegador não decodifica passam como vieram. */
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
 * Envia uma foto, uma assinatura ou um PDF de evidência (`PUT /arquivos/{id}`) com um id gerado aqui e devolve o id, que
 * os eventos referenciam (`arquivo_id`). Fotos são comprimidas antes; o PDF vai como está (a `api` confere o conteúdo e
 * o limite de 10 MB). Reenviar o mesmo id e conteúdo não tem efeito.
 */
export async function enviarArquivo(arquivo: Blob, tipo: "foto" | "assinatura" | "pdf", id: string = novoId()): Promise<string> {
  const conteudo = tipo === "foto" ? await comprimirFoto(arquivo) : arquivo;
  const nome = tipo === "foto" ? "foto.jpg" : tipo === "pdf" ? "documento.pdf" : "assinatura.png";
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

export interface EventoDeCampo {
  /** Gerado no cliente; reenviar o mesmo id não tem efeito. */
  id?: string;
  tipo:
    | "apr_concluida"
    | "execucao_iniciada"
    | "pausa_iniciada"
    | "pausa_encerrada"
    | "execucao_encerrada"
    | "execucao_interrompida"
    | "execucao_suspensa"
    | "execucao_cancelada";
  os_id?: string | null;
  payload: Record<string, unknown>;
  ocorrido_em?: string;
}

export interface RespostaEventos {
  confirmados: string[];
  alertas: string[];
  aprs: { id: string; resultado: "aprovada" | "bloqueada" }[];
  os: { id: string; status: string }[];
  rejeitados: { id: string; codigo: string; mensagem: string }[];
  pendentes: { id: string; codigo: string; mensagem: string }[];
}

/** O evento foi recusado (`rejeitado`) ou ainda não pode ser aplicado (`pendente`); `message` é o texto para o usuário. */
export class ErroDeEvento extends Error {
  constructor(
    public readonly situacao: "rejeitado" | "pendente",
    public readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

/**
 * Envia UM evento de campo (`POST /eventos`) e devolve a resposta da `api` (`aprs`, `os`, `alertas`). Se o evento não foi
 * aplicado, lança `ErroDeEvento` com a mensagem pronta ("Preencha a APR antes de iniciar", "Falta evidência em 1
 * item(ns)"…). Fotos e assinaturas precisam ter subido antes com `enviarArquivo`.
 */
export async function enviarEvento(evento: EventoDeCampo): Promise<RespostaEventos & { id: string }> {
  const id = evento.id ?? novoId();
  const resposta = await chamar<RespostaEventos>("POST", "/eventos", {
    eventos: [{ id, tipo: evento.tipo, os_id: evento.os_id ?? null, payload: evento.payload, ocorrido_em: evento.ocorrido_em ?? new Date().toISOString() }],
  });
  const recusa = resposta.rejeitados.find((r) => r.id === id);
  if (recusa) throw new ErroDeEvento("rejeitado", recusa.codigo, recusa.mensagem);
  const espera = resposta.pendentes.find((r) => r.id === id);
  if (espera) throw new ErroDeEvento("pendente", espera.codigo, espera.mensagem);
  return { ...resposta, id };
}
