import { ErroDaApi, ErroDeRede } from "./erros";

/**
 * O cliente da `api`: a camada única por onde o app fala com o servidor. `Authorization: Bearer`, JSON com as chaves em
 * `snake_case` (como a `api` devolve), renovação automática da sessão uma vez por `POST /auth/refresh` quando a resposta for `401`
 * e os erros no formato `{erro: {codigo, mensagem}}` como `ErroDaApi`. Não conhece React Native: o armazenamento dos tokens e o
 * `fetch` entram por parâmetro (o app usa o `expo-secure-store`; os testes, uma memória).
 */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  /** Instante em que o `accessToken` expira (ISO 8601). */
  expiraEm: string;
}

export interface ArmazemDeTokens {
  ler(): Promise<Tokens | null>;
  gravar(tokens: Tokens): Promise<void>;
  apagar(): Promise<void>;
}

export interface OpcoesDoCliente {
  urlBase: string;
  armazem: ArmazemDeTokens;
  fetch?: typeof fetch;
  agora?: () => number;
  /** A renovação foi recusada (`401`): os tokens já foram apagados e o app deve voltar para a entrada. */
  aoSessaoEncerrada?: () => void;
  /** Renova o token que vence em menos que isto, antes de chamar (padrão 30 s). */
  margemDeRenovacaoMs?: number;
  /** Tempo máximo de uma chamada (padrão 30 s); estourou, vira `ErroDeRede`. */
  tempoLimiteMs?: number;
  /**
   * A pessoa entrou sem sinal, pela senha guardada no aparelho, e ainda não há sessão no servidor: toda chamada autenticada vira
   * `ErroDeRede` sem sair do aparelho (o login e a renovação, que não usam o token, seguem).
   */
  modoLocal?: () => boolean;
}

export interface OpcoesDeChamada {
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Corpo JSON. */
  corpo?: unknown;
  /** Corpo multipart (arquivos); o `Content-Type` com o limite sai do próprio `fetch`. */
  formulario?: FormData;
  /** Query string; valores `undefined`, `null` e vazios são omitidos. */
  consulta?: Record<string, string | number | boolean | null | undefined>;
  /** Não manda o token (login e renovação). */
  semAutenticacao?: boolean;
  /** Tempo máximo desta chamada, no lugar do padrão do cliente. */
  tempoLimiteMs?: number;
}

export interface SessaoDoLogin {
  /** O usuário como `POST /auth/login` o devolve (o app relê `GET /me` logo depois). */
  usuario: Record<string, unknown>;
  senhaProvisoria: boolean;
}

export interface ClienteApi {
  /** Chama a `api` e devolve o JSON; qualquer status fora de 2xx lança `ErroDaApi`, e a falta de rede lança `ErroDeRede`. */
  chamar<T = unknown>(caminho: string, opcoes?: OpcoesDeChamada): Promise<T>;
  /** Como `chamar`, devolvendo a resposta crua (o PDF da OS, por exemplo). */
  chamarBruto(caminho: string, opcoes?: OpcoesDeChamada): Promise<Response>;
  /** O cabeçalho `Authorization` com o token válido, para quem baixa arquivo fora do `fetch` (o leitor de PDF). */
  autorizacao(): Promise<Record<string, string>>;
  /** O endereço completo de um caminho da `api`. */
  endereco(caminho: string, consulta?: OpcoesDeChamada["consulta"]): string;
  entrar(email: string, senha: string): Promise<SessaoDoLogin>;
  /** `POST /auth/sair` (se a `api` estiver fora, a saída vale do mesmo jeito) e apaga os tokens do aparelho. */
  sair(): Promise<void>;
  temSessao(): Promise<boolean>;
}

type CorpoDeErro = { erro?: { codigo?: string; mensagem?: string } & Record<string, unknown> };

async function lerJson(resposta: Response): Promise<Record<string, unknown> & CorpoDeErro> {
  const texto = await resposta.text();
  if (!texto) return {};
  try {
    return JSON.parse(texto);
  } catch {
    return {};
  }
}

const erroDa = (resposta: Response, dados: CorpoDeErro) =>
  new ErroDaApi(resposta.status, dados.erro?.codigo ?? "erro", dados.erro?.mensagem ?? "Erro ao falar com o servidor", dados.erro ?? {});

const MENSAGEM_DO_MODO_LOCAL = "Você entrou sem conexão, com a senha guardada neste aparelho. Conecte-se para usar isto.";

export function criarClienteApi(opcoes: OpcoesDoCliente): ClienteApi {
  const { armazem } = opcoes;
  const buscar: typeof fetch = opcoes.fetch ?? ((...args) => fetch(...args));
  const agora = opcoes.agora ?? Date.now;
  const margem = opcoes.margemDeRenovacaoMs ?? 30_000;
  const tempoLimite = opcoes.tempoLimiteMs ?? 30_000;
  let renovando: Promise<Tokens> | null = null;

  function endereco(caminho: string, consulta?: OpcoesDeChamada["consulta"]) {
    const base = `${opcoes.urlBase.replace(/\/$/, "")}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
    const partes = Object.entries(consulta ?? {})
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    return partes.length ? `${base}?${partes.join("&")}` : base;
  }

  /** `fetch` com tempo limite; qualquer falha antes de haver resposta é `ErroDeRede`. */
  async function enviar(url: string, init: RequestInit, limiteMs: number = tempoLimite): Promise<Response> {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), limiteMs);
    try {
      return await buscar(url, { ...init, signal: controle.signal });
    } catch {
      throw new ErroDeRede();
    } finally {
      clearTimeout(relogio);
    }
  }

  function renovar(): Promise<Tokens> {
    if (renovando) return renovando;
    const tentativa = (async (): Promise<Tokens> => {
      const atuais = await armazem.ler();
      if (!atuais) throw new ErroDaApi(401, "nao_autenticado", "Sessão inválida ou expirada");
      const resposta = await enviar(endereco("/auth/refresh"), {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: atuais.refreshToken }),
      });
      const dados = await lerJson(resposta);
      if (!resposta.ok) {
        // Só a recusa da `api` encerra a sessão; um erro do servidor (5xx) mantém os tokens para a próxima tentativa.
        if (resposta.status === 401 || resposta.status === 403) {
          await armazem.apagar();
          opcoes.aoSessaoEncerrada?.();
          throw new ErroDaApi(401, "nao_autenticado", "Sessão inválida ou expirada");
        }
        throw erroDa(resposta, dados);
      }
      const novos: Tokens = { accessToken: String(dados.access_token), refreshToken: String(dados.refresh_token), expiraEm: String(dados.expira_em) };
      await armazem.gravar(novos);
      return novos;
    })();
    renovando = tentativa;
    const limpar = () => {
      if (renovando === tentativa) renovando = null;
    };
    tentativa.then(limpar, limpar);
    return tentativa;
  }

  /** O token em uso: o gravado, ou um novo se faltar menos que a margem para vencer. `null` = sem sessão. */
  async function tokenValido(): Promise<Tokens | null> {
    const atuais = await armazem.ler();
    if (!atuais) return null;
    const expira = Date.parse(atuais.expiraEm);
    if (Number.isFinite(expira) && expira - agora() < margem) return renovar();
    return atuais;
  }

  async function chamarBruto(caminho: string, o: OpcoesDeChamada = {}): Promise<Response> {
    const metodo = o.metodo ?? (o.corpo !== undefined || o.formulario ? "POST" : "GET");
    const url = endereco(caminho, o.consulta);
    const montar = (tokens: Tokens | null): RequestInit => {
      const cabecalhos: Record<string, string> = { Accept: "application/json" };
      if (tokens) cabecalhos.Authorization = `Bearer ${tokens.accessToken}`;
      if (o.corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
      return { method: metodo, headers: cabecalhos, body: o.formulario ?? (o.corpo === undefined ? undefined : JSON.stringify(o.corpo)) };
    };

    if (o.semAutenticacao) return enviar(url, montar(null), o.tempoLimiteMs);
    if (opcoes.modoLocal?.()) throw new ErroDeRede(MENSAGEM_DO_MODO_LOCAL);
    const tokens = await tokenValido();
    if (!tokens) throw new ErroDaApi(401, "nao_autenticado", "Sessão inválida ou expirada");
    const resposta = await enviar(url, montar(tokens), o.tempoLimiteMs);
    if (resposta.status !== 401) return resposta;
    // `401` com o token que parecia válido: renova uma vez (sem pedir a senha) e repete. Falhou de novo, o erro segue para quem chamou.
    return enviar(url, montar(await renovar()), o.tempoLimiteMs);
  }

  async function chamar<T>(caminho: string, o: OpcoesDeChamada = {}): Promise<T> {
    const resposta = await chamarBruto(caminho, o);
    const dados = await lerJson(resposta);
    if (!resposta.ok) throw erroDa(resposta, dados);
    return dados as T;
  }

  return {
    chamar,
    chamarBruto,
    endereco,
    async autorizacao() {
      if (opcoes.modoLocal?.()) throw new ErroDeRede(MENSAGEM_DO_MODO_LOCAL);
      const tokens = await tokenValido();
      if (!tokens) throw new ErroDaApi(401, "nao_autenticado", "Sessão inválida ou expirada");
      return { Authorization: `Bearer ${tokens.accessToken}` };
    },
    async entrar(email, senha) {
      const dados = await chamar<{ access_token: string; refresh_token: string; expira_em: string; usuario: Record<string, unknown>; senha_provisoria: boolean }>("/auth/login", {
        corpo: { email: email.trim().toLowerCase(), senha },
        semAutenticacao: true,
      });
      await armazem.gravar({ accessToken: dados.access_token, refreshToken: dados.refresh_token, expiraEm: dados.expira_em });
      return { usuario: dados.usuario, senhaProvisoria: dados.senha_provisoria };
    },
    async sair() {
      try {
        await chamar("/auth/sair", { metodo: "POST", corpo: {} });
      } catch {
        // Sem sinal ou com a `api` fora do ar a saída vale do mesmo jeito; só a revogação no servidor fica para o vencimento do token.
      }
      await armazem.apagar();
    },
    async temSessao() {
      return (await armazem.ler()) !== null;
    },
  };
}
