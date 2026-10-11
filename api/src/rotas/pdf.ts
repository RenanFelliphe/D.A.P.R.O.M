import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { os } from "../db/schema";
import type { Deps } from "../deps";
import { podeVerEquipe, type Ambiente, type Autenticacao } from "../http/autenticacao";
import { conflito, naoEncontrado } from "../http/erros";
import { lerId } from "../http/validacao";
import { gerarEGuardarPdfOs } from "../servicos/pdf-os";

/** `GET /os/{id}/pdf`: o PDF de 2 páginas da OS, para quem enxerga a OS (a de outra equipe não existe: 404). */
export function rotasPdf(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.get("/os/:id/pdf", autenticar(), async (c) => {
    const id = lerId(c);
    const [o] = await deps.db.select({ equipeId: os.equipeId, status: os.status, pdfPath: os.pdfPath }).from(os).where(eq(os.id, id));
    if (!o || !podeVerEquipe(c.get("usuario"), o.equipeId)) throw naoEncontrado("OS não encontrada");

    let bytes = o.pdfPath ? await deps.armazenamento.ler("pdfs", o.pdfPath) : null;
    if (!bytes) {
      // Sem PDF guardado (a tarefa ainda não rodou, ou o arquivo sumiu): gera na hora, se a OS já encerrou.
      if (o.status !== "encerrada") throw conflito("os_nao_encerrada", "A OS ainda não foi encerrada");
      bytes = (await gerarEGuardarPdfOs(deps, id)).bytes;
    }
    return c.body(bytes as unknown as ArrayBuffer, 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="os-${id}.pdf"`,
      "Cache-Control": "private, no-store",
    });
  });

  return r;
}
