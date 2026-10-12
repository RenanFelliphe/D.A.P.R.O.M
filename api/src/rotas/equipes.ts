import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { equipe, usuario } from "../db/schema";
import { buscaDeEquipes, equipesVisiveis } from "../dominio/busca";
import { listarOs } from "../dominio/painel-os";
import { equipeParaApi } from "../dominio/usuarios";
import { podeVerEquipe, type Autenticacao, type Ambiente } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, lerConsulta, lerCorpo, lerId, textoObrigatorio, uuid } from "../http/validacao";

async function exigirSupervisor(deps: Deps, supervisorId: string | null | undefined) {
  if (!supervisorId) return;
  const [u] = await deps.db.select({ ativo: usuario.ativo }).from(usuario).where(eq(usuario.id, supervisorId));
  if (!u || !u.ativo) throw invalido("supervisor_invalido", "O supervisor precisa ser um usuário ativo");
}

export function rotasEquipes(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.post("/equipes", autenticar(), exigirPerfil("admin"), async (c) => {
    const dados = await lerCorpo(
      c,
      z.object({ nome: textoObrigatorio, centro_trabalho: textoObrigatorio, supervisor_id: uuid.nullable().optional() }),
    );
    await exigirSupervisor(deps, dados.supervisor_id);
    const [existente] = await deps.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.centroTrabalho, dados.centro_trabalho));
    if (existente) throw conflito("centro_trabalho_duplicado", "Já existe uma equipe com este centro de trabalho");

    const [criada] = await deps.db
      .insert(equipe)
      .values({ nome: dados.nome, centroTrabalho: dados.centro_trabalho, supervisorId: dados.supervisor_id ?? null })
      .returning({ id: equipe.id });
    return responder(c, { id: criada!.id }, 201);
  });

  /** O centro de trabalho não muda: é por ele que a leitura do SAP acha a equipe. */
  r.patch("/equipes/:id", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const dados = await lerCorpo(c, z.object({ nome: textoObrigatorio.optional(), supervisor_id: uuid.nullable().optional() }));
    const [atual] = await deps.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, id));
    if (!atual) throw naoEncontrado("Equipe não encontrada");
    await exigirSupervisor(deps, dados.supervisor_id);

    await deps.db
      .update(equipe)
      .set({
        ...(dados.nome !== undefined && { nome: dados.nome }),
        ...(dados.supervisor_id !== undefined && { supervisorId: dados.supervisor_id }),
      })
      .where(eq(equipe.id, id));
    return responder(c, {});
  });

  /**
   * Qualquer perfil lê: as telas filtram por equipe. Com `busca` (nome ou centro de trabalho) ou `global=true` é a busca
   * global: fica só o que o perfil enxerga (técnico e supervisor, a própria equipe e as que supervisiona), aceita os filtros `id` e
   * `supervisor_id`, e cada equipe traz o supervisor e o total de membros ativos.
   */
  r.get("/equipes", autenticar(), async (c) => {
    const p = lerConsulta(c, esquemaPaginacao.extend({
        busca: z.string().trim().min(1).optional(),
        global: booleanoDaConsulta,
        id: uuid.optional(),
        supervisor_id: uuid.optional(),
      }),
    );
    const { limit, offset } = limiteEDeslocamento(p);
    if (!p.busca && !p.global) {
      const linhas = await deps.db.select().from(equipe).orderBy(asc(equipe.nome)).limit(limit).offset(offset);
      return responder(c, { equipes: linhas.map(equipeParaApi), ...meta(p, await contar(deps.db, equipe)) });
    }

    const eu = c.get("usuario");
    const condicoes: (SQL | undefined)[] = [
      p.busca ? buscaDeEquipes(p.busca) : undefined,
      p.id ? eq(equipe.id, p.id) : undefined,
      p.supervisor_id ? eq(equipe.supervisorId, p.supervisor_id) : undefined,
      equipesVisiveis(eu),
    ];
    const onde = and(...condicoes);
    const linhas = await deps.db.select().from(equipe).where(onde).orderBy(asc(equipe.nome)).limit(limit).offset(offset);
    const ids = linhas.map((e) => e.id);
    const totais = ids.length
      ? await deps.db
          .select({ equipeId: usuario.equipeId, n: sql<number>`count(*)::int` })
          .from(usuario)
          .where(and(inArray(usuario.equipeId, ids), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado")))
          .groupBy(usuario.equipeId)
      : [];
    const supervisorIds = linhas.flatMap((e) => (e.supervisorId ? [e.supervisorId] : []));
    const supervisores = supervisorIds.length
      ? await deps.db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(inArray(usuario.id, supervisorIds))
      : [];
    return responder(c, {
      equipes: linhas.map((e) => ({
        ...equipeParaApi(e),
        supervisorNome: supervisores.find((s) => s.id === e.supervisorId)?.nome ?? null,
        totalMembros: totais.find((t) => t.equipeId === e.id)?.n ?? 0,
      })),
      ...meta(p, await contar(deps.db, equipe, onde)),
    });
  });

  /**
   * Perfil da equipe: dados, supervisor, membros, a situação das OS e as mais recentes. Quem não enxerga a equipe
   * (quem não é da equipe nem a supervisiona) recebe `404`; só o admin vê membros inativos.
   */
  r.get("/equipes/:id", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const [e] = await deps.db.select().from(equipe).where(eq(equipe.id, id));
    if (!e || !podeVerEquipe(eu, id)) throw naoEncontrado("Equipe não encontrada");

    const admin = eu.perfil === "admin";
    const [supervisor] = e.supervisorId
      ? await deps.db
          .select({ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, cargo: usuario.cargo })
          .from(usuario)
          .where(eq(usuario.id, e.supervisorId))
      : [];
    const membros = await deps.db
      .select({ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, cargo: usuario.cargo, perfil: usuario.perfil, ativo: usuario.ativo })
      .from(usuario)
      .where(admin ? eq(usuario.equipeId, id) : and(eq(usuario.equipeId, id), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado")))
      .orderBy(asc(usuario.nome));
    const { itens, total, contagemPorStatus } = await listarOs(deps.db, eu, { equipe_id: id, pagina: 1, tamanho: OS_RECENTES_DA_EQUIPE }, deps.agora());

    return responder(c, { equipe: equipeParaApi(e), supervisor: supervisor ?? null, membros, contagemPorStatus, totalOs: total, osRecentes: itens });
  });

  return r;
}

/** Quantas OS aparecem no perfil da equipe. */
const OS_RECENTES_DA_EQUIPE = 8;
