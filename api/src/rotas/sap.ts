import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db/conexao";
import type { Deps } from "../deps";
import { atividade, equipe, importacao, localInstalacao, os, OS_TIPOS, usuario } from "../db/schema";
import { alertarFalhaDeImportacao, detalheDaFalha } from "../dominio/alertas";
import { processarOrdens } from "../dominio/importacao-ordens";
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
 * A planilha falhou: nenhuma OS mudou (a transação das ordens desfez tudo ou nem começou). Fica o registro da importação
 * com o erro e o arquivo, se chegou a ser guardado, e o alerta de falha para quem enviou. Se nem isso der para gravar, só
 * registra no log: o erro original é o que volta para a pessoa.
 */
async function registrarFalhaDaPlanilha(deps: Deps, o: { importacaoId: string; arquivo: string | null; nome: string; usuarioId: string; erro: unknown }) {
  const motivo = o.erro instanceof ErroApi ? o.erro.message : "erro inesperado ao gravar as ordens";
  if (!(o.erro instanceof ErroApi)) console.error("Falha ao importar a planilha", o.erro);
  try {
    await deps.db.transaction(async (tx) => {
      const db = tx as unknown as Db;
      await db.insert(importacao).values({ id: o.importacaoId, origem: "planilha", arquivo: o.arquivo, usuarioId: o.usuarioId, erro: motivo });
      await alertarFalhaDeImportacao(db, {
        importacaoId: o.importacaoId,
        origem: "planilha",
        usuarioId: o.usuarioId,
        detalhe: detalheDaFalha({ origem: "planilha", arquivo: o.nome, motivo }),
        agora: deps.agora(),
      });
    });
  } catch (falha) {
    console.error("Não foi possível registrar a falha da planilha", falha);
  }
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
      if (arquivo.size === 0) throw invalido("arquivo_vazio", "Arquivo vazio");
      if (arquivo.size > LIMITE_DA_PLANILHA) throw new ErroApi(413, "arquivo_grande", `Arquivo maior que ${LIMITE_DA_PLANILHA / 1024 / 1024} MB`);

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

      return responder(
        c,
        { importacaoId, criadas: resultado.criadas, atualizadas: resultado.atualizadas, ignoradas: resultado.ignoradas, avisos: resultado.avisos },
        201,
      );
    } catch (erro) {
      await registrarFalhaDaPlanilha(deps, { importacaoId, arquivo: guardado ? caminho : null, nome: arquivo.name, usuarioId: eu.id, erro });
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
    return responder(c, { id: criada!.id }, 201);
  });

  /** Criticidade do local, editada no painel. */
  r.patch("/locais/:id", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const { critico } = await lerCorpo(c, z.object({ critico: z.boolean() }));
    const atualizados = await deps.db.update(localInstalacao).set({ critico }).where(eq(localInstalacao.id, id)).returning({ id: localInstalacao.id });
    if (atualizados.length === 0) throw naoEncontrado("Local não encontrado");
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
