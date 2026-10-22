import { and, desc, eq, gte, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { LIMITE_DO_MOTIVO_DO_CONVITE, PRAZO_DO_CONVITE_MIN, type SituacaoDoConvite } from "../../../shared/api/apr-convite";
import type { Db } from "../db/conexao";
import { alerta, aprConvite, localInstalacao, os, usuario } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { criarAviso } from "./alertas";
import { ausentesEm } from "./ausencia";
import { diaDe, inicioDoDia } from "./tempo";

/** As OS em que ainda se faz APR: depois de a execução começar, ou fora do quadro, não há mais o que convidar. */
const STATUS_SEM_APR = ["em_execucao", "encerrando", "aguardando_supervisor", "encerrada", "cancelada", "devolvida"] as const;

type LinhaDoConvite = typeof aprConvite.$inferSelect;

/** Como o convite se apresenta agora: o pendente vencido é "sem resposta"; o cancelado e o usado já não aparecem (`null`). */
export function situacaoDoConvite(c: Pick<LinhaDoConvite, "estado" | "expiraEm">, agora: Date): SituacaoDoConvite | null {
  switch (c.estado) {
    case "pendente":
      return c.expiraEm.getTime() > agora.getTime() ? "aguardando" : "sem_resposta";
    case "aceito":
      return "aceito";
    case "recusado":
      return "recusado";
    default:
      return null;
  }
}

const rotuloDaOs = (o: { numeroOrdem: string | null; titulo: string }) => `OS ${o.numeroOrdem ?? o.titulo}`;
const expiraEmDe = (agora: Date) => new Date(agora.getTime() + PRAZO_DO_CONVITE_MIN * 60_000);
/** O convite vale no dia, como a APR (a APR de outro dia não vale mais). */
const desdeHoje = (agora: Date) => inicioDoDia(diaDe(agora));

/** O convite como o responsável o vê (o formato de `ConviteFeito`, em `shared/api/apr-convite.ts`, depois do snake_case da resposta). */
function conviteFeito(c: LinhaDoConvite, convidado: { id: string; nome: string; matricula: string }, agora: Date) {
  return {
    id: c.id,
    osId: c.osId,
    convidado,
    situacao: situacaoDoConvite(c, agora) ?? ("sem_resposta" as SituacaoDoConvite),
    motivo: c.recusaMotivo,
    criadoEm: c.criadoEm,
    expiraEm: c.expiraEm,
    respondidoEm: c.respondidoEm,
  };
}
type ConviteFeito = ReturnType<typeof conviteFeito>;

/**
 * Os convites que o responsável fez nesta OS hoje, o último de cada pessoa: aguardando, aceito, recusado ou sem resposta. O desfeito
 * e o usado em APR já registrada não aparecem (não há mais o que decidir sobre eles).
 */
export async function convitesDoResponsavel(db: Db, osId: string, responsavelId: string, agora: Date): Promise<ConviteFeito[]> {
  const linhas = await db
    .select({ convite: aprConvite, convidado: { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula } })
    .from(aprConvite)
    .innerJoin(usuario, eq(usuario.id, aprConvite.usuarioId))
    .where(and(eq(aprConvite.osId, osId), eq(aprConvite.convidadoPorId, responsavelId), gte(aprConvite.criadoEm, desdeHoje(agora))))
    .orderBy(desc(aprConvite.criadoEm), desc(aprConvite.id));
  const vistos = new Set<string>();
  const resultado: ConviteFeito[] = [];
  for (const l of linhas) {
    if (vistos.has(l.convidado.id)) continue;
    vistos.add(l.convidado.id);
    if (situacaoDoConvite(l.convite, agora) !== null) resultado.push(conviteFeito(l.convite, l.convidado, agora));
  }
  return resultado.sort((a, b) => a.convidado.nome.localeCompare(b.convidado.nome));
}

/** O que impede um participante de entrar na APR do responsável, pelo convite que ele fez: `null` quando nada impede. */
export type ProblemaDeConvite = { codigo: "convite_pendente" | "convite_recusado" | "convite_sem_resposta"; nome: string };

/**
 * Confere os convites do responsável contra os participantes da APR: quem foi convidado e ainda não aceitou (esperando, recusou ou
 * deixou o prazo passar) não pode estar na lista. Quem não foi convidado não é cobrado (o presencial segue valendo), e quem saiu da
 * lista não importa.
 */
export async function problemasDeConvite(db: Db, osId: string, responsavelId: string, participantes: string[], agora: Date): Promise<ProblemaDeConvite[]> {
  const convites = (await convitesDoResponsavel(db, osId, responsavelId, agora)).filter((c) => participantes.includes(c.convidado.id));
  const problemas: ProblemaDeConvite[] = [];
  for (const c of convites) {
    if (c.situacao === "aguardando") problemas.push({ codigo: "convite_pendente", nome: c.convidado.nome });
    else if (c.situacao === "recusado") problemas.push({ codigo: "convite_recusado", nome: c.convidado.nome });
    else if (c.situacao === "sem_resposta") problemas.push({ codigo: "convite_sem_resposta", nome: c.convidado.nome });
  }
  return problemas;
}

export const MENSAGEM_DO_PROBLEMA_DE_CONVITE: Record<ProblemaDeConvite["codigo"], (nome: string) => string> = {
  convite_pendente: (nome) => `${nome} ainda não respondeu ao convite para a APR`,
  convite_recusado: (nome) => `${nome} recusou o convite para a APR: troque a pessoa`,
  convite_sem_resposta: (nome) => `${nome} não respondeu ao convite no prazo: convide de novo ou troque a pessoa`,
};

/** O aviso do convite sai do "não lido" quando a pessoa responde ou o convite é desfeito. */
async function resolverAvisoDoConvite(db: Db, usuarioId: string, osId: string, agora: Date) {
  await db
    .update(alerta)
    .set({ lidoEm: agora })
    .where(and(eq(alerta.tipo, "apr_convite"), eq(alerta.destinatarioId, usuarioId), eq(alerta.osId, osId), isNull(alerta.lidoEm)));
}

/**
 * Convida as pessoas para a APR da OS (`POST /os/{id}/apr-convites`). Só o técnico da equipe da OS convida, e só enquanto a OS aceita
 * APR (e, reservada, o responsável é quem a recebeu). Cada convidado: da equipe da OS ou de quem convida, ativo, liberado, presente e
 * com assinatura (a APR recusaria o resto). Repetir é seguro: o convite que ainda vale não se duplica, o vencido é renovado, o recusado
 * dá lugar a um novo, e o convite em aberto de outro responsável é `409`. Quem chama passa a própria transação.
 */
export async function convidarParaApr(db: Db, eu: UsuarioAutenticado, osId: string, convidados: string[], agora: Date): Promise<ConviteFeito[]> {
  const [ordem] = await db.select().from(os).where(eq(os.id, osId));
  if (!ordem || eu.equipeId === null || ordem.equipeId !== eu.equipeId) throw naoEncontrado("OS não encontrada");
  if ((STATUS_SEM_APR as readonly string[]).includes(ordem.status)) throw conflito("os_sem_apr", "Esta OS não recebe mais APR: a execução já começou, ou ela foi encerrada, cancelada ou devolvida");
  if (ordem.responsavelId && ordem.responsavelId !== eu.id) throw conflito("os_reservada", "Esta OS está reservada a outra pessoa: só ela inicia a APR");

  const ids = [...new Set(convidados)];
  if (ids.includes(eu.id)) throw invalido("convidado_invalido", "Você já participa da APR: convide os outros");
  const pessoas = await db.select().from(usuario).where(inArray(usuario.id, ids));
  if (pessoas.length !== ids.length) throw invalido("convidado_invalido", "Convidado não encontrado");
  const equipesAceitas = new Set([ordem.equipeId, eu.equipeId]);
  const ausentes = await ausentesEm(db, ids, diaDe(agora));
  for (const p of pessoas) {
    if (ausentes.has(p.id)) throw invalido("convidado_ausente", `${p.nome} está ausente e não pode entrar na APR`);
    if (!p.ativo || p.liberacao !== "liberado") throw invalido("convidado_inativo", `${p.nome} está desligado ou sem acesso e não pode entrar na APR`);
    if (!p.equipeId || !equipesAceitas.has(p.equipeId)) throw invalido("convidado_fora_da_equipe", `${p.nome} não é da equipe da OS`);
    if (!p.assinaturaPath) throw invalido("convidado_sem_assinatura", `${p.nome} ainda não cadastrou a assinatura no perfil`);
  }

  // O convite de outro dia, e o vencido de outro responsável, já não valem: saem do caminho do índice de "um em aberto por pessoa".
  await db
    .update(aprConvite)
    .set({ estado: "cancelado" })
    .where(
      and(
        eq(aprConvite.osId, osId),
        inArray(aprConvite.usuarioId, ids),
        inArray(aprConvite.estado, ["pendente", "aceito"]),
        sql`(${aprConvite.criadoEm} < ${desdeHoje(agora)} or (${aprConvite.estado} = 'pendente' and ${aprConvite.expiraEm} <= ${agora} and ${aprConvite.convidadoPorId} <> ${eu.id}))`,
      ),
    );
  const emAberto = await db
    .select()
    .from(aprConvite)
    .where(and(eq(aprConvite.osId, osId), inArray(aprConvite.usuarioId, ids), inArray(aprConvite.estado, ["pendente", "aceito"])));

  const notificar: string[] = [];
  for (const p of pessoas) {
    const aberto = emAberto.find((c) => c.usuarioId === p.id);
    if (aberto && aberto.convidadoPorId !== eu.id) {
      const [outro] = await db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, aberto.convidadoPorId));
      throw conflito("convite_em_aberto", `${p.nome} já foi convidado para a APR desta OS por ${outro?.nome ?? "outra pessoa"}`);
    }
    if (aberto?.estado === "aceito" || (aberto && aberto.expiraEm.getTime() > agora.getTime())) continue;
    if (aberto) await db.update(aprConvite).set({ criadoEm: agora, expiraEm: expiraEmDe(agora) }).where(eq(aprConvite.id, aberto.id));
    else await db.insert(aprConvite).values({ osId, convidadoPorId: eu.id, usuarioId: p.id, criadoEm: agora, expiraEm: expiraEmDe(agora) });
    notificar.push(p.id);
  }
  // Cada convidado sabe na hora (sino e push): o convite vale por pouco tempo.
  for (const id of notificar) {
    await criarAviso(db, [id], {
      tipo: "apr_convite",
      osId,
      detalhe: `${eu.nome} convidou você para participar da APR da ${rotuloDaOs(ordem)}. Responda em até ${PRAZO_DO_CONVITE_MIN} minutos.`,
      agora,
    });
  }
  return (await convitesDoResponsavel(db, osId, eu.id, agora)).filter((c) => ids.includes(c.convidado.id));
}

async function carregarConvite(db: Db, id: string) {
  const [linha] = await db.select({ convite: aprConvite, ordem: { id: os.id, numeroOrdem: os.numeroOrdem, titulo: os.titulo } }).from(aprConvite).innerJoin(os, eq(os.id, aprConvite.osId)).where(eq(aprConvite.id, id));
  if (!linha) throw naoEncontrado("Convite não encontrado");
  return linha;
}

/**
 * O convidado responde (`POST /apr-convites/{id}/aceitar` e `/recusar`). Só ele responde, e só o convite que ainda espera e não
 * venceu; responder de novo a mesma resposta é seguro. A recusa leva um motivo curto, que o responsável lê. O responsável é avisado
 * na hora (sino e push).
 */
export async function responderConvite(db: Db, eu: UsuarioAutenticado, conviteId: string, resposta: { aceita: true } | { aceita: false; motivo: string }, agora: Date): Promise<void> {
  const { convite, ordem } = await carregarConvite(db, conviteId);
  if (convite.usuarioId !== eu.id) throw naoEncontrado("Convite não encontrado");
  const estadoFinal = resposta.aceita ? "aceito" : "recusado";
  if (convite.estado === estadoFinal) return;
  if (convite.estado !== "pendente") throw conflito("convite_encerrado", convite.estado === "cancelado" ? "O convite foi desfeito" : convite.estado === "usado" ? "A APR já foi registrada" : "O convite já foi respondido");
  if (convite.expiraEm.getTime() <= agora.getTime()) throw conflito("convite_expirado", "O prazo para responder ao convite acabou: peça um novo");
  if (!resposta.aceita) {
    const motivo = resposta.motivo.trim();
    if (motivo === "") throw invalido("motivo_obrigatorio", "Diga por que você não pode participar");
    if (motivo.length > LIMITE_DO_MOTIVO_DO_CONVITE) throw invalido("motivo_longo", `O motivo passa de ${LIMITE_DO_MOTIVO_DO_CONVITE} caracteres`);
  }

  const [atualizado] = await db
    .update(aprConvite)
    .set({ estado: estadoFinal, respondidoEm: agora, recusaMotivo: resposta.aceita ? null : resposta.motivo.trim() })
    .where(and(eq(aprConvite.id, convite.id), eq(aprConvite.estado, "pendente")))
    .returning({ id: aprConvite.id });
  // Duas respostas disputando o mesmo convite: a que chegou depois é recusada como convite já respondido.
  if (!atualizado) throw conflito("convite_encerrado", "O convite já foi respondido");
  await resolverAvisoDoConvite(db, eu.id, convite.osId, agora);
  await criarAviso(db, [convite.convidadoPorId], {
    tipo: resposta.aceita ? "apr_convite_aceito" : "apr_convite_recusado",
    osId: convite.osId,
    detalhe: resposta.aceita
      ? `${eu.nome} aceitou participar da APR da ${rotuloDaOs(ordem)}.`
      : `${eu.nome} não pode participar da APR da ${rotuloDaOs(ordem)}: "${resposta.motivo.trim()}". Troque a pessoa para seguir.`,
    agora,
  });
}

/**
 * O responsável desfaz o convite (`DELETE /apr-convites/{id}`): trocou a pessoa ou desistiu. Só o convite em aberto (esperando ou
 * aceito); a pessoa convidada é avisada, e o convite dela some. Desfazer o que já foi desfeito é seguro.
 */
export async function desfazerConvite(db: Db, eu: UsuarioAutenticado, conviteId: string, agora: Date): Promise<void> {
  const { convite, ordem } = await carregarConvite(db, conviteId);
  if (convite.convidadoPorId !== eu.id) throw naoEncontrado("Convite não encontrado");
  if (convite.estado === "cancelado") return;
  if (convite.estado === "usado") throw conflito("convite_encerrado", "A APR já foi registrada");
  if (convite.estado === "recusado") return;
  const [atualizado] = await db.update(aprConvite).set({ estado: "cancelado" }).where(and(eq(aprConvite.id, convite.id), inArray(aprConvite.estado, ["pendente", "aceito"]))).returning({ id: aprConvite.id });
  if (!atualizado) return;
  await resolverAvisoDoConvite(db, convite.usuarioId, convite.osId, agora);
  await criarAviso(db, [convite.usuarioId], { tipo: "apr_convite_cancelado", osId: convite.osId, detalhe: `${eu.nome} desfez o convite para a APR da ${rotuloDaOs(ordem)}.`, agora });
}

/**
 * Os convites que a pessoa recebeu (`GET /me/apr-convites`): os que esperam a resposta dela e, até a APR ser registrada, os que ela
 * já aceitou (a tela mostra "você aceitou, aguardando o responsável"). O vencido, o recusado e o desfeito não aparecem.
 */
export async function convitesRecebidos(db: Db, usuarioId: string, agora: Date) {
  const linhas = await db
    .select({
      convite: aprConvite,
      responsavel: { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula },
      ordem: { id: os.id, numeroOrdem: os.numeroOrdem, titulo: os.titulo },
      local: localInstalacao.codigo,
    })
    .from(aprConvite)
    .innerJoin(usuario, eq(usuario.id, aprConvite.convidadoPorId))
    .innerJoin(os, eq(os.id, aprConvite.osId))
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(and(eq(aprConvite.usuarioId, usuarioId), inArray(aprConvite.estado, ["pendente", "aceito"]), gte(aprConvite.criadoEm, desdeHoje(agora)), notInArray(os.status, [...STATUS_SEM_APR])))
    .orderBy(desc(aprConvite.criadoEm));
  return linhas
    .filter((l) => situacaoDoConvite(l.convite, agora) !== "sem_resposta")
    .map((l) => ({
      id: l.convite.id,
      situacao: l.convite.estado === "aceito" ? ("aceito" as const) : ("aguardando" as const),
      criadoEm: l.convite.criadoEm,
      expiraEm: l.convite.expiraEm,
      convidadoPor: l.responsavel,
      os: { id: l.ordem.id, numeroOrdem: l.ordem.numeroOrdem, titulo: l.ordem.titulo, local: l.local },
    }));
}

/**
 * A APR foi registrada: os convites aceitos dos participantes viram `usado` (apontam para ela) e os demais convites em aberto do
 * responsável nesta OS (de quem ficou de fora da lista) são desfeitos em silêncio, para ninguém aceitar o que já não existe.
 */
export async function fecharConvitesDaApr(db: Db, o: { osId: string; responsavelId: string; aprId: string; participantes: string[]; agora: Date }): Promise<void> {
  await db
    .update(aprConvite)
    .set({ estado: "usado", aprId: o.aprId })
    .where(and(eq(aprConvite.osId, o.osId), eq(aprConvite.convidadoPorId, o.responsavelId), eq(aprConvite.estado, "aceito"), inArray(aprConvite.usuarioId, o.participantes), gte(aprConvite.criadoEm, desdeHoje(o.agora))));
  const sobras = await db
    .update(aprConvite)
    .set({ estado: "cancelado" })
    .where(and(eq(aprConvite.osId, o.osId), eq(aprConvite.convidadoPorId, o.responsavelId), inArray(aprConvite.estado, ["pendente", "aceito"])))
    .returning({ usuarioId: aprConvite.usuarioId });
  for (const s of sobras) await resolverAvisoDoConvite(db, s.usuarioId, o.osId, o.agora);
}
