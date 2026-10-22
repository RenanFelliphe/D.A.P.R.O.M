import { and, desc, eq, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";
import { enderecoDoMapa, LIMITE_DA_OBSERVACAO_DA_EMERGENCIA } from "../../../shared/api/emergencia";
import type { Db } from "../db/conexao";
import { emergencia, execucao, localInstalacao, os, usuario } from "../db/schema";
import { conflito, naoEncontrado, proibido } from "../http/erros";
import { podeSupervisionarEquipe, podeVerEquipe, type UsuarioAutenticado } from "../http/autenticacao";
import { uuid } from "../http/validacao";
import { adminsAtivos, criarAviso, destinatariosDaEquipe } from "./alertas";
import { ATRASO_OFFLINE_MS, carregarOsDoUsuario, lerPayload, lerPosicao, posicaoPayload, rejeitar, type Contexto } from "./eventos-base";
import { dataHoraBr, horaBr } from "../servicos/pdf-formato";

const esquemaEmergencia = z.object({
  /** O id do acionamento, gerado no aparelho: reenviar o mesmo não duplica o aviso. */
  id: uuid,
  execucao_id: uuid.nullish(),
  ...posicaoPayload,
  observacao: z.string().trim().max(LIMITE_DA_OBSERVACAO_DA_EMERGENCIA).nullish(),
});

const rotuloDaOs = (o: { numeroOrdem: string | null; titulo: string }) => `OS ${o.numeroOrdem ?? o.titulo}`;

/**
 * `emergencia_acionada`: o botão de emergência. Grava o acionamento e avisa, na hora e sem opção de desligar, o supervisor da equipe da OS
 * (e o representante, se está no comando), todos os administradores e ninguém mais: sino, push e e-mail (o aviso é de segurança). O aviso
 * leva o nome de quem acionou, a OS, o local e a posição (com o endereço do mapa). Nunca é recusado por falta de posição, de execução ou
 * de estado da OS: quem pede socorro não pode ser barrado por regra de fluxo; só a OS que não é da equipe da pessoa é recusada. Vindo da
 * fila offline (o aparelho esperou o sinal), o aviso diz a que horas foi acionado e que chegou depois.
 */
export async function aplicarEmergenciaAcionada(ctx: Contexto, osIdEnvelope: string | null, bruto: unknown) {
  const p = lerPayload(esquemaEmergencia, bruto);
  const osId = osIdEnvelope;
  if (!osId) throw rejeitar("os_obrigatoria", "Informe a OS da emergência");
  const posicao = lerPosicao(p);

  const [jaExiste] = await ctx.tx.select({ id: emergencia.id }).from(emergencia).where(eq(emergencia.id, p.id));
  if (jaExiste) return;

  const { os: ordem } = await carregarOsDoUsuario(ctx, osId);
  // A execução citada precisa ser da OS; se não for (ou não vier), a emergência vale do mesmo jeito.
  let execucaoId: string | null = null;
  if (p.execucao_id) {
    const [e] = await ctx.tx.select({ id: execucao.id, osId: execucao.osId }).from(execucao).where(eq(execucao.id, p.execucao_id));
    if (e && e.osId === ordem.id) execucaoId = e.id;
  }

  const acionadaEm = ctx.evento.ocorridoEm;
  await ctx.tx.insert(emergencia).values({
    id: p.id,
    osId: ordem.id,
    acionadaPorId: ctx.usuario.id,
    execucaoId,
    acionadaEm,
    recebidaEm: ctx.recebidoEm,
    latitude: posicao.latitude,
    longitude: posicao.longitude,
    observacao: p.observacao || null,
  });

  const [local] = await ctx.tx.select({ codigo: localInstalacao.codigo }).from(localInstalacao).where(eq(localInstalacao.id, ordem.localInstalacaoId));
  const atrasada = ctx.recebidoEm.getTime() - acionadaEm.getTime() > ATRASO_OFFLINE_MS;
  const partes = [
    `EMERGÊNCIA acionada por ${ctx.usuario.nome} (mat. ${ctx.usuario.matricula}) na ${rotuloDaOs(ordem)}${local ? ` · ${local.codigo}` : ""}, ${atrasada ? `às ${horaBr(acionadaEm)} (o aparelho estava sem sinal; chegou às ${horaBr(ctx.recebidoEm)})` : `às ${horaBr(acionadaEm)}`}.`,
    posicao.latitude !== null ? `Posição: ${enderecoDoMapa(posicao.latitude, posicao.longitude!)}` : "Sem posição: o aparelho não conseguiu o GPS.",
    p.observacao ? `Observação: "${p.observacao}".` : null,
    "Ligue para a pessoa e acione o PAE.",
  ].filter(Boolean);

  const destinatarios = new Set([...(await destinatariosDaEquipe(ctx.tx, ordem.equipeId)).map((d) => d.id), ...(await adminsAtivos(ctx.tx))]);
  destinatarios.delete(ctx.usuario.id);
  ctx.saida.alertas.push(...(await criarAviso(ctx.tx, destinatarios, { tipo: "emergencia", osId: ordem.id, detalhe: partes.join(" "), agora: ctx.recebidoEm })));
}

/** Os acionamentos da OS, do mais recente ao mais antigo (`GET /os/{id}/emergencias`): quem vê a OS vê; o atendimento é do supervisor e do admin. */
export async function emergenciasDaOs(db: Db, eu: UsuarioAutenticado, osId: string) {
  const [ordem] = await db.select({ equipeId: os.equipeId }).from(os).where(eq(os.id, osId));
  if (!ordem || !podeVerEquipe(eu, ordem.equipeId)) throw naoEncontrado("OS não encontrada");
  const atendente = alias(usuario, "atendente_da_emergencia");
  const linhas = await db
    .select({ e: emergencia, quem: { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula }, atendente: { id: atendente.id, nome: atendente.nome } })
    .from(emergencia)
    .innerJoin(usuario, eq(usuario.id, emergencia.acionadaPorId))
    .leftJoin(atendente, eq(atendente.id, emergencia.atendidaPorId))
    .where(eq(emergencia.osId, osId))
    .orderBy(desc(emergencia.acionadaEm), desc(emergencia.id));
  return linhas.map((l) => ({
    id: l.e.id,
    osId: l.e.osId,
    acionadaPor: l.quem,
    acionadaEm: l.e.acionadaEm,
    recebidaEm: l.e.recebidaEm,
    latitude: l.e.latitude,
    longitude: l.e.longitude,
    observacao: l.e.observacao,
    atendidaEm: l.e.atendidaEm,
    atendidaPor: l.atendente?.id ? { id: l.atendente.id, nome: l.atendente.nome } : null,
    notaDoAtendimento: l.e.notaDoAtendimento,
  }));
}

/**
 * O supervisor da equipe da OS ou o admin diz que a ocorrência foi tratada (`POST /emergencias/{id}/atender`), com uma nota opcional. Quem
 * acionou é avisado. Atender de novo o que já foi atendido não muda nada. A emergência de uma OS que a pessoa não supervisiona não existe para ela.
 */
export async function atenderEmergencia(db: Db, eu: UsuarioAutenticado, id: string, nota: string | null, agora: Date) {
  const [linha] = await db.select({ e: emergencia, equipeId: os.equipeId, numeroOrdem: os.numeroOrdem, titulo: os.titulo }).from(emergencia).innerJoin(os, eq(os.id, emergencia.osId)).where(eq(emergencia.id, id));
  if (!linha || !podeVerEquipe(eu, linha.equipeId)) throw naoEncontrado("Emergência não encontrada");
  if (!podeSupervisionarEquipe(eu, linha.equipeId)) throw proibido("Só o supervisor da equipe da OS e o administrador atendem a emergência");
  if (linha.e.atendidaEm) return { jaAtendida: true };
  if (linha.e.acionadaPorId === eu.id && eu.perfil !== "admin") throw conflito("emergencia_propria", "Quem acionou a emergência não a dá por atendida: o supervisor ou o administrador faz isso");
  const [feita] = await db
    .update(emergencia)
    .set({ atendidaEm: agora, atendidaPorId: eu.id, notaDoAtendimento: nota?.trim() || null })
    .where(and(eq(emergencia.id, id), isNull(emergencia.atendidaEm)))
    .returning({ id: emergencia.id });
  if (!feita) return { jaAtendida: true };
  await criarAviso(db, [linha.e.acionadaPorId], {
    tipo: "emergencia_atendida",
    osId: linha.e.osId,
    detalhe: `${eu.nome} deu a emergência da ${rotuloDaOs({ numeroOrdem: linha.numeroOrdem, titulo: linha.titulo })}, acionada às ${dataHoraBr(linha.e.acionadaEm)}, como atendida${nota?.trim() ? `: "${nota.trim()}"` : "."}`,
    agora,
  });
  return { jaAtendida: false };
}
