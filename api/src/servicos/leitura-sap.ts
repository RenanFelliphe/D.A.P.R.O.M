import { and, desc, eq, inArray, isNull, ne, notExists, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { importacao, tarefa } from "../db/schema";
import type { Deps } from "../deps";
import { alertarFalhaDeImportacao, detalheDaFalha } from "../dominio/alertas";
import { processarOrdens, type AvisoOrdem, type DetalheIgnorada } from "../dominio/importacao-ordens";
import { conferirCiclosDaImportacao } from "../dominio/preventivas";

const TAMANHO_DA_PAGINA = 200;
/** Trava contra uma API que nunca termina de paginar. */
const MAXIMO_DE_PAGINAS = 500;

export interface ResultadoLeitura {
  importacaoId: string;
  criadas: number;
  atualizadas: number;
  ignoradas: DetalheIgnorada[];
  /** Não ficam no banco: só no retorno (por exemplo, o intervalo entre ciclos que não foi reconhecido). */
  avisos: AvisoOrdem[];
  /** Preenchido quando a leitura falhou; nesse caso nada foi gravado além da própria `importacao`. */
  erro: string | null;
}

const mensagemDe = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro)).slice(0, 500);

/**
 * Onde a leitura anterior parou: o início da última leitura pela API que terminou sem erro. Fica de fora a que ainda
 * está na fila ou em andamento (uma `importacao` criada por "Ler agora" existe antes de a tarefa rodar) e a própria.
 */
async function cursorDaLeitura(db: Db, importacaoId: string | undefined): Promise<Date | undefined> {
  const [ultima] = await db
    .select({ criadaEm: importacao.criadaEm })
    .from(importacao)
    .where(
      and(
        eq(importacao.origem, "api"),
        isNull(importacao.erro),
        importacaoId ? ne(importacao.id, importacaoId) : undefined,
        notExists(
          db
            .select({ um: sql`1` })
            .from(tarefa)
            .where(and(eq(tarefa.tipo, "leitura_sap"), eq(tarefa.referenciaId, importacao.id), inArray(tarefa.estado, ["pendente", "em_andamento", "falhou"]))),
        ),
      ),
    )
    .orderBy(desc(importacao.criadaEm), desc(importacao.id))
    .limit(1);
  return ultima?.criadaEm;
}

/** Início da última leitura pela API que terminou sem erro (a "última sincronização" do painel), ou `undefined`. */
export const ultimaLeituraConcluida = (db: Db) => cursorDaLeitura(db, undefined);

async function buscarOrdens(deps: Deps, alteradasDesde: Date | undefined): Promise<unknown[]> {
  const ordens: unknown[] = [];
  let pagina = 1;
  for (let n = 0; n < MAXIMO_DE_PAGINAS; n++) {
    const resposta = await deps.sap.listarOrdens({ ...(alteradasDesde ? { alteradasDesde } : {}), pagina, tamanho: TAMANHO_DA_PAGINA });
    if (!resposta || !Array.isArray(resposta.ordens)) throw new Error("Resposta inválida da API do SAP");
    ordens.push(...resposta.ordens);
    if (!resposta.proxima_pagina) return ordens;
    if (resposta.proxima_pagina <= pagina) throw new Error("Resposta inválida da API do SAP: a próxima página não avança");
    pagina = resposta.proxima_pagina;
  }
  throw new Error("A API do SAP devolveu páginas demais");
}

/**
 * Falha: nenhuma OS foi criada, alterada ou removida; fica só o registro da leitura, com o erro (no histórico), e o alerta
 * `falha_importacao` no sino de quem pediu a leitura (na agendada, dos administradores).
 */
async function registrarFalha(deps: Deps, o: { importacaoId?: string; usuarioId: string | null; inicio: Date; erro: string }): Promise<string> {
  return deps.db.transaction(async (tx) => {
    const db = tx as unknown as Db;
    let importacaoId = o.importacaoId;
    if (importacaoId) {
      await db.update(importacao).set({ erro: o.erro }).where(eq(importacao.id, importacaoId));
    } else {
      const [criada] = await db.insert(importacao).values({ origem: "api", usuarioId: o.usuarioId, erro: o.erro, criadaEm: o.inicio }).returning({ id: importacao.id });
      importacaoId = criada!.id;
    }
    await alertarFalhaDeImportacao(db, { importacaoId, origem: "api", usuarioId: o.usuarioId, detalhe: detalheDaFalha({ origem: "api", motivo: o.erro }), agora: deps.agora() });
    return importacaoId;
  });
}

/**
 * Uma leitura do SAP: consulta a API desde a última leitura bem-sucedida, pagina até o fim e processa as ordens numa
 * única transação. Com a API fora do ar, uma resposta inválida ou um erro ao gravar, nenhuma OS muda, a `importacao` fica
 * com `erro` e sai o alerta de falha; a leitura seguinte retoma do mesmo ponto. Sem `importacaoId` (leitura agendada), a `importacao` é criada aqui, com o
 * início da leitura como `criada_em` para que nenhuma alteração feita durante a consulta escape da próxima.
 */
export async function executarLeitura(deps: Deps, opcoes: { importacaoId?: string; usuarioId?: string | null } = {}): Promise<ResultadoLeitura> {
  const inicio = deps.agora();
  let usuarioId = opcoes.usuarioId ?? null;

  if (opcoes.importacaoId) {
    const [existente] = await deps.db.select({ usuarioId: importacao.usuarioId }).from(importacao).where(eq(importacao.id, opcoes.importacaoId));
    if (!existente) throw new Error(`Importação ${opcoes.importacaoId} não encontrada`);
    usuarioId = existente.usuarioId;
  }

  const falha = async (erro: string): Promise<ResultadoLeitura> => {
    const importacaoId = await registrarFalha(deps, { ...(opcoes.importacaoId ? { importacaoId: opcoes.importacaoId } : {}), usuarioId, inicio, erro });
    return { importacaoId, criadas: 0, atualizadas: 0, ignoradas: [], avisos: [], erro };
  };

  let ordens: unknown[];
  try {
    ordens = await buscarOrdens(deps, await cursorDaLeitura(deps.db, opcoes.importacaoId));
  } catch (erro) {
    return falha(mensagemDe(erro));
  }

  try {
    const resultado = await deps.db.transaction(async (tx) => {
      const r = await processarOrdens(tx as unknown as Db, ordens.map((ordem) => ({ ordem })), { origem: "sap", agora: inicio });
      const contagens = { criadas: r.criadas, atualizadas: r.atualizadas, ignoradas: r.ignoradas.length, detalheIgnoradas: r.ignoradas, erro: null };
      let importacaoId = opcoes.importacaoId;
      if (importacaoId) {
        await tx.update(importacao).set(contagens).where(eq(importacao.id, importacaoId));
      } else {
        const [criada] = await tx.insert(importacao).values({ origem: "api", usuarioId, criadaEm: inicio, ...contagens }).returning({ id: importacao.id });
        importacaoId = criada!.id;
      }
      return { importacaoId, criadas: r.criadas, atualizadas: r.atualizadas, ignoradas: r.ignoradas, avisos: r.avisos, erro: null, planos: r.planos };
    });
    const { planos, ...leitura } = resultado;
    await conferirCiclosDaImportacao(deps.db, deps.agora(), planos);
    return leitura;
  } catch (erro) {
    console.error("Falha ao processar a leitura do SAP", erro);
    return falha(`Falha ao gravar as ordens: ${mensagemDe(erro)}`);
  }
}

/** Tarefa `leitura_sap`: `referenciaId` é a `importacao` criada por `POST /sap/leituras`, ou nulo na leitura agendada. */
export async function manipularLeituraSap(deps: Deps, tarefa: { id: string; referenciaId: string | null }): Promise<void> {
  await executarLeitura(deps, { ...(tarefa.referenciaId ? { importacaoId: tarefa.referenciaId } : {}) });
}
