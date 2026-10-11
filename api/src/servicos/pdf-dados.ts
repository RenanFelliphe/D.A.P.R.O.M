import { and, asc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import {
  apr,
  aprParticipante,
  aprResposta,
  aprRisco,
  equipe,
  evidencia,
  execucao,
  execucaoAssinatura,
  execucaoPausa,
  itemModeloApr,
  localInstalacao,
  modeloApr,
  os,
  riscoModeloApr,
  usuario,
} from "../db/schema";
import type { Deps } from "../deps";
import type { Bucket } from "./armazenamento";

type Instante = Date;

export interface TrechoPdf {
  id: string;
  inicio: Instante;
  fim: Instante;
  pausas: { inicio: Instante; fim: Instante; motivo: string | null }[];
  /** Duração entre início e fim, em ms. */
  brutoMs: number;
  pausaMs: number;
  liquidoMs: number;
}

export interface DadosPdf {
  os: typeof os.$inferSelect;
  local: typeof localInstalacao.$inferSelect;
  equipe: typeof equipe.$inferSelect;
  /** A Execução que encerrou a OS: a APR dela é a página 1. */
  principal: typeof execucao.$inferSelect;
  trechoPrincipal: TrechoPdf;
  /** Trechos anteriores (suspensos ou interrompidos), do mais antigo ao mais novo. */
  anteriores: TrechoPdf[];
  apr: typeof apr.$inferSelect;
  modelo: typeof modeloApr.$inferSelect;
  preenchidaPor: { nome: string; matricula: string };
  participantes: { usuarioId: string; funcao: string; nome: string; matricula: string; cargo: string | null; registro: string | null; assinaturaPath: string; assinadaEm: Instante }[];
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
  assinaturasExecucao: { usuarioId: string; nome: string; matricula: string; cargo: string | null; registro: string | null; assinaturaPath: string; assinadaEm: Instante }[];
  fotos: { fotoPath: string; capturadaEm: Instante; latitude: number | null; longitude: number | null }[];
  ciencia: { nome: string; cargo: string | null; registro: string | null; assinaturaPath: string | null; em: Instante } | null;
  /** Bytes das imagens (fotos e assinaturas) por `bucket/caminho`; `null` = ausente no armazenamento. */
  imagens: Map<string, Uint8Array | null>;
}

export const chaveImagem = (bucket: Bucket, caminho: string) => `${bucket}/${caminho}`;

function montarTrecho(e: typeof execucao.$inferSelect, pausas: (typeof execucaoPausa.$inferSelect)[]): TrechoPdf {
  const fim = e.fim ?? e.inicio;
  const lista = pausas
    .filter((p) => p.execucaoId === e.id)
    .map((p) => ({ inicio: p.inicio, fim: p.fim ?? fim, motivo: p.motivo }))
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  const brutoMs = Math.max(0, fim.getTime() - e.inicio.getTime());
  const pausaMs = Math.min(brutoMs, lista.reduce((s, p) => s + Math.max(0, p.fim.getTime() - p.inicio.getTime()), 0));
  return { id: e.id, inicio: e.inicio, fim, pausas: lista, brutoMs, pausaMs, liquidoMs: brutoMs - pausaMs };
}

/** Lê do banco e do armazenamento tudo o que o PDF mostra. Lança erro se a OS não existe ou não tem Execução encerrada. */
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
  if (!principal) throw new Error("A OS não tem Execução encerrada");
  const anteriores = execucoes.filter((e) => e.id !== principal.id && (e.resultado === "suspensa" || e.resultado === "interrompida") && e.fim !== null);
  anteriores.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const idsTrechos = [principal.id, ...anteriores.map((e) => e.id)];
  const pausas = await db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, idsTrechos));

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
    .where(eq(aprParticipante.aprId, aprPrincipal.id))
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

  const assinaturasExecucao = await db
    .select({
      usuarioId: execucaoAssinatura.usuarioId,
      nome: usuario.nome,
      matricula: usuario.matricula,
      cargo: usuario.cargo,
      registro: usuario.registroProfissional,
      assinaturaPath: execucaoAssinatura.assinaturaPath,
      assinadaEm: execucaoAssinatura.assinadaEm,
    })
    .from(execucaoAssinatura)
    .innerJoin(usuario, eq(usuario.id, execucaoAssinatura.usuarioId))
    .where(eq(execucaoAssinatura.execucaoId, principal.id))
    .orderBy(asc(execucaoAssinatura.assinadaEm), asc(usuario.nome));

  const fotos = await db
    .select({ fotoPath: evidencia.fotoPath, capturadaEm: evidencia.capturadaEm, latitude: evidencia.latitude, longitude: evidencia.longitude })
    .from(evidencia)
    .where(eq(evidencia.execucaoId, principal.id))
    .orderBy(asc(evidencia.capturadaEm));

  let ciencia: DadosPdf["ciencia"] = null;
  if (base.os.cienciaPor && base.os.cienciaEm) {
    const [u] = await db
      .select({ nome: usuario.nome, cargo: usuario.cargo, registro: usuario.registroProfissional, assinaturaPath: usuario.assinaturaPath })
      .from(usuario)
      .where(eq(usuario.id, base.os.cienciaPor));
    if (u) ciencia = { ...u, em: base.os.cienciaEm };
  }

  // Imagens: lidas todas de uma vez; falha de leitura ou arquivo ausente vira `null` ("[imagem indisponível]").
  const imagens = new Map<string, Uint8Array | null>();
  const pedidos: { bucket: Bucket; caminho: string }[] = [
    ...participantes.map((p) => ({ bucket: "assinaturas" as const, caminho: p.assinaturaPath })),
    ...assinaturasExecucao.map((a) => ({ bucket: "assinaturas" as const, caminho: a.assinaturaPath })),
    ...(ciencia?.assinaturaPath ? [{ bucket: "assinaturas" as const, caminho: ciencia.assinaturaPath }] : []),
    ...fotos.map((f) => ({ bucket: "fotos" as const, caminho: f.fotoPath })),
  ];
  await Promise.all(
    pedidos.map(async ({ bucket, caminho }) => {
      const chave = chaveImagem(bucket, caminho);
      if (imagens.has(chave)) return;
      imagens.set(chave, null);
      imagens.set(chave, await deps.armazenamento.ler(bucket, caminho).catch(() => null));
    }),
  );

  return {
    os: base.os,
    local: base.local,
    equipe: base.equipe,
    principal,
    trechoPrincipal: montarTrecho(principal, pausas),
    anteriores: anteriores.map((e) => montarTrecho(e, pausas)),
    apr: aprPrincipal,
    modelo: modelo!,
    preenchidaPor: autor ?? { nome: "—", matricula: "—" },
    participantes,
    riscos,
    itens,
    assinaturasExecucao,
    fotos,
    ciencia,
    imagens,
  };
}
