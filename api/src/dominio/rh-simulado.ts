import { asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { equipe, funcionarioSimulado, SITUACOES_FUNCIONARIO, usuario, type SituacaoFuncionario } from "../db/schema";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { contar } from "../http/paginacao";
import { dataIso, emailInstitucional, textoObrigatorio } from "../http/validacao";
import type { FuncionarioRh } from "../servicos/rh";
import { algum, contem } from "./busca";
import { emailDoNome } from "./usuarios";

/*
 * O registro de funcionários simulado (`apifuncionarios.md`, seções 2 e 6): catálogo de setores e cargos, gerador de funcionários
 * fictícios e as operações de gestão da tela do simulador. Nada aqui conhece o DAPROM além de duas consultas de demonstração: se
 * o funcionário já tem conta (`usuario`) e se o setor tem equipe. O DAPROM só fala com o simulador pelo contrato HTTP.
 */

type Linha = typeof funcionarioSimulado.$inferSelect;
type NovaLinha = typeof funcionarioSimulado.$inferInsert;

export interface Setor {
  /** Código do centro de trabalho, o mesmo de `equipe.centro_trabalho`. */
  centro: string;
  nome: string;
  cargos: string[];
}

/** Os três centros de trabalho das equipes de demonstração, mais alguns sem equipe no DAPROM (o caso "sem equipe correspondente"). */
export const SETORES: readonly Setor[] = [
  { centro: "SERV_ESP", nome: "Serviços Especiais", cargos: ["Técnico em Gás", "Eletricista", "Mecânico", "Técnico de Segurança", "Engenheiro Mecânico"] },
  { centro: "INSTRUM", nome: "Instrumentação", cargos: ["Instrumentista", "Técnico em Instrumentação", "Engenheiro de Automação"] },
  { centro: "LAB_QUI", nome: "Laboratório Químico", cargos: ["Químico", "Técnico em Química", "Engenheiro Químico"] },
  { centro: "MAN_ELE", nome: "Manutenção Elétrica", cargos: ["Eletricista", "Técnico em Eletrotécnica", "Engenheiro Eletricista"] },
  { centro: "MAN_MEC", nome: "Manutenção Mecânica", cargos: ["Mecânico", "Soldador", "Engenheiro Mecânico"] },
  { centro: "ADMIN", nome: "Administrativo", cargos: ["Analista Administrativo", "Assistente Administrativo", "Técnico de Segurança"] },
];

export const setorDoCentro = (centro: string) => SETORES.find((s) => s.centro === centro);

/** Só os cargos de engenharia têm registro profissional (CREA). */
export const cargoDeEngenharia = (cargo: string) => /^engenheir/i.test(cargo.trim());

const LOTACOES = ["Vila Velha/ES", "Vitória/ES", "Serra/ES", "Cariacica/ES", "Guarapari/ES", "Linhares/ES"];

const NOMES = [
  "Ana", "Bruno", "Carla", "Daniel", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Paulo",
  "Queila", "Rafael", "Sandra", "Tiago", "Úrsula", "Vinícius", "Wagner", "Yasmin", "Adriano", "Beatriz", "Caio", "Débora", "Elias", "Fernanda", "Gustavo", "Helena",
  "Igor", "Juliana", "Leandro", "Mônica", "Natália", "Otávio", "Patrícia", "Renato",
];
const SOBRENOMES = [
  "Ribeiro", "Souza", "Oliveira", "Santos", "Pereira", "Lima", "Carvalho", "Almeida", "Ferreira", "Rodrigues", "Gomes", "Martins", "Araújo", "Barbosa", "Rocha", "Dias",
  "Nascimento", "Moreira", "Cardoso", "Teixeira", "Correia", "Mendes", "Nunes", "Vieira", "Freitas", "Monteiro", "Castro", "Pinto", "Machado", "Azevedo", "Campos", "Duarte",
];

/** Matrícula sugerida: a maior matrícula numérica mais um, começando em `100001`. */
export async function proximaMatricula(db: Db): Promise<string> {
  const [r] = await db
    .select({ maior: sql<string | null>`max(${funcionarioSimulado.matricula}::bigint) filter (where ${funcionarioSimulado.matricula} ~ '^[0-9]{1,15}$')` })
    .from(funcionarioSimulado);
  return String(Math.max(100000, Number(r?.maior ?? 0)) + 1);
}

/** O funcionário no formato do contrato (o que o DAPROM lê). */
export function paraContrato(f: Linha): FuncionarioRh {
  return {
    matricula: f.matricula,
    nome: f.nome,
    email: f.email,
    cargo: f.cargo,
    centro_trabalho: f.centroTrabalho,
    setor: f.setor,
    registro_profissional: f.registroProfissional,
    situacao: f.situacao,
    data_admissao: f.dataAdmissao,
    data_nascimento: f.dataNascimento,
    telefone: f.telefone,
    gestor_matricula: f.gestorMatricula,
    lotacao: f.lotacao,
  };
}

// ------------------------------------------------------------------------------------------------------------------
// Gerador
// ------------------------------------------------------------------------------------------------------------------

/** No máximo isto por envio, somando os lotes. */
export const LIMITE_POR_ENVIO = 200;

export const esquemaLotes = z.object({
  lotes: z
    .array(
      z.object({
        quantidade: z.number().int().min(1).max(LIMITE_POR_ENVIO),
        centro_trabalho: z.string().trim().min(1).optional(),
        cargo: z.string().trim().min(1).optional(),
        situacao: z.enum(SITUACOES_FUNCIONARIO).optional(),
      }),
    )
    .min(1),
});
export type LoteAleatorio = z.infer<typeof esquemaLotes>["lotes"][number];

export interface OpcoesDoGerador {
  /** Número em [0, 1); injetável para os testes serem reproduzíveis. */
  sorteio?: () => number;
  /** Primeira matrícula livre. */
  matriculaInicial: number;
  emailsEmUso: Set<string>;
  /** Matrículas que podem ser gestores, por centro de trabalho. */
  gestoresPorCentro?: Map<string, string[]>;
  hoje?: Date;
}

const DIA_MS = 24 * 3600_000;

/**
 * Gera os funcionários dos lotes: nomes brasileiros de listas fixas, cargo coerente com o setor (o sorteio escolhe entre os do
 * setor), CREA só em cargo de engenharia, admissão nos últimos 20 anos, idade entre 20 e 60 anos, situação "ativo" a menos que
 * o lote peça outra, e-mail `nome.sobrenome@empresa.com.br` (com número quando houver homônimos).
 */
export function gerarFuncionarios(lotes: LoteAleatorio[], opcoes: OpcoesDoGerador): NovaLinha[] {
  const sorteio = opcoes.sorteio ?? Math.random;
  const hoje = opcoes.hoje ?? new Date();
  const escolher = <T>(lista: readonly T[]): T => lista[Math.min(lista.length - 1, Math.floor(sorteio() * lista.length))]!;
  const entre = (min: number, max: number) => min + Math.floor(sorteio() * (max - min + 1));
  const dataDe = (diasAtras: number) => new Date(hoje.getTime() - diasAtras * DIA_MS).toISOString().slice(0, 10);

  const total = lotes.reduce((soma, l) => soma + l.quantidade, 0);
  if (total > LIMITE_POR_ENVIO) throw invalido("limite_excedido", `No máximo ${LIMITE_POR_ENVIO} funcionários por envio`);

  const usados = new Set(opcoes.emailsEmUso);
  const gestores = opcoes.gestoresPorCentro ?? new Map<string, string[]>();
  const saida: NovaLinha[] = [];
  let matricula = opcoes.matriculaInicial;

  for (const lote of lotes) {
    const setor = lote.centro_trabalho ? setorDoCentro(lote.centro_trabalho) : undefined;
    if (lote.centro_trabalho && !setor) throw invalido("setor_inexistente", `Setor desconhecido: ${lote.centro_trabalho}`);
    for (let i = 0; i < lote.quantidade; i++) {
      const doSetor = setor ?? escolher(SETORES);
      const cargo = lote.cargo ?? escolher(doSetor.cargos);
      const primeiro = escolher(NOMES);
      const ultimo = escolher(SOBRENOMES);
      const nome = `${primeiro} ${ultimo}`;

      const [local, dominio] = emailDoNome(nome).split("@") as [string, string];
      let email = `${local}@${dominio}`;
      for (let n = 2; usados.has(email); n++) email = `${local}${n}@${dominio}`;
      usados.add(email);

      const diasDeVida = entre(20, 60) * 365 + entre(0, 364);
      const nascimento = dataDe(diasDeVida);
      // A admissão cai nos últimos 20 anos, mas nunca antes dos 18 anos da pessoa.
      const admissao = dataDe(entre(0, Math.min(20 * 365, diasDeVida - 18 * 365)));
      const candidatos = gestores.get(doSetor.centro) ?? [];

      saida.push({
        matricula: String(matricula++),
        nome,
        email,
        cargo,
        centroTrabalho: doSetor.centro,
        setor: doSetor.nome,
        registroProfissional: cargoDeEngenharia(cargo) ? `CREA ES-0${entre(10000, 99999)}/D` : null,
        situacao: lote.situacao ?? "ativo",
        dataAdmissao: admissao,
        dataNascimento: nascimento,
        telefone: `(27) 3200-${entre(1000, 9999)}`,
        gestorMatricula: candidatos.length ? escolher(candidatos) : null,
        lotacao: escolher(LOTACOES),
      });
    }
  }
  return saida;
}

// ------------------------------------------------------------------------------------------------------------------
// Gestão
// ------------------------------------------------------------------------------------------------------------------

const textoOpcional = z.string().trim().min(1).nullable().optional();

export const esquemaNovoFuncionario = z.object({
  matricula: z.string().trim().min(1).max(40),
  nome: textoObrigatorio,
  email: emailInstitucional,
  cargo: textoObrigatorio,
  centro_trabalho: textoObrigatorio,
  registro_profissional: textoOpcional,
  situacao: z.enum(SITUACOES_FUNCIONARIO).default("ativo"),
  data_admissao: dataIso.nullable().optional(),
  data_nascimento: dataIso.nullable().optional(),
  telefone: textoOpcional,
  gestor_matricula: textoOpcional,
  lotacao: textoOpcional,
});

/** Edição: tudo, menos a matrícula (`.strict()` recusa a tentativa de mudá-la em vez de ignorá-la em silêncio). */
export const esquemaEdicaoFuncionario = esquemaNovoFuncionario.omit({ matricula: true, situacao: true }).partial().extend({ situacao: z.enum(SITUACOES_FUNCIONARIO).optional() }).strict();

export const ACOES_EM_MASSA = ["excluir", "mudar_setor", "mudar_situacao"] as const;

export const esquemaEmMassa = z
  .object({
    matriculas: z.array(z.string().trim().min(1)).min(1).optional(),
    todos_da_busca: z.boolean().optional(),
    busca: z.string().trim().min(1).optional(),
    acao: z.enum(ACOES_EM_MASSA),
    valor: z.string().trim().min(1).optional(),
  })
  .refine((c) => (c.matriculas ? !c.todos_da_busca : c.todos_da_busca === true), "Informe as matrículas ou marque todos_da_busca");

const minusculas = (m: string) => m.trim().toLowerCase();

/** Contas do DAPROM com estas matrículas (sem diferenciar maiúsculas), indexadas pela matrícula em minúsculas. */
async function contasPorMatricula(db: Db, matriculas: string[]) {
  if (matriculas.length === 0) return new Map<string, { id: string; perfil: string; equipeId: string | null; ativo: boolean; liberacao: string }>();
  const contas = await db
    .select({ matricula: usuario.matricula, id: usuario.id, perfil: usuario.perfil, equipeId: usuario.equipeId, ativo: usuario.ativo, liberacao: usuario.liberacao })
    .from(usuario)
    .where(inArray(sql`lower(${usuario.matricula})`, matriculas.map(minusculas)));
  return new Map(contas.map((c) => [minusculas(c.matricula), c]));
}

const condicaoDaBusca = (busca?: string): SQL | undefined =>
  busca ? algum([funcionarioSimulado.nome, funcionarioSimulado.email, funcionarioSimulado.matricula], busca, contem) : undefined;

/** Lista paginada, com a conta de cada um no DAPROM (`null` se não tem) e o contador por situação (de todos, sem a busca). */
export async function listarFuncionarios(db: Db, o: { busca?: string; pagina: number; tamanho: number }) {
  const onde = condicaoDaBusca(o.busca);
  const linhas = await db
    .select()
    .from(funcionarioSimulado)
    .where(onde)
    .orderBy(asc(funcionarioSimulado.nome), asc(funcionarioSimulado.matricula))
    .limit(o.tamanho)
    .offset((o.pagina - 1) * o.tamanho);
  const contas = await contasPorMatricula(db, linhas.map((l) => l.matricula));
  const porSituacao = await db.select({ situacao: funcionarioSimulado.situacao, n: sql<number>`count(*)::int` }).from(funcionarioSimulado).groupBy(funcionarioSimulado.situacao);
  const contagem = { ativo: 0, afastado: 0, desligado: 0 } satisfies Record<SituacaoFuncionario, number>;
  for (const p of porSituacao) contagem[p.situacao] = p.n;
  const funcionarios = linhas.map((l) => {
    const c = contas.get(minusculas(l.matricula));
    return { ...l, contaNoDaprom: c ? { id: c.id, perfil: c.perfil, equipeId: c.equipeId, ativo: c.ativo, liberacao: c.liberacao } : null };
  });
  return { funcionarios, total: await contar(db, funcionarioSimulado, onde), contagem };
}

/** Setores e cargos, a próxima matrícula livre e quais setores têm equipe no DAPROM. */
export async function catalogoDoSimulador(db: Db) {
  const equipes = await db.select({ centro: equipe.centroTrabalho, nome: equipe.nome }).from(equipe);
  const comEquipe = new Map(equipes.map((e) => [e.centro, e.nome]));
  return {
    setores: SETORES.map((s) => ({ centroTrabalho: s.centro, nome: s.nome, cargos: s.cargos, equipeNoDaprom: comEquipe.get(s.centro) ?? null })),
    situacoes: SITUACOES_FUNCIONARIO,
    proximaMatricula: await proximaMatricula(db),
  };
}

async function exigirEmailLivre(db: Db, email: string, exceto?: string) {
  const [usado] = await db.select({ matricula: funcionarioSimulado.matricula }).from(funcionarioSimulado).where(eq(funcionarioSimulado.email, email));
  if (usado && usado.matricula !== exceto) throw conflito("email_duplicado", "E-mail já cadastrado no registro");
}

export async function criarFuncionario(db: Db, dados: z.infer<typeof esquemaNovoFuncionario>, agora: Date): Promise<Linha> {
  const setor = setorDoCentro(dados.centro_trabalho);
  if (!setor) throw invalido("setor_inexistente", `Setor desconhecido: ${dados.centro_trabalho}`);
  const [existe] = await db.select({ matricula: funcionarioSimulado.matricula }).from(funcionarioSimulado).where(eq(funcionarioSimulado.matricula, dados.matricula));
  if (existe) throw conflito("matricula_duplicada", "Matrícula já existe no registro");
  await exigirEmailLivre(db, dados.email);
  const [criado] = await db
    .insert(funcionarioSimulado)
    .values({
      matricula: dados.matricula,
      nome: dados.nome,
      email: dados.email,
      cargo: dados.cargo,
      centroTrabalho: setor.centro,
      setor: setor.nome,
      registroProfissional: dados.registro_profissional ?? null,
      situacao: dados.situacao,
      dataAdmissao: dados.data_admissao ?? null,
      dataNascimento: dados.data_nascimento ?? null,
      telefone: dados.telefone ?? null,
      gestorMatricula: dados.gestor_matricula ?? null,
      lotacao: dados.lotacao ?? null,
      criadoEm: agora,
      alteradoEm: agora,
    })
    .returning();
  return criado!;
}

/** Matrículas (por centro de trabalho) de quem pode ser gestor dos funcionários gerados: os ativos que já existem. */
async function gestoresPorCentro(db: Db) {
  const ativos = await db.select({ matricula: funcionarioSimulado.matricula, centro: funcionarioSimulado.centroTrabalho }).from(funcionarioSimulado).where(eq(funcionarioSimulado.situacao, "ativo"));
  const mapa = new Map<string, string[]>();
  for (const a of ativos) mapa.set(a.centro, [...(mapa.get(a.centro) ?? []), a.matricula]);
  return mapa;
}

export async function criarAleatorios(db: Db, lotes: LoteAleatorio[], agora: Date, sorteio?: () => number): Promise<number> {
  const emails = await db.select({ email: funcionarioSimulado.email }).from(funcionarioSimulado);
  const emUso = new Set([...emails.map((e) => e.email), ...(await db.select({ email: usuario.email }).from(usuario)).map((u) => u.email)]);
  const novos = gerarFuncionarios(lotes, {
    ...(sorteio ? { sorteio } : {}),
    matriculaInicial: Number(await proximaMatricula(db)),
    emailsEmUso: emUso,
    gestoresPorCentro: await gestoresPorCentro(db),
    hoje: agora,
  });
  await db.insert(funcionarioSimulado).values(novos.map((n) => ({ ...n, criadoEm: agora, alteradoEm: agora })));
  return novos.length;
}

/** Edita (a matrícula não muda). `virouDesligado` diz se a edição fez o funcionário passar a desligado, que dispara o aviso. */
export async function editarFuncionario(db: Db, matricula: string, dados: z.infer<typeof esquemaEdicaoFuncionario>, agora: Date): Promise<{ funcionario: Linha; virouDesligado: boolean }> {
  const [atual] = await db.select().from(funcionarioSimulado).where(eq(funcionarioSimulado.matricula, matricula));
  if (!atual) throw naoEncontrado("Funcionário não encontrado");
  let setor: Setor | undefined;
  if (dados.centro_trabalho !== undefined) {
    setor = setorDoCentro(dados.centro_trabalho);
    if (!setor) throw invalido("setor_inexistente", `Setor desconhecido: ${dados.centro_trabalho}`);
  }
  if (dados.email !== undefined) await exigirEmailLivre(db, dados.email, matricula);
  const [editado] = await db
    .update(funcionarioSimulado)
    .set({
      ...(dados.nome !== undefined && { nome: dados.nome }),
      ...(dados.email !== undefined && { email: dados.email }),
      ...(dados.cargo !== undefined && { cargo: dados.cargo }),
      ...(setor && { centroTrabalho: setor.centro, setor: setor.nome }),
      ...(dados.registro_profissional !== undefined && { registroProfissional: dados.registro_profissional }),
      ...(dados.situacao !== undefined && { situacao: dados.situacao }),
      ...(dados.data_admissao !== undefined && { dataAdmissao: dados.data_admissao }),
      ...(dados.data_nascimento !== undefined && { dataNascimento: dados.data_nascimento }),
      ...(dados.telefone !== undefined && { telefone: dados.telefone }),
      ...(dados.gestor_matricula !== undefined && { gestorMatricula: dados.gestor_matricula }),
      ...(dados.lotacao !== undefined && { lotacao: dados.lotacao }),
      alteradoEm: agora,
    })
    .where(eq(funcionarioSimulado.matricula, matricula))
    .returning();
  return { funcionario: editado!, virouDesligado: atual.situacao !== "desligado" && editado!.situacao === "desligado" };
}

export const MOTIVO_COM_CONTA = "Desligue o funcionário em vez de excluir";

/** Exclui só quem não tem conta no DAPROM: quem tem deve ser desligado, como numa empresa de verdade. */
export async function excluirFuncionario(db: Db, matricula: string): Promise<void> {
  const [f] = await db.select({ matricula: funcionarioSimulado.matricula }).from(funcionarioSimulado).where(eq(funcionarioSimulado.matricula, matricula));
  if (!f) throw naoEncontrado("Funcionário não encontrado");
  if ((await contasPorMatricula(db, [matricula])).size > 0) throw conflito("funcionario_com_conta", `${MOTIVO_COM_CONTA}: ele já tem conta no DAPROM`);
  await db.delete(funcionarioSimulado).where(eq(funcionarioSimulado.matricula, matricula));
}

export interface ResultadoEmMassa {
  afetados: number;
  recusados: { matricula: string; motivo: string }[];
  /** Matrículas que passaram a desligado nesta ação: o simulador avisa o DAPROM. */
  desligados: string[];
}

/** Ação em massa sobre as matrículas dadas (ou todas as da busca): excluir, mudar o setor ou mudar a situação. */
export async function agirEmMassa(db: Db, c: z.infer<typeof esquemaEmMassa>, agora: Date): Promise<ResultadoEmMassa> {
  const alvos = c.matriculas ?? (await db.select({ matricula: funcionarioSimulado.matricula }).from(funcionarioSimulado).where(condicaoDaBusca(c.busca))).map((l) => l.matricula);
  const recusados: ResultadoEmMassa["recusados"] = [];
  const existentes = alvos.length ? await db.select().from(funcionarioSimulado).where(inArray(funcionarioSimulado.matricula, alvos)) : [];
  const achados = new Set(existentes.map((f) => f.matricula));
  for (const m of alvos) if (!achados.has(m)) recusados.push({ matricula: m, motivo: "Funcionário não encontrado" });

  if (c.acao === "excluir") {
    const contas = await contasPorMatricula(db, existentes.map((f) => f.matricula));
    const livres = existentes.filter((f) => !contas.has(minusculas(f.matricula)));
    for (const f of existentes) if (contas.has(minusculas(f.matricula))) recusados.push({ matricula: f.matricula, motivo: MOTIVO_COM_CONTA });
    if (livres.length) await db.delete(funcionarioSimulado).where(inArray(funcionarioSimulado.matricula, livres.map((f) => f.matricula)));
    return { afetados: livres.length, recusados, desligados: [] };
  }

  if (c.acao === "mudar_setor") {
    const setor = c.valor ? setorDoCentro(c.valor) : undefined;
    if (!setor) throw invalido("setor_inexistente", c.valor ? `Setor desconhecido: ${c.valor}` : "Informe o setor");
    if (existentes.length) await db.update(funcionarioSimulado).set({ centroTrabalho: setor.centro, setor: setor.nome, alteradoEm: agora }).where(inArray(funcionarioSimulado.matricula, existentes.map((f) => f.matricula)));
    return { afetados: existentes.length, recusados, desligados: [] };
  }

  const situacao = z.enum(SITUACOES_FUNCIONARIO).safeParse(c.valor);
  if (!situacao.success) throw invalido("situacao_invalida", "Informe a situação: ativo, afastado ou desligado");
  if (existentes.length) await db.update(funcionarioSimulado).set({ situacao: situacao.data, alteradoEm: agora }).where(inArray(funcionarioSimulado.matricula, existentes.map((f) => f.matricula)));
  const desligados = situacao.data === "desligado" ? existentes.filter((f) => f.situacao !== "desligado").map((f) => f.matricula) : [];
  return { afetados: existentes.length, recusados, desligados };
}

/** Funcionário pela matrícula, ou `null`. */
export async function obterFuncionarioSimulado(db: Db, matricula: string): Promise<Linha | null> {
  const [f] = await db.select().from(funcionarioSimulado).where(eq(funcionarioSimulado.matricula, matricula));
  return f ?? null;
}

/** Página do contrato (`GET /funcionarios`), por matrícula crescente para a paginação ser estável. */
export async function paginaDoContrato(db: Db, pagina: number, tamanho: number) {
  const linhas = await db
    .select()
    .from(funcionarioSimulado)
    .orderBy(asc(funcionarioSimulado.matricula))
    .limit(tamanho + 1)
    .offset((pagina - 1) * tamanho);
  return { funcionarios: linhas.slice(0, tamanho).map(paraContrato), ...(linhas.length > tamanho ? { proxima_pagina: pagina + 1 } : {}) };
}

