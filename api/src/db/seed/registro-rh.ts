import { eq, sql } from "drizzle-orm";
import type { Db } from "../conexao";
import { equipe, funcionarioSimulado, usuario } from "../schema";
import { criarAleatorios, setorDoCentro } from "../../dominio/rh-simulado";

export interface ResultadoCargaDoRegistro {
  /** Funcionários criados para usuários que ainda não tinham o seu no registro. */
  criados: number;
  /** Usuários cujo e-mail já era de outro funcionário do registro: ficaram de fora, para uma pessoa resolver. */
  ignorados: string[];
  /** Funcionários aleatórios (sem conta) criados para demonstrar o cadastro. */
  aleatorios: number;
}

/**
 * Cria no registro de funcionários simulado um funcionário para cada usuário do DAPROM que ainda não tem o seu: a mesma matrícula,
 * nome, e-mail, cargo e registro profissional, o setor da equipe (os sem equipe ficam no Administrativo) e a situação ativo
 * (`apifuncionarios.md`, seção 7). É a carga única do banco publicado e a base do modo local e da demonstração; pode rodar de novo
 * sem duplicar. No banco publicado ela precisa rodar **antes** de a conferência ser ligada: sem isso a primeira leitura diária
 * trataria todo mundo como fora do registro.
 *
 * `aleatorios` cria, além deles, funcionários fictícios sem conta (o modo local e a demonstração usam uns 30).
 */
export async function carregarRegistroDosUsuarios(db: Db, opcoes: { aleatorios?: number; sorteio?: () => number; agora?: Date } = {}): Promise<ResultadoCargaDoRegistro> {
  const agora = opcoes.agora ?? new Date();
  const sorteio = opcoes.sorteio ?? Math.random;
  const usuarios = await db
    .select({
      matricula: usuario.matricula,
      nome: usuario.nome,
      email: usuario.email,
      cargo: usuario.cargo,
      perfil: usuario.perfil,
      registroProfissional: usuario.registroProfissional,
      criadoEm: usuario.criadoEm,
      centroTrabalho: equipe.centroTrabalho,
      nomeDaEquipe: equipe.nome,
    })
    .from(usuario)
    .leftJoin(equipe, eq(equipe.id, usuario.equipeId));

  const existentes = await db.select({ matricula: funcionarioSimulado.matricula, email: funcionarioSimulado.email }).from(funcionarioSimulado);
  const matriculas = new Set(existentes.map((f) => f.matricula.toLowerCase()));
  const emails = new Set(existentes.map((f) => f.email));

  let criados = 0;
  const ignorados: string[] = [];
  for (const u of usuarios) {
    if (matriculas.has(u.matricula.toLowerCase())) continue;
    if (emails.has(u.email)) {
      ignorados.push(u.matricula);
      continue;
    }
    const centro = u.centroTrabalho ?? "ADMIN";
    const entre = (min: number, max: number) => min + Math.floor(sorteio() * (max - min + 1));
    const admissao = new Date((u.criadoEm ?? agora).getTime() - entre(30, 365 * 6) * 24 * 3600_000);
    await db.insert(funcionarioSimulado).values({
      matricula: u.matricula,
      nome: u.nome,
      email: u.email,
      cargo: u.cargo ?? (u.perfil === "admin" ? "Analista Administrativo" : "Técnico"),
      centroTrabalho: centro,
      setor: setorDoCentro(centro)?.nome ?? u.nomeDaEquipe ?? centro,
      registroProfissional: u.registroProfissional,
      situacao: "ativo",
      dataAdmissao: admissao.toISOString().slice(0, 10),
      telefone: `(27) 3200-${entre(1000, 9999)}`,
      lotacao: "Vila Velha/ES",
      criadoEm: agora,
      alteradoEm: agora,
    });
    matriculas.add(u.matricula.toLowerCase());
    emails.add(u.email);
    criados++;
  }

  const aleatorios = opcoes.aleatorios && opcoes.aleatorios > 0 ? await criarAleatorios(db, [{ quantidade: opcoes.aleatorios }], agora, sorteio) : 0;
  return { criados, ignorados, aleatorios };
}

/** Quantos funcionários o registro simulado tem. */
export async function totalDeFuncionarios(db: Db): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(funcionarioSimulado);
  return r?.n ?? 0;
}
