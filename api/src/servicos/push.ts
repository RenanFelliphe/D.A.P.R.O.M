import type { CanalDoPush } from "../../../shared/notificacoes/push";

/** O que sai para um aparelho. `dados` é o que o app lê ao tocar (`DadosDoPush`); `canal` é o canal do Android. */
export interface MensagemDePush {
  token: string;
  titulo: string;
  corpo: string;
  dados: Record<string, unknown>;
  canal: CanalDoPush;
  /** Quanto tempo o serviço guarda a mensagem para um aparelho sem sinal, em segundos. */
  validadeS?: number;
}

/** O que o serviço respondeu por aparelho: entregue ao serviço, ou o token não vale mais (o aparelho desinstalou o app). */
export type ResultadoDoPush = { token: string; situacao: "enviada" | "token_invalido" };

/**
 * O envio de push (`docs/pessoas-e-equipes.md`, seção 8.6). Falha do serviço (rede, `5xx`) lança exceção: a tarefa tenta de novo.
 * `configurado` diz se há um serviço de verdade; sem ele o aviso fica no sino (como o e-mail sem SMTP).
 */
export interface Push {
  readonly configurado: boolean;
  enviar(mensagens: MensagemDePush[]): Promise<ResultadoDoPush[]>;
}

/** O serviço de push da Expo aceita até 100 mensagens por chamada. */
const TAMANHO_DO_LOTE = 100;

type Ticket = { status: "ok"; id?: string } | { status: "error"; message?: string; details?: { error?: string } };

/**
 * O serviço de push da Expo (`https://exp.host/--/api/v2/push/send`), que entrega pelo FCM (Android) e pelo APNs (iOS). A chave de acesso
 * (`EXPO_ACCESS_TOKEN`) é opcional: só é exigida se a conta ligou "enhanced security". As credenciais do FCM ficam na conta da Expo
 * (`eas credentials`), não aqui.
 */
export class PushExpo implements Push {
  readonly configurado = true;
  constructor(
    private readonly url: string,
    private readonly chave: string,
    private readonly buscar: typeof fetch = fetch,
  ) {}

  async enviar(mensagens: MensagemDePush[]): Promise<ResultadoDoPush[]> {
    const resultados: ResultadoDoPush[] = [];
    for (let i = 0; i < mensagens.length; i += TAMANHO_DO_LOTE) {
      const lote = mensagens.slice(i, i + TAMANHO_DO_LOTE);
      const resposta = await this.buscar(this.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...(this.chave ? { Authorization: `Bearer ${this.chave}` } : {}) },
        body: JSON.stringify(
          lote.map((m) => ({ to: m.token, title: m.titulo, body: m.corpo, data: m.dados, channelId: m.canal, priority: m.canal === "urgente" ? "high" : "default", sound: "default", ...(m.validadeS ? { ttl: m.validadeS } : {}) })),
        ),
      });
      if (!resposta.ok) throw new Error(`Serviço de push respondeu ${resposta.status}`);
      const corpo = (await resposta.json()) as { data?: Ticket[] };
      const tickets = corpo.data ?? [];
      if (tickets.length !== lote.length) throw new Error("Serviço de push devolveu menos respostas que mensagens");
      lote.forEach((m, j) => {
        const t = tickets[j]!;
        resultados.push({ token: m.token, situacao: t.status === "error" && t.details?.error === "DeviceNotRegistered" ? "token_invalido" : "enviada" });
      });
    }
    return resultados;
  }
}

/** Sem serviço configurado (`PUSH_LIGADO=false`): nada sai. A tarefa não chega a chamar `enviar` (ver `configurado`). */
export class PushDesligado implements Push {
  readonly configurado = false;
  async enviar(): Promise<ResultadoDoPush[]> {
    throw new Error("Push desligado: a notificação não foi enviada");
  }
}

/** Guarda o que "enviaria": os testes e o modo local. `tokensInvalidos` simula o aparelho que desinstalou o app. */
export class PushEmMemoria implements Push {
  readonly enviadas: MensagemDePush[] = [];
  readonly tokensInvalidos = new Set<string>();
  configurado = true;
  falhar = false;
  constructor(private readonly opcoes: { registrar?: boolean } = {}) {}
  async enviar(mensagens: MensagemDePush[]): Promise<ResultadoDoPush[]> {
    if (this.falhar) throw new Error("Serviço de push fora do ar");
    return mensagens.map((m) => {
      this.enviadas.push(m);
      if (this.opcoes.registrar) console.log(`[push] ${m.token}: ${m.titulo}`);
      return { token: m.token, situacao: this.tokensInvalidos.has(m.token) ? ("token_invalido" as const) : ("enviada" as const) };
    });
  }
}
