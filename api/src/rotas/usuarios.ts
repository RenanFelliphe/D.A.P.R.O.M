import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db/conexao";
import type { Deps } from "../deps";
import { equipe, execucao, execucaoPausa, LIBERACOES, localInstalacao, os, PERFIS, usuario } from "../db/schema";
import { diferencas, registrarAuditoria } from "../dominio/auditoria";
import { buscaDeUsuarios, usuariosVisiveis } from "../dominio/busca";
import { apagarGamificacaoDaPessoa } from "../dominio/lancamentos";
import { emMinutos, tempoDaExecucao } from "../dominio/painel-comum";
import { equipeParaApi, gerarSenhaInicial, nomesDosCriadores, usuarioParaApi } from "../dominio/usuarios";
import { ehSupervisor, equipesDoEscopo, type Autenticacao, type Ambiente, type UsuarioAutenticado } from "../http/autenticacao";
import { codigoPostgres, conflito, invalido, naoEncontrado, proibido } from "../http/erros";
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

/** O supervisor só mexe no usuário que ele mesmo cadastrou e que ainda aguarda a liberação. */
const pendenteDoSupervisor = (eu: UsuarioAutenticado, alvo: { liberacao: string; criadoPorId: string | null }) =>
  alvo.liberacao === "pendente" && alvo.criadoPorId === eu.id;

/**
 * Cadastro de usuários (admin; o supervisor cadastra técnicos das suas equipes, que nascem pendentes até um admin
 * liberar) e a listagem de colegas de equipe (todos os perfis). O primeiro CRUD: os demais seguem esta convenção. */
export function rotasUsuarios(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  r.post("/usuarios", autenticar(), exigirPerfil("admin", "supervisor"), async (c) => {
    const eu = c.get("usuario");
    const admin = eu.perfil === "admin";
    const dados = await lerCorpo(
      c,
      z.object({
        nome: textoObrigatorio,
        matricula,
        email: emailInstitucional,
        perfil: z.enum(PERFIS).optional(),
        equipe_id: uuid.nullable().optional(),
        cargo: textoOpcional,
        registro_profissional: textoOpcional,
        senha_inicial: senhaNova,
      }),
    );
    if (admin && !dados.perfil) throw invalido("validacao", "Informe o perfil");
    if (!admin) {
      // Supervisor: só técnico, só numa equipe que ele supervisiona; a conta nasce pendente.
      if (dados.perfil && dados.perfil !== "tecnico") throw proibido("O supervisor só cadastra técnicos");
      if (!dados.equipe_id) throw invalido("equipe_obrigatoria", "Informe a equipe do técnico");
      if (!eu.equipesSupervisionadas.includes(dados.equipe_id)) throw proibido("Você só cadastra técnicos nas equipes que supervisiona");
    }
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
        perfil: admin ? dados.perfil! : "tecnico",
        equipeId: dados.equipe_id ?? null,
        senhaProvisoria: true,
        liberacao: admin ? "liberado" : "pendente",
        criadoPorId: eu.id,
        criadoEm: new Date(deps.agora()),
      });
    } catch (erro) {
      await deps.auth.excluirConta(conta.id);
      throw erro;
    }
    await registrarAuditoria(deps.db, eu, {
      entidade: "usuario",
      verbo: "criar",
      entidadeId: conta.id,
      alvo: dados.nome,
      resumo: admin ? `Cadastrou o usuário ${dados.nome} (${dados.perfil})` : `Cadastrou o técnico ${dados.nome}, que aguarda a liberação`,
      detalhes: { matricula: dados.matricula, perfil: admin ? dados.perfil : "tecnico", equipe_id: dados.equipe_id ?? null },
    });
    return responder(c, { id: conta.id }, 201);
  });

  r.patch("/usuarios/:id", autenticar(), exigirPerfil("admin", "supervisor"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    const admin = eu.perfil === "admin";
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

    if (!admin) {
      // Supervisor: só nome, cargo e registro profissional do pendente que ele cadastrou.
      if (!pendenteDoSupervisor(eu, atual)) throw proibido("Você só edita o técnico que cadastrou e que ainda aguarda a liberação");
      if (dados.email !== undefined || dados.perfil !== undefined || dados.equipe_id !== undefined || dados.ativo !== undefined) {
        throw proibido("O supervisor só altera nome, cargo e registro profissional");
      }
    } else if (dados.ativo !== undefined && atual.liberacao !== "liberado") {
      throw conflito("usuario_nao_liberado", "Libere ou recuse o acesso (POST /usuarios/{id}/liberar ou /recusar) em vez de ativar ou desativar");
    }

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

    const mudancas = diferencas(
      { nome: atual.nome, email: atual.email, perfil: atual.perfil, equipe_id: atual.equipeId, cargo: atual.cargo, registro_profissional: atual.registroProfissional, ativo: atual.ativo },
      { nome: dados.nome, email: dados.email, perfil: dados.perfil, equipe_id: dados.equipe_id, cargo: dados.cargo, registro_profissional: dados.registro_profissional, ativo: dados.ativo },
    );
    if (Object.keys(mudancas).length > 0) {
      const soAtivo = Object.keys(mudancas).length === 1 && "ativo" in mudancas;
      await registrarAuditoria(deps.db, eu, {
        entidade: "usuario",
        verbo: soAtivo ? (dados.ativo ? "reativar" : "desativar") : "editar",
        entidadeId: id,
        alvo: dados.nome ?? atual.nome,
        resumo: soAtivo ? `${dados.ativo ? "Reativou" : "Desativou"} o usuário ${atual.nome}` : `Editou o usuário ${atual.nome} (${Object.keys(mudancas).join(", ")})`,
        detalhes: mudancas,
      });
    }
    return responder(c, {});
  });

  /**
   * Remove o usuário e a conta de acesso (o supervisor, só o cadastro pendente que ele fez). Só vale para quem nunca deixou registro: quem já fez APR, execução, assinatura,
   * evento ou recebeu alerta (ou supervisiona uma equipe) está amarrado ao histórico, e o banco recusa; nesse caso a saída
   * é desativar.
   */
  r.delete("/usuarios/:id", autenticar(), exigirPerfil("admin", "supervisor"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    if (id === eu.id) throw invalido("auto_alteracao", "Você não pode remover o próprio usuário");
    const [alvo] = await deps.db.select({ id: usuario.id, nome: usuario.nome, liberacao: usuario.liberacao, criadoPorId: usuario.criadoPorId }).from(usuario).where(eq(usuario.id, id));
    if (!alvo) throw naoEncontrado("Usuário não encontrado");
    // Supervisor só cancela o cadastro que ele fez e que ainda aguarda a liberação; o admin remove qualquer um (inclusive o recusado, o que libera e-mail e matrícula).
    if (eu.perfil !== "admin" && !pendenteDoSupervisor(eu, alvo)) throw proibido("Você só cancela o cadastro do técnico que criou e que ainda aguarda a liberação");

    try {
      // Os pontos e as conquistas (a assinatura e o treino pontuam já no cadastro) somem com a pessoa; o histórico de campo a protege.
      await deps.db.transaction(async (tx) => {
        await apagarGamificacaoDaPessoa(tx as unknown as Db, id);
        await tx.delete(usuario).where(eq(usuario.id, id));
      });
    } catch (erro) {
      if (codigoPostgres(erro) === "23503") {
        throw conflito("usuario_com_historico", "Este usuário tem histórico (APR, execução, assinatura, alerta ou equipe sob sua supervisão) e não pode ser removido. Desative-o.");
      }
      throw erro;
    }
    await deps.auth.excluirConta(id);
    await registrarAuditoria(deps.db, eu, { entidade: "usuario", verbo: "excluir", entidadeId: id, alvo: alvo.nome, resumo: `Removeu o usuário ${alvo.nome}` });
    return responder(c, {});
  });

  /** Só quem está `pendente` é liberado ou recusado: o `update` já filtra, e é 409 se o usuário existe em outro estado. */
  async function decidirPendente(id: string, valores: Partial<typeof usuario.$inferInsert>) {
    const [u] = await deps.db.update(usuario).set(valores).where(and(eq(usuario.id, id), eq(usuario.liberacao, "pendente"))).returning({ id: usuario.id, nome: usuario.nome });
    if (u) return u.nome;
    const [existe] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.id, id));
    if (!existe) throw naoEncontrado("Usuário não encontrado");
    throw conflito("nao_pendente", "Este usuário não está aguardando liberação");
  }

  r.post("/usuarios/:id/liberar", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    const nome = await decidirPendente(id, { liberacao: "liberado", liberadoPorId: eu.id, liberadoEm: deps.agora() });
    await registrarAuditoria(deps.db, eu, { entidade: "usuario", verbo: "liberar", entidadeId: id, alvo: nome, resumo: `Liberou o acesso de ${nome}` });
    return responder(c, {});
  });

  r.post("/usuarios/:id/recusar", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const { motivo } = await lerCorpo(c, z.object({ motivo: textoObrigatorio }));
    const nome = await decidirPendente(id, { liberacao: "recusado", ativo: false, recusaMotivo: motivo });
    await deps.auth.revogar(id);
    await registrarAuditoria(deps.db, c.get("usuario"), { entidade: "usuario", verbo: "recusar", entidadeId: id, alvo: nome, resumo: `Recusou o acesso de ${nome}`, detalhes: { motivo } });
    return responder(c, {});
  });

  r.post("/usuarios/:id/redefinir-senha", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const [u] = await deps.db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(eq(usuario.id, id));
    if (!u) throw naoEncontrado("Usuário não encontrado");
    const senha = gerarSenhaInicial();
    await deps.auth.definirSenha(id, senha);
    await deps.db.update(usuario).set({ senhaProvisoria: true }).where(eq(usuario.id, id));
    await registrarAuditoria(deps.db, c.get("usuario"), { entidade: "usuario", verbo: "redefinir_senha", entidadeId: id, alvo: u.nome, resumo: `Redefiniu a senha de ${u.nome}` });
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
      esquemaPaginacao.extend({ equipe_id: uuid.optional(), perfil: z.enum(PERFIS).optional(), ativo: booleanoDaConsulta, supervisor: booleanoDaConsulta, liberacao: z.enum(LIBERACOES).optional(), minha_supervisao: booleanoDaConsulta, busca: z.string().trim().min(1).optional() }),
    );
    const admin = eu.perfil === "admin";

    // Quem não é admin só vê pendentes e recusados das equipes que supervisiona, e só quando pede (a lista comum é a de colegas liberados).
    // `minha_supervisao=true` (tela "Minha equipe"): todos os cadastros das equipes que o supervisor supervisiona, em qualquer situação de liberação (menos o próprio dele, e os liberados só se ativos); `liberacao` filtra dentro disso.
    const minhaSupervisao = !admin && filtros.minha_supervisao === true;
    const naoLiberados = !admin && !minhaSupervisao && filtros.liberacao !== undefined && filtros.liberacao !== "liberado";
    const daSupervisao = and(
      eu.equipesSupervisionadas.length ? inArray(usuario.equipeId, eu.equipesSupervisionadas) : sql`false`,
      ne(usuario.id, eu.id),
      or(and(eq(usuario.liberacao, "liberado"), eq(usuario.ativo, true)), ne(usuario.liberacao, "liberado")),
    );
    const doSupervisor = and(
      eq(usuario.liberacao, filtros.liberacao ?? "pendente"),
      eu.equipesSupervisionadas.length ? inArray(usuario.equipeId, eu.equipesSupervisionadas) : sql`false`,
    );

    const condicoes: (SQL | undefined)[] = [
      minhaSupervisao ? daSupervisao : naoLiberados ? doSupervisor : usuariosVisiveis(eu),
      (admin || minhaSupervisao) && filtros.liberacao ? eq(usuario.liberacao, filtros.liberacao) : undefined,
      // Quem não vê todas as equipes só filtra entre as do próprio escopo; outra equipe é ignorada (não amplia o escopo).
      filtros.equipe_id && (naoLiberados || minhaSupervisao || (equipesDoEscopo(eu)?.includes(filtros.equipe_id) ?? true)) ? eq(usuario.equipeId, filtros.equipe_id) : undefined,
      filtros.perfil ? eq(usuario.perfil, filtros.perfil) : undefined,
      // `supervisor=true`: quem supervisiona alguma equipe; `false`: quem não supervisiona nenhuma.
      filtros.supervisor === undefined ? undefined : filtros.supervisor ? sql`exists (select 1 from ${equipe} where ${equipe.supervisorId} = ${usuario.id})` : sql`not exists (select 1 from ${equipe} where ${equipe.supervisorId} = ${usuario.id})`,
      filtros.busca ? buscaDeUsuarios(filtros.busca) : undefined,
      admin && filtros.ativo !== undefined ? eq(usuario.ativo, filtros.ativo) : undefined,
    ];
    const onde = and(...condicoes);

    const { limit, offset } = limiteEDeslocamento(filtros);
    const linhas = await deps.db.select().from(usuario).where(onde).orderBy(asc(usuario.nome)).limit(limit).offset(offset);
    const total = await contar(deps.db, usuario, onde);
    const criadores = await nomesDosCriadores(deps.db, linhas);
    return responder(c, {
      usuarios: linhas.map((u) => usuarioParaApi(u, { semEmail: !admin, criadoPorNome: (u.criadoPorId && criadores.get(u.criadoPorId)) || null })),
      ...meta(filtros, total),
    });
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
    // O supervisor também vê os pendentes e recusados das equipes que supervisiona.
    const naoLiberadoDoSupervisor = !admin && alvo.liberacao !== "liberado" && alvo.equipeId !== null && eu.equipesSupervisionadas.includes(alvo.equipeId);
    if (!admin && !naoLiberadoDoSupervisor) {
      const escopo = equipesDoEscopo(eu);
      if (!alvo.ativo || alvo.liberacao !== "liberado" || (escopo !== null && (alvo.equipeId === null || !escopo.includes(alvo.equipeId)))) throw naoEncontrado("Usuário não encontrado");
    }

    const [dadosDaEquipe] = alvo.equipeId ? await deps.db.select().from(equipe).where(eq(equipe.id, alvo.equipeId)) : [];
    const [supervisor] = dadosDaEquipe?.supervisorId
      ? await deps.db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(eq(usuario.id, dadosDaEquipe.supervisorId))
      : [];
    const membros = alvo.equipeId
      ? await deps.db
          .select({ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, cargo: usuario.cargo, perfil: usuario.perfil })
          .from(usuario)
          .where(and(eq(usuario.equipeId, alvo.equipeId), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado")))
          .orderBy(asc(usuario.nome))
      : [];

    // O que cada pessoa fez (OS encerradas e tempo) é de quem acompanha a equipe, do admin e dela mesma: um técnico comum não
    // vê o desempenho de um colega.
    const verTrabalho = admin || alvo.id === eu.id || ehSupervisor(eu);
    const doAlvo = eq(execucao.executorId, alvo.id);
    const [totais] = !verTrabalho ? [undefined] : await deps.db
      .select({
        encerradas: sql<number>`count(*) filter (where ${execucao.resultado} = 'encerrada')::int`,
        emAndamento: sql<number>`count(*) filter (where ${execucao.resultado} is null)::int`,
        ultimaEm: sql<Date | null>`max(${execucao.fim}) filter (where ${execucao.resultado} = 'encerrada')`,
      })
      .from(execucao)
      .where(doAlvo);
    const linhas = !verTrabalho ? [] : await deps.db
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
      usuario: usuarioParaApi(alvo, { semEmail: !admin, criadoPorNome: (alvo.criadoPorId && (await nomesDosCriadores(deps.db, [alvo])).get(alvo.criadoPorId)) || null }),
      equipe: dadosDaEquipe ? equipeParaApi(dadosDaEquipe) : null,
      supervisor: supervisor ?? null,
      membros,
      resumo: verTrabalho ? { osEncerradas: totais?.encerradas ?? 0, emAndamento: totais?.emAndamento ?? 0, ultimaEncerradaEm: totais?.ultimaEm ?? null } : null,
      execucoes,
    });
  });

  return r;
}

/** Quantas OS encerradas aparecem no perfil. */
const ULTIMAS_OS_DO_PERFIL = 10;
