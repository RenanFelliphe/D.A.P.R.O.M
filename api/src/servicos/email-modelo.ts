/**
 * O modelo visual de todos os e-mails do SYNQ OS: o cabeçalho com o nome, o título, os parágrafos, a lista de dados, as
 * seções (o resumo diário), o botão para abrir no painel e o rodapé que diz por que a pessoa recebe e como deixar de receber.
 * Sai sempre o texto puro e o HTML (com estilos em linha, que é o que os leitores de e-mail respeitam).
 */

export const escaparHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Uma linha de uma seção: o texto e, se houver, o link (o número da OS, o nome da pessoa). */
export interface LinhaDaSecao {
  texto: string;
  url?: string;
}

export interface SecaoDoEmail {
  titulo: string;
  linhas: LinhaDaSecao[];
  /** "e mais 3": o que não coube na lista. */
  mais?: number;
}

export interface PartesDoEmail {
  titulo: string;
  /** Destaque vermelho no título: a segurança do campo (APR bloqueada, interrupção por risco). */
  urgente?: boolean;
  paragrafos?: string[];
  itens?: { rotulo: string; valor: string }[];
  secoes?: SecaoDoEmail[];
  /** Trecho já em HTML seguro (montado com `escaparHtml`), para o que não cabe nas partes acima; o texto vem em `textoExtra`. */
  htmlExtra?: string;
  textoExtra?: string[];
  botao?: { texto: string; url: string };
  /** Por que a pessoa recebe e como deixar de receber. */
  rodape: string;
}

const COR = { marca: "#0F5C78", tinta: "#17212B", apagado: "#5B6670", linha: "#DADAD4", fundo: "#F2F2EE", urgente: "#A3241B" };

export function montarEmail(p: PartesDoEmail): { texto: string; html: string } {
  // ---- texto puro ----
  const texto: string[] = [p.titulo, ""];
  for (const par of p.paragrafos ?? []) texto.push(par, "");
  if (p.itens?.length) {
    for (const i of p.itens) texto.push(`${i.rotulo}: ${i.valor}`);
    texto.push("");
  }
  for (const s of p.secoes ?? []) {
    texto.push(s.titulo);
    for (const l of s.linhas) texto.push(`- ${l.texto}${l.url ? ` (${l.url})` : ""}`);
    if (s.mais) texto.push(`- e mais ${s.mais}`);
    texto.push("");
  }
  if (p.textoExtra?.length) texto.push(...p.textoExtra, "");
  if (p.botao) texto.push(`${p.botao.texto}: ${p.botao.url}`, "");
  texto.push("--", p.rodape);

  // ---- HTML ----
  const par = (s: string) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:${COR.tinta}">${escaparHtml(s)}</p>`;
  const itens = p.itens?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border-collapse:collapse;width:100%">${p.itens
        .map(
          (i) =>
            `<tr><td style="padding:6px 12px 6px 0;font-size:13px;color:${COR.apagado};vertical-align:top;white-space:nowrap">${escaparHtml(i.rotulo)}</td><td style="padding:6px 0;font-size:14px;color:${COR.tinta}">${escaparHtml(i.valor)}</td></tr>`,
        )
        .join("")}</table>`
    : "";
  const secoes = (p.secoes ?? [])
    .map(
      (s) =>
        `<h2 style="margin:18px 0 8px;font-size:15px;color:${COR.tinta}">${escaparHtml(s.titulo)}</h2><ul style="margin:0 0 8px;padding-left:20px;color:${COR.tinta}">${s.linhas
          .map((l) => `<li style="margin:0 0 6px;font-size:14px;line-height:1.4">${l.url ? `<a href="${escaparHtml(l.url)}" style="color:${COR.marca}">${escaparHtml(l.texto)}</a>` : escaparHtml(l.texto)}</li>`)
          .join("")}${s.mais ? `<li style="margin:0 0 6px;font-size:14px;color:${COR.apagado}">e mais ${s.mais}</li>` : ""}</ul>`,
    )
    .join("");
  const botao = p.botao
    ? `<p style="margin:22px 0 6px"><a href="${escaparHtml(p.botao.url)}" style="display:inline-block;background:${COR.marca};color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:11px 20px;border-radius:6px">${escaparHtml(p.botao.texto)}</a></p>`
    : "";
  const html = [
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escaparHtml(p.titulo)}</title></head>`,
    `<body style="margin:0;padding:0;background:${COR.fundo};font-family:Arial,Helvetica,sans-serif">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo}"><tr><td align="center" style="padding:24px 12px">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid ${COR.linha};border-radius:8px">`,
    `<tr><td style="padding:16px 24px;border-bottom:3px solid ${p.urgente ? COR.urgente : COR.marca};font-size:14px;font-weight:700;letter-spacing:0.08em;color:${COR.marca}">SYNQ OS</td></tr>`,
    `<tr><td style="padding:22px 24px 18px">`,
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${p.urgente ? COR.urgente : COR.tinta}">${escaparHtml(p.titulo)}</h1>`,
    (p.paragrafos ?? []).map(par).join(""),
    itens,
    secoes,
    p.htmlExtra ?? "",
    botao,
    `</td></tr>`,
    `<tr><td style="padding:14px 24px;border-top:1px solid ${COR.linha};font-size:12px;line-height:1.5;color:${COR.apagado}">${escaparHtml(p.rodape)}</td></tr>`,
    `</table></td></tr></table></body></html>`,
  ].join("");

  return { texto: texto.join("\n"), html };
}
