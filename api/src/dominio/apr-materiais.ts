import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { aprMaterial, material, type MaterialCategoria } from "../db/schema";
import { instanteIso, uuid } from "../http/validacao";
import { materiaisDosServicos } from "./catalogo";
import { exigirArquivo, rejeitar, type Contexto } from "./eventos-base";

/*
 * Conferência dos materiais do serviço na APR. O catálogo lista o que cada serviço usa (`atividade_material`); no fim do
 * checklist o técnico diz, item a item, se levou. O item obrigatório precisa da foto dele em mãos: sem a foto, ou sem o
 * item, a APR é bloqueada (a OS fica pendente e o supervisor é avisado), como num item eliminatório reprovado. A conferência
 * não olha estoque: não há contagem de quantos itens a empresa tem, só a prova de que o técnico está com o que o serviço pede.
 */

const fotoDoMaterial = z
  .object({
    /** Id do arquivo enviado com `PUT /arquivos/{id}` e `tipo=foto`. */
    arquivo_id: uuid,
    capturada_em: instanteIso,
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
  })
  .refine((f) => (f.latitude == null) === (f.longitude == null), { message: "Informe latitude e longitude juntas" });

/** Um item da conferência, como o aparelho envia: o material da lista do serviço, se levou e a foto (só de quem levou). */
export const materialDaApr = z.object({
  material_id: uuid,
  levou: z.boolean(),
  foto: fotoDoMaterial.optional(),
});
export type MaterialDaApr = z.infer<typeof materialDaApr>;

interface LinhaDaConferencia {
  materialId: string;
  obrigatorio: boolean;
  levou: boolean;
  foto: z.infer<typeof fotoDoMaterial> | null;
}

/** Um material obrigatório que não ficou comprovado: `levou` diz se o técnico o levou mas não mandou a foto. */
export interface MaterialFaltando {
  materialId: string;
  descricao: string;
  levou: boolean;
}

/** O que falta dizer do item obrigatório não comprovado, para o alerta: "Detector de gás — não levou". */
export const rotuloDoFaltando = (m: MaterialFaltando) => `${m.descricao} — ${m.levou ? "sem foto" : "não levou"}`;

/**
 * Confere a lista enviada contra a lista do serviço da OS, sem gravar nada. As regras valem na validação e no registro e
 * não dependem do resultado: cada material precisa ser da lista do serviço e aparecer uma vez; só quem levou tem foto, e a
 * foto precisa já ter subido. O obrigatório que não veio, ou veio sem foto, é `faltando` (a APR é bloqueada). Da fila
 * offline, o item que saiu da lista enquanto o aparelho estava sem sinal é ignorado em vez de recusar a APR.
 */
export async function conferirMateriais(ctx: Contexto, codigoAtividade: string | null, enviados: MaterialDaApr[]) {
  const lista = codigoAtividade ? ((await materiaisDosServicos(ctx.tx, [codigoAtividade])).get(codigoAtividade) ?? []) : [];
  const daLista = new Map(lista.map((m) => [m.materialId, m]));

  const vistos = new Set<string>();
  const linhas: LinhaDaConferencia[] = [];
  for (const e of enviados) {
    if (vistos.has(e.material_id)) throw rejeitar("material_repetido", "Material conferido mais de uma vez");
    vistos.add(e.material_id);
    const item = daLista.get(e.material_id);
    if (!item) {
      if (ctx.offline) continue;
      throw rejeitar("material_invalido", "Material que não pertence ao serviço da OS");
    }
    if (e.foto && !e.levou) throw rejeitar("foto_sem_material", `Foto de um material que não foi levado: ${item.descricao}`);
    linhas.push({ materialId: item.materialId, obrigatorio: item.obrigatorio, levou: e.levou, foto: e.foto ?? null });
  }
  // O obrigatório que nem foi conferido conta como não levado.
  for (const item of lista) {
    if (item.obrigatorio && !vistos.has(item.materialId)) linhas.push({ materialId: item.materialId, obrigatorio: true, levou: false, foto: null });
  }
  for (const l of linhas) if (l.foto) await exigirArquivo(ctx, "fotos", l.foto.arquivo_id);

  const faltando: MaterialFaltando[] = lista
    .filter((m) => m.obrigatorio)
    .flatMap((m) => {
      const linha = linhas.find((l) => l.materialId === m.materialId)!;
      return linha.levou && linha.foto ? [] : [{ materialId: m.materialId, descricao: m.descricao, levou: linha.levou }];
    });
  return { linhas, faltando };
}

/** Grava a conferência da APR: um item por linha, com a foto de quem levou. */
export async function gravarMateriaisDaApr(db: Db, aprId: string, linhas: LinhaDaConferencia[]) {
  if (linhas.length === 0) return;
  await db.insert(aprMaterial).values(
    linhas.map((l) => ({
      aprId,
      materialId: l.materialId,
      obrigatorio: l.obrigatorio,
      levou: l.levou,
      fotoPath: l.foto?.arquivo_id ?? null,
      capturadaEm: l.foto ? l.foto.capturada_em : null,
      latitude: l.foto?.latitude ?? null,
      longitude: l.foto?.longitude ?? null,
    })),
  );
}

/** Os obrigatórios que a APR já gravada não comprovou (a validação refeita depois de a APR bloqueada ser registrada). */
export async function materiaisFaltandoDaAprGravada(db: Db, aprId: string): Promise<MaterialFaltando[]> {
  const linhas = await db
    .select({ materialId: aprMaterial.materialId, descricao: material.descricao, levou: aprMaterial.levou, fotoPath: aprMaterial.fotoPath })
    .from(aprMaterial)
    .innerJoin(material, eq(material.id, aprMaterial.materialId))
    .where(and(eq(aprMaterial.aprId, aprId), eq(aprMaterial.obrigatorio, true)))
    .orderBy(asc(material.descricao));
  return linhas.filter((l) => !(l.levou && l.fotoPath !== null)).map(({ materialId, descricao, levou }) => ({ materialId, descricao, levou }));
}

export interface MaterialConferido {
  aprId: string;
  materialId: string;
  descricao: string;
  unidade: string;
  categoria: MaterialCategoria;
  obrigatorio: boolean;
  levou: boolean;
  /** A foto do item em mãos, com a posição; nula quando não há. */
  foto: { fotoPath: string; capturadaEm: Date; latitude: number | null; longitude: number | null } | null;
}

/** A conferência das APRs pedidas (obrigatórios primeiro, depois por descrição), para o histórico da OS. */
export async function materiaisDasAprs(db: Db, aprIds: string[]): Promise<MaterialConferido[]> {
  if (aprIds.length === 0) return [];
  const linhas = await db
    .select({
      aprId: aprMaterial.aprId,
      materialId: aprMaterial.materialId,
      descricao: material.descricao,
      unidade: material.unidade,
      categoria: material.categoria,
      obrigatorio: aprMaterial.obrigatorio,
      levou: aprMaterial.levou,
      fotoPath: aprMaterial.fotoPath,
      capturadaEm: aprMaterial.capturadaEm,
      latitude: aprMaterial.latitude,
      longitude: aprMaterial.longitude,
    })
    .from(aprMaterial)
    .innerJoin(material, eq(material.id, aprMaterial.materialId))
    .where(inArray(aprMaterial.aprId, aprIds))
    .orderBy(desc(aprMaterial.obrigatorio), asc(material.descricao), asc(material.id));
  return linhas.map(({ fotoPath, capturadaEm, latitude, longitude, ...resto }) => ({
    ...resto,
    foto: fotoPath && capturadaEm ? { fotoPath, capturadaEm, latitude, longitude } : null,
  }));
}
