import { sql } from "drizzle-orm";
import { boolean, check, index, pgTable, text, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { emLista, instante } from "./comum";

/** Supervisor não é perfil: é quem consta em `equipe.supervisor_id` (todo supervisor é `tecnico`). */
export const PERFIS = ["tecnico", "admin"] as const;
export type Perfil = (typeof PERFIS)[number];

/** Estado do Campo de treino de cada usuário (o treino em si roda na web, com dados fictícios; aqui só se guarda o estado). */
export const ESTADOS_TREINAMENTO = ["nao_iniciado", "concluido", "pulado"] as const;
export type EstadoTreinamento = (typeof ESTADOS_TREINAMENTO)[number];

/**
 * Liberação do acesso: quem o admin cadastra nasce `liberado`; quem o supervisor cadastra nasce `pendente` (só entra,
 * troca a senha e faz o Campo de treino) até um admin liberar ou recusar (`recusado`: não entra mais).
 */
export const LIBERACOES = ["liberado", "pendente", "recusado"] as const;
export type Liberacao = (typeof LIBERACOES)[number];

/** Situação da pessoa no registro de funcionários; `fora_do_registro` é a matrícula que sumiu de lá. */
export const SITUACOES_REGISTRO = ["ativo", "afastado", "desligado", "fora_do_registro"] as const;
export type SituacaoRegistro = (typeof SITUACOES_REGISTRO)[number];

/**
 * Por que o representante está no comando da equipe: o supervisor está ausente (ausência registrada, em curso ou vencida) ou
 * ficou `DIAS_SEM_ATIVIDADE` dias sem fazer nada no sistema (ver `dominio/representacao.ts`).
 */
export const MOTIVOS_DA_REPRESENTACAO = ["ausencia", "inatividade"] as const;
export type MotivoDaRepresentacao = (typeof MOTIVOS_DA_REPRESENTACAO)[number];

/** `equipe.supervisorId` e `usuario.equipeId` se referenciam; o Drizzle cria a segunda chave depois das duas tabelas. */
export const equipe = pgTable(
  "equipe",
  {
    id: uuid().primaryKey().defaultRandom(),
    nome: text().notNull(),
    /** Código SAP (SERV_ESP); a leitura do SAP usa para achar a equipe. */
    centroTrabalho: text().notNull().unique(),
    /** Destinatário dos alertas; sem supervisor, vão aos administradores ativos. */
    supervisorId: uuid().references((): AnyPgColumn => usuario.id),
    /**
     * Quem substitui o supervisor quando ele se ausenta: um membro ativo e liberado da própria equipe, que não é o supervisor.
     * Toda equipe com gente tem um (a `api` escolhe quando falta); fica nulo só na equipe sem membro elegível.
     */
    representanteId: uuid().references((): AnyPgColumn => usuario.id),
    /** Desde quando o representante está no comando; nulo enquanto o supervisor responde pela equipe. Gravado pela `api` para avisar uma vez só. */
    representacaoDesde: instante(),
    representacaoMotivo: text({ enum: MOTIVOS_DA_REPRESENTACAO }),
  },
  (t) => [
    check("equipe_representacao_completa", sql`(${t.representacaoDesde} is null) = (${t.representacaoMotivo} is null)`),
    check("equipe_representacao_motivo_check", emLista(t.representacaoMotivo, MOTIVOS_DA_REPRESENTACAO)),
    check("equipe_representante_diferente", sql`${t.representanteId} is null or ${t.supervisorId} is null or ${t.representanteId} <> ${t.supervisorId}`),
    index("equipe_supervisor_idx").on(t.supervisorId),
    index("equipe_representante_idx").on(t.representanteId),
  ],
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
    treinamentoEstado: text({ enum: ESTADOS_TREINAMENTO }).notNull().default("nao_iniciado"),
    /** Quando concluiu ou pulou o treino; nulo enquanto `nao_iniciado`. */
    treinamentoEm: instante(),
    liberacao: text({ enum: LIBERACOES }).notNull().default("liberado"),
    /** Quem cadastrou a conta (admin ou supervisor); nulo nas contas anteriores ao cadastro pelo supervisor. */
    criadoPorId: uuid().references((): AnyPgColumn => usuario.id),
    /** Quando a conta foi cadastrada pela API; nulo nas contas anteriores a este campo. */
    criadoEm: instante(),
    /** Admin que liberou o acesso; nulo enquanto `pendente` e nas contas criadas já liberadas. */
    liberadoPorId: uuid().references((): AnyPgColumn => usuario.id),
    liberadoEm: instante(),
    /** A assinatura do perfil do admin que liberou ou recusou o acesso (cópia). Nula nas decisões anteriores à assinatura e nas contas criadas já liberadas. */
    liberacaoAssinaturaPath: text(),
    /** Por que o admin recusou; só em `recusado`. */
    recusaMotivo: text(),
    /** Quem não quer aparecer pelo nome no ranking da gamificação: os outros veem "Participante anônimo"; os pontos continuam valendo. */
    rankingAnonimo: boolean().notNull().default(false),
    /**
     * A última patente de que a pessoa já foi avisada ("Nova patente") e a temporada em que foi avisada; o aviso volta quando a
     * patente de agora é maior. Sem chave estrangeira de propósito: excluir uma patente não pode travar nem depender disto.
     */
    patenteAvisadaId: uuid(),
    patenteAvisadaTemporada: text(),
    /** O que o registro de funcionários diz desta pessoa na última conferência; nulo até a primeira. */
    situacaoRegistro: text({ enum: SITUACOES_REGISTRO }),
    registroConferidoEm: instante(),
    /**
     * A última vez que a pessoa usou o sistema (qualquer chamada autenticada, anotada no máximo a cada poucos minutos). Quando o
     * supervisor passa `DIAS_SEM_ATIVIDADE` dias sem nenhuma, o representante da equipe assume.
     */
    ultimaAtividadeEm: instante().notNull().defaultNow(),
  },
  (t) => [
    check("usuario_perfil_check", emLista(t.perfil, PERFIS)),
    check("usuario_email_minusculo", sql`${t.email} = lower(${t.email})`),
    check("usuario_treinamento_estado_check", emLista(t.treinamentoEstado, ESTADOS_TREINAMENTO)),
    check("usuario_assinatura_completa", sql`(${t.assinaturaPath} is null) = (${t.assinaturaEm} is null)`),
    check("usuario_liberacao_check", emLista(t.liberacao, LIBERACOES)),
    check("usuario_situacao_registro_check", emLista(t.situacaoRegistro, SITUACOES_REGISTRO)),
    index("usuario_liberacao_pendente_idx").on(t.liberacao).where(sql`${t.liberacao} = 'pendente'`),
    index("usuario_equipe_idx").on(t.equipeId).where(sql`${t.ativo}`),
    index("usuario_perfil_idx").on(t.perfil).where(sql`${t.ativo}`),
  ],
).enableRLS();
