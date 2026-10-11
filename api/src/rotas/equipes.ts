import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { equipe, usuario } from "../db/schema";
import { equipeParaApi } from "../dominio/usuarios";
import type { Autenticacao, Ambiente } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { lerConsulta, lerCorpo, lerId, textoObrigatorio, uuid } from "../http/validacao";

async function exigirSupervisor(deps: Deps, supervisorId: string | null | undefined) {
  if (!supervisorId) return;
  const [u] = await deps.db.select({ perfil: usuario.perfil, ativo: usuario.ativo }).from(usuario).where(eq(usuario.id, supervisorId));
  if (!u || !u.ativo || u.perfil !== "supervisor") throw invalido("supervisor_invalido", "O supervisor precisa ser um usuário ativo com perfil supervisor");
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

  /** Qualquer perfil lê: as telas filtram por equipe. */
  r.get("/equipes", autenticar(), async (c) => {
    const p = lerConsulta(c, esquemaPaginacao);
    const { limit, offset } = limiteEDeslocamento(p);
    const linhas = await deps.db.select().from(equipe).orderBy(asc(equipe.nome)).limit(limit).offset(offset);
    return responder(c, { equipes: linhas.map(equipeParaApi), ...meta(p, await contar(deps.db, equipe)) });
  });

  return r;
}
