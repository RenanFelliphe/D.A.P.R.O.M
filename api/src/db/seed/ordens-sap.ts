import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { Db } from "../conexao";
import { equipe, localInstalacao, ordemSapSimulada, os } from "../schema";
import type { OrdemSap } from "../../servicos/sap";
import fixtures from "../../../fixtures/sap/ordens.json" with { type: "json" };

/** A ordem do contrato como linha da tabela do simulador. */
function paraLinha(o: OrdemSap, agora: Date): typeof ordemSapSimulada.$inferInsert {
  const criada = o.criada_em ? new Date(o.criada_em) : null;
  return {
    numeroOrdem: o.numero_ordem,
    numeroNota: o.numero_nota ?? null,
    tipoOrdem: o.tipo_ordem,
    tipoAtividade: o.tipo_atividade ?? null,
    codigoAtividade: o.codigo_atividade ?? null,
    titulo: o.titulo,
    descricao: o.descricao ?? null,
    centroTrabalho: o.centro_trabalho,
    localCodigo: o.local_instalacao.codigo,
    localEndereco: o.local_instalacao.endereco ?? null,
    localPlusCode: o.local_instalacao.plus_code ?? null,
    localCliente: o.local_instalacao.cliente ?? null,
    equipamento: o.equipamento ?? null,
    prioridade: o.prioridade ?? null,
    dataInicioProg: o.data_inicio_prog,
    dataFimProg: o.data_fim_prog ?? null,
    statusSap: o.status_sap ?? null,
    solicitante: o.solicitante ?? null,
    criadoPor: o.criado_por ?? null,
    criadaEm: criada,
    planoManutencao: o.plano_manutencao ?? null,
    itemManutencao: o.item_manutencao ?? null,
    intervaloCiclo: o.intervalo_ciclo ?? null,
    // Como o simulador em memória fazia: a ordem de exemplo "mudou" quando foi criada.
    alteradaEm: criada ?? agora,
  };
}

/**
 * Carga inicial do SAP simulado: com a tabela vazia, grava as ordens de `fixtures/sap/ordens.json` (dados fictícios). Com ordens já lá
 * (as que a tela criou), não faz nada. Devolve quantas gravou.
 */
export async function carregarOrdensDeExemplo(db: Db, agora: Date = new Date()): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(ordemSapSimulada);
  if ((r?.n ?? 0) > 0) return 0;
  const linhas = (fixtures as OrdemSap[]).map((o) => paraLinha(o, agora));
  await db.insert(ordemSapSimulada).values(linhas).onConflictDoNothing();
  return linhas.length;
}

/**
 * Para a demonstração: grava no simulador as ordens das OS que a carga criou direto no banco com origem `sap`, com um status coerente
 * (com `LIB` nas ativas; sem ele nas encerradas e nas canceladas), para que o SAP e o DAPROM concordem desde o início. As OS de apoio ficam
 * de fora: não existem no SAP. Não mexe nas ordens que já estão lá. Devolve quantas gravou.
 */
export async function espelharOsDoSapNoSimulador(db: Db): Promise<number> {
  const linhas = await db
    .select({
      numero: os.numeroOrdem,
      nota: os.numeroNota,
      tipo: os.tipo,
      tipoAtividade: os.tipoAtividade,
      atividade: os.codigoAtividade,
      titulo: os.titulo,
      descricao: os.descricao,
      centro: equipe.centroTrabalho,
      localCodigo: localInstalacao.codigo,
      localEndereco: localInstalacao.endereco,
      localPlusCode: localInstalacao.plusCode,
      localCliente: localInstalacao.cliente,
      equipamento: os.equipamento,
      prioridade: os.prioridade,
      inicio: os.dataInicioProg,
      fim: os.dataFimProg,
      status: os.status,
      solicitante: os.solicitante,
      criadoPor: os.criadoPorSap,
      plano: os.planoManutencao,
      item: os.itemManutencao,
      atualizadaEm: os.atualizadaEm,
    })
    .from(os)
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(and(eq(os.origem, "sap"), isNotNull(os.numeroOrdem)));
  const novas = linhas.map((l) => ({
    numeroOrdem: l.numero!,
    numeroNota: l.nota,
    tipoOrdem: l.tipo === "preventiva" ? "YBA2" : "YBA1",
    tipoAtividade: l.tipoAtividade,
    codigoAtividade: l.atividade,
    titulo: l.titulo,
    descricao: l.descricao,
    centroTrabalho: l.centro,
    localCodigo: l.localCodigo,
    localEndereco: l.localEndereco,
    localPlusCode: l.localPlusCode,
    localCliente: l.localCliente,
    equipamento: l.equipamento,
    prioridade: l.prioridade,
    dataInicioProg: l.inicio,
    dataFimProg: l.fim,
    statusSap: l.status === "encerrada" ? "ENCE" : l.status === "cancelada" ? "CRTD" : "LIB IMPR",
    solicitante: l.solicitante,
    criadoPor: l.criadoPor,
    criadaEm: l.atualizadaEm,
    planoManutencao: l.plano,
    itemManutencao: l.item,
    alteradaEm: l.atualizadaEm,
  }));
  if (novas.length === 0) return 0;
  const gravadas = await db.insert(ordemSapSimulada).values(novas).onConflictDoNothing().returning({ n: ordemSapSimulada.numeroOrdem });
  return gravadas.length;
}
