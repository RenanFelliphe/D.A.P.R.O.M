import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  CRITERIOS,
  conquista,
  conquistaEquipe,
  conquistaUsuario,
  equipe,
  lancamentoPontos,
  os,
  usuario,
} from "../db/schema";
import type { Deps } from "../deps";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { naoEncontrado } from "../http/erros";
import {
  CRITERIOS_INFO,
  carregarDadosDaEquipe,
  carregarDadosDaPessoa,
  ehCriterioDeEquipe,
  progressoDaEquipe,
  progressoDaPessoa,
  textoDaMeta,
  type Meta,
} from "./conquistas";
import { caminhoDaImagem, caminhosDasImagens, escadaDePatentes, maiorDasPatentes, patenteDosPontos, patenteParaApi, proximaPatente, seloDePatente, todasAsPatentes, urlsDasImagens, type LinhaDePatente } from "./patentes";
import { GERAL, NOME_ANONIMO, maioresPatentes, mascararPessoa, membrosDasEquipes, pessoasElegiveis, rankingDeEquipes, rankingDePessoas } from "./ranking";
import { REGRAS, NAO_PONTUAM, ORDEM_DAS_REGRAS, REGRAS_DO_JOGO } from "./regras-de-pontuacao";
import { regrasDoBanco } from "./lancamentos";
import { codigoDaTemporada, dadosDaTemporada, ehCodigoDeTemporada, listarTemporadas, temporadaAtual } from "./temporadas";
import { regraPontuacao } from "../db/schema";

/**
 * As leituras da gamificação que as telas usam: o resumo da barra superior, "Minha pontuação", as conquistas com o progresso e
 * a raridade, o perfil de uma pessoa e de uma equipe, e os avisos pendentes ("Conquista desbloqueada", "Nova patente").
 */

const jogaNoSistema = (eu: Pick<UsuarioAutenticado, "perfil">) => eu.perfil === "tecnico";

async function pontosDaPessoaNaTemporada(deps: Deps, usuarioId: string, codigo: string): Promise<number> {
  const [linha] = await deps.db
    .select({ pontos: sql<number>`coalesce(sum(${lancamentoPontos.pontos}), 0)::int` })
    .from(lancamentoPontos)
    .where(and(eq(lancamentoPontos.usuarioId, usuarioId), eq(lancamentoPontos.temporada, codigo)));
  return linha?.pontos ?? 0;
}

/**
 * Os avisos que a pessoa ainda não viu: as conquistas obtidas e a patente nova (maior que a da última vez em que ela foi avisada
 * naquela temporada; na temporada nova o ponto de partida é a menor patente, que não é aviso).
 */
async function avisosDaPessoa(deps: Deps, u: { id: string; patenteAvisadaId: string | null; patenteAvisadaTemporada: string | null }, atual: LinhaDePatente | null, escada: LinhaDePatente[], codigo: string) {
  const conquistas = await deps.db
    .select({ id: conquista.id, titulo: conquista.titulo, descricao: conquista.descricao, pontos: conquista.pontos, imagemPath: conquista.imagemPath, obtidaEm: conquistaUsuario.obtidaEm })
    .from(conquistaUsuario)
    .innerJoin(conquista, eq(conquista.id, conquistaUsuario.conquistaId))
    .where(and(eq(conquistaUsuario.usuarioId, u.id), isNull(conquistaUsuario.vistaEm)))
    .orderBy(conquistaUsuario.obtidaEm);
  const avisada = u.patenteAvisadaTemporada === codigo && u.patenteAvisadaId ? escada.find((p) => p.id === u.patenteAvisadaId) : undefined;
  const base = avisada?.pontosNecessarios ?? escada[0]?.pontosNecessarios ?? 0;
  const patenteNova = atual && atual.pontosNecessarios > base ? atual : null;
  return { conquistas, patenteNova };
}

/** O resumo do `GET /me` (a barra superior): a patente e os pontos da temporada e quantos avisos esperam. `null` para quem não joga. */
export async function resumoParaMe(deps: Deps, eu: UsuarioAutenticado) {
  if (!jogaNoSistema(eu)) return null;
  const t = temporadaAtual(deps.agora());
  const [pontos, escada, [u]] = await Promise.all([
    pontosDaPessoaNaTemporada(deps, eu.id, t.codigo),
    escadaDePatentes(deps.db),
    deps.db.select({ id: usuario.id, patenteAvisadaId: usuario.patenteAvisadaId, patenteAvisadaTemporada: usuario.patenteAvisadaTemporada }).from(usuario).where(eq(usuario.id, eu.id)),
  ]);
  const atual = patenteDosPontos(pontos, escada);
  const avisos = await avisosDaPessoa(deps, u!, atual, escada, t.codigo);
  const urls = await urlsDasImagens(deps, atual ? [atual.imagemPath] : []);
  return {
    temporada: { codigo: t.codigo, nome: t.nome },
    pontosTemporada: pontos,
    patente: seloDePatente(atual, urls),
    avisosPendentes: avisos.conquistas.length + (avisos.patenteNova ? 1 : 0),
  };
}

/** `POST /gamificacao/avisos/vistos`: marca as conquistas como vistas e guarda a patente de agora como a última avisada. */
export async function marcarAvisosVistos(deps: Deps, eu: UsuarioAutenticado): Promise<void> {
  if (!jogaNoSistema(eu)) return;
  const agora = deps.agora();
  const t = temporadaAtual(agora);
  const escada = await escadaDePatentes(deps.db);
  const atual = patenteDosPontos(await pontosDaPessoaNaTemporada(deps, eu.id, t.codigo), escada);
  await deps.db.transaction(async (tx) => {
    await tx.update(conquistaUsuario).set({ vistaEm: agora }).where(and(eq(conquistaUsuario.usuarioId, eu.id), isNull(conquistaUsuario.vistaEm)));
    await tx.update(usuario).set({ patenteAvisadaId: atual?.id ?? null, patenteAvisadaTemporada: t.codigo }).where(eq(usuario.id, eu.id));
  });
}

// ---- Conquistas -------------------------------------------------------------------------------------------------

type LinhaDaConquista = typeof conquista.$inferSelect;

const ordemDosCriterios = (c: LinhaDaConquista) => CRITERIOS.indexOf(c.criterio);

/** As conquistas como a API as devolve, com a meta em texto, a raridade e, para quem joga, a data e o progresso. */
export async function listarConquistas(deps: Deps, eu: UsuarioAutenticado) {
  const db = deps.db;
  const todas = await db.select().from(conquista);
  todas.sort((a, b) => ordemDosCriterios(a) - ordemDosCriterios(b) || a.quantidade - b.quantidade || a.titulo.localeCompare(b.titulo, "pt-BR"));

  const [patentes, elegiveis, membros] = await Promise.all([todasAsPatentes(db), pessoasElegiveis(db), membrosDasEquipes(db)]);
  const idsElegiveis = elegiveis.map((p) => p.id);
  const timesComGente = [...membros.entries()].filter(([, lista]) => lista.length > 0).map(([id]) => id);

  const obtidasPorPessoas = idsElegiveis.length ? await db.select({ conquistaId: conquistaUsuario.conquistaId }).from(conquistaUsuario).where(inArray(conquistaUsuario.usuarioId, idsElegiveis)) : [];
  const obtidasPorTimes = timesComGente.length ? await db.select({ conquistaId: conquistaEquipe.conquistaId }).from(conquistaEquipe).where(inArray(conquistaEquipe.equipeId, timesComGente)) : [];
  const contar = (linhas: { conquistaId: string }[]) => {
    const m = new Map<string, number>();
    for (const l of linhas) m.set(l.conquistaId, (m.get(l.conquistaId) ?? 0) + 1);
    return m;
  };
  const pessoasQueTem = contar(obtidasPorPessoas);
  const timesQueTem = contar(obtidasPorTimes);

  // O que o próprio usuário já obteve e onde está (a equipe dele, ou a primeira que ele supervisiona).
  const obtidaPelaPessoa = new Map<string, Date>();
  let dadosPessoa = null as Awaited<ReturnType<typeof carregarDadosDaPessoa>> | null;
  if (jogaNoSistema(eu)) {
    for (const o of await db.select().from(conquistaUsuario).where(eq(conquistaUsuario.usuarioId, eu.id))) obtidaPelaPessoa.set(o.conquistaId, o.obtidaEm);
    dadosPessoa = await carregarDadosDaPessoa(db, eu.id);
  }
  const equipeDoUsuario = eu.equipeId ?? eu.equipesSupervisionadas[0] ?? null;
  const obtidaPelaEquipe = new Map<string, Date>();
  let dadosEquipe = null as Awaited<ReturnType<typeof carregarDadosDaEquipe>> | null;
  if (equipeDoUsuario && jogaNoSistema(eu)) {
    for (const o of await db.select().from(conquistaEquipe).where(eq(conquistaEquipe.equipeId, equipeDoUsuario))) obtidaPelaEquipe.set(o.conquistaId, o.obtidaEm);
    dadosEquipe = await carregarDadosDaEquipe(db, equipeDoUsuario, membros);
  }

  const admin = eu.perfil === "admin";
  const visiveis = todas.filter((c) => admin || c.ativa || obtidaPelaPessoa.has(c.id) || obtidaPelaEquipe.has(c.id));
  const urls = await urlsDasImagens(deps, visiveis.map((c) => c.imagemPath));

  const conquistas = visiveis.map((c) => {
    const deEquipe = ehCriterioDeEquipe(c.criterio);
    const patenteMeta = c.patenteId ? (patentes.get(c.patenteId) ?? null) : null;
    const meta: Meta = { criterio: c.criterio, quantidade: c.quantidade, patentePontos: patenteMeta?.pontosNecessarios ?? null };
    const obtidaEm = (deEquipe ? obtidaPelaEquipe : obtidaPelaPessoa).get(c.id) ?? null;
    const dados = deEquipe ? dadosEquipe : dadosPessoa;
    const progresso = dados ? (deEquipe ? progressoDaEquipe(meta, dadosEquipe!) : progressoDaPessoa(meta, dadosPessoa!)) : null;
    const total = deEquipe ? timesComGente.length : idsElegiveis.length;
    const tem = (deEquipe ? timesQueTem : pessoasQueTem).get(c.id) ?? 0;
    return {
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao,
      criterio: c.criterio,
      criterioRotulo: CRITERIOS_INFO[c.criterio].rotulo,
      tipo: deEquipe ? ("equipe" as const) : ("pessoa" as const),
      quantidade: c.quantidade,
      patente: patenteMeta ? { id: patenteMeta.id, nome: patenteMeta.nome } : null,
      meta: textoDaMeta(c, patenteMeta?.nome),
      pontos: c.pontos,
      imagemUrl: urls.get(c.imagemPath) || null,
      ativa: c.ativa,
      obtidas: tem,
      raridade: total > 0 ? Math.min(1, tem / total) : 0,
      obtidaEm,
      progresso: obtidaEm ? null : progresso,
    };
  });

  const regras = await regrasDoBanco(db);
  return {
    conquistas,
    /** O que a conquista de equipe e a de pessoa mostram: de quem são o progresso e a data. */
    equipeDoProgresso: equipeDoUsuario,
    /** Os pontos das conquistas valem só enquanto a tarefa "Conquista obtida" está ativa. */
    pontosLigados: regras.get("conquista_obtida")?.ativa ?? true,
    criterios: Object.entries(CRITERIOS_INFO).map(([codigo, info]) => ({ codigo, ...info })),
    patentes: [...patentes.values()].filter((p) => p.ativa).sort((a, b) => a.pontosNecessarios - b.pontosNecessarios).map((p) => ({ id: p.id, nome: p.nome })),
  };
}

// ---- Tarefas, patentes -------------------------------------------------------------------------------------------

/** `GET /gamificacao/regras`: as tarefas com o valor de agora, as regras do jogo e o que não pontua. */
export async function listarRegras(deps: Deps) {
  const linhas = await deps.db.select().from(regraPontuacao);
  const porCodigo = new Map(linhas.map((r) => [r.codigo, r]));
  return {
    regras: ORDEM_DAS_REGRAS.map((codigo) => {
      const d = REGRAS[codigo];
      const r = porCodigo.get(codigo);
      return {
        codigo,
        nome: d.nome,
        descricao: d.descricao,
        grupo: d.grupo,
        quem: d.quem,
        quando: d.quando,
        limite: d.limite,
        pontos: r?.pontos ?? d.pontos,
        ativa: r?.ativa ?? true,
        /** Sem valor próprio: os pontos vêm de cada conquista. */
        valorProprio: codigo !== "conquista_obtida",
        atualizadaEm: r?.atualizadaEm ?? null,
      };
    }),
    regrasDoJogo: REGRAS_DO_JOGO,
    naoPontuam: NAO_PONTUAM.map((n) => ({ oQue: n.o_que, porQue: n.por_que })),
  };
}

/** `GET /gamificacao/patentes`: a escada inteira (o admin vê também as desativadas), com a pontuação da própria pessoa. */
export async function listarPatentes(deps: Deps, eu: UsuarioAutenticado) {
  const todas = [...(await todasAsPatentes(deps.db)).values()].sort((a, b) => a.pontosNecessarios - b.pontosNecessarios || a.nome.localeCompare(b.nome, "pt-BR"));
  const visiveis = eu.perfil === "admin" ? todas : todas.filter((p) => p.ativa);
  const urls = await urlsDasImagens(deps, visiveis.flatMap(caminhosDasImagens));
  let voce: { patenteId: string | null; pontosTemporada: number } | null = null;
  if (jogaNoSistema(eu)) {
    const t = temporadaAtual(deps.agora());
    const pontos = await pontosDaPessoaNaTemporada(deps, eu.id, t.codigo);
    voce = { patenteId: patenteDosPontos(pontos, await escadaDePatentes(deps.db))?.id ?? null, pontosTemporada: pontos };
  }
  return { patentes: visiveis.map((p) => patenteParaApi(p, urls)), voce };
}

// ---- Minha pontuação ---------------------------------------------------------------------------------------------

/** `GET /gamificacao/eu`: tudo de "Minha pontuação" (a patente, a barra até a próxima, as posições, as conquistas e os avisos). */
export async function painelDaPessoa(deps: Deps, eu: UsuarioAutenticado) {
  const t = temporadaAtual(deps.agora());
  const [pontosTemporada, escada, maiores, rankTemporada, rankGeral, [u]] = await Promise.all([
    pontosDaPessoaNaTemporada(deps, eu.id, t.codigo),
    escadaDePatentes(deps.db),
    maioresPatentes(deps.db),
    rankingDePessoas(deps.db, t.codigo),
    rankingDePessoas(deps.db, GERAL),
    deps.db.select().from(usuario).where(eq(usuario.id, eu.id)),
  ]);
  const [geral] = await deps.db
    .select({ pontos: sql<number>`coalesce(sum(${lancamentoPontos.pontos}), 0)::int` })
    .from(lancamentoPontos)
    .where(eq(lancamentoPontos.usuarioId, eu.id));

  const pontosGerais = geral?.pontos ?? 0;
  const atual = patenteDosPontos(pontosTemporada, escada);
  const proxima = proximaPatente(pontosTemporada, escada);
  const maior = maiorDasPatentes(maiores.get(eu.id), atual);
  const avisos = await avisosDaPessoa(deps, u!, atual, escada, t.codigo);
  const conquistas = (await listarConquistas(deps, eu)).conquistas.filter((c) => c.tipo === "pessoa");

  const urls = await urlsDasImagens(deps, [
    ...[atual, proxima, maior].filter((p): p is LinhaDePatente => p !== null).map((p) => p.imagemPath),
    ...avisos.conquistas.map((c) => c.imagemPath),
    ...(avisos.patenteNova ? [avisos.patenteNova.imagemPath] : []),
  ]);
  const naTemporada = rankTemporada.find((l) => l.usuarioId === eu.id);
  const noGeral = rankGeral.find((l) => l.usuarioId === eu.id);
  return {
    temporada: t,
    pontosTemporada,
    pontosGerais,
    patente: seloDePatente(atual, urls),
    proximaPatente: proxima ? { ...seloDePatente(proxima, urls)!, faltam: proxima.pontosNecessarios - pontosTemporada } : null,
    /** Onde a barra de progresso começa e termina: a pontuação da patente de agora e a da próxima. */
    barra: { de: atual?.pontosNecessarios ?? 0, ate: proxima?.pontosNecessarios ?? null },
    maiorPatente: seloDePatente(maior, urls),
    posicaoTemporada: naTemporada?.posicao ?? null,
    participantesTemporada: rankTemporada.length,
    posicaoGeral: noGeral?.posicao ?? null,
    participantesGeral: rankGeral.length,
    rankingAnonimo: u!.rankingAnonimo,
    conquistas,
    avisos: {
      conquistas: avisos.conquistas.map((c) => ({ id: c.id, titulo: c.titulo, descricao: c.descricao, pontos: c.pontos, obtidaEm: c.obtidaEm, imagemUrl: urls.get(c.imagemPath) || null })),
      patente: seloDePatente(avisos.patenteNova, urls),
    },
  };
}

// ---- Extrato -----------------------------------------------------------------------------------------------------

/** Como a linha do extrato se lê ("APR da OS 4019821"). */
function descreverLancamento(regra: string, nomeDaRegra: string, numeroOrdem: string | null, titulo: string | null, chave: string): string {
  const daOs = numeroOrdem ? ` da OS ${numeroOrdem}` : titulo ? ` da OS de apoio "${titulo}"` : "";
  if (regra === "conquista_obtida") return `Conquista desbloqueada`;
  if (regra === "intervalo_definido") return `${nomeDaRegra} (plano de preventiva)`;
  if (regra === "assinatura_cadastrada" || regra === "treinamento_concluido") return nomeDaRegra;
  return `${nomeDaRegra}${daOs}` || chave;
}

/** `GET /gamificacao/extrato`: os lançamentos da pessoa, do mais novo ao mais antigo, numa temporada ou no geral. */
export async function extratoDaPessoa(deps: Deps, eu: UsuarioAutenticado, escopo: string, limite: number, deslocamento: number) {
  if (escopo !== GERAL && !ehCodigoDeTemporada(escopo)) throw naoEncontrado("Temporada não encontrada");
  const onde = and(eq(lancamentoPontos.usuarioId, eu.id), escopo === GERAL ? undefined : eq(lancamentoPontos.temporada, escopo));
  const [soma] = await deps.db
    .select({ total: sql<number>`count(*)::int`, pontos: sql<number>`coalesce(sum(${lancamentoPontos.pontos}), 0)::int` })
    .from(lancamentoPontos)
    .where(onde);
  const total = soma?.total ?? 0;
  const pontos = soma?.pontos ?? 0;
  const linhas = await deps.db
    .select({
      id: lancamentoPontos.id,
      regra: lancamentoPontos.regra,
      nomeDaRegra: regraPontuacao.nome,
      pontos: lancamentoPontos.pontos,
      chave: lancamentoPontos.chave,
      osId: lancamentoPontos.osId,
      numeroOrdem: os.numeroOrdem,
      titulo: os.titulo,
      ocorridoEm: lancamentoPontos.ocorridoEm,
      temporada: lancamentoPontos.temporada,
    })
    .from(lancamentoPontos)
    .innerJoin(regraPontuacao, eq(regraPontuacao.codigo, lancamentoPontos.regra))
    .leftJoin(os, eq(os.id, lancamentoPontos.osId))
    .where(onde)
    .orderBy(desc(lancamentoPontos.ocorridoEm), desc(lancamentoPontos.id))
    .limit(limite)
    .offset(deslocamento);

  // O nome do conquista fica na chave (`conquista:<id>`): o extrato mostra qual foi.
  const idsDeConquista = linhas.filter((l) => l.regra === "conquista_obtida").map((l) => l.chave.slice("conquista:".length));
  const titulos = idsDeConquista.length ? new Map((await deps.db.select({ id: conquista.id, titulo: conquista.titulo }).from(conquista).where(inArray(conquista.id, idsDeConquista))).map((c) => [c.id, c.titulo])) : new Map<string, string>();
  return {
    total,
    pontos,
    lancamentos: linhas.map((l) => ({
      id: l.id,
      regra: l.regra,
      pontos: l.pontos,
      osId: l.osId,
      numeroOrdem: l.numeroOrdem,
      ocorridoEm: l.ocorridoEm,
      temporada: l.temporada,
      descricao:
        l.regra === "conquista_obtida"
          ? `Conquista: ${titulos.get(l.chave.slice("conquista:".length)) ?? "desbloqueada"}`
          : descreverLancamento(l.regra, l.nomeDaRegra, l.numeroOrdem, l.titulo, l.chave),
    })),
  };
}

// ---- Rankings ----------------------------------------------------------------------------------------------------

/** O escopo pedido (`?temporada=`): o código de uma temporada, `geral`, ou a de hoje quando ausente. Código que não existe é `404`. */
export async function escopoDoRanking(deps: Deps, pedido: string | undefined): Promise<string> {
  if (!pedido) return codigoDaTemporada(deps.agora());
  if (pedido === GERAL) return GERAL;
  if (!ehCodigoDeTemporada(pedido)) throw naoEncontrado("Temporada não encontrada");
  return pedido;
}

/** `GET /gamificacao/ranking`: pessoas ou equipes, com os anônimos mascarados para quem não é o próprio nem o admin. */
export async function montarRanking(deps: Deps, eu: UsuarioAutenticado, tipo: "pessoas" | "equipes", escopo: string) {
  const temporadas = await listarTemporadas(deps.db, deps.agora());
  const dados = escopo === GERAL ? null : temporadas.find((t) => t.codigo === escopo) ?? { ...dadosDaTemporada(escopo), fechadaEm: null, atual: false };
  const cabecalho = { tipo, escopo, temporada: dados ? { codigo: dados.codigo, nome: dados.nome, inicio: dados.inicio, fim: dados.fim, fechada: Boolean(dados.fechadaEm), atual: dados.atual } : null };

  if (tipo === "pessoas") {
    const linhas = (await rankingDePessoas(deps.db, escopo)).map((l) => mascararPessoa(l, eu));
    const urls = await urlsDasImagens(deps, linhas.flatMap((l) => (l.patente ? [l.patente.imagemPath] : [])));
    return {
      ...cabecalho,
      linhas: linhas.map((l) => ({
        posicao: l.posicao,
        usuarioId: l.usuarioId,
        nome: l.nome,
        equipeId: l.equipeId,
        equipeNome: l.equipeNome,
        anonimo: l.anonimo,
        voce: l.usuarioId === eu.id,
        pontos: l.pontos,
        patente: seloDePatente(l.patente, urls),
      })),
    };
  }
  const linhas = await rankingDeEquipes(deps.db, escopo);
  const urls = await urlsDasImagens(deps, linhas.flatMap((l) => (l.patente ? [caminhoDaImagem(l.patente, "equipe")] : [])));
  const minhas = new Set([eu.equipeId, ...eu.equipesSupervisionadas].filter((id): id is string => id !== null));
  return {
    ...cabecalho,
    linhas: linhas.map((l) => ({
      posicao: l.posicao,
      equipeId: l.equipeId,
      nome: l.nome,
      membros: l.membros,
      pontos: l.pontos,
      media: l.media,
      voce: minhas.has(l.equipeId),
      patente: seloDePatente(l.patente, urls, "equipe"),
    })),
  };
}

/** `GET /gamificacao/temporadas`. */
export async function temporadasParaApi(deps: Deps) {
  return {
    temporadas: (await listarTemporadas(deps.db, deps.agora())).map((t) => ({ codigo: t.codigo, nome: t.nome, inicio: t.inicio, fim: t.fim, fechada: Boolean(t.fechadaEm), fechadaEm: t.fechadaEm, atual: t.atual })),
  };
}

// ---- Perfis ------------------------------------------------------------------------------------------------------

async function conquistasObtidas(deps: Deps, de: { usuarioId: string } | { equipeId: string }) {
  const linhas =
    "usuarioId" in de
      ? await deps.db
          .select({ id: conquista.id, titulo: conquista.titulo, descricao: conquista.descricao, imagemPath: conquista.imagemPath, pontos: conquista.pontos, obtidaEm: conquistaUsuario.obtidaEm })
          .from(conquistaUsuario)
          .innerJoin(conquista, eq(conquista.id, conquistaUsuario.conquistaId))
          .where(eq(conquistaUsuario.usuarioId, de.usuarioId))
          .orderBy(desc(conquistaUsuario.obtidaEm))
      : await deps.db
          .select({ id: conquista.id, titulo: conquista.titulo, descricao: conquista.descricao, imagemPath: conquista.imagemPath, pontos: conquista.pontos, obtidaEm: conquistaEquipe.obtidaEm })
          .from(conquistaEquipe)
          .innerJoin(conquista, eq(conquista.id, conquistaEquipe.conquistaId))
          .where(eq(conquistaEquipe.equipeId, de.equipeId))
          .orderBy(desc(conquistaEquipe.obtidaEm));
  const urls = await urlsDasImagens(deps, linhas.map((l) => l.imagemPath));
  return linhas.map((l) => ({ id: l.id, titulo: l.titulo, descricao: l.descricao, pontos: l.pontos, obtidaEm: l.obtidaEm, imagemUrl: urls.get(l.imagemPath) || null }));
}

/**
 * `GET /gamificacao/usuarios/{id}`: a patente da temporada, a maior patente e as conquistas de uma pessoa (o perfil dela).
 * Quem está anônimo no ranking só mostra isso a si mesma e ao admin; para os outros vem só `anonimo: true`.
 */
export async function perfilDaPessoa(deps: Deps, eu: UsuarioAutenticado, id: string) {
  const [u] = await deps.db.select({ id: usuario.id, perfil: usuario.perfil, anonimo: usuario.rankingAnonimo }).from(usuario).where(eq(usuario.id, id));
  if (!u || u.perfil !== "tecnico") throw naoEncontrado("Pessoa não encontrada");
  if (u.anonimo && u.id !== eu.id && eu.perfil !== "admin") return { anonimo: true as const };

  const t = temporadaAtual(deps.agora());
  const [pontosTemporada, escada, maiores] = await Promise.all([pontosDaPessoaNaTemporada(deps, id, t.codigo), escadaDePatentes(deps.db), maioresPatentes(deps.db)]);
  const atual = patenteDosPontos(pontosTemporada, escada);
  const maior = maiorDasPatentes(maiores.get(id), atual);
  const urls = await urlsDasImagens(deps, [atual, maior].filter((p): p is LinhaDePatente => p !== null).map((p) => p.imagemPath));
  return {
    anonimo: false as const,
    temporada: { codigo: t.codigo, nome: t.nome },
    pontosTemporada,
    patente: seloDePatente(atual, urls),
    maiorPatente: seloDePatente(maior, urls),
    conquistas: await conquistasObtidas(deps, { usuarioId: id }),
  };
}

/**
 * `GET /gamificacao/equipes/{id}`: a soma, a média, a patente, a maior patente e a posição da equipe, as conquistas dela e os
 * pontos de cada membro na temporada (os anônimos aparecem como anônimos).
 */
export async function perfilDaEquipe(deps: Deps, eu: UsuarioAutenticado, id: string) {
  const [e] = await deps.db.select({ id: equipe.id, nome: equipe.nome }).from(equipe).where(eq(equipe.id, id));
  if (!e) throw naoEncontrado("Equipe não encontrada");
  const t = temporadaAtual(deps.agora());
  const [times, geral, pessoas, membros] = await Promise.all([rankingDeEquipes(deps.db, t.codigo), rankingDeEquipes(deps.db, GERAL), rankingDePessoas(deps.db, t.codigo), membrosDasEquipes(deps.db)]);
  const dela = times.find((l) => l.equipeId === id);
  const doGeral = geral.find((l) => l.equipeId === id);
  const lista = (membros.get(id) ?? []).map((m) => {
    const linha = pessoas.find((p) => p.usuarioId === m.id);
    return { m, pontos: linha?.pontos ?? 0, patente: linha?.patente ?? null };
  });
  lista.sort((a, b) => b.pontos - a.pontos || a.m.nome.localeCompare(b.m.nome, "pt-BR"));
  // No ranking geral, a patente da linha é a maior já alcançada pela equipe (equipe sem ninguém fica fora do ranking).
  const maior = maiorDasPatentes(doGeral?.patente, dela?.patente);
  // A patente da equipe tem a imagem das equipes; a de cada membro, a das pessoas.
  const daEquipe = [dela?.patente, maior].filter((p): p is LinhaDePatente => Boolean(p)).map((p) => caminhoDaImagem(p, "equipe"));
  const dosMembros = lista.map((l) => l.patente).filter((p): p is LinhaDePatente => Boolean(p)).map((p) => caminhoDaImagem(p));
  const urls = await urlsDasImagens(deps, [...daEquipe, ...dosMembros]);
  return {
    equipe: e,
    temporada: { codigo: t.codigo, nome: t.nome },
    pontosTemporada: dela?.pontos ?? 0,
    media: dela?.media ?? 0,
    membros: dela?.membros ?? lista.length,
    patente: seloDePatente(dela?.patente ?? null, urls, "equipe"),
    maiorPatente: seloDePatente(maior, urls, "equipe"),
    posicaoTemporada: dela?.posicao ?? null,
    equipesNoRanking: times.length,
    pontosGerais: doGeral?.pontos ?? 0,
    mediaGeral: doGeral?.media ?? 0,
    posicaoGeral: doGeral?.posicao ?? null,
    conquistas: await conquistasObtidas(deps, { equipeId: id }),
    pessoas: lista.map(({ m, pontos, patente: p }) => {
      const oculta = m.anonimo && m.id !== eu.id && eu.perfil !== "admin";
      return { usuarioId: oculta ? null : m.id, nome: oculta ? NOME_ANONIMO : m.nome, anonimo: m.anonimo, voce: m.id === eu.id, pontos, patente: seloDePatente(p, urls) };
    }),
  };
}
