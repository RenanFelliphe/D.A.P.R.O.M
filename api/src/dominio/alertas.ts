import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { ALVO_DO_AVISO, CATEGORIA_DO_AVISO, TIPOS_DE_AVISO, type TipoDeAviso } from "../../../shared/notificacoes/avisos";
import type { Db } from "../db/conexao";
import { alerta, equipe, importacao, usuario, type AlertaTipo } from "../db/schema";
import { enfileirarTarefa } from "../servicos/fila";

/** Quem está ativo e liberado: só essa pessoa recebe aviso e responde por alguma coisa. */
const valida = (u: { ativo: boolean; liberacao: string } | undefined) => !!u && u.ativo && u.liberacao === "liberado";

/** Os administradores ativos e liberados. */
export async function adminsAtivos(db: Db): Promise<string[]> {
  const linhas = await db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.perfil, "admin"), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado")));
  return linhas.map((l) => l.id);
}

/**
 * Quem recebe os alertas de uma equipe: o supervisor ativo dela e, enquanto o representante está no comando (o supervisor
 * ausente ou parado), também o representante. Na equipe sem supervisor (nenhum, ou um desativado), o representante, que é
 * quem responde por ela. Sem ninguém disso, todos os administradores ativos (Impedimento, item 1).
 */
export async function destinatariosDaEquipe(db: Db, equipeId: string): Promise<{ id: string }[]> {
  const [e] = await db
    .select({ supervisorId: equipe.supervisorId, representanteId: equipe.representanteId, representacaoDesde: equipe.representacaoDesde })
    .from(equipe)
    .where(eq(equipe.id, equipeId));
  const pessoas = [e?.supervisorId, e?.representanteId].filter((id): id is string => !!id);
  const linhas = pessoas.length ? await db.select({ id: usuario.id, ativo: usuario.ativo, liberacao: usuario.liberacao }).from(usuario).where(inArray(usuario.id, pessoas)) : [];
  const supervisor = linhas.find((u) => u.id === e?.supervisorId);
  const representante = linhas.find((u) => u.id === e?.representanteId);
  const ids = valida(supervisor)
    ? [supervisor!.id, ...(e?.representacaoDesde && valida(representante) ? [representante!.id] : [])]
    : valida(representante)
      ? [representante!.id]
      : [];
  if (ids.length > 0) return ids.map((id) => ({ id }));
  return (await adminsAtivos(db)).map((id) => ({ id }));
}

/** O alvo do aviso e o resto do que ele guarda; só as colunas do alvo do tipo (`ALVO_DO_AVISO`) vão preenchidas. */
export interface DadosDoAviso {
  tipo: AlertaTipo;
  detalhe: string;
  /** O relógio da `api` (`deps.agora()`): vira o `criado_em` e quando o e-mail pode sair. Sem ele, a hora do banco. */
  agora?: Date;
  osId?: string;
  planoPreventivaId?: string;
  importacaoId?: string;
  ausenciaId?: string;
  usuarioAlvoId?: string;
  equipeId?: string;
  leituraRhId?: string;
  treinamentoId?: string;
  /** Fica só no sino, mesmo que o tipo tenha e-mail (a falha de importação que se repete). */
  semEmail?: boolean;
}

/**
 * Cria o aviso para cada destinatário (sem repetir a pessoa) e, quando o tipo tem categoria de e-mail, enfileira a tarefa
 * `email_alerta`, que decide na hora de enviar (servidor configurado, pessoa ativa, categoria ligada no perfil). Quem chama
 * passa a própria transação: o aviso e o e-mail só existem se o resto da operação for confirmado. Devolve os ids criados.
 */
export async function criarAviso(db: Db, destinatarios: Iterable<string>, dados: DadosDoAviso): Promise<string[]> {
  const ids: string[] = [];
  const comEmail = !dados.semEmail && CATEGORIA_DO_AVISO[dados.tipo] !== null;
  for (const destinatarioId of new Set(destinatarios)) {
    const [criado] = await db
      .insert(alerta)
      .values({
        tipo: dados.tipo,
        destinatarioId,
        detalhe: dados.detalhe,
        osId: dados.osId ?? null,
        planoPreventivaId: dados.planoPreventivaId ?? null,
        importacaoId: dados.importacaoId ?? null,
        ausenciaId: dados.ausenciaId ?? null,
        usuarioAlvoId: dados.usuarioAlvoId ?? null,
        equipeId: dados.equipeId ?? null,
        leituraRhId: dados.leituraRhId ?? null,
        treinamentoId: dados.treinamentoId ?? null,
        ...(dados.agora ? { criadoEm: dados.agora } : {}),
      })
      .returning({ id: alerta.id });
    ids.push(criado!.id);
    if (comEmail) await enfileirarTarefa(db, "email_alerta", criado!.id, dados.agora);
  }
  return ids;
}

/** Aviso para todos os administradores ativos. */
export async function avisarAdmins(db: Db, dados: DadosDoAviso): Promise<string[]> {
  return criarAviso(db, await adminsAtivos(db), dados);
}

/**
 * Cria um `alerta` de OS para cada destinatário da equipe (`destinatariosDaEquipe`). Os do ciclo das preventivas levam também
 * o plano (`planoPreventivaId`). Quem chama passa a própria transação. Devolve os ids criados.
 */
export async function criarAlertas(
  db: Db,
  dados: { tipo: AlertaTipo; osId: string; equipeId: string; detalhe: string; planoPreventivaId?: string; agora?: Date },
): Promise<string[]> {
  const destinatarios = (await destinatariosDaEquipe(db, dados.equipeId)).map((d) => d.id);
  return criarAviso(db, destinatarios, { tipo: dados.tipo, osId: dados.osId, detalhe: dados.detalhe, planoPreventivaId: dados.planoPreventivaId, agora: dados.agora });
}

/**
 * Quem fica sabendo de uma falha que alguém pediu ("Ler agora", a planilha, o PDF): quem pediu, se ainda está ativo; no que é
 * agendado e não tem autor, os administradores ativos.
 */
export async function quemPediuOuAdmins(db: Db, usuarioId: string | null): Promise<string[]> {
  if (usuarioId) {
    const [quem] = await db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.id, usuarioId), eq(usuario.ativo, true)));
    if (quem) return [quem.id];
  }
  return adminsAtivos(db);
}

/**
 * Alerta `falha_importacao`, ligado ao registro da importação que falhou (qualquer método). Enquanto o alerta anterior da
 * mesma origem não foi lido, ele é reaproveitado — passa a apontar para a falha mais recente e sobe para o topo — em vez de
 * empilhar um por tentativa (a leitura agendada se repete a cada poucos minutos com a API fora do ar). Vai por e-mail só a
 * falha da leitura do SAP e só quando o alerta é novo: a planilha e o PDF mostram o erro na hora para quem enviou. Quem chama
 * passa a própria transação.
 */
export async function alertarFalhaDeImportacao(
  db: Db,
  dados: { importacaoId: string; origem: "api" | "planilha" | "pdf"; usuarioId: string | null; detalhe: string; agora: Date },
): Promise<void> {
  for (const destinatarioId of await quemPediuOuAdmins(db, dados.usuarioId)) {
    const [aberto] = await db
      .select({ id: alerta.id })
      .from(alerta)
      .innerJoin(importacao, eq(importacao.id, alerta.importacaoId))
      .where(and(eq(alerta.tipo, "falha_importacao"), eq(alerta.destinatarioId, destinatarioId), isNull(alerta.lidoEm), eq(importacao.origem, dados.origem)))
      .limit(1);
    const valores = { importacaoId: dados.importacaoId, detalhe: dados.detalhe, criadoEm: dados.agora };
    if (aberto) await db.update(alerta).set(valores).where(eq(alerta.id, aberto.id));
    else await criarAviso(db, [destinatarioId], { tipo: "falha_importacao", importacaoId: dados.importacaoId, detalhe: dados.detalhe, agora: dados.agora, semEmail: dados.origem !== "api" });
  }
}

/** Texto do alerta de falha: o método, o motivo e a garantia de que nenhuma OS mudou. */
export function detalheDaFalha(o: { origem: "api" | "planilha" | "pdf"; arquivo?: string; motivo: string }): string {
  const arquivo = o.arquivo ? `"${o.arquivo}" ` : "";
  const metodo =
    o.origem === "api"
      ? "A sincronização com a API do SAP falhou"
      : o.origem === "pdf"
        ? `A importação do PDF da OS ${arquivo}falhou`
        : `A importação da planilha ${arquivo}falhou`;
  return `${metodo}: ${o.motivo.replace(/\.$/, "")}. Nenhuma OS foi criada, alterada ou removida.`;
}

/**
 * O que o aviso pedia já foi feito (o cadastro foi liberado, a conta reativada, a equipe ganhou supervisor): os avisos ainda
 * não lidos daquele alvo saem do "não lido" de todos que os receberam. O aviso fica no histórico.
 */
export async function resolverAvisos(db: Db, filtro: { tipos: TipoDeAviso[]; usuarioAlvoId?: string; equipeId?: string }, agora: Date): Promise<void> {
  await db
    .update(alerta)
    .set({ lidoEm: agora })
    .where(
      and(
        inArray(alerta.tipo, filtro.tipos),
        isNull(alerta.lidoEm),
        filtro.usuarioAlvoId ? eq(alerta.usuarioAlvoId, filtro.usuarioAlvoId) : undefined,
        filtro.equipeId ? eq(alerta.equipeId, filtro.equipeId) : undefined,
      ),
    );
}

/** Os avisos que só falam da conta de alguém (cadastro, acesso, desligamento): não são histórico de campo. */
const AVISOS_DE_CONTA = TIPOS_DE_AVISO.filter((t) => ALVO_DO_AVISO[t] === "usuario");

/**
 * Antes de remover uma conta (o cadastro pendente cancelado, o recusado que libera o e-mail): os avisos de conta que falam
 * dela ou que ela recebeu somem junto. Os demais avisos (ausência, OS) continuam amarrando a conta ao histórico.
 */
export async function apagarAvisosDaConta(db: Db, usuarioId: string): Promise<void> {
  await db.delete(alerta).where(and(inArray(alerta.tipo, AVISOS_DE_CONTA), or(eq(alerta.usuarioAlvoId, usuarioId), eq(alerta.destinatarioId, usuarioId))));
}
