import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { alerta, equipe, leituraRh, os, tarefa, usuario, type SituacaoRegistro } from "../db/schema";
import type { Deps } from "../deps";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { conflito, ErroApi, invalido } from "../http/erros";
import { enfileirarTarefa } from "../servicos/fila";
import type { FuncionarioRh } from "../servicos/rh";
import { adminsAtivos, avisarAdmins, criarAviso, destinatariosDaEquipe, quemPediuOuAdmins, resolverAvisos } from "./alertas";
import { diferencas, registrarAuditoria, type Ator } from "./auditoria";
import { atualizarSupervisaoDasEquipes } from "./representacao";

/** Quem aparece na auditoria quando a mudança veio do registro de funcionários e não de uma pessoa (`ator_id` nulo). */
export const ATOR_REGISTRO: Ator = { id: null, nome: "Registro de funcionários" };

export const MOTIVO_DESLIGADO = "Desligado no registro de funcionários";

type LinhaUsuario = typeof usuario.$inferSelect;

/** Dia (AAAA-MM-DD) e hora de São Paulo (UTC−3, sem horário de verão desde 2019), o fuso que a `api` já usa. */
export function diaEHoraDeSaoPaulo(agora: Date): { dia: string; hora: number } {
  const local = new Date(agora.getTime() - 3 * 3600_000);
  return { dia: local.toISOString().slice(0, 10), hora: local.getUTCHours() };
}

/** Consulta uma matrícula no registro; fora do ar, não configurado ou fora do formato é `503 registro_indisponivel`. */
export async function consultarFuncionario(deps: Deps, matricula: string): Promise<FuncionarioRh | null> {
  try {
    return await deps.rh.obterFuncionario(matricula);
  } catch (erro) {
    console.error("Registro de funcionários indisponível:", erro instanceof Error ? erro.message : erro);
    throw new ErroApi(503, "registro_indisponivel", "O registro de funcionários está indisponível. Tente de novo em instantes.");
  }
}

/**
 * O que o cadastro de um usuário exige do registro (`apifuncionarios.md`, seção 4.2), na ordem das respostas: a matrícula existe
 * (`404`), o e-mail é o dela (`422`, sem revelar qual é o certo) e ela não está afastada nem desligada (`409`). Devolve o
 * funcionário e a equipe que o setor sugere. Registro fora do ar é `503`.
 */
export async function conferirParaCadastro(deps: Deps, matricula: string, email: string): Promise<{ funcionario: FuncionarioRh; equipeSugerida: { id: string; nome: string } | null }> {
  const funcionario = await consultarFuncionario(deps, matricula);
  if (!funcionario) throw new ErroApi(404, "funcionario_nao_encontrado", "Matrícula não encontrada no registro de funcionários");
  if (funcionario.email.trim().toLowerCase() !== email.trim().toLowerCase()) throw invalido("email_nao_confere", "O e-mail informado não confere com o da matrícula no registro de funcionários");
  if (funcionario.situacao === "afastado") throw conflito("funcionario_afastado", "Este funcionário está afastado no registro de funcionários e não pode ser cadastrado agora");
  if (funcionario.situacao === "desligado") throw conflito("funcionario_desligado", "Este funcionário foi desligado no registro de funcionários e não pode ser cadastrado");
  return { funcionario, equipeSugerida: await equipeDoSetor(deps.db, funcionario.centro_trabalho) };
}

/** O supervisor só cadastra quem é de um setor cuja equipe ele supervisiona. */
export function exigirSetorSupervisionado(eu: Pick<UsuarioAutenticado, "equipesSupervisionadas">, funcionario: FuncionarioRh, equipeSugerida: { id: string } | null): void {
  if (!equipeSugerida || !eu.equipesSupervisionadas.includes(equipeSugerida.id)) {
    throw new ErroApi(403, "fora_da_supervisao", `Este funcionário é do setor ${funcionario.setor}, que você não supervisiona`);
  }
}

/** A situação que o SYNQ OS grava: quem sumiu do registro é `fora_do_registro`. */
export const situacaoNoRegistro = (f: FuncionarioRh | null): SituacaoRegistro => f?.situacao ?? "fora_do_registro";

/** Desligado ou fora do registro: quem perde o acesso. */
const perdeAcesso = (s: SituacaoRegistro) => s === "desligado" || s === "fora_do_registro";

export interface ResultadoConferencia {
  situacao: SituacaoRegistro;
  /** Nome, e-mail, cargo ou registro profissional mudaram. */
  atualizado: boolean;
  /** A conta liberada e ativa foi desativada. */
  desativado: boolean;
  /** A conta pendente de liberação virou recusada. */
  recusado: boolean;
  /** A pessoa voltou a ficar ativa no registro (readmissão) com a conta desativada: os administradores foram avisados. */
  readmitido: boolean;
}

/**
 * Avisa a equipe (o supervisor, ou quem responde por ela) de que um membro perdeu o acesso, dizendo quantas OS ainda estão
 * reservadas para ele: a desativação não desfaz a reserva, e só o supervisor a libera. Quem chama passa a própria transação.
 */
export async function avisarMembroDesativado(db: Db, u: Pick<LinhaUsuario, "id" | "nome" | "matricula" | "equipeId">, porque: string, agora: Date): Promise<void> {
  if (!u.equipeId) return;
  const destinatarios = (await destinatariosDaEquipe(db, u.equipeId)).map((d) => d.id).filter((id) => id !== u.id);
  const [reservas] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(os)
    .where(and(eq(os.responsavelId, u.id), inArray(os.status, ["liberada", "pendente"])));
  const n = reservas?.n ?? 0;
  const reservadas = n > 0 ? ` ${n === 1 ? "Uma OS continua reservada" : `${n} OS continuam reservadas`} para essa pessoa: libere-as para a equipe.` : "";
  await criarAviso(db, destinatarios, { tipo: "membro_desativado", usuarioAlvoId: u.id, detalhe: `A conta de ${u.nome} (matrícula ${u.matricula}) foi desativada: ${porque}.${reservadas}`, agora });
}

/** Quantos administradores liberados e ativos existem, fora `exceto`. */
async function outrosAdminsAtivos(db: Db, exceto: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(usuario)
    .where(and(eq(usuario.perfil, "admin"), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado"), ne(usuario.id, exceto)));
  return r?.n ?? 0;
}

/**
 * A conferência de uma pessoa com o registro (`apifuncionarios.md`, seção 5.3); o aviso, a leitura diária e o "Atualizar do
 * registro" fazem a mesma coisa. `funcionario` é o que o registro respondeu para a matrícula do usuário, ou `null` se ela não está
 * lá. Copia os dados pessoais, grava a situação e a hora da conferência e, para quem saiu da empresa, tira o acesso:
 * conta liberada e ativa é desativada, conta pendente vira recusada. Afastado só grava a situação, e a conferência nunca
 * desativa o último administrador ativo. O automático só tira acesso: nunca reativa ninguém. Tudo entra na auditoria com `ator`.
 */
export async function aplicarConferencia(deps: Deps, u: LinhaUsuario, funcionario: FuncionarioRh | null, ator: Ator = ATOR_REGISTRO): Promise<ResultadoConferencia> {
  const db = deps.db;
  const situacao = situacaoNoRegistro(funcionario);
  const agora = deps.agora();

  // ---- dados pessoais ----
  const novos: Partial<Pick<LinhaUsuario, "nome" | "email" | "cargo" | "registroProfissional">> = {};
  let emailEmUso = false;
  if (funcionario) {
    novos.nome = funcionario.nome.trim();
    novos.cargo = funcionario.cargo.trim() || null;
    novos.registroProfissional = funcionario.registro_profissional?.trim() || null;
    const email = funcionario.email.trim().toLowerCase();
    if (email !== u.email) {
      const [usado] = await db.select({ id: usuario.id }).from(usuario).where(and(eq(usuario.email, email), ne(usuario.id, u.id)));
      if (usado) emailEmUso = true;
      else novos.email = email;
    }
  }
  const mudancas = diferencas(
    { nome: u.nome, email: u.email, cargo: u.cargo, registro_profissional: u.registroProfissional },
    { nome: novos.nome, email: novos.email, cargo: novos.cargo, registro_profissional: novos.registroProfissional },
  );
  const atualizado = Object.keys(mudancas).length > 0;

  // O e-mail é o login: a conta no serviço de acesso troca antes e volta ao anterior se o banco recusar.
  const trocaEmail = novos.email !== undefined && novos.email !== u.email;
  if (trocaEmail) await deps.auth.atualizarEmail(u.id, novos.email!);
  try {
    await db
      .update(usuario)
      .set({ ...novos, situacaoRegistro: situacao, registroConferidoEm: agora })
      .where(eq(usuario.id, u.id));
  } catch (erro) {
    if (trocaEmail) await deps.auth.atualizarEmail(u.id, u.email).catch(() => {});
    throw erro;
  }

  if (atualizado) {
    await registrarAuditoria(db, ator, {
      entidade: "usuario",
      verbo: "atualizar_do_registro",
      entidadeId: u.id,
      alvo: novos.nome ?? u.nome,
      resumo: `Atualizou do registro de funcionários os dados de ${u.nome} (${Object.keys(mudancas).join(", ")})`,
      detalhes: mudancas,
    });
  }
  if (emailEmUso) {
    await registrarAuditoria(db, ator, {
      entidade: "usuario",
      verbo: "conferencia_bloqueada",
      entidadeId: u.id,
      alvo: u.nome,
      resumo: `O e-mail de ${u.nome} no registro de funcionários já pertence a outra conta e não foi copiado`,
      detalhes: { email_no_registro: funcionario?.email },
    });
  }

  // ---- acesso ----
  let desativado = false;
  let recusado = false;
  if (perdeAcesso(situacao)) {
    const quem = situacao === "desligado" ? "desligado" : "fora do registro de funcionários";
    if (u.liberacao === "pendente") {
      const [r] = await db
        .update(usuario)
        .set({ liberacao: "recusado", ativo: false, recusaMotivo: MOTIVO_DESLIGADO })
        .where(and(eq(usuario.id, u.id), eq(usuario.liberacao, "pendente")))
        .returning({ id: usuario.id });
      if (r) {
        recusado = true;
        await deps.auth.revogar(u.id);
        await registrarAuditoria(db, ator, { entidade: "usuario", verbo: "recusar", entidadeId: u.id, alvo: u.nome, resumo: `Recusou o acesso de ${u.nome}: ${quem}`, detalhes: { motivo: MOTIVO_DESLIGADO, situacao_registro: situacao } });
      }
    } else if (u.liberacao === "liberado" && u.ativo) {
      if (u.perfil === "admin" && (await outrosAdminsAtivos(db, u.id)) === 0) {
        await registrarAuditoria(db, ator, {
          entidade: "usuario",
          verbo: "conferencia_bloqueada",
          entidadeId: u.id,
          alvo: u.nome,
          resumo: `Não desativou ${u.nome} (${quem}): é o último administrador ativo, e a decisão fica para uma pessoa`,
          detalhes: { situacao_registro: situacao },
        });
      } else {
        // Desativar bloqueia a `api` na hora; a sessão só é revogada depois que a fila offline pendente subir (`POST /eventos`).
        const [r] = await db
          .update(usuario)
          .set({ ativo: false })
          .where(and(eq(usuario.id, u.id), eq(usuario.ativo, true), eq(usuario.liberacao, "liberado")))
          .returning({ id: usuario.id });
        if (r) {
          desativado = true;
          await registrarAuditoria(db, ator, { entidade: "usuario", verbo: "desativar", entidadeId: u.id, alvo: u.nome, resumo: `Desativou o usuário ${u.nome}: ${quem}`, detalhes: { situacao_registro: situacao } });
        }
      }
    }
  }

  // Quem perdeu o acesso não pode ser o representante da equipe: a equipe ganha outro. O supervisor desligado deixa a equipe sem
  // supervisor: o representante assume e os administradores são avisados.
  if (desativado || recusado) await atualizarSupervisaoDasEquipes(db, agora);
  if (desativado) await avisarMembroDesativado(db, u, `${comoSaiu(situacao)} no registro de funcionários`, agora);
  if (recusado) {
    await resolverAvisos(db, { tipos: ["cadastro_pendente"], usuarioAlvoId: u.id }, agora);
    if (u.criadoPorId) {
      await criarAviso(db, [u.criadoPorId], {
        tipo: "cadastro_recusado",
        usuarioAlvoId: u.id,
        detalhe: `O cadastro de ${u.nome}, que você fez, foi recusado: a pessoa está ${comoSaiu(situacao)} no registro de funcionários.`,
        agora,
      });
    }
  }

  // Readmissão: o automático só tira acesso, então a conta continua desativada e os administradores decidem (reativar é um clique no aviso).
  const readmitido =
    situacao === "ativo" && (u.situacaoRegistro === "desligado" || u.situacaoRegistro === "fora_do_registro") && !u.ativo && u.liberacao === "liberado";
  if (readmitido) {
    await avisarAdmins(db, {
      tipo: "funcionario_readmitido",
      usuarioAlvoId: u.id,
      detalhe: `${novos.nome ?? u.nome} (matrícula ${u.matricula}) voltou a ficar ativo no registro de funcionários. A conta no SYNQ OS continua desativada: reative-a se a pessoa deve voltar a usar o sistema.`,
      agora,
    });
  }

  // Mudança de situação sem efeito no acesso (ex.: virou afastado) também fica registrada, para o admin saber.
  if (!desativado && !recusado && u.situacaoRegistro && u.situacaoRegistro !== situacao && !perdeAcesso(situacao)) {
    await registrarAuditoria(db, ator, {
      entidade: "usuario",
      verbo: "situacao_registro",
      entidadeId: u.id,
      alvo: u.nome,
      resumo: `${u.nome} passou de ${u.situacaoRegistro} para ${situacao} no registro de funcionários`,
      detalhes: { situacao_registro: { de: u.situacaoRegistro, para: situacao } },
    });
  }

  return { situacao, atualizado, desativado, recusado, readmitido };
}

/** "desligada" ou "fora do registro de funcionários", para as frases dos avisos. */
const comoSaiu = (s: SituacaoRegistro) => (s === "desligado" ? "desligada" : "fora do registro de funcionários");

/** Tarefa `conferencia_rh`: o registro avisou que a matrícula mudou; `referenciaId` é o id do usuário. Consulta e aplica. */
export async function manipularConferenciaRh(deps: Deps, t: { id: string; referenciaId: string | null }): Promise<void> {
  if (!t.referenciaId) return;
  const [u] = await deps.db.select().from(usuario).where(eq(usuario.id, t.referenciaId));
  if (!u) return;
  // Registro fora do ar lança: a tarefa tenta de novo depois de 1, 5, 15 e 15 minutos.
  const funcionario = await deps.rh.obterFuncionario(u.matricula);
  await aplicarConferencia(deps, u, funcionario);
}

/**
 * O aviso do registro: para cada matrícula que tem conta, enfileira uma `conferencia_rh` (se já não houver uma esperando para
 * a mesma pessoa). Matrícula sem conta é ignorada. O aviso não decide nada: só diz o que conferir. Devolve quantas enfileirou.
 */
export async function enfileirarConferencias(db: Db, matriculas: string[], agora: Date): Promise<number> {
  const minusculas = [...new Set(matriculas.map((m) => m.trim().toLowerCase()).filter(Boolean))];
  if (minusculas.length === 0) return 0;
  const contas = await db.select({ id: usuario.id }).from(usuario).where(inArray(sql`lower(${usuario.matricula})`, minusculas));
  let enfileiradas = 0;
  for (const conta of contas) {
    const [esperando] = await db
      .select({ id: tarefa.id })
      .from(tarefa)
      .where(and(eq(tarefa.tipo, "conferencia_rh"), eq(tarefa.referenciaId, conta.id), eq(tarefa.estado, "pendente")))
      .limit(1);
    if (esperando) continue;
    await enfileirarTarefa(db, "conferencia_rh", conta.id, agora);
    enfileiradas++;
  }
  return enfileiradas;
}

// ------------------------------------------------------------------------------------------------------------------
// Leitura completa (diária ou "Ler agora")
// ------------------------------------------------------------------------------------------------------------------

const TAMANHO_DA_PAGINA = 200;
/** Trava contra um registro que nunca termina de paginar. */
const MAXIMO_DE_PAGINAS = 500;

async function lerRegistroInteiro(deps: Deps): Promise<Map<string, FuncionarioRh>> {
  const todos = new Map<string, FuncionarioRh>();
  let pagina = 1;
  for (let n = 0; n < MAXIMO_DE_PAGINAS; n++) {
    const resposta = await deps.rh.listarFuncionarios({ pagina, tamanho: TAMANHO_DA_PAGINA });
    if (!resposta || !Array.isArray(resposta.funcionarios)) throw new Error("Resposta inválida do registro de funcionários");
    for (const f of resposta.funcionarios) todos.set(f.matricula.trim().toLowerCase(), f);
    if (!resposta.proxima_pagina) return todos;
    if (resposta.proxima_pagina <= pagina) throw new Error("Resposta inválida do registro de funcionários: a próxima página não avança");
    pagina = resposta.proxima_pagina;
  }
  throw new Error("O registro de funcionários devolveu páginas demais");
}

const mensagemDe = (erro: unknown) => (erro instanceof Error ? erro.message : String(erro)).slice(0, 500);

/**
 * Uma leitura completa: lê o registro inteiro, página por página, e confere todos os usuários do SYNQ OS pela matrícula (quem
 * sumiu do registro vira `fora_do_registro`). Antes de aplicar, a trava de segurança: se a leitura desativaria mais da metade dos
 * usuários ativos, não aplica nada e termina com erro (um registro vazio ou mal configurado não pode esvaziar o SYNQ OS). Falha de
 * rede lança, e a tarefa tenta de novo; o erro fica na leitura enquanto isso. A trava não lança: é definitiva.
 */
export async function executarLeituraRh(deps: Deps, leituraId: string): Promise<void> {
  const [leitura] = await deps.db.select({ id: leituraRh.id, concluidaEm: leituraRh.concluidaEm }).from(leituraRh).where(eq(leituraRh.id, leituraId));
  if (!leitura || leitura.concluidaEm) return;

  let registro: Map<string, FuncionarioRh>;
  try {
    registro = await lerRegistroInteiro(deps);
  } catch (erro) {
    await deps.db.update(leituraRh).set({ erro: mensagemDe(erro) }).where(eq(leituraRh.id, leituraId));
    throw erro;
  }

  const usuarios = await deps.db.select().from(usuario);
  const situacoes = usuarios.map((u) => ({ u, f: registro.get(u.matricula.trim().toLowerCase()) ?? null }));
  const ativos = usuarios.filter((u) => u.ativo && u.liberacao !== "recusado").length;
  const perderiam = situacoes.filter(({ u, f }) => u.ativo && u.liberacao !== "recusado" && perdeAcesso(situacaoNoRegistro(f))).length;
  if (perderiam > ativos / 2) {
    const erro = `Leitura interrompida: desativaria ${perderiam} dos ${ativos} usuários ativos e nada foi aplicado. Confira o registro de funcionários.`;
    await deps.db.update(leituraRh).set({ concluidaEm: deps.agora(), conferidos: 0, erro }).where(eq(leituraRh.id, leituraId));
    await avisarFalhaDaLeituraRh(deps, leituraId, erro);
    return;
  }

  let atualizados = 0;
  let desativados = 0;
  try {
    for (const { u, f } of situacoes) {
      const r = await aplicarConferencia(deps, u, f);
      if (r.atualizado) atualizados++;
      if (r.desativado || r.recusado) desativados++;
    }
  } catch (erro) {
    await deps.db.update(leituraRh).set({ erro: mensagemDe(erro) }).where(eq(leituraRh.id, leituraId));
    throw erro;
  }
  await deps.db.update(leituraRh).set({ concluidaEm: deps.agora(), conferidos: usuarios.length, atualizados, desativados, erro: null }).where(eq(leituraRh.id, leituraId));
}

/**
 * Avisa que a leitura do registro de funcionários falhou de vez (a trava de segurança, ou as tentativas esgotadas): quem pediu o
 * "Ler agora", se ainda é admin ativo, ou os administradores, na leitura agendada. Como na falha de importação, o aviso ainda
 * não lido é reaproveitado (aponta para a falha mais recente e sobe para o topo) e só o aviso novo vai por e-mail.
 */
export async function avisarFalhaDaLeituraRh(deps: Deps, leituraId: string, erro: string): Promise<void> {
  const [l] = await deps.db.select({ origem: leituraRh.origem, usuarioId: leituraRh.usuarioId }).from(leituraRh).where(eq(leituraRh.id, leituraId));
  if (!l) return;
  const agora = deps.agora();
  const admins = new Set(await adminsAtivos(deps.db));
  const destinatarios = (await quemPediuOuAdmins(deps.db, l.usuarioId)).filter((id) => admins.has(id));
  const qual = l.origem === "agendada" ? "A leitura diária do registro de funcionários" : "A leitura do registro de funcionários pedida em \"Ler agora\"";
  const detalhe = `${qual} falhou: ${erro.replace(/\.$/, "")}. Os desligamentos que o aviso do registro já aplicou continuam valendo; confira o cartão do registro de funcionários na tela de usuários e use "Ler agora" para tentar de novo.`;
  for (const destinatarioId of destinatarios.length ? destinatarios : admins) {
    const [aberto] = await deps.db
      .select({ id: alerta.id })
      .from(alerta)
      .where(and(eq(alerta.tipo, "rh_leitura_falhou"), eq(alerta.destinatarioId, destinatarioId), isNull(alerta.lidoEm)))
      .limit(1);
    if (aberto) await deps.db.update(alerta).set({ leituraRhId: leituraId, detalhe, criadoEm: agora }).where(eq(alerta.id, aberto.id));
    else await criarAviso(deps.db, [destinatarioId], { tipo: "rh_leitura_falhou", leituraRhId: leituraId, detalhe, agora });
  }
}

/** A tarefa `leitura_rh` esgotou as tentativas (o registro fora do ar o dia inteiro, por exemplo). */
export async function alertarFalhaDaLeituraRh(deps: Deps, tarefa: { referenciaId: string | null }, erro: string): Promise<void> {
  if (tarefa.referenciaId) await avisarFalhaDaLeituraRh(deps, tarefa.referenciaId, `${erro} (depois de todas as tentativas)`);
}

/** Tarefa `leitura_rh`: `referenciaId` é a `leitura_rh`. */
export async function manipularLeituraRh(deps: Deps, t: { id: string; referenciaId: string | null }): Promise<void> {
  if (t.referenciaId) await executarLeituraRh(deps, t.referenciaId);
}

/**
 * Agenda a leitura diária: a partir das `RH_LEITURA_HORA` horas (de São Paulo), se o dia ainda não tem leitura agendada. O
 * índice único em `leitura_rh.dia` garante uma por dia mesmo com reinício ou duas instâncias. Devolve se agendou.
 */
export async function agendarLeituraDiariaRh(deps: Deps): Promise<boolean> {
  if (!deps.config.rhApiUrl) return false;
  const agora = deps.agora();
  const { dia, hora } = diaEHoraDeSaoPaulo(agora);
  if (hora < deps.config.rhLeituraHora) return false;
  return deps.db.transaction(async (tx) => {
    const [criada] = await tx.insert(leituraRh).values({ origem: "agendada", dia, iniciadaEm: agora }).onConflictDoNothing().returning({ id: leituraRh.id });
    if (!criada) return false;
    await enfileirarTarefa(tx as unknown as Db, "leitura_rh", criada.id, agora);
    return true;
  });
}

/** O que `GET /rh/sincronizacao` devolve da última leitura. */
export async function ultimaLeituraRh(db: Db) {
  const [l] = await db.select().from(leituraRh).orderBy(sql`${leituraRh.iniciadaEm} desc`, sql`${leituraRh.id} desc`).limit(1);
  if (!l) return null;
  const [t] = await db
    .select({ estado: tarefa.estado })
    .from(tarefa)
    .where(and(eq(tarefa.tipo, "leitura_rh"), eq(tarefa.referenciaId, l.id)))
    .limit(1);
  // `concluida_em` com erro é a trava de segurança (definitiva); sem `concluida_em`, o erro é de uma tentativa que ainda pode se repetir.
  const situacao = l.concluidaEm ? (l.erro ? "falhou" : "concluida") : t?.estado === "falhou" ? "falhou" : l.erro ? "tentando_de_novo" : "em_andamento";
  return { ...l, situacao };
}

/** Equipe que o setor do funcionário sugere no cadastro (`equipe.centro_trabalho`), ou `null` se o setor não tem equipe. */
export async function equipeDoSetor(db: Db, centroTrabalho: string): Promise<{ id: string; nome: string } | null> {
  const [e] = await db.select({ id: equipe.id, nome: equipe.nome }).from(equipe).where(eq(equipe.centroTrabalho, centroTrabalho));
  return e ?? null;
}

