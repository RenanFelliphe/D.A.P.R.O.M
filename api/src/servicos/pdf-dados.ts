import { and, asc, eq, isNotNull, isNull, ne } from "drizzle-orm";
import {
  apr,
  aprParticipante,
  aprResposta,
  aprRisco,
  equipe,
  execucao,
  execucaoAssinatura,
  itemModeloApr,
  localInstalacao,
  modeloApr,
  os,
  riscoModeloApr,
  usuario,
} from "../db/schema";
import type { Deps } from "../deps";
import { DESCRICAO_SEM_OCORRENCIAS } from "../dominio/encerramento";
import type { Bucket } from "./armazenamento";

type Instante = Date;

export interface ParticipantePdf {
  usuarioId: string;
  funcao: string;
  nome: string;
  matricula: string;
  cargo: string | null;
  registro: string | null;
  /** Nulos enquanto a pessoa não assinou a APR (célula vazia no papel). */
  assinaturaPath: string | null;
  assinadaEm: Instante | null;
}

/** Quem assinou e quando: o responsável no encerramento ou o supervisor no fim. */
export interface AssinanteFinal {
  nome: string;
  cargo: string | null;
  registro: string | null;
  assinaturaPath: string | null;
  em: Instante;
}

/**
 * O que o PDF da OS mostra: a APR (como o modelo) e a folha da OS do SAP preenchida. Nada além disso: tempos, pausas, fotos e
 * checklist vão para o relatório da execução (`relatorio-execucao.ts`).
 */
export interface DadosPdf {
  os: typeof os.$inferSelect;
  local: typeof localInstalacao.$inferSelect;
  equipe: typeof equipe.$inferSelect;
  /** A Execução que encerrou a OS (a primeira encerrada): a APR dela é a primeira página. */
  principal: typeof execucao.$inferSelect;
  /** Início do primeiro trecho (quando a atividade teve vários) e fim da Execução que encerrou, o clique em "Encerrar OS". */
  inicio: Instante;
  fim: Instante;
  /** A descrição do encerramento, ou o texto padrão quando não houve ocorrência. */
  descricao: string;
  apr: typeof apr.$inferSelect;
  modelo: typeof modeloApr.$inferSelect;
  preenchidaPor: { nome: string; matricula: string };
  /** Quem recusou a APR saiu dela e não entra aqui (o relatório da execução traz a recusa). */
  participantes: ParticipantePdf[];
  riscos: { classificacao: string; nome: string }[];
  itens: {
    secao: string;
    classificacao: string | null;
    risco: string | null;
    ordem: number;
    texto: string;
    tipo: string;
    resposta: string;
    observacao: string | null;
    reprovado: boolean;
    alerta: boolean;
  }[];
  /** "Responsável - Manutenção": a assinatura do encerramento. */
  responsavel: AssinanteFinal | null;
  /** "Supervisor": a assinatura final. */
  ciencia: AssinanteFinal | null;
  /** Bytes das assinaturas por `bucket/caminho`; `null` = ausente no armazenamento. */
  imagens: Map<string, Uint8Array | null>;
}

export const chaveImagem = (bucket: Bucket, caminho: string) => `${bucket}/${caminho}`;

/** Lê do armazenamento as imagens pedidas, todas de uma vez; falha de leitura ou arquivo ausente vira `null` ("[imagem indisponível]"). */
export async function lerImagens(deps: Deps, pedidos: { bucket: Bucket; caminho: string | null }[]): Promise<Map<string, Uint8Array | null>> {
  const imagens = new Map<string, Uint8Array | null>();
  await Promise.all(
    pedidos.map(async ({ bucket, caminho }) => {
      if (!caminho) return;
      const chave = chaveImagem(bucket, caminho);
      if (imagens.has(chave)) return;
      imagens.set(chave, null);
      imagens.set(chave, await deps.armazenamento.ler(bucket, caminho).catch(() => null));
    }),
  );
  return imagens;
}

/** Lê do banco e do armazenamento tudo o que o PDF mostra. Lança erro se a OS não existe ou não tem Execução encerrada e assinada. */
export async function carregarDadosPdf(deps: Deps, osId: string): Promise<DadosPdf> {
  const { db } = deps;
  const [base] = await db
    .select({ os, local: localInstalacao, equipe })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .innerJoin(equipe, eq(equipe.id, os.equipeId))
    .where(eq(os.id, osId));
  if (!base) throw new Error("OS não encontrada");

  // Duas pessoas podem ter encerrado a mesma OS offline: vale a primeira encerrada.
  const execucoes = await db
    .select()
    .from(execucao)
    .where(and(eq(execucao.osId, osId), isNotNull(execucao.resultado), ne(execucao.resultado, "cancelada")))
    .orderBy(asc(execucao.fim), asc(execucao.inicio));
  const principal = execucoes.find((e) => e.resultado === "encerrada");
  if (!principal || !principal.fim) throw new Error("A OS não tem Execução encerrada");
  // O PDF só existe depois do encerramento assinado pelo responsável (e da assinatura final do supervisor, que dispara a tarefa).
  if (!principal.encerramentoAssinadoEm) throw new Error("A Execução encerrada ainda não foi assinada pelo responsável");
  const anteriores = execucoes.filter((e) => e.id !== principal.id && (e.resultado === "suspensa" || e.resultado === "interrompida") && e.fim !== null);
  const inicio = [principal, ...anteriores].reduce((menor, e) => (e.inicio < menor ? e.inicio : menor), principal.inicio);

  const [aprPrincipal] = await db.select().from(apr).where(eq(apr.id, principal.aprId));
  if (!aprPrincipal) throw new Error("APR da Execução não encontrada");
  const [modelo] = await db.select().from(modeloApr).where(eq(modeloApr.id, aprPrincipal.modeloAprId));
  const [autor] = await db.select({ nome: usuario.nome, matricula: usuario.matricula }).from(usuario).where(eq(usuario.id, aprPrincipal.preenchidaPor));

  const participantes = await db
    .select({
      usuarioId: aprParticipante.usuarioId,
      funcao: aprParticipante.funcao,
      nome: usuario.nome,
      matricula: usuario.matricula,
      cargo: usuario.cargo,
      registro: usuario.registroProfissional,
      assinaturaPath: aprParticipante.assinaturaPath,
      assinadaEm: aprParticipante.assinadaEm,
    })
    .from(aprParticipante)
    .innerJoin(usuario, eq(usuario.id, aprParticipante.usuarioId))
    .where(and(eq(aprParticipante.aprId, aprPrincipal.id), isNull(aprParticipante.recusouEm)))
    .orderBy(asc(aprParticipante.funcao), asc(usuario.nome));
  // "responsavel" vem antes de "executor" na ordem alfabética inversa; garante o responsável primeiro.
  participantes.sort((a, b) => Number(b.funcao === "responsavel") - Number(a.funcao === "responsavel"));

  const riscos = await db
    .select({ classificacao: riscoModeloApr.classificacao, nome: riscoModeloApr.nome })
    .from(aprRisco)
    .innerJoin(riscoModeloApr, eq(riscoModeloApr.id, aprRisco.riscoId))
    .where(eq(aprRisco.aprId, aprPrincipal.id))
    .orderBy(asc(riscoModeloApr.ordem));

  const respostas = await db
    .select({
      secao: itemModeloApr.secao,
      ordem: itemModeloApr.ordem,
      texto: itemModeloApr.texto,
      tipo: itemModeloApr.tipo,
      bloqueante: itemModeloApr.respostaBloqueante,
      resposta: aprResposta.resposta,
      observacao: aprResposta.observacao,
      classificacao: riscoModeloApr.classificacao,
      risco: riscoModeloApr.nome,
      ordemRisco: riscoModeloApr.ordem,
    })
    .from(aprResposta)
    .innerJoin(itemModeloApr, eq(itemModeloApr.id, aprResposta.itemId))
    .leftJoin(riscoModeloApr, eq(riscoModeloApr.id, itemModeloApr.riscoId))
    .where(eq(aprResposta.aprId, aprPrincipal.id));
  respostas.sort((a, b) => {
    if (a.secao !== b.secao) return a.secao === "verificacao" ? -1 : 1;
    return (a.ordemRisco ?? 0) - (b.ordemRisco ?? 0) || a.ordem - b.ordem;
  });
  const itens = respostas.map((r) => {
    const naBloqueante = r.bloqueante !== null && r.resposta === r.bloqueante;
    return {
      secao: r.secao,
      classificacao: r.classificacao,
      risco: r.risco,
      ordem: r.ordem,
      texto: r.texto,
      tipo: r.tipo,
      resposta: r.resposta,
      observacao: r.observacao,
      reprovado: naBloqueante && r.tipo === "eliminatorio",
      alerta: naBloqueante && r.tipo === "alerta",
    };
  });

  // A assinatura do encerramento é uma só: a do responsável (`executor_id`); na falta dela, a primeira que existir.
  const assinaturasDoEncerramento = await db
    .select({
      usuarioId: execucaoAssinatura.usuarioId,
      nome: usuario.nome,
      cargo: usuario.cargo,
      registro: usuario.registroProfissional,
      assinaturaPath: execucaoAssinatura.assinaturaPath,
      assinadaEm: execucaoAssinatura.assinadaEm,
    })
    .from(execucaoAssinatura)
    .innerJoin(usuario, eq(usuario.id, execucaoAssinatura.usuarioId))
    .where(eq(execucaoAssinatura.execucaoId, principal.id))
    .orderBy(asc(execucaoAssinatura.assinadaEm));
  const doResponsavel = assinaturasDoEncerramento.find((a) => a.usuarioId === principal.executorId) ?? assinaturasDoEncerramento[0];
  const responsavel: AssinanteFinal | null = doResponsavel
    ? { nome: doResponsavel.nome, cargo: doResponsavel.cargo, registro: doResponsavel.registro, assinaturaPath: doResponsavel.assinaturaPath, em: doResponsavel.assinadaEm }
    : null;

  let ciencia: AssinanteFinal | null = null;
  if (base.os.cienciaPor && base.os.cienciaEm) {
    const [u] = await db
      .select({ nome: usuario.nome, cargo: usuario.cargo, registro: usuario.registroProfissional, assinaturaPath: usuario.assinaturaPath })
      .from(usuario)
      .where(eq(usuario.id, base.os.cienciaPor));
    // A imagem que o supervisor usou na assinatura final; as anteriores à assinatura mostram a atual do perfil.
    if (u) ciencia = { ...u, assinaturaPath: base.os.cienciaAssinaturaPath ?? u.assinaturaPath, em: base.os.cienciaEm };
  }

  const imagens = await lerImagens(deps, [
    ...participantes.map((p) => ({ bucket: "assinaturas" as const, caminho: p.assinaturaPath })),
    { bucket: "assinaturas", caminho: responsavel?.assinaturaPath ?? null },
    { bucket: "assinaturas", caminho: ciencia?.assinaturaPath ?? null },
  ]);

  return {
    os: base.os,
    local: base.local,
    equipe: base.equipe,
    principal,
    inicio,
    fim: principal.fim,
    descricao: principal.descricaoAtividade?.trim() || DESCRICAO_SEM_OCORRENCIAS,
    apr: aprPrincipal,
    modelo: modelo!,
    preenchidaPor: autor ?? { nome: "—", matricula: "—" },
    participantes,
    riscos,
    itens,
    responsavel,
    ciencia,
    imagens,
  };
}
