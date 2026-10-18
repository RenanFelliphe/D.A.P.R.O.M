import { sql, type SQL } from "drizzle-orm";
import { check, date, index, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { ALVO_DO_AVISO, ALVOS_DE_AVISO, AVISOS_DE_AUSENCIA, AVISOS_DE_REPRESENTACAO, TIPOS_DE_AVISO, type AlvoDeAviso, type TipoDeAviso } from "../../../../shared/notificacoes/avisos";
import { emLista, instante } from "./comum";
import { planoPreventiva } from "./preventivas";
import { leituraRh } from "./rh";
import { importacao, os } from "./sap";
import { treinamentoServico } from "./treinamento-servico";
import { equipe, usuario } from "./usuarios";
import { ausencia } from "./ausencia";

/** Os tipos de aviso (o sino) ficam em `shared/notificacoes/avisos.ts`, com o alvo e a categoria de e-mail de cada um. */
export const ALERTA_TIPOS = TIPOS_DE_AVISO;
export type AlertaTipo = TipoDeAviso;
export { AVISOS_DE_AUSENCIA as ALERTA_TIPOS_DE_AUSENCIA, AVISOS_DE_REPRESENTACAO as ALERTA_TIPOS_DE_REPRESENTACAO };

/** As colunas que cada alvo exige; as demais colunas de alvo ficam nulas (`CHECK` `alerta_alvo`). */
const COLUNAS_DO_ALVO: Record<AlvoDeAviso, readonly string[]> = {
  os: ["osId"],
  importacao: ["importacaoId"],
  ausencia: ["ausenciaId", "usuarioAlvoId"],
  equipe: ["equipeId"],
  usuario: ["usuarioAlvoId"],
  leitura_rh: ["leituraRhId"],
  treinamento: ["treinamentoId"],
  nenhum: [],
};

/** Cada tipo de aviso aponta exatamente para o seu alvo: `(tipo in (...) and <colunas do alvo> is not null and <as outras> is null) or ...`. */
function alvoCoerente(colunas: Record<string, AnyPgColumn>, tipo: AnyPgColumn): SQL {
  const grupos = ALVOS_DE_AVISO.flatMap((alvo) => {
    const tipos = TIPOS_DE_AVISO.filter((t) => ALVO_DO_AVISO[t] === alvo);
    if (tipos.length === 0) return [];
    const exigidas = COLUNAS_DO_ALVO[alvo];
    const partes = Object.entries(colunas).map(([nome, coluna]) => (exigidas.includes(nome) ? sql`${coluna} is not null` : sql`${coluna} is null`));
    return [sql`(${emLista(tipo, tipos)} and ${sql.join(partes, sql.raw(" and "))})`];
  });
  return sql.join(grupos, sql.raw(" or "));
}

/**
 * Aviso no sino. Cada tipo aponta para um alvo (`ALVO_DO_AVISO`): a OS (impedimento, conflito, execução duplicada, apoio
 * encerrado, reserva, ciência, ciclo das preventivas, com o plano), a importação que falhou, a ausência e a pessoa dela, a
 * equipe (representação, equipe sem supervisor), a conta de uma pessoa (cadastro, acesso, desligamento, readmissão), a leitura
 * do registro de funcionários que falhou, o treinamento de serviço ou nada (a Vitória sem IA). Quando o tipo tem categoria de
 * e-mail, o aviso também sai por e-mail (`email_enviado_em`).
 */
export const alerta = pgTable(
  "alerta",
  {
    id: uuid().primaryKey().defaultRandom(),
    tipo: text({ enum: ALERTA_TIPOS }).notNull(),
    /** Nos avisos de OS. */
    osId: uuid().references(() => os.id),
    /** Só na falha de importação. */
    importacaoId: uuid().references(() => importacao.id),
    /** Só nos alertas do ciclo das preventivas (`preventiva_proxima`, `preventiva_vencida`). */
    planoPreventivaId: uuid().references(() => planoPreventiva.id),
    /** Só nos alertas da ausência de um usuário (`ausencia_*`). */
    ausenciaId: uuid().references(() => ausencia.id),
    /** A pessoa da ausência, nos alertas da ausência; a conta de quem se fala, nos avisos de conta (`conta_criada`, `membro_desativado` etc.). */
    usuarioAlvoId: uuid().references(() => usuario.id),
    /** Nos avisos da equipe (`representacao_*`, `equipe_sem_supervisor`). */
    equipeId: uuid().references(() => equipe.id),
    /** Só na falha da leitura do registro de funcionários (`rh_leitura_falhou`). */
    leituraRhId: uuid().references(() => leituraRh.id),
    /** Só nos avisos do treinamento de serviço (`treinamento_*`). */
    treinamentoId: uuid().references(() => treinamentoServico.id),
    /** Quem recebe: ver `dominio/alertas.ts` (o supervisor da equipe, o representante no comando, os administradores, a própria pessoa). */
    destinatarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    detalhe: text().notNull(),
    emailEnviadoEm: instante(),
    lidoEm: instante(),
    criadoEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("alerta_tipo_check", emLista(t.tipo, ALERTA_TIPOS)),
    check(
      "alerta_alvo",
      alvoCoerente(
        { osId: t.osId, importacaoId: t.importacaoId, ausenciaId: t.ausenciaId, usuarioAlvoId: t.usuarioAlvoId, equipeId: t.equipeId, leituraRhId: t.leituraRhId, treinamentoId: t.treinamentoId },
        t.tipo,
      ),
    ),
    check(
      "alerta_plano_so_na_preventiva",
      sql`(${t.tipo} in ('preventiva_proxima', 'preventiva_vencida')) = (${t.planoPreventivaId} is not null)`,
    ),
    index("alerta_destinatario_idx").on(t.destinatarioId, t.criadoEm.desc()),
    index("alerta_nao_lidos_idx").on(t.destinatarioId).where(sql`${t.lidoEm} is null`),
    index("alerta_os_idx").on(t.osId),
    index("alerta_ausencia_idx").on(t.ausenciaId).where(sql`${t.ausenciaId} is not null`),
    index("alerta_plano_idx").on(t.planoPreventivaId).where(sql`${t.planoPreventivaId} is not null`),
    index("alerta_usuario_alvo_idx").on(t.usuarioAlvoId).where(sql`${t.usuarioAlvoId} is not null`),
  ],
).enableRLS();

/** Histórico das justificativas que o indicador de atraso e a auditoria leem. */
export const reprogramacao = pgTable(
  "reprogramacao",
  {
    id: uuid().primaryKey().defaultRandom(),
    osId: uuid()
      .notNull()
      .references(() => os.id),
    usuarioId: uuid()
      .notNull()
      .references(() => usuario.id),
    dataAnterior: date({ mode: "string" }).notNull(),
    dataNova: date({ mode: "string" }).notNull(),
    equipeAnteriorId: uuid().references(() => equipe.id),
    equipeNovaId: uuid().references(() => equipe.id),
    justificativa: text().notNull(),
    /** A assinatura do perfil de quem reprogramou (cópia). Nula nas reprogramações anteriores à assinatura. */
    assinaturaPath: text(),
    criadaEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("reprogramacao_justificativa_check", sql`nullif(btrim(${t.justificativa}), '') is not null`),
    index("reprogramacao_os_idx").on(t.osId, t.criadaEm.desc()),
  ],
).enableRLS();
