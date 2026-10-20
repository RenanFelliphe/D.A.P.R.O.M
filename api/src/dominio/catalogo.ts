import { and, asc, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import {
  MATERIAL_CATEGORIAS,
  atividade,
  atividadeMaterial,
  material,
  sugestaoMateriais,
  sugestaoMateriaisItem,
  treinamentoServico,
  treinamentoServicoVersao,
  type MaterialCategoria,
} from "../db/schema";
import { conflito, invalido, naoEncontrado } from "../http/erros";
import { contar, limiteEDeslocamento, type Paginacao } from "../http/paginacao";
import { textoObrigatorio, uuid } from "../http/validacao";
import { algum, contem } from "./busca";

/*
 * Catálogo de serviço: cada serviço é uma atividade do plano de manutenção (a mesma que liga a OS ao modelo de APR), com
 * a lista dos materiais, ferramentas e EPIs que ele usa. A OS chega ao serviço pelo `codigo_atividade`. Só o admin
 * mantém o catálogo; todo perfil o lê, e o técnico o vê no detalhe da OS (o que levar para o campo).
 */

/** Um item da lista de um serviço: o material e a quantidade prevista por execução (nula = conforme a necessidade). */
export interface MaterialDoServico {
  materialId: string;
  codigo: string | null;
  descricao: string;
  unidade: string;
  categoria: MaterialCategoria;
  ativo: boolean;
  quantidade: number | null;
  observacao: string | null;
  ordem: number;
}

export const MAX_MATERIAIS_POR_SERVICO = 100;

// ---- Materiais --------------------------------------------------------------------------------------------------

/** Código SAP vazio vira nulo (o material sem código no SAP). */
const codigoDoMaterial = z
  .string()
  .trim()
  .max(40)
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const esquemaMaterial = z.object({
  codigo: codigoDoMaterial,
  descricao: textoObrigatorio.max(200),
  unidade: textoObrigatorio.max(20),
  categoria: z.enum(MATERIAL_CATEGORIAS).default("material"),
  ativo: z.boolean().optional(),
});
export type MaterialEntrada = z.infer<typeof esquemaMaterial>;

/** Em quantos serviços cada material aparece (`material.id` → total). */
const servicosDoMaterial = sql<number>`(select count(*)::int from atividade_material where atividade_material.material_id = material.id)`;

export interface FiltrosDeMateriais extends Paginacao {
  busca?: string;
  categoria?: MaterialCategoria;
  ativo?: boolean;
}

/** Materiais por categoria e descrição; a busca olha a descrição e o código do SAP, sem diferenciar acentos. */
export async function listarMateriais(db: Db, f: FiltrosDeMateriais) {
  const onde = and(
    f.busca ? algum([material.descricao, material.codigo], f.busca, contem) : undefined,
    f.categoria ? eq(material.categoria, f.categoria) : undefined,
    f.ativo === undefined ? undefined : eq(material.ativo, f.ativo),
  );
  const { limit, offset } = limiteEDeslocamento(f);
  const [linhas, total] = await Promise.all([
    db
      .select({
        id: material.id,
        codigo: material.codigo,
        descricao: material.descricao,
        unidade: material.unidade,
        categoria: material.categoria,
        ativo: material.ativo,
        criadoEm: material.criadoEm,
        servicosTotal: servicosDoMaterial,
      })
      .from(material)
      .where(onde)
      .orderBy(asc(material.categoria), asc(material.descricao), asc(material.id))
      .limit(limit)
      .offset(offset),
    contar(db, material, onde),
  ]);
  return { materiais: linhas, total };
}

/** O mesmo material duas vezes: mesmo código do SAP, ou a mesma descrição (sem diferenciar maiúsculas) na mesma unidade. */
async function exigirMaterialUnico(db: Db, m: MaterialEntrada, ignorarId?: string) {
  const mesmaDescricao = sql`lower(btrim(${material.descricao})) = ${m.descricao.trim().toLowerCase()} and lower(btrim(${material.unidade})) = ${m.unidade.trim().toLowerCase()}`;
  const outro = ignorarId ? sql`${material.id} <> ${ignorarId}` : undefined;
  const [repetido] = await db
    .select({ codigo: material.codigo, descricao: material.descricao })
    .from(material)
    .where(and(m.codigo ? sql`(${material.codigo} = ${m.codigo} or (${mesmaDescricao}))` : mesmaDescricao, outro))
    .limit(1);
  if (!repetido) return;
  if (m.codigo && repetido.codigo === m.codigo) throw conflito("material_duplicado", `Já existe um material com o código ${m.codigo}: ${repetido.descricao}`);
  throw conflito("material_duplicado", `Já existe o material "${repetido.descricao}" nessa unidade`);
}

export async function criarMaterial(db: Db, m: MaterialEntrada) {
  await exigirMaterialUnico(db, m);
  const [criado] = await db
    .insert(material)
    .values({ codigo: m.codigo, descricao: m.descricao.trim(), unidade: m.unidade.trim(), categoria: m.categoria, ativo: m.ativo ?? true })
    .returning();
  return criado!;
}

export async function editarMaterial(db: Db, id: string, m: MaterialEntrada) {
  const [anterior] = await db.select().from(material).where(eq(material.id, id));
  if (!anterior) throw naoEncontrado("Material não encontrado");
  await exigirMaterialUnico(db, m, id);
  const [salvo] = await db
    .update(material)
    .set({ codigo: m.codigo, descricao: m.descricao.trim(), unidade: m.unidade.trim(), categoria: m.categoria, ...(m.ativo !== undefined && { ativo: m.ativo }) })
    .where(eq(material.id, id))
    .returning();
  return { anterior, salvo: salvo! };
}

/** Exclui o material que nenhum serviço usa; o que está em uso fica (`409`): tire-o dos serviços ou desative-o. */
export async function excluirMaterial(db: Db, id: string) {
  const [atual] = await db.select({ descricao: material.descricao, codigo: material.codigo, servicosTotal: servicosDoMaterial }).from(material).where(eq(material.id, id));
  if (!atual) throw naoEncontrado("Material não encontrado");
  const [pendente] = await db
    .select({ id: sugestaoMateriais.id })
    .from(sugestaoMateriaisItem)
    .innerJoin(sugestaoMateriais, eq(sugestaoMateriais.id, sugestaoMateriaisItem.sugestaoId))
    .where(and(eq(sugestaoMateriaisItem.materialId, id), eq(sugestaoMateriais.estado, "pendente")))
    .limit(1);
  if (pendente) throw conflito("material_em_sugestao", `"${atual.descricao}" está numa sugestão de materiais aguardando avaliação e não pode ser excluído agora.`);
  if (atual.servicosTotal > 0) {
    throw conflito(
      "material_em_uso",
      `"${atual.descricao}" está em ${atual.servicosTotal} serviço(s) e não pode ser excluído. Tire-o desses serviços ou desative-o.`,
    );
  }
  await db.delete(material).where(eq(material.id, id));
  return atual;
}

// ---- Serviços ---------------------------------------------------------------------------------------------------

/** As listas de materiais dos serviços pedidos, na ordem de cada um (`codigo` da atividade → itens). */
export async function materiaisDosServicos(db: Db, codigos: string[]): Promise<Map<string, MaterialDoServico[]>> {
  const porServico = new Map<string, MaterialDoServico[]>(codigos.map((c) => [c, []]));
  if (codigos.length === 0) return porServico;
  const linhas = await db
    .select({
      atividadeCodigo: atividadeMaterial.atividadeCodigo,
      materialId: material.id,
      codigo: material.codigo,
      descricao: material.descricao,
      unidade: material.unidade,
      categoria: material.categoria,
      ativo: material.ativo,
      quantidade: atividadeMaterial.quantidade,
      observacao: atividadeMaterial.observacao,
      ordem: atividadeMaterial.ordem,
    })
    .from(atividadeMaterial)
    .innerJoin(material, eq(material.id, atividadeMaterial.materialId))
    .where(inArray(atividadeMaterial.atividadeCodigo, codigos))
    .orderBy(asc(atividadeMaterial.atividadeCodigo), asc(atividadeMaterial.ordem));
  for (const { atividadeCodigo, ...item } of linhas) porServico.get(atividadeCodigo)?.push(item);
  return porServico;
}

/** O serviço de uma atividade, com os materiais; `null` se a atividade não existe. */
export async function servicoDaAtividade(db: Db, codigo: string) {
  const [linha] = await db.select().from(atividade).where(eq(atividade.codigo, codigo));
  if (!linha) return null;
  return { ...linha, materiais: (await materiaisDosServicos(db, [codigo])).get(codigo) ?? [] };
}

export interface FiltrosDeServicos extends Paginacao {
  busca?: string;
  /** Só os serviços que ainda não listam nenhum material. */
  sem_materiais?: boolean;
  /** Só os serviços que usam este material. */
  material_id?: string;
}

/** O serviço lista algum material (ou este material). Colunas qualificadas à mão: a consulta de fora é de uma tabela só. */
const listaMaterial = (materialId?: string) =>
  sql`exists (select 1 from atividade_material where atividade_material.atividade_codigo = atividade.codigo${materialId ? sql` and atividade_material.material_id = ${materialId}` : sql``})`;

/** Os serviços (atividades) por código, cada um com a lista de materiais. */
/** O serviço tem treinamento publicado (com os minijogos). */
const comTreinamento = () =>
  sql<boolean>`exists (select 1 from ${treinamentoServicoVersao} inner join ${treinamentoServico} on ${treinamentoServico.id} = ${treinamentoServicoVersao.treinamentoId} where ${treinamentoServico.atividadeCodigo} = ${atividade.codigo} and ${treinamentoServicoVersao.estado} = 'publicada')`;

/** A lista do catálogo: primeiro os serviços com treinamento publicado, depois os outros, cada grupo pelo código (a web os mostra em duas seções). */
export async function listarServicos(db: Db, f: FiltrosDeServicos) {
  const condicoes: (SQL | undefined)[] = [
    f.busca ? algum([atividade.codigo, atividade.descricao], f.busca, contem) : undefined,
    f.sem_materiais ? sql`not ${listaMaterial()}` : undefined,
    f.material_id ? listaMaterial(f.material_id) : undefined,
  ];
  const onde = and(...condicoes);
  const { limit, offset } = limiteEDeslocamento(f);
  const [linhas, total] = await Promise.all([
    db.select().from(atividade).where(onde).orderBy(desc(comTreinamento()), asc(atividade.codigo)).limit(limit).offset(offset),
    contar(db, atividade, onde),
  ]);
  const materiais = await materiaisDosServicos(db, linhas.map((l) => l.codigo));
  return { servicos: linhas.map((l) => ({ ...l, materiais: materiais.get(l.codigo) ?? [] })), total };
}

export const esquemaMateriaisDoServico = z.object({
  materiais: z
    .array(
      z.object({
        material_id: uuid,
        /** Na unidade do material; nula = conforme a necessidade. */
        quantidade: z.number().positive().max(999_999_999).nullable().optional(),
        observacao: z.string().trim().max(200).nullable().optional(),
      }),
    )
    .max(MAX_MATERIAIS_POR_SERVICO),
});
export type MateriaisDoServicoEntrada = z.infer<typeof esquemaMateriaisDoServico>;

/** Como um item aparece na trilha de auditoria: "Luva de vaqueta (2 par)" ou "Detector de gás (conforme a necessidade)". */
const rotuloDoItem = (i: { descricao: string; unidade: string; quantidade: number | null }) =>
  `${i.descricao} (${i.quantidade === null ? "conforme a necessidade" : `${i.quantidade} ${i.unidade}`})`;

/**
 * Troca a lista inteira de materiais do serviço pela enviada, na ordem enviada. Material desativado só fica se já estava
 * na lista; o que não existe é recusado. Devolve o serviço salvo e o que mudou (para a auditoria).
 */
export async function salvarMateriaisDoServico(db: Db, codigo: string, entrada: MateriaisDoServicoEntrada) {
  const ids = entrada.materiais.map((m) => m.material_id);
  if (new Set(ids).size !== ids.length) throw invalido("material_repetido", "O mesmo material aparece mais de uma vez na lista");

  return db.transaction(async (tx) => {
    const [servico] = await tx.select({ codigo: atividade.codigo, descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, codigo));
    if (!servico) throw naoEncontrado("Serviço não encontrado");
    const anteriores = (await materiaisDosServicos(tx, [codigo])).get(codigo) ?? [];
    const cadastrados = ids.length ? await tx.select().from(material).where(inArray(material.id, ids)) : [];
    for (const id of ids) {
      const m = cadastrados.find((x) => x.id === id);
      if (!m) throw invalido("material_inexistente", "Material não encontrado no catálogo");
      if (!m.ativo && !anteriores.some((a) => a.materialId === id)) throw invalido("material_inativo", `"${m.descricao}" está desativado e não pode entrar em um serviço`);
    }

    await tx.delete(atividadeMaterial).where(eq(atividadeMaterial.atividadeCodigo, codigo));
    if (entrada.materiais.length > 0) {
      await tx.insert(atividadeMaterial).values(
        entrada.materiais.map((m, i) => ({
          atividadeCodigo: codigo,
          materialId: m.material_id,
          quantidade: m.quantidade ?? null,
          observacao: m.observacao ? m.observacao : null,
          ordem: i + 1,
        })),
      );
    }
    const atuais = (await materiaisDosServicos(tx, [codigo])).get(codigo) ?? [];
    const antes = anteriores.map(rotuloDoItem);
    const depois = atuais.map(rotuloDoItem);
    const mudou = JSON.stringify(anteriores.map(({ materialId, quantidade, observacao }) => [materialId, quantidade, observacao])) !==
      JSON.stringify(atuais.map(({ materialId, quantidade, observacao }) => [materialId, quantidade, observacao]));
    return { servico: { ...servico, materiais: atuais }, mudou, antes, depois, itensAntes: anteriores, itensDepois: atuais };
  });
}
