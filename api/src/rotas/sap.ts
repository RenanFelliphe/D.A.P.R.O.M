import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { atividade, equipe, importacao, localInstalacao, os, OS_TIPOS, usuario } from "../db/schema";
import { processarOrdens } from "../dominio/importacao-ordens";
import { lerPlanilha } from "../dominio/importacao-planilha";
import type { Ambiente, Autenticacao } from "../http/autenticacao";
import { podeVerEquipe } from "../http/autenticacao";
import { codigoPostgres, conflito, ErroApi, invalido, naoEncontrado, proibido } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { dataIso, lerConsulta, lerCorpo, lerId, textoObrigatorio, uuid } from "../http/validacao";
import { enfileirarTarefa } from "../servicos/fila";

const LIMITE_DA_PLANILHA = 10 * 1024 * 1024;
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const textoOpcional = z.string().trim().min(1).nullable().optional();
const dataValida = dataIso.refine((v) => {
  const [a, m, d] = v.split("-").map(Number) as [number, number, number];
  const data = new Date(Date.UTC(a, m - 1, d));
  return data.getUTCFullYear() === a && data.getUTCMonth() === m - 1 && data.getUTCDate() === d;
}, "Data inválida");

/** O nome do arquivo no bucket: sem pastas nem caracteres estranhos, sempre `.xlsx`. */
function nomeSeguro(nome: string): string {
  const base = nome.replace(/\.[^.]*$/, "").replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);
  return `${base || "planilha"}.xlsx`;
}

const escaparLike = (t: string) => t.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Integração SAP: leitura sob demanda, importação de planilha, OS manual e de apoio, e os locais de instalação. A
 * leitura em si (agendada ou por "Ler agora") roda na tarefa `leitura_sap`, em `servicos/leitura-sap.ts`.
 */
export function rotasSap(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /** "Ler agora": registra a leitura e enfileira a tarefa; quem lê é o executor de tarefas. */
  r.post("/sap/leituras", autenticar(), exigirPerfil("analista", "admin"), async (c) => {
    const eu = c.get("usuario");
    const importacaoId = await deps.db.transaction(async (tx) => {
      const [criada] = await tx.insert(importacao).values({ origem: "api", usuarioId: eu.id }).returning({ id: importacao.id });
      await enfileirarTarefa(tx, "leitura_sap", criada!.id);
      return criada!.id;
    });
    return responder(c, { importacaoId }, 202);
  });

  /** Planilha no lugar da API: o mesmo processamento da leitura, com o mapeamento de colunas de `importacao-planilha.ts`. */
  r.post("/importacoes", autenticar(), exigirPerfil("analista", "admin"), async (c) => {
    const eu = c.get("usuario");
    const form = await c.req.parseBody().catch(() => null);
    const arquivo = form?.arquivo;
    if (!(arquivo instanceof File)) throw invalido("validacao", 'arquivo: envie a planilha .xlsx no campo multipart "arquivo"');
    if (arquivo.size === 0) throw invalido("arquivo_vazio", "Arquivo vazio");
    if (arquivo.size > LIMITE_DA_PLANILHA) throw new ErroApi(413, "arquivo_grande", `Arquivo maior que ${LIMITE_DA_PLANILHA / 1024 / 1024} MB`);

    const bytes = new Uint8Array(await arquivo.arrayBuffer());
    const { entradas } = await lerPlanilha(bytes);

    const importacaoId = randomUUID();
    const caminho = `${importacaoId}/${nomeSeguro(arquivo.name)}`;
    await deps.armazenamento.gravar("importacoes", caminho, bytes, TIPO_XLSX);

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

    return responder(
      c,
      { importacaoId, criadas: resultado.criadas, atualizadas: resultado.atualizadas, ignoradas: resultado.ignoradas, avisos: resultado.avisos },
      201,
    );
  });

  /** Histórico das leituras e importações; `ultima_leitura_com_erro` acende a faixa "Falha na leitura do SAP" no painel. */
  r.get("/importacoes", autenticar(), exigirPerfil("analista", "admin"), async (c) => {
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
    const [ultimaDaApi] = await deps.db
      .select({ erro: importacao.erro })
      .from(importacao)
      .where(eq(importacao.origem, "api"))
      .orderBy(desc(importacao.criadaEm), desc(importacao.id))
      .limit(1);
    return responder(c, {
      importacoes: linhas,
      ...meta(p, await contar(deps.db, importacao)),
      ultimaLeituraComErro: ultimaDaApi?.erro != null,
    });
  });

  /**
   * OS manual (corretiva urgente fora do SAP) e OS de apoio (`os_origem_id`). Supervisor cria para a própria equipe, ou
   * OS de apoio para qualquer equipe; analista e admin, para qualquer equipe.
   */
  r.post("/os", autenticar(), exigirPerfil("supervisor", "analista", "admin"), async (c) => {
    const eu = c.get("usuario");
    const dados = await lerCorpo(
      c,
      z.object({
        numero_ordem: textoOpcional,
        tipo: z.enum(OS_TIPOS),
        codigo_atividade: textoOpcional,
        titulo: textoObrigatorio,
        descricao: textoOpcional,
        local_instalacao_id: uuid,
        equipe_id: uuid,
        data_inicio_prog: dataValida,
        data_fim_prog: dataValida.nullable().optional(),
        prioridade: textoOpcional,
        solicitante: textoOpcional,
        os_origem_id: uuid.nullable().optional(),
        equipamento: textoOpcional,
      }),
    );
    if (eu.perfil === "supervisor" && !dados.os_origem_id && dados.equipe_id !== eu.equipeId) {
      throw proibido("O supervisor só cria OS para a própria equipe");
    }
    if (dados.data_fim_prog && dados.data_fim_prog < dados.data_inicio_prog) {
      throw invalido("datas_invalidas", "A data fim programada não pode ser anterior ao início");
    }

    if (dados.os_origem_id) {
      const [origem] = await deps.db.select({ equipeId: os.equipeId }).from(os).where(eq(os.id, dados.os_origem_id));
      if (!origem || (eu.perfil === "supervisor" && !podeVerEquipe(eu, origem.equipeId))) {
        throw invalido("os_origem_inexistente", "OS de origem não encontrada");
      }
    }
    const [local] = await deps.db.select({ id: localInstalacao.id }).from(localInstalacao).where(eq(localInstalacao.id, dados.local_instalacao_id));
    if (!local) throw invalido("local_inexistente", "Local de instalação não encontrado");
    const [equipeDaOs] = await deps.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, dados.equipe_id));
    if (!equipeDaOs) throw invalido("equipe_inexistente", "Equipe não encontrada");
    if (dados.codigo_atividade) {
      const [a] = await deps.db.select({ codigo: atividade.codigo }).from(atividade).where(eq(atividade.codigo, dados.codigo_atividade));
      if (!a) throw invalido("atividade_inexistente", "Atividade não encontrada");
    }
    if (dados.numero_ordem) {
      const [repetida] = await deps.db.select({ id: os.id }).from(os).where(eq(os.numeroOrdem, dados.numero_ordem));
      if (repetida) throw conflito("numero_ordem_duplicado", "Já existe uma OS com este número de ordem");
    }

    try {
      const [criada] = await deps.db
        .insert(os)
        .values({
          numeroOrdem: dados.numero_ordem ?? null,
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
          solicitante: dados.solicitante ?? null,
          osOrigemId: dados.os_origem_id ?? null,
          origem: "manual",
        })
        .returning({ id: os.id });
      return responder(c, { id: criada!.id }, 201);
    } catch (erro) {
      if (codigoPostgres(erro) === "23505") throw conflito("numero_ordem_duplicado", "Já existe uma OS com este número de ordem");
      throw erro;
    }
  });

  /** O cadastro manual existe para a OS manual num local que nunca veio do SAP. */
  r.post("/locais", autenticar(), exigirPerfil("supervisor", "analista", "admin"), async (c) => {
    const dados = await lerCorpo(c, z.object({ codigo: textoObrigatorio, endereco: textoOpcional, plus_code: textoOpcional, cliente: textoOpcional }));
    const [existente] = await deps.db.select({ id: localInstalacao.id }).from(localInstalacao).where(eq(localInstalacao.codigo, dados.codigo));
    if (existente) throw conflito("local_duplicado", "Local já cadastrado");
    try {
      const [criado] = await deps.db
        .insert(localInstalacao)
        .values({ codigo: dados.codigo, endereco: dados.endereco ?? null, plusCode: dados.plus_code ?? null, cliente: dados.cliente ?? null })
        .returning({ id: localInstalacao.id });
      return responder(c, { id: criado!.id }, 201);
    } catch (erro) {
      if (codigoPostgres(erro) === "23505") throw conflito("local_duplicado", "Local já cadastrado");
      throw erro;
    }
  });

  /** Criticidade do local, editada no painel. */
  r.patch("/locais/:id", autenticar(), exigirPerfil("analista", "admin"), async (c) => {
    const id = lerId(c);
    const { critico } = await lerCorpo(c, z.object({ critico: z.boolean() }));
    const atualizados = await deps.db.update(localInstalacao).set({ critico }).where(eq(localInstalacao.id, id)).returning({ id: localInstalacao.id });
    if (atualizados.length === 0) throw naoEncontrado("Local não encontrado");
    return responder(c, {});
  });

  /** Qualquer perfil lê (o formulário de OS manual escolhe o local aqui); `?codigo=` filtra por trecho do código. */
  r.get("/locais", autenticar(), async (c) => {
    const filtros = lerConsulta(c, esquemaPaginacao.extend({ codigo: z.string().trim().min(1).optional() }));
    const { limit, offset } = limiteEDeslocamento(filtros);
    const onde = and(filtros.codigo ? ilike(localInstalacao.codigo, `%${escaparLike(filtros.codigo)}%`) : undefined);
    const linhas = await deps.db.select().from(localInstalacao).where(onde).orderBy(asc(localInstalacao.codigo)).limit(limit).offset(offset);
    return responder(c, { locais: linhas, ...meta(filtros, await contar(deps.db, localInstalacao, onde)) });
  });

  return r;
}
