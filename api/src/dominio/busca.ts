import { and, eq, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { equipe, localInstalacao, os, usuario } from "../db/schema";
import { veTodasAsEquipes, type UsuarioAutenticado } from "../http/autenticacao";
import { condicaoEscopo, noEscopo } from "./painel-comum";

/*
 * Busca global de usuários, equipes e OS. O texto é procurado nos campos de cada um, sem diferenciar maiúsculas nem
 * acentos ("joao" acha "João"; "inspecao", "Inspeção"), e cada lista traz só o que tem o texto em algum desses campos:
 * - usuário: nome, matrícula, cargo, e-mail e registro profissional (CREA);
 * - equipe: nome e centro de trabalho (o código do SAP);
 * - OS: número da ordem, título, código do local, número da nota e cliente do local.
 */

const VARIANTES: Record<string, string> = { a: "áàâãäå", e: "éèêë", i: "íìîï", o: "óòôõö", u: "úùûü", c: "ç", n: "ñ", y: "ýÿ" };
const PARES = Object.entries(VARIANTES).flatMap(([base, letras]) => [...letras, ...letras.toUpperCase()].map((letra) => [letra, base] as const));
const TROCA = new Map<string, string>(PARES);
/** Os dois lados do `translate` do SQL: a mesma troca, letra por letra, que `normalizar` faz no texto buscado. */
const COM_ACENTO = sql.raw(`'${PARES.map(([letra]) => letra).join("")}'`);
const SEM_ACENTO = sql.raw(`'${PARES.map(([, base]) => base).join("")}'`);

/** O texto como a busca o compara: minúsculo e sem acento. */
export const normalizar = (texto: string) => Array.from(texto.toLowerCase(), (c) => TROCA.get(c) ?? c).join("");

const semAcento = (valor: AnyColumn | SQL) => sql`lower(translate(${valor}, ${COM_ACENTO}, ${SEM_ACENTO}))`;

/** Escapa `%`, `_` e `\` para o `like` procurar o texto literal. */
const escaparLike = (texto: string) => texto.replace(/[\\%_]/g, "\\$&");

type Comparacao = (coluna: AnyColumn, termo: string) => SQL;

/** A coluna contém o termo. */
const contem: Comparacao = (coluna, termo) => sql`${semAcento(coluna)} like ${`%${escaparLike(normalizar(termo))}%`}`;

/** A coluna é o termo inteiro (fora espaços nas pontas). */
const igual: Comparacao = (coluna, termo) => sql`${semAcento(sql`btrim(${coluna})`)} = ${normalizar(termo.trim())}`;

const algum = (colunas: AnyColumn[], termo: string, comparar: Comparacao) => or(...colunas.map((coluna) => comparar(coluna, termo)))!;

const CAMPOS_DO_USUARIO = [usuario.nome, usuario.matricula, usuario.cargo, usuario.email, usuario.registroProfissional];
const CAMPOS_DA_EQUIPE = [equipe.nome, equipe.centroTrabalho];
/** Dois campos são do local: a consulta precisa do join de `os` com `local_instalacao`. */
const CAMPOS_DA_OS = [os.numeroOrdem, os.titulo, localInstalacao.codigo, os.numeroNota, localInstalacao.cliente];

/** Usuários com o texto em algum campo da busca. */
export const buscaDeUsuarios = (termo: string, comparar = contem) => algum(CAMPOS_DO_USUARIO, termo, comparar);
/** Equipes com o texto em algum campo da busca. */
export const buscaDeEquipes = (termo: string, comparar = contem) => algum(CAMPOS_DA_EQUIPE, termo, comparar);
/** OS com o texto em algum campo da busca; a consulta precisa do join com o local. */
export const buscaDeOs = (termo: string, comparar = contem) => algum(CAMPOS_DA_OS, termo, comparar);

/**
 * Contas que a pessoa enxerga: o admin, todas (inclusive as inativas e as que aguardam liberação); os demais, só as
 * ativas e liberadas do próprio escopo (pendentes e recusados só aparecem ao supervisor da equipe, em `GET /usuarios`).
 */
export function usuariosVisiveis(eu: UsuarioAutenticado): SQL | undefined {
  if (eu.perfil === "admin") return undefined;
  if (veTodasAsEquipes(eu)) return and(eq(usuario.ativo, true), eq(usuario.liberacao, "liberado"));
  return and(eq(usuario.ativo, true), eq(usuario.liberacao, "liberado"), noEscopo(eu, usuario.equipeId));
}

/** Equipes que a pessoa enxerga: todas para o admin; a própria e as que supervisiona para os demais. */
export const equipesVisiveis = (eu: UsuarioAutenticado) => noEscopo(eu, equipe.id);

export interface AchadoExato {
  tipo: "usuario" | "equipe" | "os";
  id: string;
}

/**
 * O único usuário, equipe ou OS, entre o que a pessoa enxerga, com algum campo da busca igual ao texto inteiro (sem
 * diferenciar maiúsculas nem acentos): o e-mail completo, a matrícula, o número da ordem... A busca que acha exatamente
 * um abre direto a página dele; nenhum ou mais de um (dois homônimos, um título repetido) é `null`, e a busca mostra a
 * página de resultados.
 */
export async function achadoExato(db: Db, eu: UsuarioAutenticado, termo: string): Promise<AchadoExato | null> {
  const usuarios = await db
    .select({ id: usuario.id })
    .from(usuario)
    .where(and(buscaDeUsuarios(termo, igual), usuariosVisiveis(eu)))
    .limit(2);
  const equipes = await db
    .select({ id: equipe.id })
    .from(equipe)
    .where(and(buscaDeEquipes(termo, igual), equipesVisiveis(eu)))
    .limit(2);
  const ordens = await db
    .select({ id: os.id })
    .from(os)
    .innerJoin(localInstalacao, eq(localInstalacao.id, os.localInstalacaoId))
    .where(and(buscaDeOs(termo, igual), condicaoEscopo(eu)))
    .limit(2);
  const achados: AchadoExato[] = [
    ...usuarios.map((u) => ({ tipo: "usuario" as const, id: u.id })),
    ...equipes.map((e) => ({ tipo: "equipe" as const, id: e.id })),
    ...ordens.map((o) => ({ tipo: "os" as const, id: o.id })),
  ];
  return achados.length === 1 ? achados[0]! : null;
}
