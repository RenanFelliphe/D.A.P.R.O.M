import { ErroApi } from "../http/erros";
import { cabecalhosDeServico } from "./auth";

export const BUCKETS = ["fotos", "assinaturas", "pdfs", "importacoes"] as const;
export type Bucket = (typeof BUCKETS)[number];

/**
 * Arquivos (fotos, assinaturas, PDFs, planilhas) no Storage do Supabase, em buckets privados. O banco guarda só o
 * caminho; dentro do bucket o caminho é o id do arquivo, gerado no cliente (ou o da OS, nos PDFs).
 */
export interface Armazenamento {
  /** Não sobrescreve: se o caminho já existe devolve `existente` (quem chama compara o conteúdo, se importar). */
  gravar(bucket: Bucket, caminho: string, bytes: Uint8Array, tipoMime: string, opcoes?: { sobrescrever?: boolean }): Promise<"criado" | "existente" | "substituido">;
  existe(bucket: Bucket, caminho: string): Promise<boolean>;
  ler(bucket: Bucket, caminho: string): Promise<Uint8Array | null>;
  /** URL assinada de 10 minutos (padrão). */
  urlAssinada(bucket: Bucket, caminho: string, segundos?: number): Promise<string>;
}

export class ArmazenamentoSupabase implements Armazenamento {
  constructor(
    private readonly url: string,
    private readonly chave: string,
  ) {}

  private cabecalhos(extra: Record<string, string> = {}) {
    return { ...cabecalhosDeServico(this.chave), ...extra };
  }
  private rota(bucket: Bucket, caminho: string, prefixo = "") {
    return `${this.url}/storage/v1/object/${prefixo}${bucket}/${caminho.split("/").map(encodeURIComponent).join("/")}`;
  }

  /** Cria os buckets privados que ainda não existem (idempotente); roda na subida da api. */
  async garantirBuckets() {
    for (const nome of BUCKETS) {
      const r = await fetch(`${this.url}/storage/v1/bucket`, {
        method: "POST",
        headers: this.cabecalhos({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: nome, name: nome, public: false }),
      });
      if (r.ok) continue;
      const corpo: any = await r.json().catch(() => ({}));
      if (r.status === 409 || String(corpo.statusCode) === "409" || /already exists/i.test(String(corpo.message ?? corpo.error ?? ""))) continue;
      throw new ErroApi(502, "armazenamento_indisponivel", `Não foi possível criar o bucket ${nome}`);
    }
  }

  async existe(bucket: Bucket, caminho: string) {
    const r = await fetch(this.rota(bucket, caminho, "info/"), { headers: this.cabecalhos() });
    if (r.status === 404 || r.status === 400) return false;
    if (!r.ok) throw new ErroApi(502, "armazenamento_indisponivel", "Armazenamento de arquivos indisponível");
    return true;
  }

  async gravar(bucket: Bucket, caminho: string, bytes: Uint8Array, tipoMime: string, opcoes: { sobrescrever?: boolean } = {}) {
    const antes = opcoes.sobrescrever ? await this.existe(bucket, caminho) : false;
    const r = await fetch(this.rota(bucket, caminho), {
      method: "POST",
      headers: this.cabecalhos({ "Content-Type": tipoMime, "x-upsert": opcoes.sobrescrever ? "true" : "false" }),
      body: bytes as unknown as BodyInit,
    });
    if (r.ok) return antes ? "substituido" : "criado";
    const corpo: any = await r.json().catch(() => ({}));
    if (r.status === 409 || String(corpo.statusCode) === "409") return "existente";
    throw new ErroApi(502, "armazenamento_indisponivel", "Não foi possível gravar o arquivo");
  }

  async ler(bucket: Bucket, caminho: string) {
    const r = await fetch(this.rota(bucket, caminho), { headers: this.cabecalhos() });
    if (r.status === 404 || r.status === 400) return null;
    if (!r.ok) throw new ErroApi(502, "armazenamento_indisponivel", "Armazenamento de arquivos indisponível");
    return new Uint8Array(await r.arrayBuffer());
  }

  async urlAssinada(bucket: Bucket, caminho: string, segundos = 600) {
    const r = await fetch(this.rota(bucket, caminho, "sign/"), {
      method: "POST",
      headers: this.cabecalhos({ "Content-Type": "application/json" }),
      body: JSON.stringify({ expiresIn: segundos }),
    });
    if (!r.ok) throw new ErroApi(502, "armazenamento_indisponivel", "Não foi possível gerar o link do arquivo");
    const corpo: any = await r.json();
    return `${this.url}/storage/v1${corpo.signedURL}`;
  }
}

/** Armazenamento em memória, para testes e execução sem Supabase. */
export class ArmazenamentoEmMemoria implements Armazenamento {
  readonly arquivos = new Map<string, { bytes: Uint8Array; tipoMime: string }>();
  /** Endereço que `urlAssinada` devolve; o modo local o serve em `GET /arquivos-locais/{bucket}/{id}`. */
  constructor(private readonly baseUrl = "https://storage.local") {}
  private chave = (bucket: Bucket, caminho: string) => `${bucket}/${caminho}`;

  async gravar(bucket: Bucket, caminho: string, bytes: Uint8Array, tipoMime: string, opcoes: { sobrescrever?: boolean } = {}) {
    const k = this.chave(bucket, caminho);
    const jaExiste = this.arquivos.has(k);
    if (jaExiste && !opcoes.sobrescrever) return "existente";
    this.arquivos.set(k, { bytes, tipoMime });
    return jaExiste ? "substituido" : "criado";
  }
  async existe(bucket: Bucket, caminho: string) {
    return this.arquivos.has(this.chave(bucket, caminho));
  }
  async ler(bucket: Bucket, caminho: string) {
    return this.arquivos.get(this.chave(bucket, caminho))?.bytes ?? null;
  }
  async urlAssinada(bucket: Bucket, caminho: string, segundos = 600) {
    return `${this.baseUrl}/${bucket}/${caminho}?expira=${segundos}`;
  }
}
