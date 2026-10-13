import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db/conexao";
import type { Deps } from "../deps";
import { atividade, equipe, importacao, localInstalacao, os, OS_TIPOS, usuario } from "../db/schema";
import { alertarFalhaDeImportacao, detalheDaFalha } from "../dominio/alertas";
import { registrarAuditoria } from "../dominio/auditoria";
import { processarOrdens } from "../dominio/importacao-ordens";
import { lerOrdensDoPdf, type OsDoPdf } from "../dominio/importacao-pdf";
import { lerPlanilha } from "../dominio/importacao-planilha";
import { resumoDasImportacoes } from "../dominio/importacao-resumo";
import { esquemaPeriodo } from "../dominio/periodo";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { podeSupervisionarEquipe } from "../http/autenticacao";
import { ErroApi, invalido, naoEncontrado } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { dataIso, lerConsulta, lerCorpo, lerId, textoObrigatorio, uuid } from "../http/validacao";
import { enfileirarTarefa } from "../servicos/fila";
import { ultimaLeituraConcluida } from "../servicos/leitura-sap";
import { lerTextoDoPdf } from "../servicos/pdf-texto";

const LIMITE_DO_ARQUIVO = 10 * 1024 * 1024;
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const TIPO_PDF = "application/pdf";
/** Um PDF traz no máximo uma OS por folha (o leitor recusa PDF com mais de 60 folhas). */
const LIMITE_DE_ORDENS_DO_PDF = 60;

const textoOpcional = z.string().trim().min(1).nullable().optional();
const dataValida = dataIso.refine((v) => {
  const [a, m, d] = v.split("-").map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}, "Data inválida");

/** O nome do arquivo no bucket: sem pastas nem caracteres estranhos, sempre com a extensão do tipo (`.xlsx` ou `.pdf`). */
function nomeSeguro(nome: string, extensao: "xlsx" | "pdf" = "xlsx"): string {
  const base = nome.replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);
  return `${base || (extensao === "pdf" ? "ordem" : "planilha")}.${extensao}`;
}

const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * O arquivo (planilha ou PDF) falhou: nenhuma OS mudou (a transação das ordens desfez tudo ou nem começou). Fica o
 * registro da importação com o erro e o arquivo, se chegou a ser guardado, e o alerta de falha para quem enviou. Se nem
 * isso der para gravar, só registra no log: o erro original é o que volta para a pessoa.
 */
async function registrarFalhaDoArquivo(
  deps: Deps,
  o: { origem: "planilha" | "pdf"; importacaoId: string; arquivo: string | null; nome: string; usuarioId: string; erro: unknown },
) {
  const motivo = o.erro instanceof ErroApi ? o.erro.message : "erro inesperado ao gravar as ordens";
  const qual = o.origem === "pdf" ? "do PDF" : "da planilha";
  if (!(o.erro instanceof ErroApi)) console.error(`Falha na importação ${qual}`, o.erro);
  try {
    await deps.db.transaction(async (tx) => {
      const db = tx as unknown as Db;
      await db.insert(importacao).values({ id: o.importacaoId, origem: o.origem, arquivo: o.arquivo, usuarioId: o.usuarioId, erro: motivo });
      await alertarFalhaDeImportacao(db, {
        importacaoId: o.importacaoId,
        origem: o.origem,
        usuarioId: o.usuarioId,
        detalhe: detalheDaFalha({ origem: o.origem, arquivo: o.nome, motivo }),
        agora: deps.agora(),
      });
    });
  } catch (falha) {
    console.error(`Não foi possível registrar a falha ${qual}`, falha);
  }
}

/** O arquivo veio, não está vazio e cabe no limite. */
function conferirTamanho(arquivo: File) {
  if (arquivo.size === 0) throw invalido("arquivo_vazio", "Arquivo vazio");
  if (arquivo.size > LIMITE_DO_ARQUIVO) throw new ErroApi(413, "arquivo_grande", `Arquivo maior que ${LIMITE_DO_ARQUIVO / 1024 / 1024} MB`);
}

/**
 * Lê as OS do PDF da Ordem de Manutenção impressa pelo SAP. Recusa (`422`) o que não é PDF, o PDF sem texto (uma folha
 * digitalizada, que só a Digitalização vai ler) e o PDF sem nenhuma ordem reconhecível.
 */
async function lerPdfDaOs(bytes: Uint8Array) {
  // O PDF começa por "%PDF-" (alguns geradores põem bytes antes, dentro do primeiro 1 KB).
  if (!Buffer.from(bytes.subarray(0, 1024)).toString("latin1").includes("%PDF-")) throw invalido("pdf_invalido", "O arquivo não é um PDF");
  const paginas = await lerTextoDoPdf(bytes);
  if (paginas.every((p) => p.linhas.length === 0)) {
    throw invalido(
      "pdf_sem_texto",
      "O PDF não tem texto: é uma folha digitalizada (imagem). Envie o PDF gerado pelo SAP; a leitura de folhas digitalizadas ainda não está disponível.",
    );
  }
  const leitura = lerOrdensDoPdf(paginas);
  if (leitura.ordens.length === 0) {
    throw invalido("pdf_sem_ordem", 'Nenhuma OS encontrada no PDF: o número da ordem não foi lido no cabeçalho ("Ordem de Manutenção").');
  }
  return { paginas: paginas.length, ...leitura };
}

/** O que o sistema já sabe de cada OS lida: se ela já existe, a equipe do centro de trabalho e a atividade pelo título. */
async function situacaoNoSistema(db: Db, lida: OsDoPdf) {
  const { ordem } = lida;
  const [existente] = await db.select({ id: os.id, status: os.status, origem: os.origem }).from(os).where(eq(os.numeroOrdem, ordem.numero_ordem));
  const [daEquipe] = ordem.centro_trabalho
    ? await db.select({ id: equipe.id, nome: equipe.nome }).from(equipe).where(eq(equipe.centroTrabalho, ordem.centro_trabalho))
    : [];
  // O PDF não imprime o código da atividade: vale o título inteiro ou o código no começo dele ("1.2 - Inspeção…") que
  // já estiver cadastrado em Atividades. Código que não existe não é sugerido (o registro cadastraria uma atividade nova).
  const candidatos = [ordem.titulo, /^(\d+(?:\.\d+)+)\s*-/.exec(ordem.titulo ?? "")?.[1]].filter((c): c is string => Boolean(c));
  const atividades = candidatos.length
    ? await db.select({ codigo: atividade.codigo, modeloAprCodigo: atividade.modeloAprCodigo }).from(atividade).where(inArray(atividade.codigo, candidatos))
    : [];
  const achada = candidatos.map((c) => atividades.find((a) => a.codigo === c)).find(Boolean);
  return {
    ...lida,
    ordem: { ...ordem, codigo_atividade: ordem.codigo_atividade ?? achada?.codigo ?? null },
    existente: existente ?? null,
    equipe: daEquipe ?? null,
    atividade: achada ? { codigo: achada.codigo, comModelo: achada.modeloAprCodigo !== null } : null,
  };
}

/**
 * Integração SAP: leitura sob demanda, importação de planilha, OS de apoio e os locais de instalação (que só vêm do SAP). A
 * leitura em si (agendada ou por "Ler agora") roda na tarefa `leitura_sap`, em `servicos/leitura-sap.ts`.
 */
export function rotasSap(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** "Ler agora": registra a leitura e enfileira a tarefa; quem lê é o executor de tarefas. */
  r.post("/sap/leituras", autenticar(), exigirPerfil("admin"), async (c) => {
    const eu = c.get("usuario");
    const importacaoId = await deps.db.transaction(async (tx) => {
      const [criada] = await tx.insert(importacao).values({ origem: "api", usuarioId: eu.id }).returning({ id: importacao.id });
      await enfileirarTarefa(tx, "leitura_sap", criada!.id);
      return criada!.id;
    });
    await registrarAuditoria(deps.db, eu, { entidade: "importacao", verbo: "leitura_sap", entidadeId: importacaoId, resumo: "Pediu a leitura imediata das OS no SAP" });
    return responder(c, { importacaoId }, 202);
  });

  /**
   * Planilha no lugar da API: o mesmo processamento da leitura, com o mapeamento de colunas de `importacao-planilha.ts`.
   * Recebido o arquivo, qualquer falha (vazio, grande demais, fora do formato, erro ao gravar) não mexe em nenhuma OS: o
   * arquivo e o registro da importação com o erro ficam no histórico, sai o alerta de falha para quem enviou, e a resposta
   * é o próprio erro.
   */
  r.post("/importacoes", autenticar(), exigirPerfil("admin"), async (c) => {
    const eu = c.get("usuario");
    const form = await c.req.parseBody().catch(() => null);
    const arquivo = form?.arquivo;
    if (!(arquivo instanceof File)) throw invalido("validacao", 'arquivo: envie a planilha .xlsx no campo multipart "arquivo"');

    const importacaoId = randomUUID();
    const caminho = `${importacaoId}/${nomeSeguro(arquivo.name)}`;
    let guardado = false;
    try {
      conferirTamanho(arquivo);
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      await deps.armazenamento.gravar("importacoes", caminho, bytes, TIPO_XLSX);
      guardado = true;
      const { entradas } = await lerPlanilha(bytes);

      const agora = deps.agora();
      const resultado = await deps.db.transaction(async (tx) => {
        const processado = await processarOrdens(tx, entradas, { origem: "planilha", agora });
        await tx.insert(importacao).values({
          id: importacaoId,
          origem: "planilha",
          arquivo: caminho,
          usuarioId: eu.id,
          criadas: processado.criadas,
          atualizadas: processado.atualizadas,
          ignoradas: processado.ignoradas.length,
          detalheIgnoradas: processado.ignoradas,
        });
        return processado;
      });

      await registrarAuditoria(deps.db, eu, {
        entidade: "importacao",
        verbo: "planilha",
        entidadeId: importacaoId,
        alvo: arquivo.name,
        resumo: `Importou a planilha ${arquivo.name}: ${resultado.criadas} criadas, ${resultado.atualizadas} atualizadas, ${resultado.ignoradas.length} ignoradas`,
        detalhes: { criadas: resultado.criadas, atualizadas: resultado.atualizadas, ignoradas: resultado.ignoradas.length },
      });
      return responder(
        c,
        { importacaoId, criadas: resultado.criadas, atualizadas: resultado.atualizadas, ignoradas: resultado.ignoradas, avisos: resultado.avisos },
        201,
      );
    } catch (erro) {
      await registrarFalhaDoArquivo(deps, { origem: "planilha", importacaoId, arquivo: guardado ? caminho : null, nome: arquivo.name, usuarioId: eu.id, erro });
      throw erro;
    }
  });

  /**
   * PDF da OS, primeiro passo: lê o PDF e devolve cada OS que ele traz, com os campos lidos, o que faltou e o que o sistema
   * já sabe dela (OS existente, equipe do centro de trabalho, atividade). Nada é gravado: a pessoa confere na tela e
   * registra com `POST /importacoes/pdf`.
   */
  r.post("/importacoes/pdf/leitura", autenticar(), exigirPerfil("admin"), async (c) => {
    const form = await c.req.parseBody().catch(() => null);
    const arquivo = form?.arquivo;
    if (!(arquivo instanceof File)) throw invalido("validacao", 'arquivo: envie o PDF da OS no campo multipart "arquivo"');
    conferirTamanho(arquivo);
    const leitura = await lerPdfDaOs(new Uint8Array(await arquivo.arrayBuffer()));
    const ordens = await Promise.all(leitura.ordens.map((o) => situacaoNoSistema(deps.db, o)));
    return responder(c, { arquivo: arquivo.name, paginas: leitura.paginas, paginasSemOrdem: leitura.paginasSemOrdem, ordens });
  });

  /**
   * PDF da OS, segundo passo: o mesmo PDF e as OS conferidas (`ordens`, JSON no formato do contrato do SAP). O PDF é lido de
   * novo e cada OS conferida precisa estar nele (o número da ordem vem do documento, nunca digitado); as demais colunas
   * seguem como a pessoa conferiu. Depois é o mesmo processamento da planilha, com origem `pdf`, exceto que o PDF nunca
   * cancela uma OS (é a foto de quando foi impresso). Recebido o arquivo, qualquer falha não mexe em nenhuma OS: o arquivo e o
   * registro com o erro ficam no histórico, sai o alerta de falha para quem enviou, e a resposta é o próprio erro.
   */
  r.post("/importacoes/pdf", autenticar(), exigirPerfil("admin"), async (c) => {
    const eu = c.get("usuario");
    const form = await c.req.parseBody().catch(() => null);
    const arquivo = form?.arquivo;
    if (!(arquivo instanceof File)) throw invalido("validacao", 'arquivo: envie o PDF da OS no campo multipart "arquivo"');
    let bruto: unknown;
    try {
      bruto = JSON.parse(typeof form?.ordens === "string" ? form.ordens : "");
    } catch {
      throw invalido("validacao", 'ordens: envie as OS conferidas (JSON) no campo multipart "ordens"');
    }
    const conferidas = z
      .array(z.looseObject({ numero_ordem: z.string().trim().min(1, "ordens: toda OS precisa do número da ordem") }), { error: "ordens: envie uma lista de OS" })
      .min(1, "ordens: escolha ao menos uma OS")
      .max(LIMITE_DE_ORDENS_DO_PDF, `ordens: no máximo ${LIMITE_DE_ORDENS_DO_PDF} OS por PDF`)
      .safeParse(bruto);
    if (!conferidas.success) throw invalido("validacao", conferidas.error.issues[0]?.message ?? "ordens: formato inesperado");

    const importacaoId = randomUUID();
    const caminho = `${importacaoId}/${nomeSeguro(arquivo.name, "pdf")}`;
    let guardado = false;
    try {
      conferirTamanho(arquivo);
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      await deps.armazenamento.gravar("importacoes", caminho, bytes, TIPO_PDF);
      guardado = true;
      const leitura = await lerPdfDaOs(bytes);
      const doPdf = new Set(leitura.ordens.map((o) => o.ordem.numero_ordem));
      const vistas = new Set<string>();
      for (const o of conferidas.data) {
        if (!doPdf.has(o.numero_ordem)) throw invalido("ordem_fora_do_pdf", `A ordem ${o.numero_ordem} não está no PDF enviado`);
        if (vistas.has(o.numero_ordem)) throw invalido("ordem_repetida", `A ordem ${o.numero_ordem} veio repetida`);
        vistas.add(o.numero_ordem);
      }

      const agora = deps.agora();
      const resultado = await deps.db.transaction(async (tx) => {
        const processado = await processarOrdens(tx, conferidas.data.map((ordem) => ({ ordem })), { origem: "pdf", agora });
        await tx.insert(importacao).values({
          id: importacaoId,
          origem: "pdf",
          arquivo: caminho,
          usuarioId: eu.id,
          criadas: processado.criadas,
          atualizadas: processado.atualizadas,
          ignoradas: processado.ignoradas.length,
          detalheIgnoradas: processado.ignoradas,
        });
        return processado;
      });

      await registrarAuditoria(deps.db, eu, {
        entidade: "importacao",
        verbo: "pdf",
        entidadeId: importacaoId,
        alvo: arquivo.name,
        resumo: `Importou o PDF ${arquivo.name}: ${resultado.criadas} criadas, ${resultado.atualizadas} atualizadas, ${resultado.ignoradas.length} ignoradas`,
        detalhes: { criadas: resultado.criadas, atualizadas: resultado.atualizadas, ignoradas: resultado.ignoradas.length, ordens: [...vistas] },
      });
      return responder(
        c,
        { importacaoId, criadas: resultado.criadas, atualizadas: resultado.atualizadas, ignoradas: resultado.ignoradas, avisos: resultado.avisos },
        201,
      );
    } catch (erro) {
      await registrarFalhaDoArquivo(deps, { origem: "pdf", importacaoId, arquivo: guardado ? caminho : null, nome: arquivo.name, usuarioId: eu.id, erro });
      throw erro;
    }
  });

  /** Histórico das leituras e importações, inclusive as que falharam (com `erro`). */
  r.get("/importacoes", autenticar(), exigirPerfil("admin"), async (c) => {
    const p = lerConsulta(c, esquemaPaginacao);
    const { limit, offset } = limiteEDeslocamento(p);
    const linhas = await deps.db
      .select({
        id: importacao.id,
        origem: importacao.origem,
        arquivo: importacao.arquivo,
        usuarioId: importacao.usuarioId,
        usuarioNome: usuario.nome,
        criadas: importacao.criadas,
        atualizadas: importacao.atualizadas,
        ignoradas: importacao.ignoradas,
        detalheIgnoradas: importacao.detalheIgnoradas,
        erro: importacao.erro,
        criadaEm: importacao.criadaEm,
      })
      .from(importacao)
      .leftJoin(usuario, eq(usuario.id, importacao.usuarioId))
      .orderBy(desc(importacao.criadaEm), desc(importacao.id))
      .limit(limit)
      .offset(offset);
    return responder(c, { importacoes: linhas, ...meta(p, await contar(deps.db, importacao)) });
  });

  /**
   * Diagnóstico da entrada de OS: OS registradas por dia, semana ou mês e por origem no período (`?periodo=7d|30d|90d|12m|AAAA-MM`,
   * 30 dias se ausente), as leituras da API com e sem falha, os motivos das linhas ignoradas e a comparação com o período
   * anterior.
   */
  r.get("/importacoes/resumo", autenticar(), exigirPerfil("admin"), async (c) => {
    const { periodo } = lerConsulta(c, z.object({ periodo: esquemaPeriodo }));
    return responder(c, await resumoDasImportacoes(deps.db, periodo, deps.agora()));
  });

  /** Estado da sincronização com a API: a última leitura sem erro e a leitura agendada. As falhas viram alerta no sino. */
  r.get("/sap/sincronizacao", autenticar(), exigirPerfil("admin"), async (c) => {
    const ultimaLeitura = await ultimaLeituraConcluida(deps.db);
    return responder(c, {
      ultimaLeituraSemErroEm: ultimaLeitura ?? null,
      // Sem `SAP_API_URL` a leitura agendada não roda; a sincronização sob demanda continua disponível.
      automatica: Boolean(deps.config.sapApiUrl),
      intervaloMin: deps.config.sapLeituraIntervaloMin,
    });
  });

  /**
   * OS de apoio: a única OS que nasce no sistema (as demais vêm da leitura do SAP ou da planilha). Fica ligada à OS que
   * destrava (`os_origem_id`, obrigatório) e ainda não tem número SAP. O supervisor abre para qualquer equipe, desde que
   * veja a OS de origem; o admin, a partir de qualquer OS.
   */
  r.post("/os", autenticar(), exigirPerfil("supervisor", "admin"), async (c) => {
    const eu = c.get("usuario");
    const dados = await lerCorpo(
      c,
      z.object({
        tipo: z.enum(OS_TIPOS),
        codigo_atividade: textoOpcional,
        titulo: textoObrigatorio,
        descricao: textoOpcional,
        local_instalacao_id: uuid,
        equipe_id: uuid,
        data_inicio_prog: dataValida,
        data_fim_prog: dataValida.nullable().optional(),
        prioridade: textoOpcional,
        os_origem_id: uuid,
        equipamento: textoOpcional,
      }),
    );
    if (dados.data_fim_prog && dados.data_fim_prog < dados.data_inicio_prog) {
      throw invalido("datas_invalidas", "A data fim programada não pode ser anterior ao início");
    }

    const [origem] = await deps.db.select({ equipeId: os.equipeId }).from(os).where(eq(os.id, dados.os_origem_id));
    if (!origem || !podeSupervisionarEquipe(eu, origem.equipeId)) {
      throw invalido("os_origem_inexistente", "OS de origem não encontrada");
    }
    const [local] = await deps.db.select({ id: localInstalacao.id }).from(localInstalacao).where(eq(localInstalacao.id, dados.local_instalacao_id));
    if (!local) throw invalido("local_inexistente", "Local de instalação não encontrado");
    const [equipeDaOs] = await deps.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, dados.equipe_id));
    if (!equipeDaOs) throw invalido("equipe_inexistente", "Equipe não encontrada");
    if (dados.codigo_atividade) {
      const [a] = await deps.db.select({ codigo: atividade.codigo }).from(atividade).where(eq(atividade.codigo, dados.codigo_atividade));
      if (!a) throw invalido("atividade_inexistente", "Atividade não encontrada");
    }
    const [criada] = await deps.db
      .insert(os)
      .values({
        tipo: dados.tipo,
        codigoAtividade: dados.codigo_atividade ?? null,
        titulo: dados.titulo,
        descricao: dados.descricao ?? null,
        equipamento: dados.equipamento ?? null,
        localInstalacaoId: dados.local_instalacao_id,
        equipeId: dados.equipe_id,
        prioridade: dados.prioridade ?? null,
        dataInicioProg: dados.data_inicio_prog,
        dataFimProg: dados.data_fim_prog ?? null,
        osOrigemId: dados.os_origem_id,
        origem: "apoio",
      })
      .returning({ id: os.id });
    await registrarAuditoria(deps.db, eu, {
      entidade: "os",
      verbo: "criar_apoio",
      entidadeId: criada!.id,
      alvo: dados.titulo,
      resumo: `Abriu a OS de apoio \"${dados.titulo}\"`,
      detalhes: { os_origem_id: dados.os_origem_id, equipe_id: dados.equipe_id, data_inicio_prog: dados.data_inicio_prog },
    });
    return responder(c, { id: criada!.id }, 201);
  });

  /** Criticidade do local, editada no painel. */
  r.patch("/locais/:id", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const { critico } = await lerCorpo(c, z.object({ critico: z.boolean() }));
    const atualizados = await deps.db.update(localInstalacao).set({ critico }).where(eq(localInstalacao.id, id)).returning({ id: localInstalacao.id, codigo: localInstalacao.codigo });
    if (atualizados.length === 0) throw naoEncontrado("Local não encontrado");
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "os",
      verbo: critico ? "marcar_local_critico" : "desmarcar_local_critico",
      entidadeId: id,
      alvo: atualizados[0]!.codigo,
      resumo: `${critico ? "Marcou" : "Desmarcou"} o local ${atualizados[0]!.codigo} como crítico`,
    });
    return responder(c, {});
  });

  /** Qualquer perfil lê (o formulário de OS de apoio escolhe o local aqui); `?codigo=` filtra por trecho do código. */
  r.get("/locais", autenticar(), async (c) => {
    const filtros = lerConsulta(c, esquemaPaginacao.extend({ codigo: z.string().trim().min(1).optional() }));
    const { limit, offset } = limiteEDeslocamento(filtros);
    const onde = and(filtros.codigo ? ilike(localInstalacao.codigo, `%${escaparLike(filtros.codigo)}%`) : undefined);
    const linhas = await deps.db.select().from(localInstalacao).where(onde).orderBy(asc(localInstalacao.codigo)).limit(limit).offset(offset);
    return responder(c, { locais: linhas, ...meta(filtros, await contar(deps.db, localInstalacao, onde)) });
  });

  return r;
}
