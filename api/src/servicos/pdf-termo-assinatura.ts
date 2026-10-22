import PDFDocument from "pdfkit";
import { dataHoraBr } from "./pdf-formato";

export interface DadosDoTermo {
  /** O código da assinatura no SYNQ OS (o mesmo `external_id` do provedor): amarra o PDF ao registro de auditoria. */
  codigo: string;
  /** O que a pessoa assina: o título da janela de assinatura. */
  titulo: string;
  resumo: string | null;
  signatario: { nome: string; matricula: string; cargo: string | null; email: string };
  os: { numeroOrdem: string | null; titulo: string } | null;
  geradoEm: Date;
  /** Quando o ato foi feito sem sinal e só agora é assinado: a data em que ele aconteceu. */
  atoFeitoEm?: Date;
}

/**
 * O termo do ato, uma página A4: o que se assina, quem assina e quando. É o documento que a ZapSign recebe; a página de assinaturas
 * (nome, data e hora, IP, código de verificação) é acrescentada por ela. O texto vem do servidor (a OS e a pessoa são lidas do banco);
 * só o título e o resumo vêm da janela que a pessoa confirmou.
 */
export async function gerarPdfDoTermo(d: DadosDoTermo): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4", margins: { top: 56, bottom: 56, left: 56, right: 56 }, info: { Title: d.titulo, Author: "SYNQ OS", CreationDate: d.geradoEm } });
  const pedacos: Buffer[] = [];
  doc.on("data", (p: Buffer) => pedacos.push(p));
  const pronto = new Promise<void>((resolver, rejeitar) => {
    doc.on("end", resolver);
    doc.on("error", rejeitar);
  });

  const largura = doc.page.width - 112;
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#666666").text("SYNQ OS · TERMO DE ASSINATURA ELETRÔNICA", { width: largura });
  doc.moveDown(0.6);
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#111111").text(d.titulo, { width: largura });
  doc.moveDown(0.8);

  const campo = (rotulo: string, valor: string) => {
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#666666").text(rotulo.toUpperCase(), { width: largura });
    doc.font("Helvetica").fontSize(12).fillColor("#111111").text(valor, { width: largura });
    doc.moveDown(0.6);
  };

  if (d.resumo) campo("O que está sendo assinado", d.resumo);
  if (d.os) campo("Ordem de serviço", `${d.os.numeroOrdem ? `OS ${d.os.numeroOrdem} · ` : ""}${d.os.titulo}`);
  campo("Signatário", `${d.signatario.nome} · matrícula ${d.signatario.matricula}${d.signatario.cargo ? ` · ${d.signatario.cargo}` : ""}`);
  campo("E-mail institucional", d.signatario.email);
  if (d.atoFeitoEm) campo("O ato foi feito em", `${dataHoraBr(d.atoFeitoEm)} (sem sinal, com a assinatura desenhada do perfil)`);
  campo(d.atoFeitoEm ? "Termo gerado em" : "Data e hora", `${dataHoraBr(d.geradoEm)} (horário de Brasília)`);

  doc.moveDown(0.6);
  doc.font("Helvetica").fontSize(11).fillColor("#111111").text(
    "Declaro que li e confirmo o ato descrito acima, e o assino eletronicamente. A assinatura é feita na página do provedor de assinatura eletrônica, que registra a data, a hora e a identificação de quem assinou.",
    { width: largura, align: "justify" },
  );
  doc.moveDown(1.5);
  doc.font("Helvetica").fontSize(8).fillColor("#666666").text(`Código do documento no SYNQ OS: ${d.codigo}`, { width: largura });

  doc.end();
  await pronto;
  return new Uint8Array(Buffer.concat(pedacos));
}
