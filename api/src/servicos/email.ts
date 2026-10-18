import nodemailer, { type Transporter } from "nodemailer";

export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

/**
 * Envio de e-mail (os avisos e o resumo diário). Falha lança exceção: a tarefa tenta de novo. `configurado` diz se há um
 * servidor de verdade: sem ele as tarefas de e-mail terminam sem enviar e sem marcar o aviso como enviado (o aviso fica no sino).
 */
export interface Email {
  readonly configurado: boolean;
  enviar(mensagem: Mensagem): Promise<void>;
}

export class EmailSmtp implements Email {
  readonly configurado = true;
  private transporte: Transporter;
  constructor(
    smtpUrl: string,
    private readonly remetente: string,
  ) {
    this.transporte = nodemailer.createTransport(smtpUrl);
  }
  async enviar(m: Mensagem) {
    await this.transporte.sendMail({ from: this.remetente, to: m.para, subject: m.assunto, text: m.texto, html: m.html });
  }
  /** Conecta e autentica no servidor sem enviar nada (`pnpm email:testar`). */
  async verificar() {
    await this.transporte.verify();
  }
}

/** Sem `SMTP_URL`: nada sai. As tarefas de e-mail não chegam a chamar `enviar` (ver `configurado`). */
export class EmailSemServidor implements Email {
  readonly configurado = false;
  async enviar(): Promise<void> {
    throw new Error("SMTP_URL não configurado: o e-mail não foi enviado");
  }
}

/** Guarda o que "enviaria": os testes e o modo local. Com `registrar`, também escreve no console quem receberia e o assunto. */
export class EmailEmMemoria implements Email {
  readonly enviados: Mensagem[] = [];
  configurado = true;
  constructor(private readonly opcoes: { registrar?: boolean } = {}) {}
  async enviar(m: Mensagem) {
    this.enviados.push(m);
    if (this.opcoes.registrar) console.log(`[e-mail] para ${m.para}: ${m.assunto}`);
  }
}
