import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";

export const PERFIS = ["tecnico", "supervisor", "analista", "seguranca", "admin"] as const;
export type Perfil = (typeof PERFIS)[number];

/** `equipe.supervisorId` e `usuario.equipeId` se referenciam; o Drizzle cria a segunda chave depois das duas tabelas. */
export const equipe = pgTable(
  "equipe",
  {
    id: uuid().primaryKey().defaultRandom(),
    nome: text().notNull(),
    /** Código SAP (SERV_ESP); a leitura do SAP usa para achar a equipe. */
    centroTrabalho: text().notNull().unique(),
    /** Destinatário dos alertas; sem supervisor, vão aos analistas ativos. */
    supervisorId: uuid().references((): AnyPgColumn => usuario.id),
  },
  (t) => [index("equipe_supervisor_idx").on(t.supervisorId)],
).enableRLS();

export const usuario = pgTable(
  "usuario",
  {
    /** = id do Supabase Auth: a api o informa, não há default. */
    id: uuid().primaryKey(),
    nome: text().notNull(),
    /** Identificação definitiva da pessoa na empresa (PDF e SAP); não é o login. */
    matricula: text().notNull().unique(),
    /** E-mail institucional, sempre em minúsculas: é o login (o mesmo e-mail da conta no Supabase Auth) e o destino dos alertas. */
    email: text().notNull().unique(),
    /** Aparece sob a assinatura na OS impressa, ex.: Técnico em Elétrica, Engenheiro Mecânico. */
    cargo: text(),
    /** Registro profissional impresso na OS (CREA), ex.: ES-050003/D. */
    registroProfissional: text(),
    perfil: text({ enum: PERFIS }).notNull(),
    equipeId: uuid().references(() => equipe.id),
    ativo: boolean().notNull().default(true),
    senhaProvisoria: boolean().notNull().default(true),
    /** Imagem da rubrica no bucket `assinaturas`. */
    assinaturaPath: text(),
    assinaturaEm: instante(),
  },
  (t) => [
    check("usuario_perfil_check", emLista(t.perfil, PERFIS)),
    check("usuario_email_minusculo", sql`${t.email} = lower(${t.email})`),
    check("usuario_assinatura_completa", sql`(${t.assinaturaPath} is null) = (${t.assinaturaEm} is null)`),
    index("usuario_equipe_idx").on(t.equipeId).where(sql`${t.ativo}`),
    index("usuario_perfil_idx").on(t.perfil).where(sql`${t.ativo}`),
  ],
).enableRLS();
