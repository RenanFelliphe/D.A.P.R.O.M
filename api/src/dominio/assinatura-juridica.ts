import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import {
  CABECALHO_ASSINATURA_JURIDICA,
  CAMPO_ASSINATURA_JURIDICA_DO_EVENTO,
  ERRO_ASSINATURA_JURIDICA_PENDENTE,
  VALIDADE_DA_ASSINATURA_JURIDICA_MIN,
  type AssinaturaJuridica,
  type AssinaturaJuridicaDaOs,
  type SituacaoDaAssinaturaJuridica,
} from "../../../shared/api/assinatura-juridica";
import type { Db } from "../db/conexao";
import { assinaturaJuridica, os, usuario } from "../db/schema";
import type { Deps } from "../deps";
import { podeSupervisionarEquipe, podeVerEquipe, type Ambiente, type UsuarioAutenticado } from "../http/autenticacao";
import { conflito, ErroApi, invalido, naoEncontrado, proibido } from "../http/erros";
import { ErroDoProvedor } from "../servicos/assinatura-juridica";
import { gerarPdfDoTermo } from "../servicos/pdf-termo-assinatura";
import { adiar, rejeitar } from "./eventos-base";

/**
 * A assinatura com validade jurídica (`docs/pessoas-e-equipes.md`, seção 3.3). O ciclo: a janela do ato cria a assinatura (o termo vai
 * ao provedor), a pessoa assina na página dele, a `api` confere com o provedor (por consulta, ou quando o webhook avisa) e o ato chega
 * com o código dela, que a `api` consome: serve a um ato só, e fica gravado qual.
 */

type Linha = typeof assinaturaJuridica.$inferSelect;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O título da pendência de cada evento de campo assinado que veio sem sinal. */
export const TITULO_DO_EVENTO_ASSINADO: Record<string, string> = {
  apr_assinada: "Assinatura da APR",
  encerramento_assinado: "Assinatura do encerramento da execução",
  execucao_interrompida: "Interrupção da execução por risco",
  execucao_cancelada: "Cancelamento da execução por engano",
};

export function assinaturaJuridicaParaApi(l: Linha): AssinaturaJuridica {
  return {
    id: l.id,
    titulo: l.titulo,
    resumo: l.resumo,
    situacao: l.situacao,
    url_assinatura: l.situacao === "aguardando" ? l.urlAssinatura : null,
    criada_em: l.criadaEm.toISOString(),
    assinada_em: l.assinadaEm?.toISOString() ?? null,
    usada: l.usadaEm !== null,
    pdf_pronto: l.pdfPath !== null,
    os_id: l.osId,
    origem_offline: l.origemOffline,
  };
}

const provedorIndisponivel = () => new ErroApi(502, "assinatura_juridica_indisponivel", "O provedor de assinatura não respondeu. Tente de novo em instantes.");

function exigirLigada(deps: Deps) {
  if (!deps.config.assinaturaJuridica.ligada || !deps.provedorDeAssinatura.configurado) {
    throw new ErroApi(409, "assinatura_juridica_desligada", "A assinatura com validade jurídica não está ligada neste ambiente");
  }
}

async function dadosDoTermo(deps: Deps, eu: UsuarioAutenticado, l: { id: string; titulo: string; resumo: string | null; osId: string | null }, extra: { atoFeitoEm?: Date } = {}) {
  const [pessoa] = await deps.db.select({ cargo: usuario.cargo }).from(usuario).where(eq(usuario.id, eu.id));
  const [ordem] = l.osId ? await deps.db.select({ numeroOrdem: os.numeroOrdem, titulo: os.titulo }).from(os).where(eq(os.id, l.osId)) : [];
  return gerarPdfDoTermo({
    codigo: l.id,
    titulo: l.titulo,
    resumo: l.resumo,
    signatario: { nome: eu.nome, matricula: eu.matricula, cargo: pessoa?.cargo ?? null, email: eu.email },
    os: ordem ?? null,
    geradoEm: deps.agora(),
    ...extra,
  });
}

/** Cria o documento no provedor para a pessoa assinar agora (`POST /assinaturas-juridicas`). */
export async function criarAssinaturaJuridica(
  deps: Deps,
  eu: UsuarioAutenticado,
  entrada: { titulo: string; resumo?: string; osId?: string },
): Promise<AssinaturaJuridica> {
  exigirLigada(deps);
  if (entrada.osId) {
    const [ordem] = await deps.db.select({ equipeId: os.equipeId }).from(os).where(eq(os.id, entrada.osId));
    if (!ordem || !podeVerEquipe(eu, ordem.equipeId)) throw naoEncontrado("OS não encontrada");
  }
  const id = randomUUID();
  const base = { id, titulo: entrada.titulo, resumo: entrada.resumo ?? null, osId: entrada.osId ?? null };
  const pdf = await dadosDoTermo(deps, eu, base);
  let documento;
  try {
    documento = await deps.provedorDeAssinatura.criarDocumento({ nome: entrada.titulo, pdf, signatario: { nome: eu.nome, email: eu.email }, referencia: id });
  } catch (erro) {
    if (!(erro instanceof ErroDoProvedor)) throw erro;
    console.warn(`[assinatura] o provedor recusou o documento: ${erro.message}`);
    throw provedorIndisponivel();
  }
  const [linha] = await deps.db
    .insert(assinaturaJuridica)
    .values({ ...base, usuarioId: eu.id, situacao: "aguardando", provedor: deps.provedorDeAssinatura.nome, documentoId: documento.documentoId, urlAssinatura: documento.urlAssinatura, criadaEm: deps.agora() })
    .returning();
  return assinaturaJuridicaParaApi(linha!);
}

/**
 * Confere a assinatura que está `aguardando` com o provedor e grava o que mudou: `assinada` (com o PDF assinado, guardado em `pdfs`),
 * `recusada`, ou `falhou` se o provedor não conhece mais o documento. Falha passageira do provedor não muda nada: a próxima consulta tenta.
 * Idempotente (a consulta da janela e o webhook podem chegar juntos).
 */
export async function atualizarAssinaturaJuridica(deps: Deps, linha: Linha): Promise<Linha> {
  if (linha.situacao !== "aguardando" || !linha.documentoId) return linha;
  const mudar = async (valores: Partial<Linha> & { situacao: SituacaoDaAssinaturaJuridica }) => {
    const [nova] = await deps.db
      .update(assinaturaJuridica)
      .set(valores)
      .where(and(eq(assinaturaJuridica.id, linha.id), eq(assinaturaJuridica.situacao, "aguardando")))
      .returning();
    // Perdeu a corrida para outra consulta: vale a que gravou primeiro.
    return nova ?? (await deps.db.select().from(assinaturaJuridica).where(eq(assinaturaJuridica.id, linha.id)))[0]!;
  };

  let estado;
  try {
    estado = await deps.provedorDeAssinatura.consultar(linha.documentoId);
  } catch (erro) {
    if (erro instanceof ErroDoProvedor && erro.inexistente) return mudar({ situacao: "falhou" });
    console.warn(`[assinatura] consulta ao provedor falhou: ${(erro as Error).message}`);
    return linha;
  }
  if (estado.situacao === "aguardando") return linha;
  if (estado.situacao === "recusada") return mudar({ situacao: "recusada" });
  const pdfPath = await guardarPdfAssinado(deps, linha.id, estado.urlPdf);
  return mudar({ situacao: "assinada", assinadaEm: estado.assinadaEm ?? deps.agora(), pdfPath });
}

/** Baixa o PDF assinado do provedor e o guarda no bucket `pdfs`; `null` se o provedor ainda não o entrega (a leitura do PDF tenta de novo). */
async function guardarPdfAssinado(deps: Deps, id: string, urlPdf: string | null): Promise<string | null> {
  if (!urlPdf) return null;
  try {
    const bytes = await deps.provedorDeAssinatura.baixarPdf(urlPdf);
    const caminho = `assinaturas-juridicas/${id}.pdf`;
    await deps.armazenamento.gravar("pdfs", caminho, bytes, "application/pdf", { sobrescrever: true });
    return caminho;
  } catch (erro) {
    console.warn(`[assinatura] não foi possível guardar o PDF assinado: ${(erro as Error).message}`);
    return null;
  }
}

async function minhaLinha(deps: Deps, eu: UsuarioAutenticado, id: string): Promise<Linha> {
  if (!UUID.test(id)) throw naoEncontrado("Assinatura não encontrada");
  const [linha] = await deps.db.select().from(assinaturaJuridica).where(and(eq(assinaturaJuridica.id, id), eq(assinaturaJuridica.usuarioId, eu.id)));
  if (!linha) throw naoEncontrado("Assinatura não encontrada");
  return linha;
}

/** `GET /assinaturas-juridicas/{id}`: a situação de agora, conferida com o provedor se ainda aguarda. */
export async function consultarAssinaturaJuridica(deps: Deps, eu: UsuarioAutenticado, id: string): Promise<AssinaturaJuridica> {
  return assinaturaJuridicaParaApi(await atualizarAssinaturaJuridica(deps, await minhaLinha(deps, eu, id)));
}

/** O webhook do provedor avisa que o documento mudou: a `api` não confia no aviso, só reconsulta o provedor. */
export async function avisoDoProvedor(deps: Deps, documentoId: string): Promise<void> {
  const [linha] = await deps.db.select().from(assinaturaJuridica).where(eq(assinaturaJuridica.documentoId, documentoId));
  if (linha) await atualizarAssinaturaJuridica(deps, linha);
}

/** `GET /assinaturas-juridicas`: as da pessoa, da mais recente à mais antiga; com `situacao`, só as dessa situação. */
export async function listarMinhasAssinaturasJuridicas(deps: Deps, eu: UsuarioAutenticado, situacao?: SituacaoDaAssinaturaJuridica): Promise<AssinaturaJuridica[]> {
  const linhas = await deps.db
    .select()
    .from(assinaturaJuridica)
    .where(situacao ? and(eq(assinaturaJuridica.usuarioId, eu.id), eq(assinaturaJuridica.situacao, situacao)) : eq(assinaturaJuridica.usuarioId, eu.id))
    .orderBy(desc(assinaturaJuridica.criadaEm))
    .limit(100);
  return linhas.map(assinaturaJuridicaParaApi);
}

/**
 * `POST /assinaturas-juridicas/{id}/enviar`: o ato feito sem sinal (`pendente_offline`) vai ao provedor agora, para a pessoa assinar o que
 * já fez. O termo diz que o ato aconteceu sem sinal, com a assinatura desenhada, e quando. Repetir o pedido devolve a mesma assinatura.
 */
export async function enviarAssinaturaPendente(deps: Deps, eu: UsuarioAutenticado, id: string): Promise<AssinaturaJuridica> {
  exigirLigada(deps);
  const linha = await minhaLinha(deps, eu, id);
  if (linha.situacao !== "pendente_offline") {
    if (linha.situacao === "aguardando") return assinaturaJuridicaParaApi(await atualizarAssinaturaJuridica(deps, linha));
    throw conflito("assinatura_nao_pendente", "Esta assinatura não está pendente");
  }
  const pdf = await dadosDoTermo(deps, eu, linha, { atoFeitoEm: linha.criadaEm });
  let documento;
  try {
    documento = await deps.provedorDeAssinatura.criarDocumento({ nome: linha.titulo, pdf, signatario: { nome: eu.nome, email: eu.email }, referencia: linha.id });
  } catch (erro) {
    if (!(erro instanceof ErroDoProvedor)) throw erro;
    console.warn(`[assinatura] o provedor recusou o documento: ${erro.message}`);
    throw provedorIndisponivel();
  }
  const [nova] = await deps.db
    .update(assinaturaJuridica)
    .set({ situacao: "aguardando", provedor: deps.provedorDeAssinatura.nome, documentoId: documento.documentoId, urlAssinatura: documento.urlAssinatura })
    .where(and(eq(assinaturaJuridica.id, linha.id), eq(assinaturaJuridica.situacao, "pendente_offline")))
    .returning();
  return assinaturaJuridicaParaApi(nova ?? (await minhaLinha(deps, eu, id)));
}

/** `GET /assinaturas-juridicas/{id}/pdf`: o link do PDF assinado, para a própria pessoa, o admin e o supervisor da equipe da OS. */
export async function urlDoPdfAssinado(deps: Deps, eu: UsuarioAutenticado, id: string): Promise<string> {
  if (!UUID.test(id)) throw naoEncontrado("Assinatura não encontrada");
  const [dados] = await deps.db
    .select({ linha: assinaturaJuridica, equipeId: os.equipeId })
    .from(assinaturaJuridica)
    .leftJoin(os, eq(os.id, assinaturaJuridica.osId))
    .where(eq(assinaturaJuridica.id, id));
  if (!dados) throw naoEncontrado("Assinatura não encontrada");
  const { linha, equipeId } = dados;
  const dono = linha.usuarioId === eu.id;
  if (!dono && eu.perfil !== "admin" && !(equipeId && podeSupervisionarEquipe(eu, equipeId))) throw proibido("Só quem assinou, o supervisor da equipe da OS e o administrador veem o PDF assinado");
  if (linha.situacao !== "assinada") throw conflito("assinatura_nao_assinada", "A assinatura ainda não foi concluída");
  let caminho = linha.pdfPath;
  if (!caminho && linha.documentoId) {
    // O provedor ainda não entregava o PDF quando a assinatura foi confirmada: tenta de novo agora.
    try {
      const estado = await deps.provedorDeAssinatura.consultar(linha.documentoId);
      if (estado.situacao === "assinada") caminho = await guardarPdfAssinado(deps, linha.id, estado.urlPdf);
    } catch (erro) {
      console.warn(`[assinatura] consulta ao provedor falhou: ${(erro as Error).message}`);
    }
    if (caminho) await deps.db.update(assinaturaJuridica).set({ pdfPath: caminho }).where(eq(assinaturaJuridica.id, linha.id));
  }
  if (!caminho) throw conflito("pdf_assinado_indisponivel", "O provedor ainda não entregou o PDF assinado. Tente de novo em instantes.");
  return deps.armazenamento.urlAssinada("pdfs", caminho);
}

/** `GET /os/{id}/assinaturas-juridicas`: o que foi assinado com validade jurídica nos atos da OS, para quem enxerga a OS. */
export async function assinaturasJuridicasDaOs(deps: Deps, eu: UsuarioAutenticado, osId: string): Promise<AssinaturaJuridicaDaOs[]> {
  const [ordem] = await deps.db.select({ equipeId: os.equipeId }).from(os).where(eq(os.id, osId));
  if (!ordem || !podeVerEquipe(eu, ordem.equipeId)) throw naoEncontrado("OS não encontrada");
  const linhas = await deps.db
    .select({ linha: assinaturaJuridica, nome: usuario.nome })
    .from(assinaturaJuridica)
    .innerJoin(usuario, eq(usuario.id, assinaturaJuridica.usuarioId))
    .where(eq(assinaturaJuridica.osId, osId))
    .orderBy(desc(assinaturaJuridica.criadaEm));
  return linhas.map(({ linha, nome }) => ({ ...assinaturaJuridicaParaApi(linha), usuario: { id: linha.usuarioId, nome } }));
}

/**
 * Usa a assinatura num ato: ela precisa ser da pessoa, estar `assinada`, ter sido assinada há no máximo `VALIDADE_DA_ASSINATURA_JURIDICA_MIN`
 * minutos antes de `instante` e ainda não ter sido usada. Um `update` condicional faz a conferência e a marca num passo só, então dois atos
 * não usam a mesma assinatura. `ato` é o ato que a usa (fica na trilha de auditoria).
 */
export async function consumirAssinaturaJuridica(db: Db, entrada: { usuarioId: string; id: string; ato: string; instante: Date }): Promise<void> {
  if (!UUID.test(entrada.id)) throw invalido("assinatura_juridica_invalida", "Código de assinatura inválido");
  const limite = new Date(entrada.instante.getTime() - VALIDADE_DA_ASSINATURA_JURIDICA_MIN * 60_000);
  const [usada] = await db
    .update(assinaturaJuridica)
    .set({ usadaEm: entrada.instante, ato: entrada.ato })
    .where(
      and(
        eq(assinaturaJuridica.id, entrada.id),
        eq(assinaturaJuridica.usuarioId, entrada.usuarioId),
        eq(assinaturaJuridica.situacao, "assinada"),
        isNull(assinaturaJuridica.usadaEm),
        gte(assinaturaJuridica.assinadaEm, limite),
      ),
    )
    .returning({ id: assinaturaJuridica.id });
  if (usada) return;

  // Não serviu: diz por quê (a janela de assinatura refaz a assinatura quando o motivo é "venceu" ou "já foi usada").
  const [linha] = await db.select().from(assinaturaJuridica).where(and(eq(assinaturaJuridica.id, entrada.id), eq(assinaturaJuridica.usuarioId, entrada.usuarioId)));
  if (!linha) throw invalido("assinatura_juridica_invalida", "Assinatura não encontrada");
  if (linha.situacao !== "assinada") throw invalido("assinatura_juridica_nao_assinada", "Esta assinatura ainda não foi concluída na página do provedor");
  if (linha.usadaEm) throw invalido("assinatura_juridica_usada", "Esta assinatura já foi usada em outro ato: assine de novo");
  throw invalido("assinatura_juridica_vencida", `Esta assinatura venceu (vale ${VALIDADE_DA_ASSINATURA_JURIDICA_MIN} minutos): assine de novo`);
}

/** O ato não aconteceu (a rota recusou depois de a assinatura ser usada): devolve a assinatura para ser usada de novo. */
export async function liberarAssinaturaJuridica(db: Db, id: string, ato: string): Promise<void> {
  await db
    .update(assinaturaJuridica)
    .set({ usadaEm: null, ato: null })
    .where(and(eq(assinaturaJuridica.id, id), eq(assinaturaJuridica.ato, ato)));
}

/**
 * O ato feito sem sinal, que valeu com a assinatura desenhada: fica registrado como `pendente_offline` para a pessoa assinar depois, online.
 * `ocorridoEm` é quando o ato aconteceu no aparelho. Roda na transação do evento (se o evento for recusado, a pendência some junto).
 */
export async function registrarAssinaturaPendente(
  db: Db,
  entrada: { usuarioId: string; titulo: string; osId: string | null; ato: string; ocorridoEm: Date; recebidoEm: Date },
): Promise<void> {
  await db.insert(assinaturaJuridica).values({
    usuarioId: entrada.usuarioId,
    titulo: entrada.titulo,
    osId: entrada.osId,
    situacao: "pendente_offline",
    origemOffline: true,
    ato: entrada.ato,
    criadaEm: entrada.ocorridoEm,
    usadaEm: entrada.recebidoEm,
  });
}

/**
 * O evento de campo assinado (`EVENTOS_ASSINADOS`), na transação dele. Com o provedor ligado:
 * - com `payload.assinatura_juridica_id`: consome a assinatura (vale como no instante do ato: o `ocorrido_em` do aparelho se veio da fila);
 * - sem ela, o que veio da fila offline vale com a assinatura desenhada e vira `pendente_offline` para ser assinado depois; o mesmo vale
 *   para o código que não serviu. O que chegou com sinal fica pendente na fila do cliente: ele assina e reenvia (e, se o cliente desistir da
 *   assinatura, o evento só passa depois de velho como o da fila, como o aparelho sem sinal).
 * Com o provedor desligado não faz nada.
 */
export async function conferirAssinaturaDoEvento(
  tx: Db,
  usuario: Pick<UsuarioAutenticado, "id">,
  e: { id: string; tipo: string; payload: Record<string, unknown>; ocorridoEm: Date },
  osId: string | null,
  opcoes: { offline: boolean; recebidoEm: Date },
): Promise<void> {
  const codigo = e.payload[CAMPO_ASSINATURA_JURIDICA_DO_EVENTO];
  const ato = `evento:${e.tipo}:${e.id}`;
  const pendencia = () =>
    registrarAssinaturaPendente(tx, { usuarioId: usuario.id, titulo: TITULO_DO_EVENTO_ASSINADO[e.tipo] ?? e.tipo, osId, ato, ocorridoEm: e.ocorridoEm, recebidoEm: opcoes.recebidoEm });

  if (typeof codigo === "string" && codigo) {
    try {
      await consumirAssinaturaJuridica(tx, { usuarioId: usuario.id, id: codigo, ato, instante: opcoes.offline ? e.ocorridoEm : opcoes.recebidoEm });
      return;
    } catch (erro) {
      if (!(erro instanceof ErroApi)) throw erro;
      if (opcoes.offline) return pendencia();
      throw rejeitar(erro.codigo, erro.message);
    }
  }
  if (opcoes.offline) return pendencia();
  throw adiar(ERRO_ASSINATURA_JURIDICA_PENDENTE, "Assine o ato na página do provedor antes de confirmar");
}

/** Consome a assinatura do pedido dentro da transação do ato (ver `assinaturaJuridicaDoPedido`). */
export type ExigirAssinaturaJuridica = (db: Db) => Promise<void>;

/**
 * Para o ato que só às vezes assina (a conferência com divergência, a função de IA que passa a ler dados, a ausência registrada pelo supervisor):
 * o ato chama a função devolvida no momento de assinar, com a transação dele, então se o ato falha depois a assinatura volta sozinha.
 * Com o provedor desligado não faz nada.
 */
export function assinaturaJuridicaDoPedido(deps: Deps, c: Context<Ambiente>): ExigirAssinaturaJuridica {
  return async (db) => {
    if (!deps.config.assinaturaJuridica.ligada) return;
    const id = c.req.header(CABECALHO_ASSINATURA_JURIDICA)?.trim();
    if (!id) throw invalido(ERRO_ASSINATURA_JURIDICA_PENDENTE, "Assine o ato na página do provedor antes de confirmar");
    await consumirAssinaturaJuridica(db, { usuarioId: c.get("usuario").id, id, ato: `${c.req.method} ${c.req.path}`, instante: deps.agora() });
  };
}

/**
 * Nas rotas dos atos assinados (depois de `autenticar`): com o provedor ligado, o ato exige o código da assinatura no cabeçalho
 * `X-Assinatura-Juridica`. A `api` a consome antes de rodar a rota e a devolve se a rota recusar o ato. Com o provedor desligado não faz nada:
 * a assinatura desenhada segue valendo sozinha.
 */
export function exigirAssinaturaJuridica(deps: Deps): MiddlewareHandler<Ambiente> {
  return async (c, proximo) => {
    if (!deps.config.assinaturaJuridica.ligada) return proximo();
    const id = c.req.header(CABECALHO_ASSINATURA_JURIDICA)?.trim();
    if (!id) throw invalido(ERRO_ASSINATURA_JURIDICA_PENDENTE, "Assine o ato na página do provedor antes de confirmar");
    const ato = `${c.req.method} ${c.req.path}`;
    await consumirAssinaturaJuridica(deps.db, { usuarioId: c.get("usuario").id, id, ato, instante: deps.agora() });
    try {
      await proximo();
    } catch (erro) {
      await liberarAssinaturaJuridica(deps.db, id, ato);
      throw erro;
    }
    // O Hono trata a falha da rota e segue com a resposta de erro: é pelo status que se sabe que o ato não aconteceu.
    if (c.res.status >= 400) await liberarAssinaturaJuridica(deps.db, id, ato);
  };
}
