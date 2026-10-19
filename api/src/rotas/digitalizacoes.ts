import { randomUUID } from "node:crypto";
import { desc, eq, ne } from "drizzle-orm";
import { Hono } from "hono";
import { digitalizacao } from "../db/schema";
import type { Deps } from "../deps";
import { BUCKET_DAS_FOLHAS, caminhoDaFolha, caminhoDoOriginal, situacaoDaOs, type LeituraDaDigitalizacao } from "../dominio/digitalizacao";
import { modelosComItens } from "../dominio/digitalizacao-apr";
import { esquemaRegistro, registrarDigitalizacao } from "../dominio/digitalizacao-registro";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { ErroApi, conflito, invalido, naoEncontrado } from "../http/erros";
import { responder } from "../http/resposta";
import { lerCorpo, lerId } from "../http/validacao";
import { enfileirarTarefa } from "../servicos/fila";
import { ehFotoAceita, MAX_FOTOS_POR_ENVIO, montarPdfDeFotos } from "../servicos/pdf-folhas";

/** O PDF digitalizado cresce com a resolução do scanner (a folha de 600 dpi passa de 1 MB): o limite é maior que o da importação. */
const LIMITE_DO_PDF = 30 * 1024 * 1024;
/** Uma foto de celular tem de 2 a 8 MB; a da câmera do navegador já chega reduzida. */
const LIMITE_DA_FOTO = 15 * 1024 * 1024;

type Linha = typeof digitalizacao.$inferSelect;

/** A digitalização como a tela a vê. A leitura só vai quando está pronta, com o que o sistema sabe de cada OS agora. */
async function apresentar(deps: Deps, l: Linha, comLeitura: boolean) {
  const base = {
    id: l.id,
    nome_arquivo: l.nomeArquivo,
    estado: l.estado,
    etapa: l.etapa,
    paginas: l.paginas,
    paginas_lidas: l.paginasLidas,
    usou_ia: l.usouIa,
    erro: l.erro,
    criada_em: l.criadaEm,
    atualizada_em: l.atualizadaEm,
  };
  if (!comLeitura || l.estado !== "lida" || !l.leitura) return base;
  const leitura = l.leitura as LeituraDaDigitalizacao;
  // O que o sistema sabe de cada OS é de agora (a OS pode ter sido importada ou executada desde a leitura): não fica guardado.
  const ordens = await Promise.all(leitura.ordens.map(async (o) => ({ ...o, situacao: await situacaoDaOs(deps.db, o.ordem) })));
  return { ...base, leitura: { ...leitura, ordens } };
}

/**
 * Digitalização de OS antigas (só o admin): o PDF escaneado das folhas já executadas no papel entra, é lido em segundo plano (OCR
 * local para o impresso, IA de visão para o manuscrito), o admin confere e a OS é registrada como encerrada, de histórico. Os
 * passos: `POST /digitalizacoes` (envia e enfileira a leitura), `GET /digitalizacoes/{id}` (andamento e, pronta, a leitura),
 * `POST /digitalizacoes/{id}/registro` (as OS conferidas) ou `DELETE` (descarta). Desenho na seção 10 do vitoria.md.
 */
export function rotasDigitalizacoes(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const admin = [autenticar(), exigirPerfil("admin")] as const;

  /**
   * Entrada: o PDF escaneado (campo `arquivo`) ou as fotos de folhas avulsas tiradas na câmera (campo `fotos`, repetido, uma por
   * folha e na ordem). As fotos viram um PDF, e dali em diante o caminho é o mesmo.
   */
  r.post("/digitalizacoes", ...admin, async (c) => {
    const eu = c.get("usuario");
    const form = await c.req.parseBody({ all: true }).catch(() => null);
    const arquivos = (campo: string) => [form?.[campo]].flat().filter((v): v is File => v instanceof File);
    const [arquivo] = arquivos("arquivo");
    const fotos = arquivos("fotos");
    if (arquivo && fotos.length > 0) throw invalido("validacao", 'envie o PDF (campo "arquivo") ou as fotos (campo "fotos"), não os dois');
    if (!arquivo && fotos.length === 0) throw invalido("validacao", 'arquivo: envie o PDF digitalizado no campo multipart "arquivo" ou as fotos das folhas no campo "fotos"');

    let bytes: Uint8Array;
    let nome: string;
    if (arquivo) {
      if (arquivo.size === 0) throw invalido("arquivo_vazio", "Arquivo vazio");
      if (arquivo.size > LIMITE_DO_PDF) throw new ErroApi(413, "arquivo_grande", `Arquivo maior que ${LIMITE_DO_PDF / 1024 / 1024} MB`);
      bytes = new Uint8Array(await arquivo.arrayBuffer());
      // O PDF começa por "%PDF-" (alguns geradores põem bytes antes, dentro do primeiro 1 KB).
      if (!Buffer.from(bytes.subarray(0, 1024)).toString("latin1").includes("%PDF-")) throw invalido("pdf_invalido", "O arquivo não é um PDF");
      nome = arquivo.name.slice(0, 200) || "digitalizacao.pdf";
    } else {
      if (fotos.length > MAX_FOTOS_POR_ENVIO) throw invalido("fotos_demais", `No máximo ${MAX_FOTOS_POR_ENVIO} fotos por envio: para mais folhas, escaneie e envie o PDF`);
      const lidas: Uint8Array[] = [];
      for (const foto of fotos) {
        if (foto.size === 0) throw invalido("arquivo_vazio", "Uma das fotos está vazia");
        if (foto.size > LIMITE_DA_FOTO) throw new ErroApi(413, "arquivo_grande", `Uma das fotos passa de ${LIMITE_DA_FOTO / 1024 / 1024} MB`);
        const conteudo = new Uint8Array(await foto.arrayBuffer());
        if (!ehFotoAceita(conteudo)) throw invalido("foto_invalida", "Envie as fotos em JPEG ou PNG");
        lidas.push(conteudo);
      }
      bytes = await montarPdfDeFotos(lidas, "Fotos das folhas da OS");
      nome = `Fotos de ${lidas.length === 1 ? "1 folha" : `${lidas.length} folhas`}.pdf`;
    }

    const id = randomUUID();
    const caminho = caminhoDoOriginal(id);
    await deps.armazenamento.gravar(BUCKET_DAS_FOLHAS, caminho, bytes, "application/pdf");
    try {
      await deps.db.transaction(async (tx) => {
        await tx.insert(digitalizacao).values({ id, usuarioId: eu.id, nomeArquivo: nome, arquivo: caminho });
        await enfileirarTarefa(tx, "digitalizacao", id, deps.agora());
      });
    } catch (erro) {
      await deps.armazenamento.remover(BUCKET_DAS_FOLHAS, caminho).catch(() => undefined);
      throw erro;
    }
    const [criada] = await deps.db.select().from(digitalizacao).where(eq(digitalizacao.id, id));
    return responder(c, await apresentar(deps, criada!, false), 202);
  });

  /** As digitalizações que ainda não foram registradas (em leitura, prontas para conferir ou que falharam), da mais nova para a mais antiga. */
  r.get("/digitalizacoes", ...admin, async (c) => {
    const linhas = await deps.db.select().from(digitalizacao).where(ne(digitalizacao.estado, "registrada")).orderBy(desc(digitalizacao.criadaEm)).limit(20);
    return responder(c, { digitalizacoes: await Promise.all(linhas.map((l) => apresentar(deps, l, false))) });
  });

  /**
   * Os modelos de APR com os itens, para a conferência da APR em papel escolher o modelo e marcar a resposta de cada item. É do admin,
   * que também vê o que é eliminatório (aqui, `resposta_bloqueante`): o aviso de que a resposta bloquearia uma APR nova.
   */
  r.get("/digitalizacoes/modelos-apr", ...admin, async (c) => responder(c, { modelos: await modelosComItens(deps.db) }));

  r.get("/digitalizacoes/:id", ...admin, async (c) => {
    const [l] = await deps.db.select().from(digitalizacao).where(eq(digitalizacao.id, lerId(c)));
    if (!l) throw naoEncontrado("Digitalização não encontrada");
    return responder(c, await apresentar(deps, l, true));
  });

  /** A folha (JPEG) ao lado da conferência. */
  r.get("/digitalizacoes/:id/folhas/:numero", ...admin, async (c) => {
    const id = lerId(c);
    const numero = Number(c.req.param("numero"));
    const [l] = await deps.db.select({ paginas: digitalizacao.paginas }).from(digitalizacao).where(eq(digitalizacao.id, id));
    if (!l || !Number.isInteger(numero) || numero < 1 || numero > l.paginas) throw naoEncontrado("Folha não encontrada");
    const bytes = await deps.armazenamento.ler(BUCKET_DAS_FOLHAS, caminhoDaFolha(id, numero));
    if (!bytes) throw naoEncontrado("Folha não encontrada");
    return c.body(bytes as unknown as ArrayBuffer, 200, { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=3600" });
  });

  r.post("/digitalizacoes/:id/registro", ...admin, async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const corpo = await lerCorpo(c, esquemaRegistro);
    return responder(c, await registrarDigitalizacao(deps, { id: eu.id, nome: eu.nome }, id, corpo), 201);
  });

  /** Descarta uma digitalização que não foi registrada: apaga o PDF e as folhas. */
  r.delete("/digitalizacoes/:id", ...admin, async (c) => {
    const id = lerId(c);
    const [l] = await deps.db.select().from(digitalizacao).where(eq(digitalizacao.id, id));
    if (!l) throw naoEncontrado("Digitalização não encontrada");
    if (l.estado === "registrada") throw conflito("digitalizacao_registrada", "Esta digitalização já foi registrada: as OS dela estão no sistema");
    if (l.estado === "lendo") throw conflito("digitalizacao_em_leitura", "A leitura ainda está em andamento: espere terminar para descartar");
    for (let n = 1; n <= l.paginas; n++) await deps.armazenamento.remover(BUCKET_DAS_FOLHAS, caminhoDaFolha(id, n)).catch(() => undefined);
    await deps.armazenamento.remover(BUCKET_DAS_FOLHAS, l.arquivo).catch(() => undefined);
    await deps.db.delete(digitalizacao).where(eq(digitalizacao.id, id));
    return responder(c, {});
  });

  return r;
}

