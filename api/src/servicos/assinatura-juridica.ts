import { randomUUID } from "node:crypto";
import type { Config } from "../config";

/** O que a `api` manda ao provedor para a pessoa assinar. */
export interface EntradaDeDocumento {
  nome: string;
  pdf: Uint8Array;
  signatario: { nome: string; email: string };
  /** O id da assinatura no SYNQ OS: o provedor o guarda junto do documento (`external_id` na ZapSign). */
  referencia: string;
}

export interface DocumentoCriado {
  /** O código do documento no provedor: é com ele que a `api` consulta a situação depois. */
  documentoId: string;
  /** A página em que a pessoa assina. */
  urlAssinatura: string;
}

export type SituacaoNoProvedor =
  | { situacao: "aguardando" }
  | { situacao: "recusada" }
  | { situacao: "assinada"; assinadaEm: Date | null; /** Onde baixar o PDF assinado (o endereço vale pouco tempo); `null` se o provedor ainda não o tem. */ urlPdf: string | null };

/** O provedor não atendeu (rede, `5xx`, token recusado, documento que ele não conhece): a `api` responde `502`. */
export class ErroDoProvedor extends Error {
  constructor(
    mensagem: string,
    /** O provedor não conhece o documento (apagado, ou o provedor simulado reiniciou): não adianta tentar de novo. */
    public readonly inexistente = false,
  ) {
    super(mensagem);
  }
}

/**
 * O provedor de assinatura eletrônica com validade jurídica (`docs/pessoas-e-equipes.md`, seção 3.3). Falha lança `ErroDoProvedor`.
 * `configurado` diz se há provedor de verdade: sem ele os atos assinados seguem só com a assinatura desenhada.
 */
export interface ProvedorDeAssinatura {
  readonly nome: "zapsign" | "simulado" | "desligado";
  readonly configurado: boolean;
  criarDocumento(entrada: EntradaDeDocumento): Promise<DocumentoCriado>;
  consultar(documentoId: string): Promise<SituacaoNoProvedor>;
  baixarPdf(url: string): Promise<Uint8Array>;
}

/** O e-mail do signatário só segue ao provedor se for um endereço de verdade (as contas `.local` da demonstração não são). */
export function emailParaOProvedor(email: string): string | null {
  return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email) && !/\.local$/i.test(email) ? email : null;
}

interface RespostaDaZapSign {
  token?: string;
  status?: string;
  signed_file?: string | null;
  signers?: { token?: string; sign_url?: string; status?: string; signed_at?: string | null }[];
}

/**
 * A ZapSign (`https://docs.zapsign.com.br`): o documento nasce com `POST /docs/` (PDF em base64, um signatário, assinatura na tela, sem
 * e-mail: o link abre dentro do SYNQ OS) e a situação vem de `GET /docs/{token}/` (`pending` ou `signed`). O endereço do sandbox
 * (`https://sandbox.api.zapsign.com.br/api/v1`, sem validade jurídica) e o da produção só mudam em `ZAPSIGN_URL` e `ZAPSIGN_TOKEN`.
 */
export class ProvedorZapSign implements ProvedorDeAssinatura {
  readonly nome = "zapsign" as const;
  readonly configurado = true;
  constructor(
    private readonly url: string,
    private readonly token: string,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  private async chamar(metodo: "GET" | "POST", caminho: string, corpo?: unknown): Promise<RespostaDaZapSign> {
    let resposta: Response;
    try {
      resposta = await this.buscar(`${this.url}${caminho}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${this.token}`, Accept: "application/json", ...(corpo ? { "Content-Type": "application/json" } : {}) },
        ...(corpo ? { body: JSON.stringify(corpo) } : {}),
      });
    } catch (erro) {
      throw new ErroDoProvedor(`ZapSign inacessível: ${(erro as Error).message}`);
    }
    if (resposta.status === 404) throw new ErroDoProvedor("ZapSign não conhece o documento", true);
    if (!resposta.ok) throw new ErroDoProvedor(`ZapSign respondeu ${resposta.status}: ${(await resposta.text().catch(() => "")).slice(0, 300)}`);
    return (await resposta.json()) as RespostaDaZapSign;
  }

  async criarDocumento(e: EntradaDeDocumento): Promise<DocumentoCriado> {
    const email = emailParaOProvedor(e.signatario.email);
    const r = await this.chamar("POST", "/docs/", {
      name: e.nome.slice(0, 255),
      base64_pdf: Buffer.from(e.pdf).toString("base64"),
      lang: "pt-br",
      disable_signer_emails: true,
      external_id: e.referencia,
      signers: [{ name: e.signatario.nome, ...(email ? { email } : {}), auth_mode: "assinaturaTela", send_automatic_email: false, external_id: e.referencia }],
    });
    const urlAssinatura = r.signers?.[0]?.sign_url;
    if (!r.token || !urlAssinatura) throw new ErroDoProvedor("ZapSign não devolveu o código do documento e o link de assinatura");
    return { documentoId: r.token, urlAssinatura };
  }

  async consultar(documentoId: string): Promise<SituacaoNoProvedor> {
    const r = await this.chamar("GET", `/docs/${encodeURIComponent(documentoId)}/`);
    const status = (r.status ?? "").toLowerCase();
    // A documentação só descreve `pending` e `signed`; qualquer recusa que o provedor sinalize encerra a espera.
    if (status.includes("refus") || r.signers?.some((s) => (s.status ?? "").toLowerCase().includes("refus"))) return { situacao: "recusada" };
    if (status !== "signed") return { situacao: "aguardando" };
    const quando = r.signers?.map((s) => s.signed_at).find((x): x is string => Boolean(x));
    return { situacao: "assinada", assinadaEm: quando ? new Date(quando) : null, urlPdf: r.signed_file ?? null };
  }

  async baixarPdf(url: string): Promise<Uint8Array> {
    const r = await this.buscar(url);
    if (!r.ok) throw new ErroDoProvedor(`Não foi possível baixar o PDF assinado (${r.status})`);
    return new Uint8Array(await r.arrayBuffer());
  }
}

/** O provedor que a configuração pede: a ZapSign, o simulado, ou nenhum (`ligada` é falso). */
export function criarProvedorDeAssinatura(cfg: Config["assinaturaJuridica"]): ProvedorDeAssinatura {
  if (!cfg.ligada) return new ProvedorDeAssinaturaDesligado();
  return cfg.provedor === "zapsign" ? new ProvedorZapSign(cfg.url, cfg.token) : new ProvedorDeAssinaturaSimulado(cfg.urlPublicaDaApi);
}

/** Sem provedor (`ASSINATURA_PROVEDOR=desligado`, ou ZapSign sem token): nada é criado; a rota recusa antes de chegar aqui. */
export class ProvedorDeAssinaturaDesligado implements ProvedorDeAssinatura {
  readonly nome = "desligado" as const;
  readonly configurado = false;
  async criarDocumento(): Promise<DocumentoCriado> {
    throw new ErroDoProvedor("Assinatura com validade jurídica desligada");
  }
  async consultar(): Promise<SituacaoNoProvedor> {
    throw new ErroDoProvedor("Assinatura com validade jurídica desligada");
  }
  async baixarPdf(): Promise<Uint8Array> {
    throw new ErroDoProvedor("Assinatura com validade jurídica desligada");
  }
}

interface DocumentoSimulado {
  id: string;
  nome: string;
  signatario: string;
  pdf: Uint8Array;
  assinadoEm: Date | null;
  recusado: boolean;
}

/**
 * O provedor simulado: guarda os documentos na memória e a página de assinatura é da própria `api` (`/assinatura-simulada/{id}`, ver
 * `rotas/assinatura-simulada.ts`). Mostra o fluxo inteiro sem conta no provedor e **não tem validade jurídica**. Os testes o usam
 * como provedor em memória: `assinar` e `recusar` fazem o papel da pessoa na página do provedor, e `falhar` derruba o provedor.
 */
export class ProvedorDeAssinaturaSimulado implements ProvedorDeAssinatura {
  readonly nome = "simulado" as const;
  readonly configurado = true;
  readonly documentos = new Map<string, DocumentoSimulado>();
  falhar = false;
  /** Quantos documentos foram criados (os testes conferem que `enviar` e `criar` chamam o provedor uma vez só). */
  criados = 0;
  constructor(private readonly urlPublica = "http://localhost:3333") {}

  async criarDocumento(e: EntradaDeDocumento): Promise<DocumentoCriado> {
    if (this.falhar) throw new ErroDoProvedor("Provedor de assinatura fora do ar");
    const id = randomUUID();
    this.criados++;
    this.documentos.set(id, { id, nome: e.nome, signatario: e.signatario.nome, pdf: e.pdf, assinadoEm: null, recusado: false });
    return { documentoId: id, urlAssinatura: `${this.urlPublica}/assinatura-simulada/${id}` };
  }

  async consultar(documentoId: string): Promise<SituacaoNoProvedor> {
    if (this.falhar) throw new ErroDoProvedor("Provedor de assinatura fora do ar");
    const d = this.documentos.get(documentoId);
    if (!d) throw new ErroDoProvedor("Documento desconhecido do provedor simulado", true);
    if (d.recusado) return { situacao: "recusada" };
    if (!d.assinadoEm) return { situacao: "aguardando" };
    return { situacao: "assinada", assinadaEm: d.assinadoEm, urlPdf: `simulado:${d.id}` };
  }

  async baixarPdf(url: string): Promise<Uint8Array> {
    const d = this.documentos.get(url.replace(/^simulado:/, ""));
    if (!d) throw new ErroDoProvedor("Documento desconhecido do provedor simulado", true);
    return d.pdf;
  }

  /** A pessoa assinou na página do provedor. */
  assinar(documentoId: string, quando = new Date()): boolean {
    const d = this.documentos.get(documentoId);
    if (!d || d.recusado) return false;
    d.assinadoEm ??= quando;
    return true;
  }

  recusar(documentoId: string): boolean {
    const d = this.documentos.get(documentoId);
    if (!d || d.assinadoEm) return false;
    d.recusado = true;
    return true;
  }
}
