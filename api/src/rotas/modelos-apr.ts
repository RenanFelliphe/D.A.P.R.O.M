import { and, asc, count, desc, eq, ilike, isNotNull, isNull, max, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { diferencas, registrarAuditoria } from "../dominio/auditoria";
import { apr, atividade, itemModeloApr, modeloApr, orientacaoModeloApr, riscoModeloApr, type Perfil } from "../db/schema";
import {
  conteudoDe,
  gravarRiscosEItens,
  modeloCompleto,
  modeloPorVersao,
  rascunhoDoCodigo,
  resolverVersao,
  traduzirImutabilidade,
  versaoPublicadaMaisRecente,
} from "../dominio/modelo-apr-banco";
import {
  dataDoDocumento,
  esquemaCodigo,
  esquemaItem,
  esquemaPae,
  esquemaRisco,
  exigirPublicavel,
  validarConteudo,
  type ConteudoDoModelo,
} from "../dominio/modelo-apr-esquema";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { codigoPostgres, conflito, invalido, naoEncontrado } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, lerConsulta, lerCorpo, textoObrigatorio } from "../http/validacao";

/**
 * Quem cria, edita, publica e exclui modelos, escreve a orientação deles e mantém a tabela de atividades: só o
 * administrador do sistema, que mantém o conteúdo definido pela Segurança do Trabalho (que não usa o sistema). Ele também
 * enxerga os rascunhos.
 */
const PERFIS_DE_MODELO = ["admin"] as const satisfies readonly Perfil[];
const editaModelos = (perfil: Perfil) => (PERFIS_DE_MODELO as readonly Perfil[]).includes(perfil);

/** `:versao` da URL precisa ser um número ou `publicada`; qualquer outra coisa é uma versão que não existe. */
function numeroDaVersao(versao: string): number {
  if (!/^[0-9]+$/.test(versao)) throw naoEncontrado("Modelo ou versão não encontrado");
  return Number(versao);
}

const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

/** Resumo de uma versão, sem itens. Colunas qualificadas à mão: o Drizzle as emite sem prefixo numa consulta de uma tabela só. */
const resumoDaVersao = {
  id: modeloApr.id,
  codigo: modeloApr.codigo,
  versao: modeloApr.versao,
  titulo: modeloApr.titulo,
  dataDocumento: modeloApr.dataDocumento,
  participantesComAssinatura: modeloApr.participantesComAssinatura,
  publicadoEm: modeloApr.publicadoEm,
  arquivadoEm: modeloApr.arquivadoEm,
  rascunho: sql<boolean>`${modeloApr.publicadoEm} is null`,
  itensTotal: sql<number>`(select count(*)::int from item_modelo_apr where item_modelo_apr.modelo_apr_id = modelo_apr.id)`,
  /** APRs respondidas nesta versão. */
  aprsTotal: sql<number>`(select count(*)::int from apr where apr.modelo_apr_id = modelo_apr.id)`,
};

/** A orientação do código (o que o técnico vê ao escolher o modelo); vazia enquanto ninguém a escreveu. */
async function orientacaoDe(db: Deps["db"], codigo: string) {
  const [o] = await db.select().from(orientacaoModeloApr).where(eq(orientacaoModeloApr.codigo, codigo));
  return o ?? { codigo, descricao: "", exemplos: [] as string[], palavrasChave: [] as string[], atualizadaEm: null };
}

/** Um texto por linha: sem espaços nas pontas, sem linhas vazias e sem repetidos (sem diferenciar maiúsculas). */
const listaDeTextos = (maximo: number) =>
  z
    .array(z.string().trim().max(200))
    .max(maximo)
    .transform((lista) => {
      const vistos = new Set<string>();
      return lista.filter((t) => t !== "" && !vistos.has(t.toLowerCase()) && Boolean(vistos.add(t.toLowerCase())));
    });

/**
 * Modelos de APR versionados, a orientação de cada um e a tabela de atividades. Todo perfil autenticado lê (rascunho só
 * quem edita); só o administrador escreve (a Segurança do Trabalho não usa o sistema). Um modelo publicado é imutável
 * (Decisão-chave 6): editar é criar um rascunho da versão seguinte, ajustá-lo e publicá-lo; excluir um modelo publicado o
 * arquiva. A orientação fica fora do versionamento.
 */
export function rotasModelosApr(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const soQuemEdita = exigirPerfil(...PERFIS_DE_MODELO);

  // ---- Modelos ---------------------------------------------------------------------------------------------------

  /**
   * Resumos, sem itens: por código e versão decrescente. Quem não edita só vê os publicados. Os modelos excluídos
   * (arquivados) ficam de fora, a menos que se peça `arquivados=true`, que lista só eles.
   */
  r.get("/modelos-apr", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({ codigo: z.string().trim().min(1).optional(), publicados: booleanoDaConsulta, arquivados: booleanoDaConsulta }),
    );
    const soPublicados = !editaModelos(eu.perfil) || filtros.publicados === true;
    const onde = and(
      filtros.codigo ? eq(modeloApr.codigo, filtros.codigo) : undefined,
      soPublicados ? isNotNull(modeloApr.publicadoEm) : undefined,
      filtros.arquivados ? isNotNull(modeloApr.arquivadoEm) : isNull(modeloApr.arquivadoEm),
    );
    const { limit, offset } = limiteEDeslocamento(filtros);
    const linhas = await deps.db
      .select(resumoDaVersao)
      .from(modeloApr)
      .where(onde)
      .orderBy(asc(modeloApr.codigo), desc(modeloApr.versao))
      .limit(limit)
      .offset(offset);
    return responder(c, { modelos: linhas, ...meta(filtros, await contar(deps.db, modeloApr, onde)) });
  });

  /** Um modelo, a orientação e todas as versões dele, inclusive quando excluído (arquivado), para a tela do modelo. */
  r.get("/modelos-apr/:codigo", autenticar(), async (c) => {
    const codigo = c.req.param("codigo");
    const veRascunho = editaModelos(c.get("usuario").perfil);
    const versoes = await deps.db
      .select(resumoDaVersao)
      .from(modeloApr)
      .where(and(eq(modeloApr.codigo, codigo), veRascunho ? undefined : isNotNull(modeloApr.publicadoEm)))
      .orderBy(desc(modeloApr.versao));
    if (versoes.length === 0) throw naoEncontrado("Modelo não encontrado");
    const principal = versoes.find((v) => !v.rascunho) ?? versoes[0]!;
    return responder(c, { codigo, titulo: principal.titulo, arquivadoEm: principal.arquivadoEm, orientacao: await orientacaoDe(deps.db, codigo), versoes });
  });

  /**
   * Troca a orientação do modelo: a descrição dos serviços que ele atende, os exemplos e as palavras-chave com que o sistema
   * lê a OS e recomenda um modelo ao técnico. Vale para todas as versões e na hora, sem publicar.
   */
  r.put("/modelos-apr/:codigo/orientacao", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo");
    const dados = await lerCorpo(
      c,
      z.object({
        descricao: z.string().trim().max(1000),
        exemplos: listaDeTextos(20),
        palavras_chave: listaDeTextos(80),
      }),
    );
    const [existe] = await deps.db.select({ id: modeloApr.id }).from(modeloApr).where(eq(modeloApr.codigo, codigo)).limit(1);
    if (!existe) throw naoEncontrado("Modelo não encontrado");

    const anterior = await orientacaoDe(deps.db, codigo);
    const valores = { descricao: dados.descricao, exemplos: dados.exemplos, palavrasChave: dados.palavras_chave, atualizadaEm: deps.agora() };
    const [salva] = await deps.db.insert(orientacaoModeloApr).values({ codigo, ...valores }).onConflictDoUpdate({ target: orientacaoModeloApr.codigo, set: valores }).returning();
    const mudancas = diferencas(
      { descricao: anterior.descricao, exemplos: anterior.exemplos.join(" | "), palavras_chave: anterior.palavrasChave.join(", ") },
      { descricao: dados.descricao, exemplos: dados.exemplos.join(" | "), palavras_chave: dados.palavras_chave.join(", ") },
    );
    if (Object.keys(mudancas).length > 0) {
      await registrarAuditoria(deps.db, c.get("usuario"), {
        entidade: "modelo_apr",
        verbo: "orientacao",
        entidadeId: codigo,
        alvo: codigo,
        resumo: `Editou a orientação do modelo de APR ${codigo} (${Object.keys(mudancas).join(", ")})`,
        detalhes: mudancas,
      });
    }
    return responder(c, salva);
  });

  /** Onde o modelo é usado: as APRs já respondidas em qualquer versão. Só para quem enxerga as OS de todas as equipes. */
  r.get("/modelos-apr/:codigo/uso", autenticar(), exigirPerfil("admin"), async (c) => {
    const codigo = c.req.param("codigo");
    const [existe] = await deps.db.select({ id: modeloApr.id }).from(modeloApr).where(eq(modeloApr.codigo, codigo)).limit(1);
    if (!existe) throw naoEncontrado("Modelo não encontrado");

    const [aprs] = await deps.db
      .select({
        total: count(),
        bloqueadas: sql<number>`(count(*) filter (where ${apr.resultado} = 'bloqueada'))::int`,
        ultimaEm: max(apr.concluidaEm),
      })
      .from(apr)
      .innerJoin(modeloApr, eq(modeloApr.id, apr.modeloAprId))
      .where(eq(modeloApr.codigo, codigo));

    return responder(c, { codigo, aprs });
  });

  /**
   * Exclui o modelo. O rascunho sai de vez, com a orientação; se já houve versão publicada, as versões ficam arquivadas
   * (APRs, PDFs e a APR offline que ainda vai chegar apontam para elas) e a orientação fica para uma restauração: o modelo
   * some das listas, da escolha das APRs novas e da cópia offline.
   */
  r.delete("/modelos-apr/:codigo", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo");
    const feito = await traduzirImutabilidade(() =>
      deps.db.transaction(async (tx) => {
        const versoes = await tx.select({ publicadoEm: modeloApr.publicadoEm, arquivadoEm: modeloApr.arquivadoEm }).from(modeloApr).where(eq(modeloApr.codigo, codigo));
        if (versoes.length === 0) throw naoEncontrado("Modelo não encontrado");
        if (versoes.some((v) => v.arquivadoEm)) throw conflito("modelo_arquivado", `O modelo ${codigo} já foi excluído`);

        await tx.delete(modeloApr).where(and(eq(modeloApr.codigo, codigo), isNull(modeloApr.publicadoEm)));
        const arquivado = versoes.some((v) => v.publicadoEm);
        if (arquivado) {
          await tx
            .update(modeloApr)
            .set({ arquivadoEm: deps.agora() })
            .where(and(eq(modeloApr.codigo, codigo), isNotNull(modeloApr.publicadoEm)));
        } else {
          await tx.delete(orientacaoModeloApr).where(eq(orientacaoModeloApr.codigo, codigo));
        }
        return { codigo, resultado: arquivado ? "arquivado" : "excluido" };
      }),
    );
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "modelo_apr",
      verbo: "excluir",
      entidadeId: codigo,
      alvo: codigo,
      resumo: feito.resultado === "arquivado" ? `Excluiu o modelo de APR ${codigo} (versões arquivadas)` : `Excluiu o modelo de APR ${codigo}`,
      detalhes: { resultado: feito.resultado },
    });
    return responder(c, feito);
  });

  /** Desfaz a exclusão de um modelo arquivado: ele volta à escolha das APRs novas, com a orientação que tinha. */
  r.post("/modelos-apr/:codigo/restaurar", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo");
    const restauradas = await deps.db
      .update(modeloApr)
      .set({ arquivadoEm: null })
      .where(and(eq(modeloApr.codigo, codigo), isNotNull(modeloApr.arquivadoEm)))
      .returning({ versao: modeloApr.versao });
    if (restauradas.length === 0) {
      const [existe] = await deps.db.select({ id: modeloApr.id }).from(modeloApr).where(eq(modeloApr.codigo, codigo)).limit(1);
      if (!existe) throw naoEncontrado("Modelo não encontrado");
      throw conflito("modelo_nao_arquivado", `O modelo ${codigo} não está excluído`);
    }
    await registrarAuditoria(deps.db, c.get("usuario"), { entidade: "modelo_apr", verbo: "restaurar", entidadeId: codigo, alvo: codigo, resumo: `Restaurou o modelo de APR ${codigo}` });
    return responder(c, { codigo, versoes: restauradas.length });
  });

  /**
   * Modelo completo para o editor e para aplicar a APR. `publicada` = a publicada mais recente do código. Quem não
   * edita (o técnico) recebe os itens sem `tipo`, `resposta_bloqueante` e `evidencia`: não pode saber o que é eliminatório.
   */
  r.get("/modelos-apr/:codigo/versoes/:versao", autenticar(), async (c) => {
    const veRascunho = editaModelos(c.get("usuario").perfil);
    const linha = await resolverVersao(deps.db, c.req.param("codigo"), c.req.param("versao"), veRascunho);
    return responder(c, await modeloCompleto(deps.db, linha, veRascunho));
  });

  /**
   * Cria o rascunho da versão seguinte. `titulo`, `pae`, `riscos` e `itens` omitidos copiam a versão publicada mais
   * recente (`data_documento` omitida fica nula: a data é a do documento novo). Um código que ainda não existe cria o
   * modelo: exige `titulo` e, para o conteúdo, `riscos` e `itens` ou `copiar_de` (outro modelo, cuja versão publicada
   * mais recente é copiada); `versao` diz o número da primeira versão (a revisão do documento em papel; padrão 1).
   */
  r.post("/modelos-apr/:codigo/versoes", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo").trim();
    if (!codigo || codigo.length > 40) throw invalido("codigo_invalido", "Código do modelo inválido");
    const dados = await lerCorpo(
      c,
      z.object({
        titulo: textoObrigatorio.optional(),
        pae: esquemaPae.nullable().optional(),
        data_documento: dataDoDocumento.nullable().optional(),
        /** A folha tem a coluna "Assinatura" na tabela de participantes; omitida, copia a versão anterior (modelo novo: sim). */
        participantes_com_assinatura: z.boolean().optional(),
        riscos: z.array(esquemaRisco).optional(),
        itens: z.array(esquemaItem).optional(),
        versao: z.number().int().min(1).max(999).optional(),
        copiar_de: esquemaCodigo.optional(),
      }),
    );

    const criado = await traduzirImutabilidade(() =>
      deps.db.transaction(async (tx) => {
        const existentes = await tx.select({ versao: modeloApr.versao, arquivadoEm: modeloApr.arquivadoEm }).from(modeloApr).where(eq(modeloApr.codigo, codigo));
        let base: ConteudoDoModelo | null = null;
        if (existentes.length > 0) {
          if (dados.versao !== undefined || dados.copiar_de !== undefined) {
            throw invalido("so_no_modelo_novo", "versao e copiar_de só valem para um modelo novo");
          }
          if (existentes.some((e) => e.arquivadoEm)) {
            throw conflito("modelo_arquivado", `O modelo ${codigo} foi excluído; restaure-o antes de criar uma versão nova`);
          }
          if (await rascunhoDoCodigo(tx, codigo)) {
            throw conflito("rascunho_existente", `Já existe um rascunho do modelo ${codigo}; edite-o ou publique-o antes`);
          }
          const publicada = await versaoPublicadaMaisRecente(tx, codigo);
          if (publicada) base = await conteudoDe(tx, publicada);
        } else {
          if (dados.copiar_de !== undefined) {
            const origem = await versaoPublicadaMaisRecente(tx, dados.copiar_de);
            if (!origem) throw invalido("modelo_sem_versao_publicada", `O modelo ${dados.copiar_de} não existe ou não tem versão publicada`);
            base = await conteudoDe(tx, origem);
          }
          if (dados.titulo === undefined || (!base && (dados.riscos === undefined || dados.itens === undefined))) {
            throw invalido("conteudo_obrigatorio", "Modelo novo precisa de titulo e de riscos e itens (ou de copiar_de)");
          }
        }

        const conteudo: ConteudoDoModelo = {
          titulo: dados.titulo ?? base!.titulo,
          pae: dados.pae === undefined ? (base?.pae ?? null) : dados.pae,
          dataDocumento: dados.data_documento ?? null,
          participantesComAssinatura: dados.participantes_com_assinatura ?? base?.participantesComAssinatura ?? true,
          riscos: dados.riscos ?? base!.riscos,
          itens: dados.itens ?? base!.itens,
        };
        validarConteudo(conteudo.riscos, conteudo.itens);

        const versao = existentes.length > 0 ? Math.max(...existentes.map((e) => e.versao)) + 1 : (dados.versao ?? 1);
        const [linha] = await tx
          .insert(modeloApr)
          .values({ codigo, versao, titulo: conteudo.titulo, pae: conteudo.pae, dataDocumento: conteudo.dataDocumento, participantesComAssinatura: conteudo.participantesComAssinatura })
          .returning({ id: modeloApr.id, versao: modeloApr.versao });
        await gravarRiscosEItens(tx, linha!.id, conteudo.riscos, conteudo.itens);
        return linha!;
      }),
    );
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "modelo_apr",
      verbo: "criar_versao",
      entidadeId: codigo,
      alvo: `${codigo} v${criado.versao}`,
      resumo: `Criou o rascunho da versão ${criado.versao} do modelo de APR ${codigo}`,
      detalhes: { versao: criado.versao, copiar_de: dados.copiar_de ?? null },
    });
    return responder(c, criado, 201);
  });

  /** Substitui o conteúdo inteiro de um rascunho. Publicado não aceita escrita (`409`). */
  r.put("/modelos-apr/:codigo/versoes/:versao", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo");
    const versao = numeroDaVersao(c.req.param("versao"));
    const dados = await lerCorpo(
      c,
      z.object({
        titulo: textoObrigatorio,
        pae: esquemaPae.nullable().optional(),
        data_documento: dataDoDocumento.nullable().optional(),
        participantes_com_assinatura: z.boolean().optional(),
        riscos: z.array(esquemaRisco),
        itens: z.array(esquemaItem),
      }),
    );
    validarConteudo(dados.riscos, dados.itens);

    const id = await traduzirImutabilidade(() =>
      deps.db.transaction(async (tx) => {
        const linha = await modeloPorVersao(tx, codigo, versao);
        if (!linha) throw naoEncontrado("Modelo ou versão não encontrado");
        if (linha.publicadoEm !== null) throw conflito("modelo_publicado", "Modelo publicado não pode ser alterado; crie uma nova versão");

        await tx
          .update(modeloApr)
          .set({
            titulo: dados.titulo,
            pae: dados.pae ?? null,
            dataDocumento: dados.data_documento ?? null,
            ...(dados.participantes_com_assinatura === undefined ? {} : { participantesComAssinatura: dados.participantes_com_assinatura }),
          })
          .where(eq(modeloApr.id, linha.id));
        await tx.delete(itemModeloApr).where(eq(itemModeloApr.modeloAprId, linha.id));
        await tx.delete(riscoModeloApr).where(eq(riscoModeloApr.modeloAprId, linha.id));
        await gravarRiscosEItens(tx, linha.id, dados.riscos, dados.itens);
        return linha.id;
      }),
    );
    return responder(c, { id, versao });
  });

  /** Só rascunho se descarta; uma versão publicada pode já ter APRs apontando para ela (o modelo inteiro se exclui acima). */
  r.delete("/modelos-apr/:codigo/versoes/:versao", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo");
    const versao = numeroDaVersao(c.req.param("versao"));
    await traduzirImutabilidade(() =>
      deps.db.transaction(async (tx) => {
        const linha = await modeloPorVersao(tx, codigo, versao);
        if (!linha) throw naoEncontrado("Modelo ou versão não encontrado");
        if (linha.publicadoEm !== null) throw conflito("modelo_publicado", "Modelo publicado não pode ser excluído");
        await tx.delete(modeloApr).where(eq(modeloApr.id, linha.id));
      }),
    );
    await registrarAuditoria(deps.db, c.get("usuario"), { entidade: "modelo_apr", verbo: "descartar_rascunho", entidadeId: codigo, alvo: `${codigo} v${versao}`, resumo: `Descartou o rascunho da versão ${versao} do modelo de APR ${codigo}` });
    return responder(c, {});
  });

  /** Publica o rascunho: passa a ser a versão que as APRs novas usam, e nada mais nele muda. */
  r.post("/modelos-apr/:codigo/versoes/:versao/publicar", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo");
    const versao = numeroDaVersao(c.req.param("versao"));
    const publicado = await traduzirImutabilidade(() =>
      deps.db.transaction(async (tx) => {
        const linha = await modeloPorVersao(tx, codigo, versao);
        if (!linha) throw naoEncontrado("Modelo ou versão não encontrado");
        if (linha.publicadoEm !== null) throw conflito("ja_publicado", "Esta versão já está publicada");

        const itens = await tx
          .select({ secao: itemModeloApr.secao, tipo: itemModeloApr.tipo, resposta_bloqueante: itemModeloApr.respostaBloqueante })
          .from(itemModeloApr)
          .where(eq(itemModeloApr.modeloAprId, linha.id));
        exigirPublicavel(itens);

        const [feito] = await tx
          .update(modeloApr)
          .set({ publicadoEm: deps.agora() })
          .where(and(eq(modeloApr.id, linha.id), isNull(modeloApr.publicadoEm)))
          .returning({ id: modeloApr.id, versao: modeloApr.versao, publicadoEm: modeloApr.publicadoEm });
        if (!feito) throw conflito("ja_publicado", "Esta versão já está publicada");
        return feito;
      }),
    );
    await registrarAuditoria(deps.db, c.get("usuario"), { entidade: "modelo_apr", verbo: "publicar", entidadeId: codigo, alvo: `${codigo} v${publicado.versao}`, resumo: `Publicou a versão ${publicado.versao} do modelo de APR ${codigo}` });
    return responder(c, publicado);
  });

  // ---- Atividades ------------------------------------------------------------------------------------------------

  /**
   * As atividades do plano de manutenção: cada OS traz o código de uma, e ela é o serviço do catálogo (a lista de
   * materiais). Não escolhem o modelo da APR.
   */
  r.get("/atividades", autenticar(), async (c) => {
    const filtros = lerConsulta(c, esquemaPaginacao.extend({ busca: z.string().trim().min(1).optional() }));
    const onde = filtros.busca ? or(ilike(atividade.codigo, `%${escaparLike(filtros.busca)}%`), ilike(atividade.descricao, `%${escaparLike(filtros.busca)}%`)) : undefined;
    const { limit, offset } = limiteEDeslocamento(filtros);
    const linhas = await deps.db.select().from(atividade).where(onde).orderBy(asc(atividade.codigo)).limit(limit).offset(offset);
    return responder(c, { atividades: linhas, ...meta(filtros, await contar(deps.db, atividade, onde)) });
  });

  /** Cria ou atualiza a atividade. A chave é o código do plano do SAP (pode ter pontos e barras: `8.7.1`, `8.7.2/8.7.3`). */
  r.put("/atividades/:codigo{.+}", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo").trim();
    if (!codigo || codigo.length > 200) throw invalido("codigo_invalido", "Código da atividade inválido");
    const dados = await lerCorpo(
      c,
      z.object({
        descricao: textoObrigatorio,
        provisorio: z.boolean().optional(),
      }),
    );

    const [anterior] = await deps.db.select().from(atividade).where(eq(atividade.codigo, codigo));
    const [salva] = await deps.db
      .insert(atividade)
      .values({ codigo, descricao: dados.descricao, provisorio: dados.provisorio ?? false })
      .onConflictDoUpdate({
        target: atividade.codigo,
        set: { descricao: dados.descricao, ...(dados.provisorio !== undefined && { provisorio: dados.provisorio }) },
      })
      .returning();
    const mudancas = diferencas({ descricao: anterior?.descricao, provisorio: anterior?.provisorio }, { descricao: dados.descricao, provisorio: dados.provisorio });
    if (!anterior || Object.keys(mudancas).length > 0) {
      await registrarAuditoria(deps.db, c.get("usuario"), {
        entidade: "atividade",
        verbo: anterior ? "editar" : "criar",
        entidadeId: codigo,
        alvo: codigo,
        resumo: anterior
          ? `Editou a atividade ${codigo} (${Object.keys(mudancas).join(", ")})`
          : `Cadastrou a atividade ${codigo}`,
        detalhes: mudancas,
      });
    }
    return responder(c, salva);
  });

  /** Remove a atividade. Só se nenhuma OS a usa (a OS guarda o código da atividade); senão `409`. */
  r.delete("/atividades/:codigo{.+}", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo").trim();
    const [atual] = await deps.db.select({ descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, codigo));
    if (!atual) throw naoEncontrado("Atividade não encontrada");
    try {
      await deps.db.delete(atividade).where(eq(atividade.codigo, codigo));
    } catch (erro) {
      if (codigoPostgres(erro) === "23503") {
        throw conflito("atividade_com_os", "Há OS com esta atividade e ela não pode ser excluída.");
      }
      throw erro;
    }
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "atividade",
      verbo: "excluir",
      entidadeId: codigo,
      alvo: codigo,
      resumo: `Excluiu a atividade ${codigo}`,
      detalhes: { descricao: atual.descricao },
    });
    return responder(c, {});
  });

  return r;
}
