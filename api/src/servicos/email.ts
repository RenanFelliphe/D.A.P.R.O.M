import nodemailer, { type Transporter } from "nodemailer";

export interface Mensagem {
  para: string;
  assunto: string;
  texto: string;
  html?: string;
}

/** Envio de e-mail (alertas de bloqueio). Falha lança exceção: a tarefa `email_alerta` tenta de novo. */
export interface Email {
  enviar(mensagem: Mensagem): Promise<void>;
}

export class EmailSmtp implements Email {
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
}

/** Guarda o que "enviaria": testes e execução sem SMTP (`SMTP_URL` vazio). */
export class EmailEmMemoria implements Email {
  readonly enviados: Mensagem[] = [];
  async enviar(m: Mensagem) {
    this.enviados.push(m);
  }
}
