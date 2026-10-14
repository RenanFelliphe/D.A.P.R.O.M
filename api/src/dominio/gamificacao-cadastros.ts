import { randomUUID } from "node:crypto";
import { eq, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import {
  CRITERIOS,
  REGRA_CODIGOS,
  conquista,
  conquistaEquipe,
  conquistaUsuario,
  patente,
  regraPontuacao,
  temporadaEquipe,
  temporadaUsuario,
  type Criterio,
  type RegraCodigo,
} from "../db/schema";
import type { Deps } from "../deps";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { ErroApi, codigoPostgres, conflito, invalido, naoEncontrado, restricaoPostgres } from "../http/erros";
import { uuid } from "../http/validacao";
import { diferencas, registrarAuditoria } from "./auditoria";
import { CRITERIOS_INFO, conferirTodos } from "./conquistas";
import { listarConquistas } from "./gamificacao-leituras";
import { lerImagem } from "./imagem";
import { caminhoDaImagem, caminhosDasImagens, patenteParaApi, urlsDasImagens, type DeQuem } from "./patentes";
import { REGRAS } from "./regras-de-pontuacao";

/**
 * O cadastro do admin (seções 3.2, 7.2 e 2 do `gameficacao.md`): o valor e o estado de cada tarefa, as patentes e as
 * conquistas, cada um com a auditoria. As imagens (PNG, JPEG ou WebP, até 1 MB, quadradas) ficam no bucket `gamificacao`; cada
 * patente tem duas, uma para as pessoas e uma para as equipes.
 */

const MB = 1024 * 1024;
export const LIMITE_DA_IMAGEM = 1 * MB;
const LADO_MINIMO = 64;
const LADO_MAXIMO = 4096;

type Ator = Pick<UsuarioAutenticado, "id" | "nome">;

const booleano = z.union([z.boolean(), z.enum(["true", "false"]).transform((v) => v === "true")]);
const vazioViraNulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

// ---- Imagem -----------------------------------------------------------------------------------------------------

/** Confere o arquivo (conteúdo, tamanho e proporção) e o grava no bucket com um id novo. Devolve o caminho. */
async function salvarImagem(deps: Deps, arquivo: unknown, campo = "imagem"): Promise<string> {
  if (!(arquivo instanceof File)) throw invalido("validacao", `${campo}: envie a imagem no campo multipart "${campo}"`);
  if (arquivo.size === 0) throw invalido("arquivo_vazio", "Arquivo vazio");
  if (arquivo.size > LIMITE_DA_IMAGEM) throw new ErroApi(413, "arquivo_grande", "A imagem tem mais de 1 MB");
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const lida = lerImagem(bytes);
  if (!lida) throw invalido("tipo_de_arquivo", "Envie uma imagem PNG, JPEG ou WebP");
  if (lida.largura !== lida.altura) throw invalido("imagem_nao_quadrada", `A imagem precisa ser quadrada (512 × 512 é o recomendado); esta tem ${lida.largura} × ${lida.altura}`);
  if (lida.largura < LADO_MINIMO || lida.largura > LADO_MAXIMO) throw invalido("imagem_fora_do_tamanho", `A imagem precisa ter entre ${LADO_MINIMO} e ${LADO_MAXIMO} pixels de lado`);
  const caminho = randomUUID();
  await deps.armazenamento.gravar("gamificacao", caminho, bytes, lida.tipoMime);
  return caminho;
}

const apagarImagem = (deps: Deps, caminho: string | null | undefined) => (caminho ? deps.armazenamento.remover("gamificacao", caminho).catch(() => {}) : Promise.resolve());

/**
 * Apaga o arquivo de uma imagem de patente, a não ser que alguma patente ainda o use (nas patentes anteriores à imagem de equipe,
 * a migração deixou as duas imagens apontando para o mesmo arquivo; trocar só uma não pode apagar a outra). Chamar depois de a
 * linha ser atualizada ou excluída.
 */
async function apagarImagemDaPatente(deps: Deps, caminho: string): Promise<void> {
  const [uso] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(patente).where(or(eq(patente.imagemPath, caminho), eq(patente.imagemEquipePath, caminho)));
  if ((uso?.n ?? 0) === 0) await apagarImagem(deps, caminho);
}

/** Traduz a violação de uma restrição única do cadastro na mensagem para o admin. */
function recusarDuplicado(erro: unknown, mensagens: Record<string, [string, string]>): never {
  if (codigoPostgres(erro) === "23505") {
    const m = mensagens[restricaoPostgres(erro) ?? ""];
    if (m) throw conflito(m[0], m[1]);
  }
  throw erro;
}

// ---- Tarefas -----------------------------------------------------------------------------------------------------

export const esquemaRegra = z
  .object({ pontos: z.number().int("Use um número inteiro").min(0, "Os pontos não podem ser negativos").max(1000, "No máximo 1.000 pontos por tarefa").optional(), ativa: z.boolean().optional() })
  .refine((r) => r.pontos !== undefined || r.ativa !== undefined, { message: "Informe pontos, ativa ou os dois" });

/** `PATCH /gamificacao/regras/{codigo}`: muda o valor e o estado de uma tarefa; vale dali em diante (o extrato não muda). */
export async function editarRegra(deps: Deps, ator: Ator, codigo: string, dados: z.infer<typeof esquemaRegra>) {
  if (!(REGRA_CODIGOS as readonly string[]).includes(codigo)) throw naoEncontrado("Tarefa não encontrada");
  const regra = codigo as RegraCodigo;
  if (regra === "conquista_obtida" && dados.pontos !== undefined) throw invalido("sem_valor_proprio", "Os pontos de cada conquista são definidos nela; aqui só se liga ou desliga");
  const [antes] = await deps.db.select().from(regraPontuacao).where(eq(regraPontuacao.codigo, codigo));
  if (!antes) throw naoEncontrado("Tarefa não encontrada");

  const [depois] = await deps.db
    .update(regraPontuacao)
    .set({ ...(dados.pontos !== undefined && { pontos: dados.pontos }), ...(dados.ativa !== undefined && { ativa: dados.ativa }), atualizadaEm: deps.agora(), atualizadaPor: ator.id })
    .where(eq(regraPontuacao.codigo, codigo))
    .returning();
  const mudancas = diferencas({ pontos: antes.pontos, ativa: antes.ativa }, { pontos: depois!.pontos, ativa: depois!.ativa });
  if (Object.keys(mudancas).length > 0) {
    const nome = REGRAS[regra].nome;
    const partes: string[] = [];
    if ("pontos" in mudancas) partes.push(`o valor de ${antes.pontos} para ${depois!.pontos} pontos`);
    if ("ativa" in mudancas) partes.push(depois!.ativa ? "ativou" : "desativou");
    await registrarAuditoria(deps.db, ator, {
      entidade: "regra_pontuacao",
      verbo: "ativa" in mudancas && !("pontos" in mudancas) ? (depois!.ativa ? "ativar" : "desativar") : "editar",
      entidadeId: codigo,
      alvo: nome,
      resumo: "ativa" in mudancas && !("pontos" in mudancas) ? `${depois!.ativa ? "Ativou" : "Desativou"} a tarefa "${nome}"` : `Mudou ${partes.join(" e ")} da tarefa "${nome}"`,
      detalhes: mudancas,
    });
  }
  return { codigo, pontos: depois!.pontos, ativa: depois!.ativa };
}

// ---- Patentes ----------------------------------------------------------------------------------------------------

const corDaPatente = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Use a cor no formato #RRGGBB");

export const esquemaNovaPatente = z.object({
  nome: z.string().trim().min(1, "Informe o nome").max(40, "No máximo 40 caracteres"),
  pontos_necessarios: z.coerce.number().int("Use um número inteiro").min(0, "A pontuação não pode ser negativa").max(1_000_000),
  cor: corDaPatente,
  descricao: z.preprocess(vazioViraNulo, z.string().trim().max(300, "No máximo 300 caracteres").nullish()),
  ativa: booleano.default(true),
});

export const esquemaEdicaoDaPatente = z
  .object({
    nome: z.string().trim().min(1).max(40),
    pontos_necessarios: z.number().int().min(0).max(1_000_000),
    cor: corDaPatente,
    descricao: z.preprocess(vazioViraNulo, z.string().trim().max(300).nullable()),
    ativa: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo" });

const MENSAGENS_DA_PATENTE: Record<string, [string, string]> = {
  patente_nome_unique: ["nome_duplicado", "Já existe uma patente com esse nome"],
  patente_pontos_ativas_idx: ["pontos_duplicados", "Já existe uma patente ativa com essa pontuação necessária"],
};

/** Mudar uma patente pode fazer alguém cumprir uma conquista de patente: confere todo mundo. */
const conferirConquistas = (deps: Deps, opcoes: { soConquista?: string } = {}) => deps.db.transaction(async (tx) => conferirTodos({ tx: tx as unknown as Db, agora: deps.agora() }, opcoes));

/**
 * `POST /gamificacao/patentes` (multipart: os campos, a `imagem` das pessoas e a `imagem_equipe` das equipes). As duas são
 * obrigatórias e cada uma vira um arquivo próprio: só ficam iguais se o admin enviar a mesma imagem nos dois campos.
 */
export async function criarPatente(deps: Deps, ator: Ator, corpo: unknown, arquivo: unknown, arquivoDaEquipe: unknown) {
  const d = esquemaNovaPatente.safeParse(corpo);
  if (!d.success) throw invalido("validacao", `${d.error.issues[0]?.path.join(".")}: ${d.error.issues[0]?.message}`);
  const caminho = await salvarImagem(deps, arquivo);
  let caminhoDaEquipe: string;
  try {
    caminhoDaEquipe = await salvarImagem(deps, arquivoDaEquipe, "imagem_equipe");
  } catch (erro) {
    await apagarImagem(deps, caminho);
    throw erro;
  }
  let criada: typeof patente.$inferSelect;
  try {
    [criada] = (await deps.db
      .insert(patente)
      .values({ nome: d.data.nome, pontosNecessarios: d.data.pontos_necessarios, cor: d.data.cor.toUpperCase(), descricao: d.data.descricao ?? null, ativa: d.data.ativa, imagemPath: caminho, imagemEquipePath: caminhoDaEquipe })
      .returning()) as [typeof criada];
  } catch (erro) {
    await Promise.all([apagarImagem(deps, caminho), apagarImagem(deps, caminhoDaEquipe)]);
    recusarDuplicado(erro, MENSAGENS_DA_PATENTE);
  }
  await registrarAuditoria(deps.db, ator, {
    entidade: "patente",
    verbo: "criar",
    entidadeId: criada.id,
    alvo: criada.nome,
    resumo: `Criou a patente "${criada.nome}" (a partir de ${criada.pontosNecessarios} pontos)`,
    detalhes: { pontos_necessarios: criada.pontosNecessarios, cor: criada.cor, ativa: criada.ativa },
  });
  await conferirConquistas(deps);
  return patenteParaApi(criada, await urlsDasImagens(deps, caminhosDasImagens(criada)));
}

/** `PATCH /gamificacao/patentes/{id}`. Mudar vale na hora para a temporada aberta; as fechadas guardam a patente gravada. */
export async function editarPatente(deps: Deps, ator: Ator, id: string, dados: z.infer<typeof esquemaEdicaoDaPatente>) {
  const [antes] = await deps.db.select().from(patente).where(eq(patente.id, id));
  if (!antes) throw naoEncontrado("Patente não encontrada");
  let depois: typeof patente.$inferSelect;
  try {
    [depois] = (await deps.db
      .update(patente)
      .set({
        ...(dados.nome !== undefined && { nome: dados.nome }),
        ...(dados.pontos_necessarios !== undefined && { pontosNecessarios: dados.pontos_necessarios }),
        ...(dados.cor !== undefined && { cor: dados.cor.toUpperCase() }),
        ...(dados.descricao !== undefined && { descricao: dados.descricao }),
        ...(dados.ativa !== undefined && { ativa: dados.ativa }),
        atualizadaEm: deps.agora(),
      })
      .where(eq(patente.id, id))
      .returning()) as [typeof depois];
  } catch (erro) {
    recusarDuplicado(erro, MENSAGENS_DA_PATENTE);
  }
  const campos = (p: typeof antes) => ({ nome: p.nome, pontos_necessarios: p.pontosNecessarios, cor: p.cor, descricao: p.descricao, ativa: p.ativa });
  const mudancas = diferencas(campos(antes), campos(depois));
  const nomes = Object.keys(mudancas);
  if (nomes.length > 0) {
    const soAtiva = nomes.length === 1 && nomes[0] === "ativa";
    await registrarAuditoria(deps.db, ator, {
      entidade: "patente",
      verbo: soAtiva ? (depois.ativa ? "ativar" : "desativar") : "editar",
      entidadeId: id,
      alvo: depois.nome,
      resumo: soAtiva ? `${depois.ativa ? "Reativou" : "Desativou"} a patente "${depois.nome}"` : `Editou a patente "${depois.nome}" (${nomes.join(", ")})`,
      detalhes: mudancas,
    });
    if ("pontos_necessarios" in mudancas || "ativa" in mudancas) await conferirConquistas(deps);
  }
  return patenteParaApi(depois, await urlsDasImagens(deps, caminhosDasImagens(depois)));
}

/**
 * `PUT /gamificacao/patentes/{id}/imagem` (a das pessoas) e `PUT /gamificacao/patentes/{id}/imagem-equipe` (a das equipes): troca
 * só a imagem pedida e apaga o arquivo antigo. A outra imagem não muda: cada uma é escolhida à parte.
 */
async function trocarImagem(deps: Deps, ator: Ator, id: string, arquivo: unknown, de: DeQuem) {
  const [antes] = await deps.db.select().from(patente).where(eq(patente.id, id));
  if (!antes) throw naoEncontrado("Patente não encontrada");
  const caminho = await salvarImagem(deps, arquivo, de === "equipe" ? "imagem_equipe" : "imagem");
  const [depois] = await deps.db
    .update(patente)
    .set({ ...(de === "equipe" ? { imagemEquipePath: caminho } : { imagemPath: caminho }), atualizadaEm: deps.agora() })
    .where(eq(patente.id, id))
    .returning();
  await apagarImagemDaPatente(deps, caminhoDaImagem(antes, de));
  await registrarAuditoria(deps.db, ator, {
    entidade: "patente",
    verbo: "imagem",
    entidadeId: id,
    alvo: antes.nome,
    resumo: `Trocou a imagem ${de === "equipe" ? "das equipes" : "das pessoas"} da patente "${antes.nome}"`,
    detalhes: { imagem: de },
  });
  return patenteParaApi(depois!, await urlsDasImagens(deps, caminhosDasImagens(depois!)));
}

export const trocarImagemDaPatente = (deps: Deps, ator: Ator, id: string, arquivo: unknown) => trocarImagem(deps, ator, id, arquivo, "pessoa");

export const trocarImagemDaEquipeDaPatente = (deps: Deps, ator: Ator, id: string, arquivo: unknown) => trocarImagem(deps, ator, id, arquivo, "equipe");

/**
 * `DELETE /gamificacao/patentes/{id}`: só vale para a patente que nunca foi gravada numa temporada fechada nem é meta de uma
 * conquista; nos outros casos o admin a desativa.
 */
export async function excluirPatente(deps: Deps, ator: Ator, id: string) {
  const [p] = await deps.db.select().from(patente).where(eq(patente.id, id));
  if (!p) throw naoEncontrado("Patente não encontrada");
  const [gravada] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(temporadaUsuario).where(eq(temporadaUsuario.patenteId, id));
  const [gravadaEquipe] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(temporadaEquipe).where(eq(temporadaEquipe.patenteId, id));
  const [meta] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(conquista).where(eq(conquista.patenteId, id));
  if ((gravada?.n ?? 0) + (gravadaEquipe?.n ?? 0) > 0) throw conflito("patente_em_uso", "Esta patente já foi gravada numa temporada fechada: desative-a em vez de excluir");
  if ((meta?.n ?? 0) > 0) throw conflito("patente_em_uso", "Esta patente é a meta de uma conquista: desative-a em vez de excluir");
  await deps.db.delete(patente).where(eq(patente.id, id));
  for (const caminho of new Set(caminhosDasImagens(p))) await apagarImagemDaPatente(deps, caminho);
  await registrarAuditoria(deps.db, ator, { entidade: "patente", verbo: "excluir", entidadeId: id, alvo: p.nome, resumo: `Excluiu a patente "${p.nome}"` });
}

// ---- Conquistas --------------------------------------------------------------------------------------------------

const idDePatente = z.preprocess(vazioViraNulo, uuid.nullish());

export const esquemaNovaConquista = z.object({
  titulo: z.string().trim().min(1, "Informe o título").max(80, "No máximo 80 caracteres"),
  descricao: z.string().trim().min(1, "Informe a descrição").max(300, "No máximo 300 caracteres"),
  criterio: z.enum(CRITERIOS),
  quantidade: z.coerce.number().int("Use um número inteiro").min(1, "A quantidade é de ao menos 1").max(1_000_000).default(1),
  patente_id: idDePatente,
  pontos: z.coerce.number().int("Use um número inteiro").min(0, "Os pontos não podem ser negativos").max(1000, "No máximo 1.000 pontos").default(0),
  ativa: booleano.default(true),
});

export const esquemaEdicaoDaConquista = z
  .object({
    titulo: z.string().trim().min(1).max(80),
    descricao: z.string().trim().min(1).max(300),
    criterio: z.enum(CRITERIOS),
    quantidade: z.number().int().min(1).max(1_000_000),
    patente_id: uuid.nullable(),
    pontos: z.number().int().min(0).max(1000),
    ativa: z.boolean(),
  })
  .partial()
  .refine((d) => Object.keys(d).length > 0, { message: "Informe ao menos um campo" });

interface DadosDaConquista {
  titulo: string;
  descricao: string;
  criterio: Criterio;
  quantidade: number;
  patenteId: string | null;
  pontos: number;
  ativa: boolean;
}

/** Ajusta a meta ao critério (quantidade fixa no treino e nas patentes, pontos zero nas de equipe) e confere a patente-meta. */
async function normalizar(db: Db, d: DadosDaConquista): Promise<DadosDaConquista> {
  const info = CRITERIOS_INFO[d.criterio];
  if (info.pedePatente) {
    if (!d.patenteId) throw invalido("patente_obrigatoria", "Escolha a patente que é a meta desta conquista");
    const [p] = await db.select({ id: patente.id }).from(patente).where(eq(patente.id, d.patenteId));
    if (!p) throw invalido("patente_inexistente", "A patente escolhida não existe");
  }
  return { ...d, quantidade: info.pedeQuantidade ? d.quantidade : 1, patenteId: info.pedePatente ? d.patenteId : null, pontos: info.tipo === "equipe" ? 0 : d.pontos };
}

const MENSAGENS_DA_CONQUISTA: Record<string, [string, string]> = { conquista_titulo_unique: ["titulo_duplicado", "Já existe uma conquista com esse título"] };

async function conquistaParaApi(deps: Deps, ator: UsuarioAutenticado | Ator, id: string, eu?: UsuarioAutenticado) {
  const lista = await listarConquistas(deps, (eu ?? ator) as UsuarioAutenticado);
  return lista.conquistas.find((c) => c.id === id)!;
}

/** `POST /gamificacao/conquistas` (multipart: os campos e a `imagem`). Valendo para o passado: quem já bateu a meta recebe na hora. */
export async function criarConquista(deps: Deps, eu: UsuarioAutenticado, corpo: unknown, arquivo: unknown) {
  const d = esquemaNovaConquista.safeParse(corpo);
  if (!d.success) throw invalido("validacao", `${d.error.issues[0]?.path.join(".")}: ${d.error.issues[0]?.message}`);
  const dados = await normalizar(deps.db, { titulo: d.data.titulo, descricao: d.data.descricao, criterio: d.data.criterio, quantidade: d.data.quantidade, patenteId: d.data.patente_id ?? null, pontos: d.data.pontos, ativa: d.data.ativa });
  const caminho = await salvarImagem(deps, arquivo);
  let criada: typeof conquista.$inferSelect;
  try {
    [criada] = (await deps.db.insert(conquista).values({ ...dados, imagemPath: caminho, criadaPor: eu.id }).returning()) as [typeof criada];
  } catch (erro) {
    await apagarImagem(deps, caminho);
    recusarDuplicado(erro, MENSAGENS_DA_CONQUISTA);
  }
  await registrarAuditoria(deps.db, eu, {
    entidade: "conquista",
    verbo: "criar",
    entidadeId: criada.id,
    alvo: criada.titulo,
    resumo: `Criou a conquista "${criada.titulo}"`,
    detalhes: { criterio: criada.criterio, quantidade: criada.quantidade, pontos: criada.pontos, ativa: criada.ativa },
  });
  if (criada.ativa) await conferirConquistas(deps, { soConquista: criada.id });
  return conquistaParaApi(deps, eu, criada.id);
}

/**
 * `PATCH /gamificacao/conquistas/{id}`. Quem já tem a conquista não perde; se a meta baixar, quem passa a cumpri-la recebe;
 * reativar também confere todo mundo. Mudar os pontos vale dali em diante. Pessoa e equipe não se trocam.
 */
export async function editarConquista(deps: Deps, eu: UsuarioAutenticado, id: string, dados: z.infer<typeof esquemaEdicaoDaConquista>) {
  const [antes] = await deps.db.select().from(conquista).where(eq(conquista.id, id));
  if (!antes) throw naoEncontrado("Conquista não encontrada");
  const mesclado = await normalizar(deps.db, {
    titulo: dados.titulo ?? antes.titulo,
    descricao: dados.descricao ?? antes.descricao,
    criterio: dados.criterio ?? antes.criterio,
    quantidade: dados.quantidade ?? antes.quantidade,
    patenteId: dados.patente_id !== undefined ? dados.patente_id : antes.patenteId,
    pontos: dados.pontos ?? antes.pontos,
    ativa: dados.ativa ?? antes.ativa,
  });
  if (CRITERIOS_INFO[mesclado.criterio].tipo !== CRITERIOS_INFO[antes.criterio].tipo) {
    throw invalido("tipo_imutavel", "Uma conquista de pessoa não vira de equipe (nem o contrário): crie outra");
  }
  let depois: typeof conquista.$inferSelect;
  try {
    [depois] = (await deps.db.update(conquista).set(mesclado).where(eq(conquista.id, id)).returning()) as [typeof depois];
  } catch (erro) {
    recusarDuplicado(erro, MENSAGENS_DA_CONQUISTA);
  }
  const campos = (c: typeof antes) => ({ titulo: c.titulo, descricao: c.descricao, criterio: c.criterio, quantidade: c.quantidade, patente_id: c.patenteId, pontos: c.pontos, ativa: c.ativa });
  const mudancas = diferencas(campos(antes), campos(depois));
  const nomes = Object.keys(mudancas);
  if (nomes.length > 0) {
    const soAtiva = nomes.length === 1 && nomes[0] === "ativa";
    await registrarAuditoria(deps.db, eu, {
      entidade: "conquista",
      verbo: soAtiva ? (depois.ativa ? "ativar" : "desativar") : "editar",
      entidadeId: id,
      alvo: depois.titulo,
      resumo: soAtiva ? `${depois.ativa ? "Reativou" : "Desativou"} a conquista "${depois.titulo}"` : `Editou a conquista "${depois.titulo}" (${nomes.join(", ")})`,
      detalhes: mudancas,
    });
  }
  // A meta mudou ou a conquista voltou a valer: quem já a cumpre recebe na hora.
  const metaMudou = ["criterio", "quantidade", "patente_id", "ativa"].some((c) => c in mudancas);
  if (depois.ativa && metaMudou) await conferirConquistas(deps, { soConquista: id });
  return conquistaParaApi(deps, eu, id);
}

/** `PUT /gamificacao/conquistas/{id}/imagem`. */
export async function trocarImagemDaConquista(deps: Deps, eu: UsuarioAutenticado, id: string, arquivo: unknown) {
  const [antes] = await deps.db.select().from(conquista).where(eq(conquista.id, id));
  if (!antes) throw naoEncontrado("Conquista não encontrada");
  const caminho = await salvarImagem(deps, arquivo);
  await deps.db.update(conquista).set({ imagemPath: caminho }).where(eq(conquista.id, id));
  await apagarImagem(deps, antes.imagemPath);
  await registrarAuditoria(deps.db, eu, { entidade: "conquista", verbo: "imagem", entidadeId: id, alvo: antes.titulo, resumo: `Trocou a imagem da conquista "${antes.titulo}"` });
  return conquistaParaApi(deps, eu, id);
}

/** `DELETE /gamificacao/conquistas/{id}`: só se ninguém a tem; senão o admin a desativa. */
export async function excluirConquista(deps: Deps, eu: UsuarioAutenticado, id: string) {
  const [c] = await deps.db.select().from(conquista).where(eq(conquista.id, id));
  if (!c) throw naoEncontrado("Conquista não encontrada");
  const [pessoas] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(conquistaUsuario).where(eq(conquistaUsuario.conquistaId, id));
  const [times] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(conquistaEquipe).where(eq(conquistaEquipe.conquistaId, id));
  if ((pessoas?.n ?? 0) + (times?.n ?? 0) > 0) throw conflito("conquista_em_uso", "Alguém já obteve esta conquista: desative-a em vez de excluir");
  await deps.db.delete(conquista).where(eq(conquista.id, id));
  await apagarImagem(deps, c.imagemPath);
  await registrarAuditoria(deps.db, eu, { entidade: "conquista", verbo: "excluir", entidadeId: id, alvo: c.titulo, resumo: `Excluiu a conquista "${c.titulo}"` });
}
