import { eq } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { digitalizacao, equipe, execucao, localInstalacao, os } from "../db/schema";
import type { Deps } from "../deps";
import { ErroApi } from "../http/erros";
import type { FolhaLidaPorOcr } from "../servicos/ocr";
import { abrirFolhas } from "../servicos/pdf-imagem";
import { IAIndisponivel, RespostaIAInvalida, type ImagemDeMensagem } from "../servicos/ia";
import { situacaoDaFuncao } from "./ia-funcoes";
import type { AprLida, EstadoDaIa } from "./digitalizacao-apr";
import { lerAprs, separarFolhasDaApr } from "./digitalizacao-apr-leitura";
import { lerManuscritoComIa, MANUSCRITO_VAZIO, MAX_IMAGENS_POR_OS, recortarFolha, type ManuscritoLido } from "./digitalizacao-ia";
import { lerOrdensDoPdf, normalizar, numeroDaFolha, OPERACOES, type OsDoPdf } from "./importacao-pdf";

/**
 * Digitalização de OS antigas, a leitura (a tarefa em segundo plano `digitalizacao`): o PDF escaneado vira folhas (imagem), o
 * OCR local lê o impresso e a IA de visão lê só o escrito à mão, o sistema confere o que foi lido com os cadastros e com o SAP, e a
 * leitura inteira fica guardada em `digitalizacao.leitura` à espera da conferência do admin. O registro, que cria as OS como
 * encerradas, é em `digitalizacao-registro.ts`.
 *
 * Princípio (`docs/ia-e-vitoria.md`, seção 6): a IA lê, o sistema confere e a pessoa confirma o que não bater.
 */

export type EstadoDoCampo = "confere" | "duvidoso" | "invalido" | "faltando";
export type CampoConferido =
  | "numero_ordem"
  | "tipo_ordem"
  | "titulo"
  | "centro_trabalho"
  | "local_instalacao"
  | "equipamento"
  | "data_inicio_prog"
  | "inicio_real"
  | "fim_real"
  | "numero_pessoas"
  | "texto";

export interface OsDigitalizada extends OsDoPdf {
  /** O número da ordem como foi lido: identifica a OS na conferência mesmo que a pessoa corrija o número. */
  chave: string;
  /** As folhas que trazem o cabeçalho da OS; as demais folhas dela (sem número, como a APR) nunca vão à IA. */
  folhas_da_os: number[];
  manuscrito: ManuscritoLido & { lido_por: "ia" | "nenhum" };
  /** A APR em papel que veio junto com a folha da OS (as folhas com o título "Análise Preliminar de Risco"); `null` quando não veio. */
  apr: AprLida | null;
  estados: Partial<Record<CampoConferido, EstadoDoCampo>>;
  /** O que a conferência achou e a pessoa deve olhar (em português). */
  avisos: string[];
}

export interface LeituraDaDigitalizacao {
  paginas: number;
  paginas_sem_ordem: number[];
  /** Nitidez média do que o OCR leu, de 0 a 100. */
  confianca_media: number;
  /** Se a IA leu o manuscrito; senão, `motivo` diz por quê (sem chave, sem cota, fora do ar). */
  ia: { usada: boolean; motivo: string | null };
  ordens: OsDigitalizada[];
}

export const BUCKET_DAS_FOLHAS = "importacoes" as const;
export const pastaDaDigitalizacao = (id: string) => `digitalizacoes/${id}`;
export const caminhoDoOriginal = (id: string) => `${pastaDaDigitalizacao(id)}/original.pdf`;
export const caminhoDaFolha = (id: string, numero: number) => `${pastaDaDigitalizacao(id)}/folha-${numero}.jpg`;

/** O código sem pontuação e com as trocas que o OCR e a letra de mão confundem (O/0, I/1, S/5), para comparar com o cadastro. */
const chaveDoCadastro = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/I/g, "1").replace(/S/g, "5");

const MENSAGEM_DA_FALHA = "Não foi possível ler as folhas deste PDF. Confira se o arquivo é o PDF digitalizado da OS e tente de novo.";
/** Confiança média do OCR abaixo da qual o impresso fica "duvidoso": a folha está escura, torta ou clara demais. */
const CONFIANCA_BOA = 80;

async function andamento(db: Db, id: string, dados: Partial<typeof digitalizacao.$inferInsert>, agora: Date, aoAndar?: () => Promise<void>) {
  await db.update(digitalizacao).set({ ...dados, atualizadaEm: agora }).where(eq(digitalizacao.id, id));
  await aoAndar?.();
}

/** Os recortes da OS para a IA: da linha de títulos das operações para baixo (onde está a letra de mão) e as folhas seguintes. */
async function imagensParaIa(o: OsDigitalizada, folhas: Map<number, FolhaLidaPorOcr>, lerJpeg: (numero: number) => Promise<Uint8Array>): Promise<ImagemDeMensagem[]> {
  const numeradas = o.folhas_da_os;
  const iAncora = numeradas.findIndex((n) => folhas.get(n)?.linhas.some((l) => OPERACOES.test(normalizar(l))));
  const escolhidas = (iAncora >= 0 ? numeradas.slice(iAncora) : numeradas).slice(0, MAX_IMAGENS_POR_OS);
  const imagens: ImagemDeMensagem[] = [];
  for (const [i, n] of escolhidas.entries()) {
    let topo = 0;
    if (iAncora >= 0 && i === 0) {
      const folha = folhas.get(n)!;
      const j = folha.linhas.findIndex((l) => OPERACOES.test(normalizar(l)));
      const linha = folha.posicoes[j];
      // O `y` do OCR cresce para cima; o recorte conta do topo da imagem, com meia linha de folga.
      if (linha) topo = Math.max(0, folha.altura - linha.y - linha.altura * 1.5);
    }
    imagens.push(await recortarFolha(await lerJpeg(n), topo));
  }
  return imagens;
}

/**
 * Corrige o centro de trabalho pelo cadastro (o OCR perde o `_`: "PROTCAT" vira "PROT_CAT") e confere o que foi lido com os
 * cadastros, com o SAP e entre si. Os campos manuscritos nunca saem como "confere": nada os confirma além da própria pessoa.
 */
async function conferirOs(deps: Deps, o: OsDigitalizada, confianca: number, centros: Map<string, string>): Promise<void> {
  const { ordem, manuscrito } = o;
  const estados: OsDigitalizada["estados"] = {};
  const avisos: string[] = [];
  const impresso: EstadoDoCampo = confianca >= CONFIANCA_BOA ? "confere" : "duvidoso";

  // O número da ordem a pessoa sempre confirma: um dígito errado cria uma OS que não existe no SAP.
  let noSap: Awaited<ReturnType<Deps["sap"]["obterOrdem"]>> = null;
  try {
    noSap = await deps.sap.obterOrdem(ordem.numero_ordem);
  } catch {
    // SAP fora do ar: a conferência com ele fica de fora, o resto segue.
  }
  const [existente] = await deps.db.select({ id: os.id }).from(os).where(eq(os.numeroOrdem, ordem.numero_ordem));
  estados.numero_ordem = noSap || existente ? "confere" : "duvidoso";
  if (!noSap && !existente) avisos.push("O número da ordem não está no SAP nem no sistema: confira cada dígito na folha.");

  estados.tipo_ordem = ordem.tipo_ordem ? impresso : "faltando";
  estados.titulo = ordem.titulo ? impresso : "faltando";
  estados.data_inicio_prog = ordem.data_inicio_prog ? impresso : "faltando";
  if (ordem.equipamento) estados.equipamento = impresso;

  if (ordem.centro_trabalho) {
    const lido = ordem.centro_trabalho;
    const certo = centros.get(lido) ?? centros.get(chaveDoCadastro(lido));
    if (certo) {
      if (certo !== lido) {
        ordem.centro_trabalho = certo;
        o.observacoes.push(`Centro de trabalho corrigido pelo cadastro de equipes (lido "${lido}", cadastrado "${certo}").`);
      }
      estados.centro_trabalho = "confere";
    } else {
      estados.centro_trabalho = "invalido";
      avisos.push(`Nenhuma equipe atende o centro de trabalho "${lido}": a OS não entra sem ele.`);
    }
  } else estados.centro_trabalho = "faltando";

  if (ordem.local_instalacao.codigo) {
    const [local] = await deps.db.select({ id: localInstalacao.id }).from(localInstalacao).where(eq(localInstalacao.codigo, ordem.local_instalacao.codigo));
    estados.local_instalacao = local || noSap?.local_instalacao.codigo === ordem.local_instalacao.codigo ? "confere" : "duvidoso";
    if (estados.local_instalacao === "duvidoso") avisos.push("O local de instalação não está cadastrado: se estiver certo, ele será criado ao registrar.");
  } else estados.local_instalacao = "faltando";

  // A parte impressa, comparada com a ordem do SAP quando ela existe lá.
  if (noSap) {
    const difere = (rotulo: string, lido: string | null | undefined, sap: string | null | undefined) => {
      if (lido && sap && normalizar(lido) !== normalizar(sap)) avisos.push(`${rotulo}: a folha diz "${lido}", o SAP diz "${sap}".`);
    };
    difere("Título", ordem.titulo, noSap.titulo);
    difere("Centro de trabalho", ordem.centro_trabalho, noSap.centro_trabalho);
    difere("Local de instalação", ordem.local_instalacao.codigo, noSap.local_instalacao.codigo);
    difere("Início programado", ordem.data_inicio_prog, noSap.data_inicio_prog?.slice(0, 10));
  }

  // O que foi escrito à mão: a IA (ou a pessoa) preenche, e só a coerência entre as datas se confere.
  estados.inicio_real = manuscrito.inicio ? "duvidoso" : "faltando";
  estados.fim_real = manuscrito.fim ? "duvidoso" : "faltando";
  estados.numero_pessoas = manuscrito.pessoas ? "duvidoso" : "faltando";
  if (manuscrito.texto) estados.texto = "duvidoso";
  if (manuscrito.inicio && manuscrito.fim && manuscrito.fim < manuscrito.inicio) {
    estados.inicio_real = estados.fim_real = "invalido";
    avisos.push("O fim real vem antes do início real: confira as datas e as horas na folha.");
  }
  const emissao = ordem.criada_em;
  if (emissao && manuscrito.inicio && manuscrito.inicio.slice(0, 10) < emissao) {
    estados.inicio_real = "invalido";
    avisos.push(`O início real (${manuscrito.inicio.slice(0, 10)}) é anterior à data da ordem (${emissao}).`);
  }
  avisos.push(...manuscrito.avisos);

  o.estados = estados;
  o.avisos = avisos;
}

/** Os centros de trabalho cadastrados, por código e por chave sem pontuação, apontando para o código certo. */
async function centrosDeTrabalho(db: Db): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const linhas = await db.select({ centro: equipe.centroTrabalho }).from(equipe);
  const repetidas = new Set<string>();
  for (const { centro } of linhas) {
    mapa.set(centro, centro);
    const chave = chaveDoCadastro(centro);
    // Duas equipes com a mesma chave: não dá para corrigir por ela sem adivinhar.
    if (mapa.has(chave) && mapa.get(chave) !== centro) repetidas.add(chave);
    else mapa.set(chave, centro);
  }
  for (const r of repetidas) mapa.delete(r);
  return mapa;
}

/**
 * O corpo da tarefa `digitalizacao`: lê o PDF guardado, folha a folha, e deixa a leitura pronta para a conferência. Qualquer
 * falha vira `estado = falhou` com a mensagem (a tarefa não repete: ler de novo gastaria a IA outra vez); o que ficou pela metade
 * é refeito se o processo cair no meio e a tarefa voltar à fila.
 */
export async function processarDigitalizacao(deps: Deps, id: string, aoAndar?: () => Promise<void>): Promise<void> {
  const [lote] = await deps.db.select().from(digitalizacao).where(eq(digitalizacao.id, id));
  if (!lote || lote.estado !== "lendo") return;
  const falhar = (erro: unknown) => {
    const mensagem = erro instanceof ErroApi ? erro.message : MENSAGEM_DA_FALHA;
    if (!(erro instanceof ErroApi)) console.error(`Falha na leitura da digitalização ${id}`, erro);
    return andamento(deps.db, id, { estado: "falhou", erro: mensagem }, deps.agora());
  };

  let folhas;
  try {
    const original = await deps.armazenamento.ler(BUCKET_DAS_FOLHAS, lote.arquivo);
    if (!original) throw new ErroApi(422, "arquivo_sumiu", "O PDF enviado não está mais guardado: envie-o de novo.");
    folhas = await abrirFolhas(original);
  } catch (erro) {
    await falhar(erro);
    return;
  }

  try {
    await andamento(deps.db, id, { paginas: folhas.total, paginasLidas: 0, etapa: "ocr" }, deps.agora());

    // 1. As folhas: desenha, guarda o JPEG (para a conferência e para a IA) e passa pelo OCR.
    const lidas = new Map<number, FolhaLidaPorOcr>();
    for (let n = 1; n <= folhas.total; n++) {
      const folha = await folhas.renderizar(n);
      await deps.armazenamento.gravar(BUCKET_DAS_FOLHAS, caminhoDaFolha(id, n), folha.jpeg, "image/jpeg", { sobrescrever: true });
      lidas.set(n, await deps.ocr.lerFolha(folha.png, n, folha.largura, folha.altura));
      await andamento(deps.db, id, { paginasLidas: n }, deps.agora(), aoAndar);
    }

    // 2. As OS: o mesmo leitor do PDF do SAP, agora sobre o texto do OCR.
    const paginas = [...lidas.values()];
    // As folhas da APR em papel saem antes: o rótulo e o número escrito à mão delas não podem se misturar com a leitura das OS.
    const { grupos: gruposDaApr, restantes } = separarFolhasDaApr(paginas);
    const lido = lerOrdensDoPdf(restantes);
    if (lido.ordens.length === 0) {
      throw new ErroApi(
        422,
        "pdf_sem_ordem",
        'Nenhuma OS foi reconhecida nas folhas: o número da ordem não foi lido no cabeçalho ("Ordem de Manutenção"). Confira se as folhas estão nítidas e inteiras.',
      );
    }
    const confianca = paginas.reduce((t, p) => t + p.confianca, 0) / paginas.length;
    const numeradas = new Set(restantes.filter((p) => numeroDaFolha(p) !== null).map((p) => p.numero));
    const ordens: OsDigitalizada[] = lido.ordens.map((o) => ({
      ...o,
      chave: o.ordem.numero_ordem,
      folhas_da_os: o.paginas.filter((p) => numeradas.has(p)),
      manuscrito: { ...MANUSCRITO_VAZIO, lido_por: "nenhum" },
      apr: null,
      estados: {},
      avisos: [],
    }));

    // 3. O manuscrito, pela IA de visão, uma OS por vez. Sem IA (ou a IA cai no meio), as demais seguem sem ela.
    const situacaoDaIa = await situacaoDaFuncao(deps, "digitalizacao");
    const ia: EstadoDaIa = {
      usou: false,
      motivo:
        situacaoDaIa === "disponivel"
          ? null
          : situacaoDaIa === "desligada"
            ? "A função Digitalização de documentos está desligada em Configurações › Sistema: o escrito à mão é digitado na conferência."
            : "A IA não está configurada: o escrito à mão é digitado na conferência.",
    };
    const lerJpeg = async (n: number) => {
      const bytes = await deps.armazenamento.ler(BUCKET_DAS_FOLHAS, caminhoDaFolha(id, n));
      if (!bytes) throw new Error(`folha ${n} sumiu`);
      return bytes;
    };
    await andamento(deps.db, id, { etapa: "ia" }, deps.agora());
    for (const o of ordens) {
      if (ia.motivo) break;
      try {
        o.manuscrito = { ...(await lerManuscritoComIa(deps.ia, await imagensParaIa(o, lidas, lerJpeg))), lido_por: "ia" };
        ia.usou = true;
      } catch (erro) {
        if (erro instanceof IAIndisponivel) ia.motivo = "A IA de leitura está indisponível agora: o escrito à mão é digitado na conferência.";
        else if (erro instanceof RespostaIAInvalida) o.avisos.push("A IA não conseguiu ler o escrito à mão desta OS: digite-o na conferência.");
        else throw erro;
      }
    }

    // 3b. A APR em papel que veio junto: o modelo sai do título impresso e a IA lê o cabeçalho, as pessoas e a marca de cada item.
    await lerAprs(deps, ordens, gruposDaApr, lidas, lerJpeg, ia);

    // 4. As conferências.
    await andamento(deps.db, id, { etapa: "conferindo" }, deps.agora());
    const centros = await centrosDeTrabalho(deps.db);
    for (const o of ordens) {
      const avisosDaLeitura = o.avisos;
      await conferirOs(deps, o, confianca, centros);
      o.avisos.unshift(...avisosDaLeitura);
    }

    const leitura: LeituraDaDigitalizacao = {
      paginas: folhas.total,
      paginas_sem_ordem: lido.paginasSemOrdem,
      confianca_media: Math.round(confianca),
      ia: { usada: ia.usou, motivo: ia.usou ? null : ia.motivo },
      ordens,
    };
    await andamento(deps.db, id, { estado: "lida", leitura, usouIa: ia.usou, erro: null }, deps.agora());
  } catch (erro) {
    await falhar(erro);
  } finally {
    await folhas.fechar().catch(() => undefined);
  }
}

/** O que o sistema já sabe de uma OS lida: se ela já existe (e se tem execução), a equipe do centro de trabalho. */
export async function situacaoDaOs(db: Db, ordem: OsDoPdf["ordem"]) {
  const [existente] = await db.select({ id: os.id, status: os.status, origem: os.origem }).from(os).where(eq(os.numeroOrdem, ordem.numero_ordem));
  const [comExecucao] = existente ? await db.select({ id: execucao.id }).from(execucao).where(eq(execucao.osId, existente.id)).limit(1) : [];
  const [daEquipe] = ordem.centro_trabalho
    ? await db.select({ id: equipe.id, nome: equipe.nome }).from(equipe).where(eq(equipe.centroTrabalho, ordem.centro_trabalho))
    : [];
  return { existente: existente ?? null, tem_execucao: Boolean(comExecucao), equipe: daEquipe ?? null };
}
