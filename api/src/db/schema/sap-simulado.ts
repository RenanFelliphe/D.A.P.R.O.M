import { date, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { instante } from "./comum";

/**
 * As ordens de manutenção do SAP simulado: o que o SAP teria, com dados fictícios, que o SYNQ OS lê pelo contrato (`GET /sap-simulado/ordens`).
 * Fica no banco do SYNQ OS (e não na memória) para sobreviver a um reinício, mas não tem chave para nenhuma tabela do SYNQ OS: o vínculo
 * com `os` é só o número da ordem, como seria com o SAP de verdade. Uma coluna para cada campo do contrato (`OrdemSap`), com o local de
 * instalação em quatro colunas. Vazia quando `SAP_SIMULADO=false`. Ver `apiSAP.md`.
 */
export const ordemSapSimulada = pgTable(
  "ordem_sap_simulada",
  {
    /** Única e fixa depois de criada. */
    numeroOrdem: text().primaryKey(),
    numeroNota: text(),
    /** `YBA1` (corretiva) ou `YBA2` (preventiva). */
    tipoOrdem: text().notNull(),
    tipoAtividade: text(),
    codigoAtividade: text(),
    titulo: text().notNull(),
    descricao: text(),
    centroTrabalho: text().notNull(),
    localCodigo: text().notNull(),
    localEndereco: text(),
    localPlusCode: text(),
    localCliente: text(),
    equipamento: text(),
    prioridade: text(),
    dataInicioProg: date({ mode: "string" }).notNull(),
    dataFimProg: date({ mode: "string" }),
    /** Lista de códigos do sistema (`LIB IMPR CAPC`); a `api` do SYNQ OS procura o `LIB`. */
    statusSap: text(),
    solicitante: text(),
    criadoPor: text(),
    criadaEm: instante(),
    planoManutencao: text(),
    itemManutencao: text(),
    /** Texto ("3 MES", "trimestral") ou `{quantidade, unidade}`: por isso `jsonb`. */
    intervaloCiclo: jsonb(),
    /** O que `alteradas_desde` filtra: a última vez que a ordem mudou no simulador. */
    alteradaEm: instante().notNull().defaultNow(),
  },
  (t) => [index("ordem_sap_simulada_alterada_idx").on(t.alteradaEm)],
).enableRLS();
