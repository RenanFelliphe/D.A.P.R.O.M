import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { equipe, execucao, execucaoPausa, localInstalacao, os, PERFIS, usuario } from "../db/schema";
import { buscaDeUsuarios, usuariosVisiveis } from "../dominio/busca";
import { emMinutos, tempoDaExecucao } from "../dominio/painel-comum";
import { equipeParaApi, gerarSenhaInicial, usuarioParaApi } from "../dominio/usuarios";
import { equipeDoEscopo, type Autenticacao, type Ambiente } from "../http/autenticacao";
import { codigoPostgres, conflito, invalido, naoEncontrado } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, emailInstitucional, lerConsulta, lerCorpo, lerId, textoObrigatorio, uuid } from "../http/validacao";
import { senhaNova } from "./auth";

/** Identificação definitiva da pessoa na empresa; não é o login (o login é o e-mail institucional). */
const matricula = z.string().trim().min(1).max(40);

const textoOpcional = z.string().trim().min(1).nullable().optional();

async function exigirEquipe(deps: Deps, equipeId: string | null | undefined) {
  if (!equipeId) return;
  const [e] = await deps.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, equipeId));
  if (!e) throw invalido("equipe_inexistente", "Equipe não encontrada");
}

/** Cadastro de usuários (admin) e a listagem de colegas de equipe (todos os perfis). O primeiro CRUD: os demais seguem esta convenção. */
export function rotasUsuarios(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.post("/usuarios", autenticar(), exigirPerfil("admin"), async (c) => {
    const dados = await lerCorpo(
      c,
      z.object({
        nome: textoObrigatorio,
        matricula,
        email: emailInstitucional,
        perfil: z.enum(PERFIS),
        equipe_id: uuid.nullable().optional(),
        cargo: textoOpcional,
        registro_profissional: textoOpcional,
        senha_inicial: senhaNova,
      }),
    );
    await exigirEquipe(deps, dados.equipe_id);

    const [existente] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(sql`lower(${usuario.matricula})`, dados.matricula.toLowerCase()));
    if (existente) throw conflito("matricula_duplicada", "Matrícula já cadastrada");
    const [emailUsado] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, dados.email));
    if (emailUsado) throw conflito("email_duplicado", "E-mail já cadastrado");

    const conta = await deps.auth.criarConta(dados.email, dados.senha_inicial);
    try {
      await deps.db.insert(usuario).values({
        id: conta.id,
        nome: dados.nome,
        matricula: dados.matricula,
        email: dados.email,
        cargo: dados.cargo ?? null,
        registroProfissional: dados.registro_profissional ?? null,
        perfil: dados.perfil,
        equipeId: dados.equipe_id ?? null,
        senhaProvisoria: true,
      });
    } catch (erro) {
      await deps.auth.excluirConta(conta.id);
      throw erro;
    }
    return responder(c, { id: conta.id }, 201);
  });

  r.patch("/usuarios/:id", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    const dados = await lerCorpo(
      c,
      z.object({
        nome: textoObrigatorio.optional(),
        email: emailInstitucional.optional(),
        perfil: z.enum(PERFIS).optional(),
        equipe_id: uuid.nullable().optional(),
        cargo: textoOpcional,
        registro_profissional: textoOpcional,
        ativo: z.boolean().optional(),
      }),
    );
    const [atual] = await deps.db.select().from(usuario).where(eq(usuario.id, id));
    if (!atual) throw naoEncontrado("Usuário não encontrado");

    if (id === eu.id && (dados.ativo === false || (dados.perfil && dados.perfil !== "admin"))) {
      throw invalido("auto_alteracao", "Você não pode desativar nem rebaixar o próprio usuário");
    }
    await exigirEquipe(deps, dados.equipe_id);

    // O e-mail é o login: a conta no serviço de acesso troca junto, e volta ao anterior se o banco recusar.
    const trocaEmail = dados.email !== undefined && dados.email !== atual.email;
    if (trocaEmail) {
      const [emailUsado] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, dados.email!));
      if (emailUsado) throw conflito("email_duplicado", "E-mail já cadastrado");
      await deps.auth.atualizarEmail(id, dados.email!);
    }

    try {
      await deps.db
        .update(usuario)
        .set({
          ...(dados.nome !== undefined && { nome: dados.nome }),
          ...(dados.email !== undefined && { email: dados.email }),
          ...(dados.perfil !== undefined && { perfil: dados.perfil }),
          ...(dados.equipe_id !== undefined && { equipeId: dados.equipe_id }),
          ...(dados.cargo !== undefined && { cargo: dados.cargo }),
          ...(dados.registro_profissional !== undefined && { registroProfissional: dados.registro_profissional }),
          ...(dados.ativo !== undefined && { ativo: dados.ativo }),
        })
        .where(eq(usuario.id, id));
    } catch (erro) {
      if (trocaEmail) await deps.auth.atualizarEmail(id, atual.email).catch(() => {});
      throw erro;
    }

    // Desativar bloqueia a `api` na hora; o Supabase só é revogado depois que a fila offline pendente subir
    // (ver `POST /eventos`). Reativar desfaz uma revogação anterior.
    if (dados.ativo === true && !atual.ativo) await deps.auth.restaurar(id);
    return responder(c, {});
  });

  /**
   * Remove o usuário e a conta de acesso. Só vale para quem nunca deixou registro: quem já fez APR, execução, assinatura,
   * evento ou recebeu alerta (ou supervisiona uma equipe) está amarrado ao histórico, e o banco recusa; nesse caso a saída
   * é desativar.
   */
  r.delete("/usuarios/:id", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    if (id === eu.id) throw invalido("auto_alteracao", "Você não pode remover o próprio usuário");
    const [alvo] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.id, id));
    if (!alvo) throw naoEncontrado("Usuário não encontrado");

    try {
      await deps.db.delete(usuario).where(eq(usuario.id, id));
    } catch (erro) {
      if (codigoPostgres(erro) === "23503") {
        throw conflito("usuario_com_historico", "Este usuário tem histórico (APR, execução, assinatura, alerta ou equipe sob sua supervisão) e não pode ser removido. Desative-o.");
      }
      throw erro;
    }
    await deps.auth.excluirConta(id);
    return responder(c, {});
  });

  r.post("/usuarios/:id/redefinir-senha", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const [u] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.id, id));
    if (!u) throw naoEncontrado("Usuário não encontrado");
    const senha = gerarSenhaInicial();
    await deps.auth.definirSenha(id, senha);
    await deps.db.update(usuario).set({ senhaProvisoria: true }).where(eq(usuario.id, id));
    return responder(c, { senhaInicial: senha });
  });

  /**
   * Admin vê tudo. Os demais perfis só precisam dos colegas (lista de participantes da APR): ficam só os ativos, da
   * própria equipe quando o perfil é de equipe, e sem e-mail. `busca` procura no nome, matrícula, cargo, e-mail e CREA
   * (ver `dominio/busca.ts`); o e-mail serve de busca para todos, mas só o admin o recebe.
   */
  r.get("/usuarios", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({ equipe_id: uuid.optional(), perfil: z.enum(PERFIS).optional(), ativo: booleanoDaConsulta, busca: z.string().trim().min(1).optional() }),
    );
    const admin = eu.perfil === "admin";

    const condicoes: (SQL | undefined)[] = [
      usuariosVisiveis(eu),
      // Quem só enxerga a própria equipe não amplia o escopo pelo filtro.
      equipeDoEscopo(eu) === null && filtros.equipe_id ? eq(usuario.equipeId, filtros.equipe_id) : undefined,
      filtros.perfil ? eq(usuario.perfil, filtros.perfil) : undefined,
      filtros.busca ? buscaDeUsuarios(filtros.busca) : undefined,
      admin && filtros.ativo !== undefined ? eq(usuario.ativo, filtros.ativo) : undefined,
    ];
    const onde = and(...condicoes);

    const { limit, offset } = limiteEDeslocamento(filtros);
    const linhas = await deps.db.select().from(usuario).where(onde).orderBy(asc(usuario.nome)).limit(limit).offset(offset);
    const total = await contar(deps.db, usuario, onde);
    return responder(c, { usuarios: linhas.map((u) => usuarioParaApi(u, { semEmail: !admin })), ...meta(filtros, total) });
  });

  /**
   * Perfil de uma pessoa: dados, equipe com os membros e as últimas OS que ela encerrou. O admin vê qualquer conta
   * (inclusive e-mail e inativas); os demais só enxergam colegas ativos do próprio escopo, como na listagem, e recebem
   * `404` para o resto.
   */
  r.get("/usuarios/:id", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const id = lerId(c);
    const admin = eu.perfil === "admin";
    const [alvo] = await deps.db.select().from(usuario).where(eq(usuario.id, id));
    if (!alvo) throw naoEncontrado("Usuário não encontrado");
    if (!admin) {
      const escopo = equipeDoEscopo(eu);
      const semEquipe = escopo === null && eu.equipeId === null && (eu.perfil === "tecnico" || eu.perfil === "supervisor");
      if (!alvo.ativo || semEquipe || (escopo !== null && alvo.equipeId !== escopo)) throw naoEncontrado("Usuário não encontrado");
    }

    const [dadosDaEquipe] = alvo.equipeId ? await deps.db.select().from(equipe).where(eq(equipe.id, alvo.equipeId)) : [];
    const [supervisor] = dadosDaEquipe?.supervisorId
      ? await deps.db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(eq(usuario.id, dadosDaEquipe.supervisorId))
      : [];
    const membros = alvo.equipeId
      ? await deps.db
          .select({ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, cargo: usuario.cargo, perfil: usuario.perfil })
          .from(usuario)
          .where(and(eq(usuario.equipeId, alvo.equipeId), eq(usuario.ativo, true)))
          .orderBy(asc(usuario.nome))
      : [];

    const doAlvo = eq(execucao.executorId, alvo.id);
    const [totais] = await deps.db
      .select({
        encerradas: sql<number>`count(*) filter (where ${execucao.resultado} = 'encerrada')::int`,
        emAndamento: sql<number>`count(*) filter (where ${execucao.resultado} is null)::int`,
        ultimaEm: sql<Date | null>`max(${execucao.fim}) filter (where ${execucao.resultado} = 'encerrada')`,
      })
      .from(execucao)
      .where(doAlvo);
    const linhas = await deps.db
      .select({
        id: execucao.id,
        osId: execucao.osId,
        numeroOrdem: os.numeroOrdem,
        titulo: os.titulo,
        localCodigo: localInstalacao.codigo,
        inicio: execucao.inicio,
        fim: execucao.fim,
        pdfPath: os.pdfPath,
      })
      .from(execucao)
      .innerJoin(os, eq(os.id, execucao.osId))
      .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
      .where(and(doAlvo, eq(execucao.resultado, "encerrada")))
      .orderBy(desc(execucao.fim), desc(execucao.id))
      .limit(ULTIMAS_OS_DO_PERFIL);
    const pausas = linhas.length ? await deps.db.select().from(execucaoPausa).where(inArray(execucaoPausa.execucaoId, linhas.map((l) => l.id))) : [];
    const execucoes = linhas.map(({ pdfPath, ...l }) => {
      const tempo = tempoDaExecucao(l, pausas.filter((p) => p.execucaoId === l.id));
      return { ...l, tempoLiquidoMin: tempo ? emMinutos(tempo.liquidoMs) : null, pdfPronto: pdfPath !== null };
    });

    return responder(c, {
      usuario: usuarioParaApi(alvo, { semEmail: !admin }),
      equipe: dadosDaEquipe ? equipeParaApi(dadosDaEquipe) : null,
      supervisor: supervisor ?? null,
      membros,
      resumo: { osEncerradas: totais?.encerradas ?? 0, emAndamento: totais?.emAndamento ?? 0, ultimaEncerradaEm: totais?.ultimaEm ?? null },
      execucoes,
    });
  });

  return r;
}

/** Quantas OS encerradas aparecem no perfil. */
const ULTIMAS_OS_DO_PERFIL = 10;
