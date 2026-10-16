import { eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Deps } from "../deps";
import { apr, aprParticipante, evidencia, execucao, execucaoAssinatura, os, usuario } from "../db/schema";
import { podeVerEquipe, type Autenticacao, type Ambiente, type UsuarioAutenticado } from "../http/autenticacao";
import { ErroApi, invalido, naoEncontrado, proibido } from "../http/erros";
import { responder } from "../http/resposta";
import { lerId } from "../http/validacao";
import { bucketDaEvidencia } from "../dominio/evidencias";
import type { Bucket } from "../servicos/armazenamento";

const MB = 1024 * 1024;

/**
 * O que cada `tipo` de envio aceita. Foto e assinatura são imagens; o PDF (documento de evidência: laudo, atestado,
 * relatório) é conferido pelo conteúdo, que precisa começar como um PDF, e não só pelo tipo que o navegador declarou.
 */
const TIPOS = {
  foto: { bucket: "fotos", limite: 10 * MB, formato: "imagem" },
  assinatura: { bucket: "assinaturas", limite: 1 * MB, formato: "imagem" },
  pdf: { bucket: "documentos", limite: 10 * MB, formato: "pdf" },
} as const satisfies Record<string, { bucket: Bucket; limite: number; formato: "imagem" | "pdf" }>;
type TipoDeEnvio = keyof typeof TIPOS;

/** A assinatura `%PDF-` aparece no começo do arquivo (a especificação do PDF tolera até 1 KB de lixo antes dela). */
const ehPdf = (bytes: Uint8Array) => Buffer.from(bytes.subarray(0, 1024)).includes("%PDF-");

/** Descobre de quem é o arquivo `id` e em qual bucket ele está, a partir do que o referencia; `null` = ninguém o referencia. */
async function localizar(deps: Deps, id: string): Promise<{ bucket: Bucket; equipeId: string | null; donoId?: string } | null> {
  const [daExecucao] = await deps.db
    .select({ equipeId: os.equipeId, tipo: evidencia.tipo })
    .from(evidencia)
    .innerJoin(execucao, eq(execucao.id, evidencia.execucaoId))
    .innerJoin(os, eq(os.id, execucao.osId))
    .where(eq(evidencia.fotoPath, id))
    .limit(1);
  if (daExecucao) return { bucket: bucketDaEvidencia(daExecucao.tipo), equipeId: daExecucao.equipeId };

  // Evidência de item reprovado (foto ou PDF): pertence à APR, não à execução.
  const [daApr] = await deps.db
    .select({ equipeId: os.equipeId, tipo: evidencia.tipo })
    .from(evidencia)
    .innerJoin(apr, eq(apr.id, evidencia.aprId))
    .innerJoin(os, eq(os.id, apr.osId))
    .where(eq(evidencia.fotoPath, id))
    .limit(1);
  if (daApr) return { bucket: bucketDaEvidencia(daApr.tipo), equipeId: daApr.equipeId };

  const [doPerfil] = await deps.db.select({ equipeId: usuario.equipeId, donoId: usuario.id }).from(usuario).where(eq(usuario.assinaturaPath, id)).limit(1);
  if (doPerfil) return { bucket: "assinaturas", ...doPerfil };

  const [naApr] = await deps.db
    .select({ equipeId: os.equipeId })
    .from(aprParticipante)
    .innerJoin(apr, eq(apr.id, aprParticipante.aprId))
    .innerJoin(os, eq(os.id, apr.osId))
    .where(eq(aprParticipante.assinaturaPath, id))
    .limit(1);
  if (naApr) return { bucket: "assinaturas", equipeId: naApr.equipeId };

  const [naExecucao] = await deps.db
    .select({ equipeId: os.equipeId })
    .from(execucaoAssinatura)
    .innerJoin(execucao, eq(execucao.id, execucaoAssinatura.execucaoId))
    .innerJoin(os, eq(os.id, execucao.osId))
    .where(eq(execucaoAssinatura.assinaturaPath, id))
    .limit(1);
  if (naExecucao) return { bucket: "assinaturas", equipeId: naExecucao.equipeId };

  const [pdf] = await deps.db.select({ equipeId: os.equipeId }).from(os).where(eq(os.pdfPath, id)).limit(1);
  if (pdf) return { bucket: "pdfs", equipeId: pdf.equipeId };
  return null;
}

const podeLer = (u: UsuarioAutenticado, alvo: { equipeId: string | null; donoId?: string }) =>
  alvo.donoId === u.id || (alvo.equipeId !== null ? podeVerEquipe(u, alvo.equipeId) : u.perfil === "admin");

/** Fotos, assinaturas e PDFs sobem com o id gerado no cliente, antes do evento que os referencia (Decisão-chave 3). */
export function rotasArquivos(deps: Deps, { autenticar }: Autenticacao) {
  const r = new Hono<Ambiente>();

  // Um usuário desativado ou ausente ainda envia a fila offline pendente (do que fez antes), e os arquivos vêm antes dos eventos.
  r.put("/arquivos/:id", autenticar({ permitirDesativado: true, permitirAusente: true }), async (c) => {
    const id = lerId(c);
    const form = await c.req.parseBody().catch(() => null);
    const arquivo = form?.arquivo;
    const tipo = form?.tipo;
    if (!(arquivo instanceof File)) throw invalido("validacao", "arquivo: envie o arquivo no campo multipart \"arquivo\"");
    if (typeof tipo !== "string" || !Object.hasOwn(TIPOS, tipo)) throw invalido("validacao", 'tipo: use "foto", "assinatura" ou "pdf"');
    const { bucket, limite, formato } = TIPOS[tipo as TipoDeEnvio];
    if (formato === "imagem" && !arquivo.type.startsWith("image/")) throw invalido("tipo_de_arquivo", "Envie uma imagem");
    if (arquivo.size === 0) throw invalido("arquivo_vazio", "Arquivo vazio");
    if (arquivo.size > limite) throw new ErroApi(413, "arquivo_grande", `Arquivo maior que ${limite / MB} MB`);

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    if (formato === "pdf" && !ehPdf(bytes)) throw invalido("tipo_de_arquivo", "Envie um arquivo PDF");
    const resultado = await deps.armazenamento.gravar(bucket, id, bytes, formato === "pdf" ? "application/pdf" : arquivo.type);
    if (resultado === "existente") {
      // Reenviar o mesmo id e conteúdo não tem efeito; outro conteúdo com o mesmo id é erro do cliente.
      const gravado = await deps.armazenamento.ler(bucket, id);
      if (!gravado || Buffer.compare(Buffer.from(gravado), Buffer.from(bytes)) !== 0) {
        throw new ErroApi(409, "arquivo_diferente", "Já existe outro arquivo com este id");
      }
    }
    return responder(c, { id, caminho: id });
  });

  r.get("/arquivos/:id/url", autenticar(), async (c) => {
    const id = lerId(c);
    const alvo = await localizar(deps, id);
    if (!alvo) throw naoEncontrado("Arquivo não encontrado");
    if (!podeLer(c.get("usuario"), alvo)) throw proibido();
    return responder(c, { url: await deps.armazenamento.urlAssinada(alvo.bucket, id) });
  });

  return r;
}
