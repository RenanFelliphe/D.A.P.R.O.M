import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";

export const TAREFA_TIPOS = ["pdf_os", "email_alerta", "email_resumo", "leitura_sap", "leitura_rh", "conferencia_rh", "digitalizacao", "pedido_prazo"] as const;
export const TAREFA_ESTADOS = ["pendente", "em_andamento", "concluida", "falhou"] as const;

/** Tarefas em segundo plano: geração de PDF, e-mail dos avisos e o resumo diário, leitura do SAP, as conferências com o registro de funcionários e a leitura das folhas digitalizadas. */
export const tarefa = pgTable(
  "tarefa",
  {
    id: uuid().primaryKey().defaultRandom(),
    tipo: text({ enum: TAREFA_TIPOS }).notNull(),
    /** execucao_pedido.id (pedido_prazo), os.id, alerta.id, importacao.id, leitura_rh.id, usuario.id (conferencia_rh e email_resumo) ou nulo (leitura agendada do SAP). */
    referenciaId: uuid(),
    estado: text({ enum: TAREFA_ESTADOS }).notNull().default("pendente"),
    tentativas: integer().notNull().default(0),
    proximaEm: instante().notNull().defaultNow(),
    /** Última mensagem de erro. */
    erro: text(),
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("tarefa_tipo_check", emLista(t.tipo, TAREFA_TIPOS)),
    check("tarefa_estado_check", emLista(t.estado, TAREFA_ESTADOS)),
    check("tarefa_tentativas_check", sql`${t.tentativas} >= 0`),
    // O executor lê as tarefas pendentes na ordem em que vencem.
    index("tarefa_pendentes_idx").on(t.proximaEm).where(sql`${t.estado} = 'pendente'`),
    index("tarefa_referencia_idx").on(t.tipo, t.referenciaId),
  ],
).enableRLS();

/** O que a trilha de auditoria registra: cada entidade que o admin (ou o supervisor) cria, altera ou remove. */
export const AUDITORIA_ENTIDADES = ["usuario", "equipe", "modelo_apr", "atividade", "material", "os", "importacao", "exportacao", "plano_preventiva", "patente", "conquista", "regra_pontuacao", "rh", "ausencia", "treinamento", "sugestao_materiais", "ia_funcao"] as const;
export type AuditoriaEntidade = (typeof AUDITORIA_ENTIDADES)[number];

/**
 * Trilha de auditoria: quem fez o quê e quando nas telas de gestão. Só cresce (um gatilho recusa alterar ou apagar uma
 * linha). Não tem chave estrangeira: o registro guarda o nome de quem agiu e o rótulo do alvo na hora, para continuar
 * legível mesmo se a conta ou o cadastro forem removidos depois. Os eventos de campo ficam em `evento_campo`.
 */
export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid().primaryKey().defaultRandom(),
    em: instante().notNull().defaultNow(),
    /** `usuario.id` de quem agiu, sem chave estrangeira (a conta pode ser removida depois); nulo quando quem agiu foi um sistema (o registro de funcionários). */
    atorId: uuid(),
    atorNome: text().notNull(),
    /** `entidade.verbo`, ex.: `usuario.criar`, `modelo_apr.publicar`. */
    acao: text().notNull(),
    entidade: text({ enum: AUDITORIA_ENTIDADES }).notNull(),
    /** Id (ou código) da entidade afetada; nulo quando a ação não tem um alvo só (ex.: a leitura do SAP). */
    entidadeId: text(),
    /** Como o alvo se chamava na hora (nome do usuário, código do modelo, número da OS…). */
    alvo: text(),
    /** A frase que a tela mostra, ex.: "Desativou o usuário Maria Souza". */
    resumo: text().notNull(),
    /** O que mudou (`{campo: {de, para}}`) ou dados extras da ação. */
    detalhes: jsonb(),
  },
  (t) => [
    check("auditoria_entidade_check", emLista(t.entidade, AUDITORIA_ENTIDADES)),
    index("auditoria_em_idx").on(t.em.desc()),
    index("auditoria_entidade_idx").on(t.entidade, t.entidadeId),
    index("auditoria_ator_idx").on(t.atorId),
  ],
).enableRLS();
