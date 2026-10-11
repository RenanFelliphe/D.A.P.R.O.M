import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../deps";
import { equipe, PERFIS, usuario } from "../db/schema";
import { gerarSenhaInicial, usuarioParaApi } from "../dominio/usuarios";
import { equipeDoEscopo, type Autenticacao, type Ambiente } from "../http/autenticacao";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { contar, esquemaPaginacao, limiteEDeslocamento, meta } from "../http/paginacao";
import { responder } from "../http/resposta";
import { booleanoDaConsulta, lerConsulta, lerCorpo, lerId, textoObrigatorio, uuid } from "../http/validacao";
import { emailInterno } from "../servicos/auth";
import { senhaNova } from "./auth";

/** A matrícula vira a parte local do e-mail interno do Supabase Auth, então só aceita caracteres de e-mail. */
const matricula = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._-]{1,40}$/, "Use só letras, números, ponto, hífen e sublinhado");

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
        email: z.string().trim().email().nullable().optional(),
        perfil: z.enum(PERFIS),
        equipe_id: uuid.nullable().optional(),
        cargo: textoOpcional,
        registro_profissional: textoOpcional,
        senha_inicial: senhaNova,
      }),
    );
    if (dados.perfil === "supervisor" && !dados.email) throw invalido("email_obrigatorio", "Supervisor precisa de e-mail para receber alertas");
    await exigirEquipe(deps, dados.equipe_id);

    const [existente] = await deps.db.select({ id: usuario.id }).from(usuario).where(eq(sql`lower(${usuario.matricula})`, dados.matricula.toLowerCase()));
    if (existente) throw conflito("matricula_duplicada", "Matrícula já cadastrada");

    const conta = await deps.auth.criarConta(emailInterno(dados.matricula), dados.senha_inicial);
    try {
      await deps.db.insert(usuario).values({
        id: conta.id,
        nome: dados.nome,
        matricula: dados.matricula,
        email: dados.email ?? null,
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
        email: z.string().trim().email().nullable().optional(),
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
    const perfilFinal = dados.perfil ?? atual.perfil;
    const emailFinal = dados.email === undefined ? atual.email : dados.email;
    if (perfilFinal === "supervisor" && !emailFinal) throw invalido("email_obrigatorio", "Supervisor precisa de e-mail para receber alertas");
    await exigirEquipe(deps, dados.equipe_id);

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

    // Desativar bloqueia a `api` na hora; o Supabase só é revogado depois que a fila offline pendente subir
    // (ver `POST /eventos`). Reativar desfaz uma revogação anterior.
    if (dados.ativo === true && !atual.ativo) await deps.auth.restaurar(id);
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
   * própria equipe quando o perfil é de equipe, e sem e-mail.
   */
  r.get("/usuarios", autenticar(), async (c) => {
    const eu = c.get("usuario");
    const filtros = lerConsulta(
      c,
      esquemaPaginacao.extend({ equipe_id: uuid.optional(), perfil: z.enum(PERFIS).optional(), ativo: booleanoDaConsulta }),
    );
    const admin = eu.perfil === "admin";
    const escopo = admin ? null : equipeDoEscopo(eu);
    if (!admin && escopo === null && eu.equipeId === null && (eu.perfil === "tecnico" || eu.perfil === "supervisor")) {
      return responder(c, { usuarios: [], ...meta(filtros, 0) });
    }

    const condicoes: (SQL | undefined)[] = [
      escopo ? eq(usuario.equipeId, escopo) : filtros.equipe_id ? eq(usuario.equipeId, filtros.equipe_id) : undefined,
      filtros.perfil ? eq(usuario.perfil, filtros.perfil) : undefined,
      admin ? (filtros.ativo === undefined ? undefined : eq(usuario.ativo, filtros.ativo)) : eq(usuario.ativo, true),
    ];
    const onde = and(...condicoes);

    const linhas = await deps.db.select().from(usuario).where(onde).orderBy(asc(usuario.nome)).limit(limiteEDeslocamento(filtros).limit).offset(limiteEDeslocamento(filtros).offset);
    const total = await contar(deps.db, usuario, onde);
    return responder(c, { usuarios: linhas.map((u) => usuarioParaApi(u, { semEmail: !admin })), ...meta(filtros, total) });
  });

  return r;
}
