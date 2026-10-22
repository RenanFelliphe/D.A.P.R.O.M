import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { atividade, itemModeloApr, modeloApr, orientacaoModeloApr, riscoModeloApr } from "../schema";
import { ehPerguntaDeClima } from "../../../../shared/api/clima";
import dados from "./modelos-apr.json" with { type: "json" };
import { ORIENTACOES_INICIAIS } from "./orientacoes-modelos-apr";

type ItemDoSeed = Omit<typeof itemModeloApr.$inferInsert, "id" | "modeloAprId" | "riscoId"> & { risco: number | null };

export interface ResultadoDaCarga {
  modelosCarregados: string[];
  modelosJaExistentes: string[];
  atividadesInseridas: number;
  orientacoesInseridas: number;
}

/**
 * Carga inicial: os 8 modelos de APR de `base/apr-examples/` (já lidos para `modelos-apr.json` por
 * `gerar-modelos-apr.mjs`), a orientação de cada um (o que o técnico vê ao escolher o modelo) e a tabela de atividades.
 *
 * Segura para rodar a cada subida da api: um modelo só entra se o código ainda não existe em nenhuma versão (se a
 * Segurança já criou versões novas, a carga não toca), e uma orientação ou uma atividade só entra se o código ainda não
 * existe (o que o admin editou fica). O `modeloAprCodigo` das atividades do JSON só diz em que planilha a atividade
 * aparece: a atividade não escolhe o modelo da APR. Cada modelo entra como rascunho e é publicado ao fim, na mesma transação, porque o banco
 * não aceita itens em modelo publicado.
 */
export async function carregarDadosIniciais(db: PgDatabase<PgQueryResultHKT>): Promise<ResultadoDaCarga> {
  const resultado: ResultadoDaCarga = { modelosCarregados: [], modelosJaExistentes: [], atividadesInseridas: 0, orientacoesInseridas: 0 };

  for (const m of dados.modelos) {
    await db.transaction(async (tx) => {
      const existente = await tx.select({ id: modeloApr.id }).from(modeloApr).where(eq(modeloApr.codigo, m.codigo)).limit(1);
      if (existente.length > 0) {
        resultado.modelosJaExistentes.push(m.codigo);
        return;
      }

      const [criado] = await tx
        .insert(modeloApr)
        .values({ codigo: m.codigo, versao: m.versao, dataDocumento: m.dataDocumento, titulo: m.titulo, pae: m.pae, participantesComAssinatura: m.participantesComAssinatura })
        .returning({ id: modeloApr.id });
      const modeloAprId = criado!.id;

      const riscos = await tx
        .insert(riscoModeloApr)
        .values(m.riscos.map((r) => ({ ...r, modeloAprId })))
        .returning({ id: riscoModeloApr.id, ordem: riscoModeloApr.ordem });
      const riscoPorOrdem = new Map(riscos.map((r) => [r.ordem, r.id]));

      await tx.insert(itemModeloApr).values(
        (m.itens as ItemDoSeed[]).map(({ risco, ...item }) => ({
          ...item,
          mostrarClima: item.mostrarClima ?? ehPerguntaDeClima(item.texto),
          modeloAprId,
          riscoId: risco === null ? null : riscoPorOrdem.get(risco)!,
        })),
      );

      await tx.update(modeloApr).set({ publicadoEm: new Date() }).where(eq(modeloApr.id, modeloAprId));
      resultado.modelosCarregados.push(m.codigo);
    });
  }

  const orientacoes = await db.insert(orientacaoModeloApr).values([...ORIENTACOES_INICIAIS]).onConflictDoNothing({ target: orientacaoModeloApr.codigo }).returning({ codigo: orientacaoModeloApr.codigo });
  resultado.orientacoesInseridas = orientacoes.length;

  for (const a of dados.atividades) {
    const inseridas = await db
      .insert(atividade)
      .values({ codigo: a.codigo, descricao: a.descricao, provisorio: a.provisorio })
      .onConflictDoNothing({ target: atividade.codigo })
      .returning({ codigo: atividade.codigo });
    resultado.atividadesInseridas += inseridas.length;
  }

  return resultado;
}
