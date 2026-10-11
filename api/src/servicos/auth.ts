import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { ErroApi } from "../http/erros";

export interface Sessao {
  accessToken: string;
  refreshToken: string;
  /** Instante em que o `accessToken` expira. */
  expiraEm: Date;
}

/**
 * Autenticação por trás da `api`: o Supabase Auth em produção. A `api` é a única a falar com ele; o cliente só
 * recebe os tokens que a `api` devolve. A senha nunca fica no nosso banco.
 */
export interface ProvedorAuth {
  /** Cria a conta e devolve o id, que passa a ser o `usuario.id`. */
  criarConta(email: string, senha: string): Promise<{ id: string }>;
  /** Desfaz `criarConta` quando a gravação no banco falha em seguida. */
  excluirConta(id: string): Promise<void>;
  /** Credencial errada → `null`; indisponibilidade → exceção. */
  entrar(email: string, senha: string): Promise<Sessao | null>;
  renovar(refreshToken: string): Promise<Sessao | null>;
  definirSenha(id: string, senha: string): Promise<void>;
  /** Bloqueia a conta e derruba as sessões (usuário desativado, depois de enviar a fila offline). */
  revogar(id: string): Promise<void>;
  /** Desfaz `revogar` (usuário reativado). */
  restaurar(id: string): Promise<void>;
}


/** Chave de serviço: a `service_role` legada é um JWT e vai também em `Authorization`; as chaves novas (`sb_secret_…`) não são JWT e vão só em `apikey`. */
export function cabecalhosDeServico(chave: string): Record<string, string> {
  return chave.startsWith("eyJ") ? { apikey: chave, Authorization: `Bearer ${chave}` } : { apikey: chave };
}

export const emailInterno = (matricula: string) => `${matricula.trim().toLowerCase()}@daprom.local`;

/** Supabase Auth (GoTrue) pela API REST, com a chave de serviço: só a `api` a tem. */
export class AuthSupabase implements ProvedorAuth {
  constructor(
    private readonly url: string,
    private readonly chave: string,
  ) {}

  private async chamar(caminho: string, init: { method: string; body?: unknown }) {
    const resposta = await fetch(`${this.url}/auth/v1${caminho}`, {
      method: init.method,
      headers: { ...cabecalhosDeServico(this.chave), "Content-Type": "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const texto = await resposta.text();
    let corpo: any = null;
    try {
      corpo = texto ? JSON.parse(texto) : null;
    } catch {
      /* resposta que não é JSON */
    }
    return { status: resposta.status, ok: resposta.ok, corpo };
  }

  private sessao(corpo: any): Sessao {
    return {
      accessToken: corpo.access_token,
      refreshToken: corpo.refresh_token,
      expiraEm: new Date((corpo.expires_at ?? Math.floor(Date.now() / 1000) + corpo.expires_in) * 1000),
    };
  }

  async criarConta(email: string, senha: string) {
    const r = await this.chamar("/admin/users", { method: "POST", body: { email, password: senha, email_confirm: true } });
    if (!r.ok) throw new ErroApi(502, "auth_indisponivel", "Não foi possível criar a conta de acesso");
    return { id: r.corpo.id as string };
  }

  async excluirConta(id: string) {
    await this.chamar(`/admin/users/${id}`, { method: "DELETE" });
  }

  async entrar(email: string, senha: string) {
    const r = await this.chamar("/token?grant_type=password", { method: "POST", body: { email, password: senha } });
    if (r.status === 400 || r.status === 401 || r.status === 422) return null;
    if (!r.ok) throw new ErroApi(502, "auth_indisponivel", "Serviço de autenticação indisponível");
    return this.sessao(r.corpo);
  }

  async renovar(refreshToken: string) {
    const r = await this.chamar("/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: refreshToken } });
    if (r.status === 400 || r.status === 401 || r.status === 422) return null;
    if (!r.ok) throw new ErroApi(502, "auth_indisponivel", "Serviço de autenticação indisponível");
    return this.sessao(r.corpo);
  }

  async definirSenha(id: string, senha: string) {
    const r = await this.chamar(`/admin/users/${id}`, { method: "PUT", body: { password: senha } });
    if (!r.ok) throw new ErroApi(502, "auth_indisponivel", "Não foi possível trocar a senha");
  }

  async revogar(id: string) {
    await this.chamar(`/admin/users/${id}`, { method: "PUT", body: { ban_duration: "876000h" } });
  }

  async restaurar(id: string) {
    await this.chamar(`/admin/users/${id}`, { method: "PUT", body: { ban_duration: "none" } });
  }
}

/**
 * Autenticação em memória, com JWT HS256 assinado pelo mesmo segredo que a `api` confere. Serve aos testes e a quem
 * quiser rodar a `api` sem Supabase; as contas somem quando o processo termina.
 */
export class AuthEmMemoria implements ProvedorAuth {
  private contas = new Map<string, { id: string; senha: string; revogada: boolean }>();
  private renovacoes = new Map<string, string>();

  constructor(
    private readonly segredoJwt: string,
    private readonly agora: () => Date = () => new Date(),
    private readonly duracaoSegundos = 3600,
  ) {}

  async criarConta(email: string, senha: string) {
    if (this.contas.has(email)) throw new ErroApi(409, "duplicado", "Conta já existe");
    const id = randomUUID();
    this.contas.set(email, { id, senha, revogada: false });
    return { id };
  }

  async excluirConta(id: string) {
    for (const [email, conta] of this.contas) if (conta.id === id) this.contas.delete(email);
  }

  private async emitir(id: string): Promise<Sessao> {
    const expiraEm = new Date(this.agora().getTime() + this.duracaoSegundos * 1000);
    const accessToken = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(id)
      .setIssuedAt(Math.floor(this.agora().getTime() / 1000))
      .setExpirationTime(Math.floor(expiraEm.getTime() / 1000))
      .sign(new TextEncoder().encode(this.segredoJwt));
    const refreshToken = randomUUID();
    this.renovacoes.set(refreshToken, id);
    return { accessToken, refreshToken, expiraEm };
  }

  async entrar(email: string, senha: string) {
    const conta = this.contas.get(email);
    if (!conta || conta.senha !== senha || conta.revogada) return null;
    return this.emitir(conta.id);
  }

  async renovar(refreshToken: string) {
    const id = this.renovacoes.get(refreshToken);
    const conta = [...this.contas.values()].find((c) => c.id === id);
    if (!id || !conta || conta.revogada) return null;
    this.renovacoes.delete(refreshToken);
    return this.emitir(id);
  }

  async definirSenha(id: string, senha: string) {
    for (const conta of this.contas.values()) if (conta.id === id) conta.senha = senha;
  }

  async revogar(id: string) {
    for (const conta of this.contas.values()) if (conta.id === id) conta.revogada = true;
  }

  async restaurar(id: string) {
    for (const conta of this.contas.values()) if (conta.id === id) conta.revogada = false;
  }
}
