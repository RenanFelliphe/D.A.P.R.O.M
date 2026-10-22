import { and, asc, desc, eq, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Db } from "../db/conexao";
import type { Deps } from "../deps";
import { equipe, execucao, execucaoPausa, LIBERACOES, localInstalacao, os, PERFIS, usuario } from "../db/schema";
import { ausenciaDaPessoaParaApi, ausentesEm } from "../dominio/ausencia";
import { diferencas, registrarAuditoria } from "../dominio/auditoria";
import { buscaDeUsuarios, usuariosVisiveis } from "../dominio/busca";
import { apagarGamificacaoDaPessoa } from "../dominio/lancamentos";
import { aplicarConferencia, conferirParaCadastro, consultarFuncionario, exigirSetorSupervisionado } from "../dominio/rh";
import { emMinutos, tempoDaExecucao } from "../dominio/painel-comum";
import { diaDe } from "../dominio/tempo";
import { equipeParaApi, gerarSenhaInicial, nomesDosCriadores, usuarioParaApi } from "../dominio/usuarios";
import { ehSupervisor, equipesDoEscopo, type Autenticacao, type Ambiente, type UsuarioAutenticado } from "../http/autenticacao";
import { codigoPostgres, conflito, invalido, naoEncontrado, proibido } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, emailInstitucional, lerConsulta, lerCorpo, lerId, textoObrigatorio, uuid } from "../http/validacao";
import { assinaturaDoAto } from "../dominio/assinatura";
import { apagarAvisosDaConta, avisarAdmins, criarAviso, resolverAvisos } from "../dominio/alertas";
import { atenderSolicitacao } from "../dominio/solicitacao-conta";
import { atualizarSupervisaoDasEquipes } from "../dominio/representacao";
import { avisarMembroDesativado } from "../dominio/rh";
import { senhaNova } from "./auth";
import { exigirAssinaturaJuridica } from "../dominio/assinatura-juridica";

/** Identificação definitiva da pessoa na empresa; não é o login (o login é o e-mail institucional). */
const matricula = z.string().trim().min(1).max(40);

async function exigirEquipe(deps: Deps, equipeId: string | null | undefined) {
  if (!equipeId) return;
  const [e] = await deps.db.select({ id: equipe.id }).from(equipe).where(eq(equipe.id, equipeId));
  if (!e) throw invalido("equipe_inexistente", "Equipe não encontrada");
}

/** O supervisor só mexe no usuário que ele mesmo cadastrou e que ainda aguarda a liberação. */
const pendenteDoSupervisor = (eu: UsuarioAutenticado, alvo: { liberacao: string; criadoPorId: string | null }) =>
  alvo.liberacao === "pendente" && alvo.criadoPorId === eu.id;

/**
 * Cadastro de usuários a partir do registro de funcionários (admin; o supervisor cadastra técnicos das suas equipes, que
 * nascem pendentes até um admin liberar) e a listagem de colegas de equipe (todos os perfis). O primeiro CRUD: os demais seguem
 * esta convenção. */
export function rotasUsuarios(deps: Deps, { autenticar, exigirPerfil }: Autenticacao) {
  const r = new Hono<Ambiente>();

  /**
   * Cadastra quem já está no registro de funcionários (`docs/pessoas-e-equipes.md`, seção 2.3). O corpo traz só a matrícula, o e-mail, o perfil
   * e a equipe (o admin) e a senha inicial: nome, cargo e registro profissional vêm do registro, que a `api` consulta de novo aqui
   * (não confia na prévia de `GET /rh/funcionarios/{matricula}`). Recusa matrícula fora do registro, e-mail que não é o dela e
   * funcionário afastado ou desligado. O supervisor cadastra só técnicos de um setor cuja equipe ele supervisiona, na equipe do setor.
   */
  r.post("/usuarios", autenticar(), exigirPerfil("admin", "supervisor"), async (c) => {
    const eu = c.get("usuario");
    const admin = eu.perfil === "admin";
    const dados = await lerCorpo(
      c,
      z.object({
        matricula,
        email: emailInstitucional,
        perfil: z.enum(PERFIS).optional(),
        equipe_id: uuid.nullable().optional(),
        senha_inicial: senhaNova,
      }),
    );
    if (admin && !dados.perfil) throw invalido("validacao", "Informe o perfil");
    if (!admin && dados.perfil && dados.perfil !== "tecnico") throw proibido("O supervisor só cadastra técnicos");
    // Equipe informada que não existe é erro de quem pediu, antes de consultar o registro.
    if (admin) await exigirEquipe(deps, dados.equipe_id);

    const { funcionario, equipeSugerida } = await conferirParaCadastro(deps, dados.matricula, dados.email);
    // Supervisor: a equipe é a do setor do funcionário, e o setor tem de ser de uma equipe que ele supervisiona.
    if (!admin) exigirSetorSupervisionado(eu, funcionario, equipeSugerida);
    // Admin: sem `equipe_id` no corpo vale a equipe do setor; `null` cadastra sem equipe.
    const equipeId = admin ? (dados.equipe_id !== undefined ? dados.equipe_id : (equipeSugerida?.id ?? null)) : equipeSugerida!.id;

    const [existente] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(sql`lower(${usuario.matricula})`, funcionario.matricula.toLowerCase()));
    if (existente) throw conflito("matricula_duplicada", "Matrícula já cadastrada");
    const email = funcionario.email.trim().toLowerCase();
    const [emailUsado] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, email));
    if (emailUsado) throw conflito("email_duplicado", "E-mail já cadastrado");

    const nome = funcionario.nome.trim();
    const agora = deps.agora();
    const conta = await deps.auth.criarConta(email, dados.senha_inicial);
    try {
      await deps.db.insert(usuario).values({
        id: conta.id,
        nome,
        matricula: funcionario.matricula,
        email,
        cargo: funcionario.cargo.trim() || null,
        registroProfissional: funcionario.registro_profissional?.trim() || null,
        perfil: admin ? dados.perfil! : "tecnico",
        equipeId,
        senhaProvisoria: true,
        liberacao: admin ? "liberado" : "pendente",
        criadoPorId: eu.id,
        criadoEm: new Date(agora),
        situacaoRegistro: "ativo",
        registroConferidoEm: agora,
      });
    } catch (erro) {
      await deps.auth.excluirConta(conta.id);
      throw erro;
    }
    await registrarAuditoria(deps.db, eu, {
      entidade: "usuario",
      verbo: "criar",
      entidadeId: conta.id,
      alvo: nome,
      resumo: admin ? `Cadastrou o usuário ${nome} (${dados.perfil})` : `Cadastrou o técnico ${nome}, que aguarda a liberação`,
      detalhes: { matricula: funcionario.matricula, perfil: admin ? dados.perfil : "tecnico", equipe_id: equipeId },
    });
    // O pedido de conta que a pessoa fez na tela de entrada fica atendido.
    await atenderSolicitacao(deps.db, email, conta.id, eu.id, agora);
    // A equipe que ainda não tinha quem represente o supervisor ganha o primeiro técnico liberado (e, se está sem supervisor, ele assume).
    await atualizarSupervisaoDasEquipes(deps.db, agora);
    // A pessoa fica sabendo da conta (a senha provisória vem de quem a cadastrou); o cadastro do supervisor espera um admin liberar.
    await criarAviso(deps.db, [conta.id], {
      tipo: "conta_criada",
      usuarioAlvoId: conta.id,
      detalhe: `${eu.nome} criou a sua conta no SYNQ OS. Entre com o seu e-mail institucional (${email}) e a senha provisória que ${eu.nome} vai lhe passar; no primeiro acesso, você define a sua.${admin ? "" : " Até um administrador liberar o seu acesso, você pode fazer o Campo de treino."}`,
      agora,
    });
    if (!admin) {
      await avisarAdmins(deps.db, {
        tipo: "cadastro_pendente",
        usuarioAlvoId: conta.id,
        detalhe: `${eu.nome} cadastrou o técnico ${nome} (matrícula ${funcionario.matricula})${equipeSugerida ? ` na equipe ${equipeSugerida.nome}` : ""}. O acesso aguarda a liberação de um administrador.`,
        agora,
      });
    }
    return responder(c, { id: conta.id }, 201);
  });

  /**
   * O admin altera só o perfil, a equipe e se a conta está ativa: nome, e-mail, cargo e registro profissional vêm do registro de
   * funcionários (`POST /usuarios/{id}/atualizar-do-registro`). Reativar (`ativo: true`) consulta o registro: desligado ou fora dele é
   * `409 funcionario_desligado`, e afastado, `409 funcionario_afastado`. O supervisor não edita ninguém (só cancela o cadastro pendente).
   */
  r.patch("/usuarios/:id", autenticar(), exigirPerfil("admin", "supervisor"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    if (eu.perfil !== "admin") throw proibido("O supervisor não edita o cadastro: nome, cargo e registro vêm do registro de funcionários. Ele só cancela o cadastro pendente que fez");
    const dados = await lerCorpo(
      c,
      z
        .object({
          perfil: z.enum(PERFIS).optional(),
          equipe_id: uuid.nullable().optional(),
          ativo: z.boolean().optional(),
        })
        .strict(),
    );
    const [atual] = await deps.db.select().from(usuario).where(eq(usuario.id, id));
    if (!atual) throw naoEncontrado("Usuário não encontrado");

    if (dados.ativo !== undefined && atual.liberacao !== "liberado") {
      throw conflito("usuario_nao_liberado", "Libere ou recuse o acesso (POST /usuarios/{id}/liberar ou /recusar) em vez de ativar ou desativar");
    }
    if (id === eu.id && (dados.ativo === false || (dados.perfil && dados.perfil !== "admin"))) {
      throw invalido("auto_alteracao", "Você não pode desativar nem rebaixar o próprio usuário");
    }
    await exigirEquipe(deps, dados.equipe_id);

    // Reativar só vale se o registro disser que a pessoa está ativa (quem sumiu de lá conta como desligada).
    const reativando = dados.ativo === true && !atual.ativo;
    if (reativando) {
      const funcionario = await consultarFuncionario(deps, atual.matricula);
      if (!funcionario || funcionario.situacao === "desligado") throw conflito("funcionario_desligado", "Este funcionário foi desligado no registro de funcionários e a conta não pode ser reativada");
      if (funcionario.situacao === "afastado") throw conflito("funcionario_afastado", "Este funcionário está afastado no registro de funcionários e a conta não pode ser reativada agora");
    }

    await deps.db
      .update(usuario)
      .set({
        ...(dados.perfil !== undefined && { perfil: dados.perfil }),
        ...(dados.equipe_id !== undefined && { equipeId: dados.equipe_id }),
        ...(dados.ativo !== undefined && { ativo: dados.ativo }),
        ...(reativando && { situacaoRegistro: "ativo" as const, registroConferidoEm: deps.agora() }),
      })
      .where(eq(usuario.id, id));

    // Quem saiu da equipe, foi desativado ou mudou de perfil não pode continuar como representante: a equipe ganha outro. O
    // supervisor desativado deixa a equipe sem supervisor (o representante assume e os administradores são avisados).
    const agora = deps.agora();
    await atualizarSupervisaoDasEquipes(deps.db, agora);

    // Desativar bloqueia a `api` na hora; o Supabase só é revogado depois que a fila offline pendente subir
    // (ver `POST /eventos`). Reativar desfaz uma revogação anterior.
    if (reativando) {
      await deps.auth.restaurar(id);
      await resolverAvisos(deps.db, { tipos: ["funcionario_readmitido"], usuarioAlvoId: id }, agora);
      await criarAviso(deps.db, [id], { tipo: "acesso_liberado", usuarioAlvoId: id, detalhe: `${eu.nome} reativou a sua conta no SYNQ OS: você já pode entrar de novo.`, agora });
    }
    if (dados.ativo === false && atual.ativo) await avisarMembroDesativado(deps.db, atual, `desativada por ${eu.nome}`, agora);

    const mudancas = diferencas(
      { perfil: atual.perfil, equipe_id: atual.equipeId, ativo: atual.ativo },
      { perfil: dados.perfil, equipe_id: dados.equipe_id, ativo: dados.ativo },
    );
    if (Object.keys(mudancas).length > 0) {
      const soAtivo = Object.keys(mudancas).length === 1 && "ativo" in mudancas;
      await registrarAuditoria(deps.db, eu, {
        entidade: "usuario",
        verbo: soAtivo ? (dados.ativo ? "reativar" : "desativar") : "editar",
        entidadeId: id,
        alvo: atual.nome,
        resumo: soAtivo ? `${dados.ativo ? "Reativou" : "Desativou"} o usuário ${atual.nome}` : `Editou o usuário ${atual.nome} (${Object.keys(mudancas).join(", ")})`,
        detalhes: mudancas,
      });
    }
    return responder(c, {});
  });

  /**
   * "Atualizar do registro" (só admin): copia do registro de funcionários o nome, o e-mail (que é o login), o cargo e o registro
   * profissional, e grava a situação. Se o registro diz que a pessoa foi desligada, a conta é desativada (exceto o último admin
   * ativo, que fica para uma pessoa decidir).
   */
  r.post("/usuarios/:id/atualizar-do-registro", autenticar(), exigirPerfil("admin"), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    const [alvo] = await deps.db.select().from(usuario).where(eq(usuario.id, id));
    if (!alvo) throw naoEncontrado("Usuário não encontrado");
    const funcionario = await consultarFuncionario(deps, alvo.matricula);
    const resultado = await aplicarConferencia(deps, alvo, funcionario, eu);
    return responder(c, { situacaoRegistro: resultado.situacao, atualizado: resultado.atualizado, desativado: resultado.desativado, recusado: resultado.recusado, readmitido: resultado.readmitido });
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
      // Os pontos e as conquistas (a assinatura e o treino pontuam já no cadastro) somem com a pessoa, como os avisos da conta
      // (conta criada, cadastro aguardando liberação); o histórico de campo a protege.
      await deps.db.transaction(async (tx) => {
        await apagarGamificacaoDaPessoa(tx as unknown as Db, id);
        await apagarAvisosDaConta(tx as unknown as Db, id);
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
    const [u] = await deps.db
      .update(usuario)
      .set(valores)
      .where(and(eq(usuario.id, id), eq(usuario.liberacao, "pendente")))
      .returning({ id: usuario.id, nome: usuario.nome, criadoPorId: usuario.criadoPorId });
    if (u) return u;
    const [existe] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(usuario.id, id));
    if (!existe) throw naoEncontrado("Usuário não encontrado");
    throw conflito("nao_pendente", "Este usuário não está aguardando liberação");
  }

  r.post("/usuarios/:id/liberar", autenticar(), exigirPerfil("admin"), exigirAssinaturaJuridica(deps), async (c) => {
    const id = lerId(c);
    const eu = c.get("usuario");
    const agora = deps.agora();
    const { nome, criadoPorId } = await decidirPendente(id, { liberacao: "liberado", liberadoPorId: eu.id, liberadoEm: agora, liberacaoAssinaturaPath: assinaturaDoAto(eu) });
    await atualizarSupervisaoDasEquipes(deps.db, agora);
    await resolverAvisos(deps.db, { tipos: ["cadastro_pendente"], usuarioAlvoId: id }, agora);
    await criarAviso(deps.db, [id], { tipo: "acesso_liberado", usuarioAlvoId: id, detalhe: `${eu.nome} liberou o seu acesso ao SYNQ OS. No próximo acesso, cadastre a sua assinatura: é a primeira coisa que o sistema pede.`, agora });
    if (criadoPorId && criadoPorId !== eu.id) {
      await criarAviso(deps.db, [criadoPorId], { tipo: "cadastro_liberado", usuarioAlvoId: id, detalhe: `${eu.nome} liberou o acesso de ${nome}, que você cadastrou.`, agora });
    }
    await registrarAuditoria(deps.db, eu, { entidade: "usuario", verbo: "liberar", entidadeId: id, alvo: nome, resumo: `Liberou o acesso de ${nome}` });
    return responder(c, {});
  });

  r.post("/usuarios/:id/recusar", autenticar(), exigirPerfil("admin"), exigirAssinaturaJuridica(deps), async (c) => {
    const id = lerId(c);
    const { motivo } = await lerCorpo(c, z.object({ motivo: textoObrigatorio }));
    const eu = c.get("usuario");
    const agora = deps.agora();
    const { nome, criadoPorId } = await decidirPendente(id, { liberacao: "recusado", ativo: false, recusaMotivo: motivo, liberacaoAssinaturaPath: assinaturaDoAto(eu) });
    await deps.auth.revogar(id);
    await resolverAvisos(deps.db, { tipos: ["cadastro_pendente"], usuarioAlvoId: id }, agora);
    await criarAviso(deps.db, [id], { tipo: "acesso_recusado", usuarioAlvoId: id, detalhe: `O seu acesso ao SYNQ OS foi recusado por ${eu.nome}. Motivo: ${motivo}`, agora });
    if (criadoPorId && criadoPorId !== eu.id) {
      await criarAviso(deps.db, [criadoPorId], { tipo: "cadastro_recusado", usuarioAlvoId: id, detalhe: `${eu.nome} recusou o acesso de ${nome}, que você cadastrou. Motivo: ${motivo}`, agora });
    }
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
    const eu = c.get("usuario");
    // A pessoa fica sabendo (a senha nunca vai no aviso): se ela não pediu, é com o administrador que fala.
    if (id !== eu.id) {
      await criarAviso(deps.db, [id], {
        tipo: "senha_redefinida",
        usuarioAlvoId: id,
        detalhe: `${eu.nome} redefiniu a sua senha do SYNQ OS. Peça a nova senha provisória a ${eu.nome}; no próximo acesso, você define a sua. Se você não pediu, avise o administrador.`,
        agora: deps.agora(),
      });
    }
    await registrarAuditoria(deps.db, eu, { entidade: "usuario", verbo: "redefinir_senha", entidadeId: id, alvo: u.nome, resumo: `Redefiniu a senha de ${u.nome}` });
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
    // O selo "Ausente até DD/MM" das listas de pessoas (e de onde a APR e a reserva tiram quem não pode ser escolhido).
    const ausentes = await ausentesEm(deps.db, linhas.map((u) => u.id), diaDe(deps.agora()));
    return responder(c, {
      usuarios: linhas.map((u) => usuarioParaApi(u, { semEmail: !admin, criadoPorNome: (u.criadoPorId && criadores.get(u.criadoPorId)) || null, ausencia: ausentes.get(u.id) })),
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
    const hoje = diaDe(deps.agora());
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

    const ausentes = await ausentesEm(deps.db, [alvo.id, ...membros.map((m) => m.id)], hoje);

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
      usuario: usuarioParaApi(alvo, { semEmail: !admin, criadoPorNome: (alvo.criadoPorId && (await nomesDosCriadores(deps.db, [alvo])).get(alvo.criadoPorId)) || null, ausencia: ausentes.get(alvo.id) }),
      equipe: dadosDaEquipe ? equipeParaApi(dadosDaEquipe) : null,
      supervisor: supervisor ?? null,
      membros: membros.map((m) => ({ ...m, ausencia: ausenciaDaPessoaParaApi(ausentes.get(m.id)) })),
      resumo: verTrabalho ? { osEncerradas: totais?.encerradas ?? 0, emAndamento: totais?.emAndamento ?? 0, ultimaEncerradaEm: totais?.ultimaEm ?? null } : null,
      execucoes,
    });
  });

  return r;
}

/** Quantas OS encerradas aparecem no perfil. */
const ULTIMAS_OS_DO_PERFIL = 10;
