import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { apr, aprResposta, atividade, equipe, itemModeloApr, modeloApr, os } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { condicaoEscopo, diaNoFuso, todas } from "./painel-comum";
import { diaDoInstante, faixaDoDia, instanteEntre, resolverPeriodo, type Periodo } from "./periodo";

/** Quantos itens cada ranking de itens reprovados traz. */
const ITENS_NO_RANKING = 8;

const contagem = sql<number>`count(*)::int`;

/**
 * Dashboard de APR: respondidas por faixa, aprovadas e bloqueadas, os itens que mais bloquearam e os alertas mais
 * registrados, as APRs por modelo e por equipe, e quantas caíram numa OS sem atividade ligada a um modelo (o técnico
 * teve de escolher). Conta pela data de conclusão da APR, no fuso de São Paulo, e traz os totais do período anterior.
 * A equipe é a da OS; o supervisor só vê a dele (a equipe já vem resolvida por `equipeDoIndicador`).
 */
export async function resumoDasAprs(db: Db, eu: UsuarioAutenticado, f: { periodo: Periodo; equipeId?: string }, agora: Date) {
  const { agrupamento, faixas, anterior, inicio, fim, de, ate } = resolverPeriodo(f.periodo, diaNoFuso(agora));
  const daEquipe = todas(condicaoEscopo(eu), f.equipeId ? eq(os.equipeId, f.equipeId) : undefined);
  const noPeriodo = todas(instanteEntre(apr.concluidaEm, inicio, fim), daEquipe);
  const dia = diaDoInstante(apr.concluidaEm);
  const bloqueadas = sql<number>`(count(*) filter (where ${apr.resultado} = 'bloqueada'))::int`;

  const [porDia, reprovados, porModelo, porEquipe, [semModelo]] = await Promise.all([
    db
      .select({ dia, resultado: apr.resultado, total: contagem })
      .from(apr)
      .innerJoin(os, eq(os.id, apr.osId))
      .where(todas(instanteEntre(apr.concluidaEm, anterior.inicio, fim), daEquipe))
      .groupBy(dia, apr.resultado),
    // Item reprovado: a resposta foi a que o modelo marca. No eliminatório ela bloqueou a APR; no alerta, só registrou.
    db
      .select({ modelo: modeloApr.codigo, texto: itemModeloApr.texto, secao: itemModeloApr.secao, tipo: itemModeloApr.tipo, total: contagem })
      .from(aprResposta)
      .innerJoin(apr, eq(apr.id, aprResposta.aprId))
      .innerJoin(os, eq(os.id, apr.osId))
      .innerJoin(itemModeloApr, eq(itemModeloApr.id, aprResposta.itemId))
      .innerJoin(modeloApr, eq(modeloApr.id, itemModeloApr.modeloAprId))
      .where(todas(noPeriodo, sql`${aprResposta.resposta} = ${itemModeloApr.respostaBloqueante}`))
      .groupBy(modeloApr.codigo, itemModeloApr.texto, itemModeloApr.secao, itemModeloApr.tipo)
      .orderBy(sql`count(*) desc`, modeloApr.codigo, itemModeloApr.texto),
    db
      .select({
        codigo: modeloApr.codigo,
        // o título da versão mais nova que foi respondida no período
        titulo: sql<string>`(array_agg(${modeloApr.titulo} order by ${modeloApr.versao} desc))[1]`,
        aprs: contagem,
        bloqueadas,
      })
      .from(apr)
      .innerJoin(os, eq(os.id, apr.osId))
      .innerJoin(modeloApr, eq(modeloApr.id, apr.modeloAprId))
      .where(noPeriodo)
      .groupBy(modeloApr.codigo)
      .orderBy(sql`count(*) desc`, modeloApr.codigo),
    db
      .select({ id: equipe.id, nome: equipe.nome, aprs: contagem, bloqueadas })
      .from(apr)
      .innerJoin(os, eq(os.id, apr.osId))
      .innerJoin(equipe, eq(equipe.id, os.equipeId))
      .where(noPeriodo)
      .groupBy(equipe.id, equipe.nome)
      .orderBy(sql`count(*) desc`, equipe.nome),
    // A ligação é a de hoje: a atividade da OS (se houver) ainda sem modelo.
    db
      .select({ total: contagem })
      .from(apr)
      .innerJoin(os, eq(os.id, apr.osId))
      .leftJoin(atividade, eq(atividade.codigo, os.codigoAtividade))
      .where(todas(noPeriodo, sql`${atividade.modeloAprCodigo} is null`)),
  ]);

  const serie = faixas.map((faixa) => ({ ...faixa, aprovadas: 0, bloqueadas: 0 }));
  const totais = { aprovadas: 0, bloqueadas: 0 };
  const doAnterior = { aprovadas: 0, bloqueadas: 0 };
  for (const { dia: d, resultado, total } of porDia) {
    const chave = resultado === "bloqueada" ? "bloqueadas" : "aprovadas";
    if (d < inicio) {
      doAnterior[chave] += total;
      continue;
    }
    const ponto = faixaDoDia(serie, d);
    if (!ponto) continue;
    ponto[chave] += total;
    totais[chave] += total;
  }

  const ranking = (tipo: "eliminatorio" | "alerta") =>
    reprovados
      .filter((r) => r.tipo === tipo)
      .slice(0, ITENS_NO_RANKING)
      .map(({ modelo, texto, secao, total }) => ({ modelo, texto, secao, total }));

  return {
    periodo: f.periodo,
    agrupamento,
    de,
    ate,
    totais: {
      aprs: totais.aprovadas + totais.bloqueadas,
      ...totais,
      /** Vezes em que um item de alerta recebeu a resposta que o modelo marca (registrado, sem bloquear). */
      alertas: reprovados.filter((r) => r.tipo === "alerta").reduce((soma, r) => soma + r.total, 0),
      semModeloLigado: semModelo?.total ?? 0,
    },
    anterior: { aprs: doAnterior.aprovadas + doAnterior.bloqueadas, bloqueadas: doAnterior.bloqueadas },
    serie,
    itensQueBloqueiam: ranking("eliminatorio"),
    alertasRegistrados: ranking("alerta"),
    porModelo,
    porEquipe,
  };
}
