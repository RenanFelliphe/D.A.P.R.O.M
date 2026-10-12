import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, max, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { diferencas, registrarAuditoria } from "../dominio/auditoria";
import { apr, atividade, equipe, itemModeloApr, modeloApr, os, riscoModeloApr, type Perfil } from "../db/schema";
import {
  conteudoDe,
  gravarRiscosEItens,
  modeloCompleto,
  modeloPorVersao,
  publicadoEmUso,
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
 * Quem cria, edita, publica e exclui modelos e mantém a tabela de atividades: só o administrador do sistema, que
 * mantém o conteúdo definido pela Segurança do Trabalho (que não usa o sistema). Ele também enxerga os rascunhos.
 */
const PERFIS_DE_MODELO = ["admin"] as const satisfies readonly Perfil[];
const editaModelos = (perfil: Perfil) => (PERFIS_DE_MODELO as readonly Perfil[]).includes(perfil);

/** Status em que a OS ainda vai pedir uma APR (ou está em campo com uma). */
const OS_ABERTAS = ["liberada", "pendente", "em_execucao"] as const;
const OS_ABERTAS_NA_RESPOSTA = 10;

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
  publicadoEm: modeloApr.publicadoEm,
  arquivadoEm: modeloApr.arquivadoEm,
  rascunho: sql<boolean>`${modeloApr.publicadoEm} is null`,
  itensTotal: sql<number>`(select count(*)::int from item_modelo_apr where item_modelo_apr.modelo_apr_id = modelo_apr.id)`,
  /** APRs respondidas nesta versão. */
  aprsTotal: sql<number>`(select count(*)::int from apr where apr.modelo_apr_id = modelo_apr.id)`,
  /** Atividades do SAP ligadas ao código (igual em todas as versões dele). */
  atividadesTotal: sql<number>`(select count(*)::int from atividade where atividade.modelo_apr_codigo = modelo_apr.codigo)`,
};

/**
 * Modelos de APR versionados e a tabela de atividades. Todo perfil autenticado lê (rascunho só quem edita); só o
 * administrador escreve (a Segurança do Trabalho não usa o sistema). Um modelo publicado é imutável (Decisão-chave 6): editar é criar
 * um rascunho da versão seguinte, ajustá-lo e publicá-lo; excluir um modelo publicado o arquiva.
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

  /** Um modelo e todas as versões dele, inclusive quando excluído (arquivado), para a tela do modelo. */
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
    return responder(c, { codigo, titulo: principal.titulo, arquivadoEm: principal.arquivadoEm, versoes });
  });

  /**
   * Onde o modelo é usado: as atividades do SAP ligadas a ele (é por elas que uma OS chega ao modelo), as OS abertas
   * dessas atividades e as APRs já respondidas em qualquer versão. Só para quem enxerga as OS de todas as equipes.
   */
  r.get("/modelos-apr/:codigo/uso", autenticar(), exigirPerfil("admin"), async (c) => {
    const codigo = c.req.param("codigo");
    const [existe] = await deps.db.select({ id: modeloApr.id }).from(modeloApr).where(eq(modeloApr.codigo, codigo)).limit(1);
    if (!existe) throw naoEncontrado("Modelo não encontrado");

    const atividades = await deps.db
      .select({ codigo: atividade.codigo, descricao: atividade.descricao, provisorio: atividade.provisorio })
      .from(atividade)
      .where(eq(atividade.modeloAprCodigo, codigo))
      .orderBy(asc(atividade.codigo));

    const abertas = and(
      inArray(os.status, [...OS_ABERTAS]),
      inArray(os.codigoAtividade, deps.db.select({ codigo: atividade.codigo }).from(atividade).where(eq(atividade.modeloAprCodigo, codigo))),
    );
    const [recentes, totalAbertas, [aprs]] = await Promise.all([
      deps.db
        .select({
          id: os.id,
          numeroOrdem: os.numeroOrdem,
          titulo: os.titulo,
          status: os.status,
          codigoAtividade: os.codigoAtividade,
          dataInicioProg: os.dataInicioProg,
          equipe: equipe.nome,
        })
        .from(os)
        .innerJoin(equipe, eq(equipe.id, os.equipeId))
        .where(abertas)
        .orderBy(asc(os.dataInicioProg), asc(os.numeroOrdem))
        .limit(OS_ABERTAS_NA_RESPOSTA),
      contar(deps.db, os, abertas),
      deps.db
        .select({
          total: count(),
          bloqueadas: sql<number>`(count(*) filter (where ${apr.resultado} = 'bloqueada'))::int`,
          ultimaEm: max(apr.concluidaEm),
        })
        .from(apr)
        .innerJoin(modeloApr, eq(modeloApr.id, apr.modeloAprId))
        .where(eq(modeloApr.codigo, codigo)),
    ]);

    return responder(c, { codigo, atividades, osAbertas: { total: totalAbertas, recentes }, aprs });
  });

  /**
   * Exclui o modelo. O rascunho sai de vez; se já houve versão publicada, as versões ficam arquivadas (APRs, PDFs e
   * a APR offline que ainda vai chegar apontam para elas): o modelo some das listas, das APRs novas e da cópia offline.
   * As atividades ligadas a ele passam para o `substituto` (um modelo publicado) ou ficam sem modelo, e o técnico
   * escolhe ao abrir a APR dessas OS.
   */
  r.delete("/modelos-apr/:codigo", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo");
    const { substituto } = lerConsulta(c, z.object({ substituto: esquemaCodigo.optional() }));
    if (substituto === codigo) throw invalido("substituto_invalido", "O substituto precisa ser outro modelo");

    const feito = await traduzirImutabilidade(() =>
      deps.db.transaction(async (tx) => {
        const versoes = await tx.select({ publicadoEm: modeloApr.publicadoEm, arquivadoEm: modeloApr.arquivadoEm }).from(modeloApr).where(eq(modeloApr.codigo, codigo));
        if (versoes.length === 0) throw naoEncontrado("Modelo não encontrado");
        if (versoes.some((v) => v.arquivadoEm)) throw conflito("modelo_arquivado", `O modelo ${codigo} já foi excluído`);
        if (substituto && !(await publicadoEmUso(tx, substituto))) {
          throw invalido("substituto_invalido", `O modelo ${substituto} não existe, não tem versão publicada ou foi excluído`);
        }

        const movidas = await tx
          .update(atividade)
          .set({ modeloAprCodigo: substituto ?? null })
          .where(eq(atividade.modeloAprCodigo, codigo))
          .returning({ codigo: atividade.codigo });
        await tx.delete(modeloApr).where(and(eq(modeloApr.codigo, codigo), isNull(modeloApr.publicadoEm)));
        const arquivado = versoes.some((v) => v.publicadoEm);
        if (arquivado) {
          await tx
            .update(modeloApr)
            .set({ arquivadoEm: deps.agora() })
            .where(and(eq(modeloApr.codigo, codigo), isNotNull(modeloApr.publicadoEm)));
        }
        return { codigo, resultado: arquivado ? "arquivado" : "excluido", atividades: movidas.length, substituto: substituto ?? null };
      }),
    );
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "modelo_apr",
      verbo: "excluir",
      entidadeId: codigo,
      alvo: codigo,
      resumo: feito.resultado === "arquivado" ? `Excluiu o modelo de APR ${codigo} (versões arquivadas)` : `Excluiu o modelo de APR ${codigo}`,
      detalhes: { resultado: feito.resultado, atividades_movidas: feito.atividades, substituto: feito.substituto },
    });
    return responder(c, feito);
  });

  /** Desfaz a exclusão de um modelo arquivado. As atividades não voltam sozinhas: ligue-as de novo na tabela. */
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
          riscos: dados.riscos ?? base!.riscos,
          itens: dados.itens ?? base!.itens,
        };
        validarConteudo(conteudo.riscos, conteudo.itens);

        const versao = existentes.length > 0 ? Math.max(...existentes.map((e) => e.versao)) + 1 : (dados.versao ?? 1);
        const [linha] = await tx
          .insert(modeloApr)
          .values({ codigo, versao, titulo: conteudo.titulo, pae: conteudo.pae, dataDocumento: conteudo.dataDocumento })
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
          .set({ titulo: dados.titulo, pae: dados.pae ?? null, dataDocumento: dados.data_documento ?? null })
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

  /** A ligação OS → modelo: cada OS traz o código da atividade (plano de manutenção), e a atividade diz o modelo. */
  r.get("/atividades", autenticar(), async (c) => {
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({
        sem_modelo: booleanoDaConsulta,
        busca: z.string().trim().min(1).optional(),
        modelo: esquemaCodigo.optional(),
      }),
    );
    const condicoes: (SQL | undefined)[] = [
      filtros.sem_modelo ? isNull(atividade.modeloAprCodigo) : undefined,
      filtros.modelo ? eq(atividade.modeloAprCodigo, filtros.modelo) : undefined,
      filtros.busca ? or(ilike(atividade.codigo, `%${escaparLike(filtros.busca)}%`), ilike(atividade.descricao, `%${escaparLike(filtros.busca)}%`)) : undefined,
    ];
    const onde = and(...condicoes);
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
        modelo_apr_codigo: z.string().trim().min(1).nullable(),
        provisorio: z.boolean().optional(),
      }),
    );
    if (dados.modelo_apr_codigo !== null && !(await publicadoEmUso(deps.db, dados.modelo_apr_codigo))) {
      throw invalido("modelo_sem_versao_publicada", `O modelo ${dados.modelo_apr_codigo} não existe, não tem versão publicada ou foi excluído`);
    }

    const [anterior] = await deps.db.select().from(atividade).where(eq(atividade.codigo, codigo));
    const [salva] = await deps.db
      .insert(atividade)
      .values({ codigo, descricao: dados.descricao, modeloAprCodigo: dados.modelo_apr_codigo, provisorio: dados.provisorio ?? false })
      .onConflictDoUpdate({
        target: atividade.codigo,
        set: {
          descricao: dados.descricao,
          modeloAprCodigo: dados.modelo_apr_codigo,
          ...(dados.provisorio !== undefined && { provisorio: dados.provisorio }),
        },
      })
      .returning();
    const mudancas = diferencas(
      { descricao: anterior?.descricao, modelo_apr_codigo: anterior?.modeloAprCodigo ?? null, provisorio: anterior?.provisorio },
      { descricao: dados.descricao, modelo_apr_codigo: dados.modelo_apr_codigo, provisorio: dados.provisorio },
    );
    if (!anterior || Object.keys(mudancas).length > 0) {
      await registrarAuditoria(deps.db, c.get("usuario"), {
        entidade: "atividade",
        verbo: anterior ? "editar" : "criar",
        entidadeId: codigo,
        alvo: codigo,
        resumo: anterior
          ? `Editou a atividade ${codigo} (${Object.keys(mudancas).join(", ")})`
          : `Cadastrou a atividade ${codigo}${dados.modelo_apr_codigo ? ` com o modelo ${dados.modelo_apr_codigo}` : " sem modelo"}`,
        detalhes: mudancas,
      });
    }
    return responder(c, salva);
  });

  /** Remove a atividade. Só se nenhuma OS a usa (a OS guarda o código da atividade); senão `409`, e a saída é ligar a atividade a outro modelo ou deixá-la sem modelo. */
  r.delete("/atividades/:codigo{.+}", autenticar(), soQuemEdita, async (c) => {
    const codigo = c.req.param("codigo").trim();
    const [atual] = await deps.db.select({ descricao: atividade.descricao, modeloAprCodigo: atividade.modeloAprCodigo }).from(atividade).where(eq(atividade.codigo, codigo));
    if (!atual) throw naoEncontrado("Atividade não encontrada");
    try {
      await deps.db.delete(atividade).where(eq(atividade.codigo, codigo));
    } catch (erro) {
      if (codigoPostgres(erro) === "23503") {
        throw conflito("atividade_com_os", "Há OS com esta atividade e ela não pode ser excluída. Deixe-a sem modelo ou ligue-a a outro.");
      }
      throw erro;
    }
    await registrarAuditoria(deps.db, c.get("usuario"), {
      entidade: "atividade",
      verbo: "excluir",
      entidadeId: codigo,
      alvo: codigo,
      resumo: `Excluiu a atividade ${codigo}`,
      detalhes: { descricao: atual.descricao, modelo_apr_codigo: atual.modeloAprCodigo },
    });
    return responder(c, {});
  });

  return r;
}
