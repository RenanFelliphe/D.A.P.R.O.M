import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { atividade, itemModeloApr, modeloApr, riscoModeloApr } from "../db/schema";
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
  esquemaItem,
  esquemaPae,
  esquemaRisco,
  exigirPublicavel,
  validarConteudo,
  type ConteudoDoModelo,
} from "../dominio/modelo-apr-esquema";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, lerConsulta, lerCorpo, textoObrigatorio } from "../http/validacao";

/** `:versao` da URL precisa ser um número ou `publicada`; qualquer outra coisa é uma versão que não existe. */
function numeroDaVersao(versao: string): number {
  if (!/^[0-9]+$/.test(versao)) throw naoEncontrado("Modelo ou versão não encontrado");
  return Number(versao);
}

const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

/**
 * Modelos de APR versionados e a tabela de atividades. Todo perfil autenticado lê (rascunho só a Segurança do Trabalho
 * enxerga); só o perfil `seguranca` escreve. Um modelo publicado é imutável (Decisão-chave 6): editar é criar um
 * rascunho da versão seguinte, ajustá-lo e publicá-lo.
 */
export function rotasModelosApr(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();
  const soSeguranca = exigirPerfil("seguranca");

  // ---- Modelos ---------------------------------------------------------------------------------------------------

  /** Resumos, sem itens: por código e versão decrescente. Quem não é da Segurança só vê os publicados. */
  r.get("/modelos-apr", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const filtros = lerConsulta(c, esquemaPaginacao.extend({ codigo: z.string().trim().min(1).optional(), publicados: booleanoDaConsulta }));
    const soPublicados = eu.perfil !== "seguranca" || filtros.publicados === true;
    const onde = and(
      filtros.codigo ? eq(modeloApr.codigo, filtros.codigo) : undefined,
      soPublicados ? isNotNull(modeloApr.publicadoEm) : undefined,
    );
    const { limit, offset } = limiteEDeslocamento(filtros);
    const linhas = await deps.db
      .select({
        id: modeloApr.id,
        codigo: modeloApr.codigo,
        versao: modeloApr.versao,
        titulo: modeloApr.titulo,
        dataDocumento: modeloApr.dataDocumento,
        publicadoEm: modeloApr.publicadoEm,
        rascunho: sql<boolean>`${modeloApr.publicadoEm} is null`,
        // colunas qualificadas à mão: o Drizzle as emite sem prefixo numa consulta de uma tabela só, e `id` valeria o do item
        itensTotal: sql<number>`(select count(*)::int from item_modelo_apr where item_modelo_apr.modelo_apr_id = modelo_apr.id)`,
      })
      .from(modeloApr)
      .where(onde)
      .orderBy(asc(modeloApr.codigo), desc(modeloApr.versao))
      .limit(limit)
      .offset(offset);
    return responder(c, { modelos: linhas, ...meta(filtros, await contar(deps.db, modeloApr, onde)) });
  });

  /** Modelo completo para o editor e para aplicar a APR. `publicada` = a publicada mais recente do código. */
  r.get("/modelos-apr/:codigo/versoes/:versao", autenticar(), async (c) => {
    const veRascunho = c.get("usuario").perfil === "seguranca";
    const linha = await resolverVersao(deps.db, c.req.param("codigo"), c.req.param("versao"), veRascunho);
    return responder(c, await modeloCompleto(deps.db, linha));
  });

  /**
   * Cria o rascunho da versão seguinte. `titulo`, `pae`, `riscos` e `itens` omitidos copiam a versão publicada mais
   * recente (`data_documento` omitida fica nula: a data é a do documento novo); um código que ainda não existe cria a
   * versão 1 e exige `titulo`, `riscos` e `itens`.
   */
  r.post("/modelos-apr/:codigo/versoes", autenticar(), soSeguranca, async (c) => {
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
      }),
    );

    const criado = await traduzirImutabilidade(() =>
      deps.db.transaction(async (tx) => {
        const existentes = await tx.select({ versao: modeloApr.versao }).from(modeloApr).where(eq(modeloApr.codigo, codigo));
        let base: ConteudoDoModelo | null = null;
        if (existentes.length > 0) {
          if (await rascunhoDoCodigo(tx, codigo)) {
            throw conflito("rascunho_existente", `Já existe um rascunho do modelo ${codigo}; edite-o ou publique-o antes`);
          }
          const publicada = await versaoPublicadaMaisRecente(tx, codigo);
          if (publicada) base = await conteudoDe(tx, publicada);
        } else if (dados.titulo === undefined || dados.riscos === undefined || dados.itens === undefined) {
          throw invalido("conteudo_obrigatorio", "Modelo novo precisa de titulo, riscos e itens");
        }

        const conteudo: ConteudoDoModelo = {
          titulo: dados.titulo ?? base!.titulo,
          pae: dados.pae === undefined ? (base?.pae ?? null) : dados.pae,
          dataDocumento: dados.data_documento ?? null,
          riscos: dados.riscos ?? base!.riscos,
          itens: dados.itens ?? base!.itens,
        };
        validarConteudo(conteudo.riscos, conteudo.itens);

        const versao = Math.max(0, ...existentes.map((e) => e.versao)) + 1;
        const [linha] = await tx
          .insert(modeloApr)
          .values({ codigo, versao, titulo: conteudo.titulo, pae: conteudo.pae, dataDocumento: conteudo.dataDocumento })
          .returning({ id: modeloApr.id, versao: modeloApr.versao });
        await gravarRiscosEItens(tx, linha!.id, conteudo.riscos, conteudo.itens);
        return linha!;
      }),
    );
    return responder(c, criado, 201);
  });

  /** Substitui o conteúdo inteiro de um rascunho. Publicado não aceita escrita (`409`). */
  r.put("/modelos-apr/:codigo/versoes/:versao", autenticar(), soSeguranca, async (c) => {
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

  /** Só rascunho se descarta; uma versão publicada pode já ter APRs apontando para ela. */
  r.delete("/modelos-apr/:codigo/versoes/:versao", autenticar(), soSeguranca, async (c) => {
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
    return responder(c, {});
  });

  /** Publica o rascunho: passa a ser a versão que as APRs novas usam, e nada mais nele muda. */
  r.post("/modelos-apr/:codigo/versoes/:versao/publicar", autenticar(), soSeguranca, async (c) => {
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
    return responder(c, publicado);
  });

  // ---- Atividades ------------------------------------------------------------------------------------------------

  r.get("/atividades", autenticar(), async (c) => {
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({ sem_modelo: booleanoDaConsulta, busca: z.string().trim().min(1).optional() }),
    );
    const condicoes: (SQL | undefined)[] = [
      filtros.sem_modelo ? isNull(atividade.modeloAprCodigo) : undefined,
      filtros.busca ? or(ilike(atividade.codigo, `%${escaparLike(filtros.busca)}%`), ilike(atividade.descricao, `%${escaparLike(filtros.busca)}%`)) : undefined,
    ];
    const onde = and(...condicoes);
    const { limit, offset } = limiteEDeslocamento(filtros);
    const linhas = await deps.db.select().from(atividade).where(onde).orderBy(asc(atividade.codigo)).limit(limit).offset(offset);
    return responder(c, { atividades: linhas, ...meta(filtros, await contar(deps.db, atividade, onde)) });
  });

  /** Cria ou atualiza a atividade. A chave é o código do plano do SAP (pode ter pontos e barras: `8.7.1`, `8.7.2/8.7.3`). */
  r.put("/atividades/:codigo{.+}", autenticar(), soSeguranca, async (c) => {
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
    if (dados.modelo_apr_codigo !== null) {
      const [publicado] = await deps.db
        .select({ id: modeloApr.id })
        .from(modeloApr)
        .where(and(eq(modeloApr.codigo, dados.modelo_apr_codigo), isNotNull(modeloApr.publicadoEm)))
        .limit(1);
      if (!publicado) throw invalido("modelo_sem_versao_publicada", `O modelo ${dados.modelo_apr_codigo} não existe ou não tem versão publicada`);
    }

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
    return responder(c, salva);
  });

  return r;
}
