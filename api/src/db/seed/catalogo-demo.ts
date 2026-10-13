import { inArray, sql } from "drizzle-orm";
import type { Db } from "../conexao";
import { atividade, atividadeMaterial, material, type MaterialCategoria } from "../schema";

/**
 * Catálogo de serviço fictício, para o modo local e a demonstração: materiais, ferramentas e EPIs inventados (códigos
 * `DEMO-…`) e a lista de alguns serviços da carga inicial. O catálogo real depende da lista de materiais de cada serviço,
 * que a ES Gás ainda vai passar; nunca rode isto com dados reais.
 */

const MATERIAIS: { codigo: string; descricao: string; unidade: string; categoria: MaterialCategoria }[] = [
  { codigo: "DEMO-001", descricao: "Fita veda-rosca 18 mm", unidade: "un", categoria: "material" },
  { codigo: "DEMO-002", descricao: "Pasta seladora para roscas de gás", unidade: "un", categoria: "material" },
  { codigo: "DEMO-003", descricao: 'Kit de vedação para válvula esfera 2"', unidade: "un", categoria: "material" },
  { codigo: "DEMO-004", descricao: "Lacre de segurança numerado", unidade: "un", categoria: "material" },
  { codigo: "DEMO-005", descricao: "Vaselina industrial", unidade: "kg", categoria: "material" },
  { codigo: "DEMO-006", descricao: "Tinta epóxi anticorrosiva", unidade: "L", categoria: "material" },
  { codigo: "DEMO-007", descricao: "Diluente para epóxi", unidade: "L", categoria: "material" },
  { codigo: "DEMO-008", descricao: "Lixa ferro grão 80", unidade: "folha", categoria: "material" },
  { codigo: "DEMO-009", descricao: "Detergente neutro biodegradável", unidade: "L", categoria: "material" },
  { codigo: "DEMO-010", descricao: "Estopa", unidade: "kg", categoria: "material" },
  { codigo: "DEMO-101", descricao: 'Chave de grifo 18"', unidade: "un", categoria: "ferramenta" },
  { codigo: "DEMO-102", descricao: "Torquímetro 20 a 100 N·m", unidade: "un", categoria: "ferramenta" },
  { codigo: "DEMO-103", descricao: "Detector portátil de gases (4 gases)", unidade: "un", categoria: "ferramenta" },
  { codigo: "DEMO-104", descricao: "Manômetro padrão calibrado", unidade: "un", categoria: "ferramenta" },
  { codigo: "DEMO-105", descricao: "Multímetro digital", unidade: "un", categoria: "ferramenta" },
  { codigo: "DEMO-106", descricao: "Lavadora de alta pressão", unidade: "un", categoria: "ferramenta" },
  { codigo: "DEMO-107", descricao: "Escova de aço manual", unidade: "un", categoria: "ferramenta" },
  { codigo: "DEMO-201", descricao: "Luva de vaqueta", unidade: "par", categoria: "epi" },
  { codigo: "DEMO-202", descricao: "Óculos de segurança incolor", unidade: "un", categoria: "epi" },
  { codigo: "DEMO-203", descricao: "Protetor auricular tipo plugue", unidade: "par", categoria: "epi" },
  { codigo: "DEMO-204", descricao: "Respirador semifacial com filtro para vapores orgânicos", unidade: "un", categoria: "epi" },
];

type Linha = [codigoDoMaterial: string, quantidade: number | null, observacao?: string];

/** Listas por serviço (código da atividade da carga inicial, o mesmo que as OS de exemplo trazem). */
const LISTAS: Record<string, Linha[]> = {
  Medição: [["DEMO-104", 1], ["DEMO-105", 1], ["DEMO-103", 1, "Conferir a calibração antes de sair"], ["DEMO-004", 2, "Para relacrar o medidor"], ["DEMO-201", 1], ["DEMO-202", 1]],
  "Lavagem de Estação": [["DEMO-106", 1], ["DEMO-009", 5], ["DEMO-107", 2], ["DEMO-010", 1], ["DEMO-201", 1], ["DEMO-202", 1], ["DEMO-203", 1]],
  "Teste, manutenção e válvulas": [
    ["DEMO-003", 1],
    ["DEMO-001", 2],
    ["DEMO-002", 1],
    ["DEMO-005", 0.5],
    ["DEMO-101", 1],
    ["DEMO-102", 1],
    ["DEMO-103", 1, "Teste de estanqueidade depois do aperto"],
    ["DEMO-201", 1],
    ["DEMO-202", 1],
  ],
  "Tratamento em corrosão e pintura": [
    ["DEMO-008", 10],
    ["DEMO-107", 1],
    ["DEMO-006", 3.6],
    ["DEMO-007", 0.9],
    ["DEMO-010", 1],
    ["DEMO-204", 1, "Obrigatório durante a pintura"],
    ["DEMO-201", 1],
    ["DEMO-202", 1],
  ],
};
/** Serviço que não está em `LISTAS` e foi pedido: o básico de qualquer atividade com gás. */
const LISTA_BASICA: Linha[] = [["DEMO-103", 1], ["DEMO-201", 1], ["DEMO-202", 1]];

/**
 * Cria os materiais fictícios (se o catálogo ainda não tem nenhum) e a lista dos serviços de `LISTAS` e de `extras`
 * que existem e ainda não listam nada. Não mexe no que o admin já cadastrou. Devolve quantos serviços ganharam lista.
 */
export async function popularCatalogoDemo(db: Db, extras: (string | null)[] = []): Promise<number> {
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(material);
  if (n === 0) await db.insert(material).values(MATERIAIS);
  const porCodigo = new Map((await db.select({ id: material.id, codigo: material.codigo }).from(material).where(inArray(material.codigo, MATERIAIS.map((m) => m.codigo)))).map((m) => [m.codigo, m.id]));

  const pedidos = [...new Set([...Object.keys(LISTAS), ...extras.filter((c): c is string => !!c)])];
  const existentes = new Set((await db.select({ codigo: atividade.codigo }).from(atividade).where(inArray(atividade.codigo, pedidos))).map((a) => a.codigo));
  const comLista = new Set((await db.selectDistinct({ codigo: atividadeMaterial.atividadeCodigo }).from(atividadeMaterial).where(inArray(atividadeMaterial.atividadeCodigo, pedidos))).map((a) => a.codigo));

  let servicos = 0;
  for (const codigo of pedidos) {
    if (!existentes.has(codigo) || comLista.has(codigo)) continue;
    const linhas = (LISTAS[codigo] ?? LISTA_BASICA).filter(([m]) => porCodigo.has(m));
    if (linhas.length === 0) continue;
    await db.insert(atividadeMaterial).values(
      linhas.map(([m, quantidade, observacao], i) => ({ atividadeCodigo: codigo, materialId: porCodigo.get(m)!, quantidade, observacao: observacao ?? null, ordem: i + 1 })),
    );
    servicos++;
  }
  return servicos;
}
