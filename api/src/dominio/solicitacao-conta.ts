import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { equipe, solicitacaoConta, usuario } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { ErroApi, invalido, naoEncontrado, proibido } from "../http/erros";
import { emailInstitucional, textoObrigatorio, uuid } from "../http/validacao";
import { adminsAtivos, criarAviso, destinatariosDaEquipe } from "./alertas";
import { registrarAuditoria } from "./auditoria";

/*
 * O pedido de conta feito na tela de entrada (`docs/pessoas-e-equipes.md`, seção 2.2): quem trabalha na empresa e ainda não
 * tem conta informa o nome, o e-mail e, se quiser, a equipe. Os administradores recebem o aviso e, com a equipe, quem responde
 * por ela (o supervisor, o representante no comando). A conta continua nascendo pelo cadastro de sempre (`POST /usuarios`, que
 * confere o registro de funcionários): o pedido só avisa, e cadastrar a pessoa com o mesmo e-mail o atende sozinho.
 */

/** Acima disto, pedidos novos na última hora (de todo mundo), a rota recusa por um tempo: protege o sino de uma enxurrada. */
export const LIMITE_DE_PEDIDOS_POR_HORA = 30;

export const esquemaSolicitacaoConta = z.object({
  nome: textoObrigatorio.pipe(z.string().max(120, "O nome pode ter no máximo 120 caracteres")),
  email: emailInstitucional.pipe(z.string().max(200)),
  equipe_id: uuid.nullable().optional(),
});

/** As equipes que a tela de entrada mostra no pedido: só o id e o nome, por ordem alfabética. */
export async function equipesParaOPedido(db: Db) {
  return db.select({ id: equipe.id, nome: equipe.nome }).from(equipe).orderBy(asc(equipe.nome));
}

/**
 * Registra o pedido e avisa. A resposta é a mesma em todo caso (quem pede não fica sabendo se o e-mail já tem conta ou já
 * pediu): o e-mail que já tem conta não gera pedido nem aviso, e o que já tem pedido pendente só atualiza o nome e a equipe,
 * sem avisar de novo. Equipe inexistente é `422`; muitos pedidos na última hora, `429`.
 */
export async function solicitarConta(db: Db, dados: z.infer<typeof esquemaSolicitacaoConta>, agora: Date): Promise<void> {
  const equipeId = dados.equipe_id ?? null;
  let nomeDaEquipe: string | null = null;
  if (equipeId) {
    const [e] = await db.select({ nome: equipe.nome }).from(equipe).where(eq(equipe.id, equipeId));
    if (!e) throw invalido("equipe_inexistente", "Equipe não encontrada");
    nomeDaEquipe = e.nome;
  }

  await db.transaction(async (tx) => {
    // Uma vez por vez: a contagem da última hora e o "já pediu" não podem ser lidos por dois pedidos ao mesmo tempo.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('solicitacao_conta'))`);
    const [conta] = await tx.select({ id: usuario.id }).from(usuario).where(eq(usuario.email, dados.email));
    if (conta) return;

    const [pendente] = await tx.select({ id: solicitacaoConta.id }).from(solicitacaoConta).where(and(eq(solicitacaoConta.email, dados.email), eq(solicitacaoConta.estado, "pendente")));
    if (pendente) {
      await tx.update(solicitacaoConta).set({ nome: dados.nome, equipeId }).where(eq(solicitacaoConta.id, pendente.id));
      return;
    }

    const umaHoraAtras = new Date(agora.getTime() - 3600_000);
    const [recentes] = await tx.select({ n: sql<number>`count(*)::int` }).from(solicitacaoConta).where(gte(solicitacaoConta.criadaEm, umaHoraAtras));
    if ((recentes?.n ?? 0) >= LIMITE_DE_PEDIDOS_POR_HORA) throw new ErroApi(429, "muitos_pedidos", "Muitos pedidos de conta agora. Tente de novo mais tarde.");

    const [criada] = await tx.insert(solicitacaoConta).values({ nome: dados.nome, email: dados.email, equipeId, criadaEm: agora }).returning({ id: solicitacaoConta.id });
    const daEquipe = equipeId ? (await destinatariosDaEquipe(tx, equipeId)).map((d) => d.id) : [];
    const destinatarios = new Set([...(await adminsAtivos(tx)), ...daEquipe]);
    const detalhe = `${dados.nome} (${dados.email}) pediu uma conta no SYNQ OS${nomeDaEquipe ? `, na equipe ${nomeDaEquipe}` : ""}. Confira a matrícula no registro de funcionários e cadastre a pessoa em Equipes e usuários.`;
    await criarAviso(tx, destinatarios, { tipo: "conta_solicitada", solicitacaoContaId: criada!.id, detalhe, agora });
  });
}

/** Quem vê um pedido: o admin, todos; quem responde por equipes, os pedidos que escolheram uma delas. */
const escopo = (eu: UsuarioAutenticado) =>
  eu.perfil === "admin" ? undefined : eu.equipesSupervisionadas.length > 0 ? inArray(solicitacaoConta.equipeId, eu.equipesSupervisionadas) : sql`false`;

/** Os pedidos pendentes que a pessoa vê, dos mais antigos aos mais novos (o primeiro a pedir é atendido primeiro). */
export async function listarSolicitacoes(db: Db, eu: UsuarioAutenticado) {
  return db
    .select({ id: solicitacaoConta.id, nome: solicitacaoConta.nome, email: solicitacaoConta.email, equipeId: solicitacaoConta.equipeId, equipeNome: equipe.nome, criadaEm: solicitacaoConta.criadaEm })
    .from(solicitacaoConta)
    .leftJoin(equipe, eq(equipe.id, solicitacaoConta.equipeId))
    .where(and(eq(solicitacaoConta.estado, "pendente"), escopo(eu)))
    .orderBy(asc(solicitacaoConta.criadaEm), asc(solicitacaoConta.nome));
}

/** Descarta um pedido pendente (quem pediu não é funcionário, pedido repetido...). Só quem o vê; fica na auditoria. */
export async function descartarSolicitacao(db: Db, eu: UsuarioAutenticado, id: string, agora: Date): Promise<void> {
  const [s] = await db.select().from(solicitacaoConta).where(eq(solicitacaoConta.id, id));
  if (!s || s.estado !== "pendente") throw naoEncontrado("Pedido de conta não encontrado");
  if (eu.perfil !== "admin" && !(s.equipeId && eu.equipesSupervisionadas.includes(s.equipeId))) throw proibido("Este pedido não é de uma equipe sua");
  await db.transaction(async (tx) => {
    await tx.update(solicitacaoConta).set({ estado: "descartada", resolvidaEm: agora, resolvidaPorId: eu.id }).where(eq(solicitacaoConta.id, id));
    await registrarAuditoria(tx, eu, {
      entidade: "usuario",
      verbo: "descartar_pedido_de_conta",
      entidadeId: id,
      alvo: s.nome,
      resumo: `Descartou o pedido de conta de ${s.nome} (${s.email})`,
      detalhes: { email: s.email, equipe_id: s.equipeId },
    });
  });
}

/** Cadastrar a pessoa (`POST /usuarios`) atende o pedido pendente com o mesmo e-mail. Quem chama passa a própria transação. */
export async function atenderSolicitacao(db: Db, email: string, usuarioId: string, porId: string, agora: Date): Promise<void> {
  await db
    .update(solicitacaoConta)
    .set({ estado: "atendida", usuarioId, resolvidaEm: agora, resolvidaPorId: porId })
    .where(and(eq(solicitacaoConta.email, email), eq(solicitacaoConta.estado, "pendente")));
}
