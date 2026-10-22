import { Hono } from "hono";
import { dataHoraBr } from "../servicos/pdf-formato";
import type { ProvedorDeAssinaturaSimulado } from "../servicos/assinatura-juridica";

const esc = (t: string) => t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function pagina(titulo: string, corpo: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>
<style>body{font-family:system-ui,sans-serif;margin:0;background:#f4f5f7;color:#1b1f24}main{max-width:480px;margin:0 auto;padding:24px 16px}
.cartao{background:#fff;border:1px solid #d9dce1;border-radius:12px;padding:20px;display:grid;gap:12px}h1{font-size:20px;margin:0}p{margin:0;line-height:1.5}
.aviso{background:#fff4d6;border:1px solid #e8c766;border-radius:8px;padding:10px;font-size:14px}.ok{background:#e1f5e6;border-color:#8ccf9b}
button,a.botao{font:inherit;padding:12px 16px;border-radius:8px;border:1px solid #1d4ed8;background:#1d4ed8;color:#fff;cursor:pointer;text-align:center;text-decoration:none}
button.sec{background:#fff;color:#1d4ed8}.linha{display:grid;gap:8px}small{color:#5b6470}</style></head><body><main>${corpo}</main></body></html>`;
}

/**
 * A página de assinatura do provedor simulado (`ASSINATURA_PROVEDOR=simulado`, e o modo local): faz o papel da página da ZapSign para
 * mostrar o fluxo inteiro sem conta no provedor. Não tem validade jurídica, e a página diz isso.
 */
export function rotasAssinaturaSimulada(provedor: ProvedorDeAssinaturaSimulado) {
  const r = new Hono();

  r.get("/:id", (c) => {
    const d = provedor.documentos.get(c.req.param("id"));
    if (!d) return c.html(pagina("Documento não encontrado", `<div class="cartao"><h1>Documento não encontrado</h1><p>Este documento simulado não existe mais (o simulador reiniciou). Volte ao SYNQ OS e assine de novo.</p></div>`), 404);
    const id = esc(d.id);
    const estado = d.assinadoEm
      ? `<div class="aviso ok">Assinado por ${esc(d.signatario)} em ${esc(dataHoraBr(d.assinadoEm))}. Pode fechar esta aba e voltar ao SYNQ OS.</div>`
      : d.recusado
        ? `<div class="aviso">Assinatura recusada. Pode fechar esta aba e voltar ao SYNQ OS.</div>`
        : `<form method="post" action="/assinatura-simulada/${id}/assinar" class="linha"><button type="submit">Assinar como ${esc(d.signatario)}</button></form>
           <form method="post" action="/assinatura-simulada/${id}/recusar" class="linha"><button type="submit" class="sec">Recusar</button></form>`;
    return c.html(
      pagina(
        d.nome,
        `<div class="cartao"><small>Assinatura eletrônica · SIMULADA</small><h1>${esc(d.nome)}</h1>
         <div class="aviso">Esta é a assinatura simulada do SYNQ OS: serve para mostrar o fluxo e <strong>não tem validade jurídica</strong>.</div>
         <p>Signatário: <strong>${esc(d.signatario)}</strong></p>
         <a class="botao sec" style="background:#fff;color:#1d4ed8" href="/assinatura-simulada/${id}/pdf" target="_blank" rel="noopener">Ver o documento</a>
         ${estado}</div>`,
      ),
    );
  });

  r.get("/:id/pdf", (c) => {
    const d = provedor.documentos.get(c.req.param("id"));
    if (!d) return c.notFound();
    return c.body(d.pdf as unknown as ArrayBuffer, 200, { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${d.id}.pdf"`, "Cache-Control": "private, no-store" });
  });

  r.post("/:id/assinar", (c) => {
    provedor.assinar(c.req.param("id"));
    return c.redirect(`/assinatura-simulada/${c.req.param("id")}`, 303);
  });

  r.post("/:id/recusar", (c) => {
    provedor.recusar(c.req.param("id"));
    return c.redirect(`/assinatura-simulada/${c.req.param("id")}`, 303);
  });

  return r;
}
