import { dentroDaJanela } from "./janela";

/**
 * As credenciais do login sem sinal. No login com sinal, o app guarda, no armazenamento seguro do aparelho, **o hash salgado da senha**
 * (nunca a senha) e o instante em que o servidor confirmou a conta. Sem sinal, quem digita o e-mail e a senha de uma conta guardada
 * há no máximo 7 dias entra; depois disso, "Conecte-se para entrar". A senha trocada na web só vale aqui depois do próximo login com
 * sinal, e a conta que o servidor recusou ou desativou deixa de valer na hora (`esquecer`).
 *
 * Não conhece o React Native: o armazenamento, a derivação e a data entram por `Dependencias`, então os testes usam uma memória e
 * uma derivação rápida. Cada pessoa tem o seu registro (uma só, por aparelho, na prática, mas a fila de quem saiu continua dela).
 */

/** O custo da derivação: sobe a conta do atacante que tem o aparelho e o hash, mas o telefone também a faz (em JavaScript, sem módulo nativo). */
export const ITERACOES_DA_SENHA = 30_000;

/** O servidor só é "reconfirmado" no registro se a última confirmação for mais velha que isto (evita gravar a cada `GET /me`). */
const RECONFIRMAR_DEPOIS_DE_MS = 3_600_000;

export interface RegistroDeCredencial {
  usuarioId: string;
  /** O e-mail institucional, em minúsculas. */
  email: string;
  /** Sal aleatório, em hexadecimal. */
  sal: string;
  hash: string;
  iteracoes: number;
  /** Quando o servidor confirmou a conta pela última vez (ISO). */
  confirmadoEm: string;
}

/** Onde o texto fica (o `expo-secure-store`, no aparelho). */
export interface ArmazemDeTexto {
  ler(): Promise<string | null>;
  gravar(texto: string): Promise<void>;
  apagar(): Promise<void>;
}

export interface DependenciasDasCredenciais {
  armazem: ArmazemDeTexto;
  derivar(senha: string, salHex: string, iteracoes: number): Promise<string>;
  /** Um sal novo, em hexadecimal (16 bytes aleatórios). */
  novoSal(): string;
  agora(): Date;
  iteracoes?: number;
}

export type ResultadoDaVerificacao =
  | { ok: true; registro: RegistroDeCredencial }
  | {
      ok: false;
      /** `sem-registro`: este aparelho não conhece a conta; `vencido`: passou de 7 dias; `senha`: a senha não confere com a do último acesso. */
      motivo: "sem-registro" | "vencido" | "senha";
    };

const normalizar = (email: string) => email.trim().toLowerCase();

/** Compara sem parar no primeiro caractere diferente. */
function iguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

const registroValido = (r: unknown): r is RegistroDeCredencial => {
  const x = r as Partial<RegistroDeCredencial> | null;
  return Boolean(x) && typeof x!.usuarioId === "string" && typeof x!.email === "string" && typeof x!.sal === "string" && typeof x!.hash === "string" && typeof x!.confirmadoEm === "string" && Number.isInteger(x!.iteracoes);
};

export function criarCredenciais(d: DependenciasDasCredenciais) {
  const iteracoes = d.iteracoes ?? ITERACOES_DA_SENHA;
  /** As gravações, uma de cada vez: ler, mudar e gravar não pode se misturar com outra. */
  let cauda: Promise<unknown> = Promise.resolve();
  const naVez = <T>(tarefa: () => Promise<T>): Promise<T> => {
    const resultado = cauda.then(tarefa, tarefa);
    cauda = resultado.catch(() => undefined);
    return resultado;
  };

  async function ler(): Promise<RegistroDeCredencial[]> {
    const texto = await d.armazem.ler().catch(() => null);
    if (!texto) return [];
    try {
      const dados = JSON.parse(texto) as { registros?: unknown };
      return Array.isArray(dados.registros) ? dados.registros.filter(registroValido) : [];
    } catch {
      return [];
    }
  }

  /** Grava só o que ainda vale: o registro vencido não serve para mais nada. */
  async function gravar(registros: RegistroDeCredencial[]): Promise<void> {
    const vivos = registros.filter((r) => dentroDaJanela(r.confirmadoEm, d.agora()));
    if (vivos.length === 0) await d.armazem.apagar();
    else await d.armazem.gravar(JSON.stringify({ versao: 1, registros: vivos }));
  }

  return {
    /** No login com sinal (e na troca de senha): guarda o hash da senha e marca a conta como confirmada agora. */
    async guardar(p: { usuarioId: string; email: string; senha: string }): Promise<void> {
      const sal = d.novoSal();
      const hash = await d.derivar(p.senha, sal, iteracoes);
      await naVez(async () => {
        const email = normalizar(p.email);
        const outros = (await ler()).filter((r) => r.usuarioId !== p.usuarioId && r.email !== email);
        await gravar([...outros, { usuarioId: p.usuarioId, email, sal, hash, iteracoes, confirmadoEm: d.agora().toISOString() }]);
      });
    },

    /** O servidor confirmou a conta de novo (um `GET /me` com sinal): a janela de 7 dias recomeça. */
    confirmar(usuarioId: string): Promise<void> {
      return naVez(async () => {
        const registros = await ler();
        const r = registros.find((x) => x.usuarioId === usuarioId);
        if (!r) return;
        const idade = d.agora().getTime() - Date.parse(r.confirmadoEm);
        if (Number.isFinite(idade) && idade >= 0 && idade < RECONFIRMAR_DEPOIS_DE_MS) return;
        r.confirmadoEm = d.agora().toISOString();
        await gravar(registros);
      });
    },

    /** Sem sinal: este e-mail e esta senha entram? */
    async verificar(email: string, senha: string): Promise<ResultadoDaVerificacao> {
      const r = (await ler()).find((x) => x.email === normalizar(email));
      if (!r) return { ok: false, motivo: "sem-registro" };
      if (!dentroDaJanela(r.confirmadoEm, d.agora())) return { ok: false, motivo: "vencido" };
      const hash = await d.derivar(senha, r.sal, r.iteracoes);
      return iguais(hash, r.hash) ? { ok: true, registro: r } : { ok: false, motivo: "senha" };
    },

    /** O servidor recusou a sessão (conta desativada, senha redefinida): a conta deixa de entrar sem sinal. */
    esquecer(usuarioId: string): Promise<void> {
      return naVez(async () => gravar((await ler()).filter((r) => r.usuarioId !== usuarioId)));
    },

    /** Só para os testes e para a tela: o registro da conta, se houver. */
    async registroDe(usuarioId: string): Promise<RegistroDeCredencial | null> {
      return (await ler()).find((r) => r.usuarioId === usuarioId) ?? null;
    },
  };
}

export type Credenciais = ReturnType<typeof criarCredenciais>;

/** O que a tela diz quando o login sem sinal não entra. */
export function mensagemDaEntradaSemSinal(motivo: "sem-registro" | "vencido" | "senha"): string {
  switch (motivo) {
    case "sem-registro":
      return "Sem conexão com o servidor. Este aparelho ainda não guarda o seu acesso: conecte-se para entrar pela primeira vez.";
    case "vencido":
      return "Sem conexão com o servidor. Faz mais de 7 dias que você entrou com sinal neste aparelho: conecte-se para entrar.";
    case "senha":
      return "Senha incorreta. Sem conexão, vale a senha do seu último acesso com sinal; se você a trocou em outro lugar, conecte-se para entrar.";
  }
}
