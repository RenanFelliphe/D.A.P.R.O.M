import { asc, desc, eq, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db/conexao";
import { modeloApr, usuario, type APR_FUNCOES, type APR_RESPOSTAS } from "../db/schema";
import type { Deps } from "../deps";
import { RespostaIAInvalida, type ImagemDeMensagem, type ProvedorIA } from "../servicos/ia";
import { RegistroIndisponivel } from "../servicos/rh";
import type { EstadoDoCampo } from "./digitalizacao";
import { extrairJson, instante } from "./digitalizacao-ia";
import { normalizar } from "./importacao-pdf";
import { lerRiscosEItens } from "./modelo-apr-banco";

/**
 * Digitalização, a APR em papel que vem junto com a folha da OS antiga: o OCR acha as folhas da APR (o título impresso e o código
 * do modelo) e a IA de visão lê o que foi escrito à mão (a data e a hora, o serviço, quem participou e a coluna marcada em cada
 * item). A leitura fica na conferência do admin, que escolhe o modelo e corrige o que errou; o registro guarda a APR à parte da
 * tabela `apr` (`os_digitalizacao_apr`): ela não é uma APR do sistema, não ampara execução, não pontua e não bloqueia nada, porque
 * o serviço já foi feito. As assinaturas e as rubricas ficam só nas imagens. A IA lê, o sistema confere e a pessoa confirma.
 */

type Funcao = (typeof APR_FUNCOES)[number];
type Resposta = (typeof APR_RESPOSTAS)[number];

export interface ModeloDaApr {
  id: string;
  codigo: string;
  versao: number;
  titulo: string;
}

export interface ParticipanteLido {
  nome: string | null;
  matricula: string | null;
  funcao: Funcao;
  /** Se a matrícula é de uma conta do sistema: o ato fica ligado a ela. Quem não tem conta (ou já saiu) fica só com nome e matrícula. */
  usuario_id: string | null;
  estado: EstadoDoCampo;
  /** O que a conferência achou da matrícula e do nome (em português). */
  aviso: string | null;
}

/** A APR em papel como a leitura a guarda e a conferência a mostra. Os itens do modelo vêm de `GET /digitalizacoes/modelos-apr`. */
export interface AprLida {
  /** As folhas do PDF que são a APR (a partir de 1). */
  paginas: number[];
  lido_por: "ia" | "nenhum";
  /** O modelo achado pelo código impresso no título (ou lido pela IA); `null` quando nada o identificou: a pessoa escolhe. */
  modelo: ModeloDaApr | null;
  /** O número da OS escrito à mão na APR, que tem de bater com o da folha da OS. */
  numero_os: string | null;
  /** `AAAA-MM-DDTHH:MM`, no horário de São Paulo. */
  data_hora: string | null;
  servico: string | null;
  participantes: ParticipanteLido[];
  respostas: { item_id: string; resposta: Resposta }[];
  avisos: string[];
}

/** Se a IA ainda pode ser chamada na leitura em curso; `motivo` preenchido = desligada (sem chave, sem cota, fora do ar). */
export interface EstadoDaIa {
  motivo: string | null;
  usou: boolean;
}

// ---- As folhas e o modelo ------------------------------------------------------------------------------------------

/** A folha é de uma APR pelo título impresso ("ANÁLISE PRELIMINAR DE RISCO"), mesmo com o OCR comendo uma letra ou outra. */
export const ehFolhaDeApr = (linhas: string[]) => linhas.some((l) => /prelimin\w* de risco|analise prelimin/.test(normalizar(l)));

/** O código do modelo impresso no título da folha ("… — APR 04" vira "APR 04"). */
export function codigoNaFolha(linhas: string[]): string | null {
  for (const l of linhas.slice(0, 12)) {
    const m = /\bapr\s*0?(\d{1,2})\b/.exec(normalizar(l));
    if (m) return `APR ${m[1]!.padStart(2, "0")}`;
  }
  return null;
}

/** A versão publicada mais recente de cada código de modelo, inclusive dos excluídos (a APR em papel é histórico). */
export async function modelosParaEscolha(db: Db): Promise<(ModeloDaApr & { arquivado: boolean })[]> {
  const linhas = await db.select().from(modeloApr).where(isNotNull(modeloApr.publicadoEm)).orderBy(asc(modeloApr.codigo), desc(modeloApr.versao));
  const vistos = new Set<string>();
  const modelos: (ModeloDaApr & { arquivado: boolean })[] = [];
  for (const l of linhas) {
    if (vistos.has(l.codigo)) continue;
    vistos.add(l.codigo);
    modelos.push({ id: l.id, codigo: l.codigo, versao: l.versao, titulo: l.titulo, arquivado: l.arquivadoEm !== null });
  }
  return modelos;
}

/** O que a conferência precisa para escolher o modelo e marcar as respostas: os itens de cada modelo, com o que o admin pode ver. */
export async function modelosComItens(db: Db) {
  const modelos = await modelosParaEscolha(db);
  return Promise.all(
    modelos.map(async (m) => {
      const { riscos, itens } = await lerRiscosEItens(db, m.id);
      const nomeDoRisco = new Map(riscos.map((r) => [r.id, r.nome]));
      return {
        ...m,
        itens: itens.map((i) => ({
          id: i.id,
          ordem: i.ordem,
          secao: i.secao,
          risco: i.riscoId ? (nomeDoRisco.get(i.riscoId) ?? null) : null,
          texto: i.texto,
          respostaBloqueante: i.respostaBloqueante,
          permiteNa: i.permiteNa,
        })),
      };
    }),
  );
}

// ---- A IA de visão -------------------------------------------------------------------------------------------------

const INSTRUCAO_DO_CABECALHO = `Você lê uma APR (Análise Preliminar de Risco) preenchida À MÃO sobre o formulário impresso, já executada no papel pela ES Gás. As imagens são as folhas da APR. Responda SOMENTE com um JSON, sem texto antes nem depois.

O que procurar:
- "modelo_codigo": o código do modelo impresso no título, como "APR 04". Escolha SOMENTE entre os códigos da lista que vem na mensagem; se não estiver legível ou não estiver na lista, null.
- "numero_os": o número da OS escrito à mão no cabeçalho (só dígitos).
- "data_hora": a data e a hora escritas à mão no cabeçalho (não a "DATA" impressa do documento), no formato AAAA-MM-DDTHH:MM. Ano com 2 dígitos é 20aa.
- "servico": o serviço escrito à mão.
- "participantes": uma entrada por linha preenchida da tabela de pessoas: "nome" como está escrito, "matricula" (só dígitos e letras, sem espaços) e "funcao": "responsavel" para o "Supervisor da Atividade" e "executor" para os demais. Linhas em branco não entram.

Regras:
- NUNCA invente. Campo que não está escrito, está ilegível ou sobre o qual você não tem certeza: null (e, em "participantes", deixe o campo nulo em vez de completar um nome plausível). Explique em "avisos".
- Dígitos (matrícula, número da OS, data e hora) são o que mais se erra: releia-os com calma.
- NÃO transcreva assinaturas nem rubricas.
- Ignore tudo o que é impresso (perguntas, riscos, o plano de emergência).

Formato da resposta:
{"modelo_codigo": string|null, "numero_os": string|null, "data_hora": string|null, "servico": string|null, "participantes": [{"nome": string|null, "matricula": string|null, "funcao": "responsavel"|"executor"}], "avisos": string[]}`;

const INSTRUCAO_DAS_RESPOSTAS = `Você lê as respostas de uma APR (Análise Preliminar de Risco) preenchida À MÃO sobre o formulário impresso. As imagens são as folhas da APR e a mensagem traz a lista numerada dos itens do modelo, na mesma ordem do formulário. Responda SOMENTE com um JSON, sem texto antes nem depois.

Cada item do formulário tem uma coluna para SIM, uma para NÃO e uma para N/A (não se aplica). Devolva, para cada item, a coluna em que está a marca (✓, X ou traço): "sim", "nao" ou "na".

Regras:
- Item sem marca (como a medida de um risco que não foi marcado, que fica em branco no papel), com duas marcas ou sobre o qual você não tem certeza: null. NUNCA invente uma resposta.
- Cada item da lista tem de aparecer uma vez, pelo número dele.
- Releia as linhas com calma: é fácil marcar a linha de cima ou a de baixo.

Formato da resposta:
{"respostas": [{"item": number, "resposta": "sim"|"nao"|"na"|null}], "avisos": string[]}`;

const ESQUEMA_DO_CABECALHO = {
  type: "object",
  properties: {
    modelo_codigo: { type: ["string", "null"] },
    numero_os: { type: ["string", "null"] },
    data_hora: { type: ["string", "null"] },
    servico: { type: ["string", "null"] },
    participantes: {
      type: "array",
      items: {
        type: "object",
        properties: { nome: { type: ["string", "null"] }, matricula: { type: ["string", "null"] }, funcao: { type: "string", enum: ["responsavel", "executor"] } },
        required: ["nome", "matricula", "funcao"],
      },
    },
    avisos: { type: "array", items: { type: "string" } },
  },
  required: ["modelo_codigo", "numero_os", "data_hora", "servico", "participantes", "avisos"],
} as const;

const ESQUEMA_DAS_RESPOSTAS = {
  type: "object",
  properties: {
    respostas: {
      type: "array",
      items: { type: "object", properties: { item: { type: "integer" }, resposta: { type: ["string", "null"], enum: ["sim", "nao", "na", null] } }, required: ["item", "resposta"] },
    },
    avisos: { type: "array", items: { type: "string" } },
  },
  required: ["respostas", "avisos"],
} as const;

const texto = (maximo: number) =>
  z
    .string()
    .nullable()
    .transform((t) => (t && t.trim() ? t.trim().slice(0, maximo) : null))
    .catch(null)
    .default(null);

const esquemaCabecalho = z.object({
  modelo_codigo: texto(20),
  numero_os: texto(20).transform((t) => t?.replace(/\D/g, "") || null),
  data_hora: instante.catch(null).default(null),
  servico: texto(500),
  participantes: z
    .array(
      z.object({
        nome: texto(200),
        matricula: texto(30).transform((t) => t?.replace(/\s+/g, "") || null),
        funcao: z.enum(["responsavel", "executor"]).catch("executor").default("executor"),
      }),
    )
    .catch([])
    .default([]),
  avisos: z.array(z.string()).catch([]).default([]),
});
export type CabecalhoLido = z.infer<typeof esquemaCabecalho>;

const esquemaRespostas = z.object({
  respostas: z
    .array(z.object({ item: z.number().int(), resposta: z.enum(["sim", "nao", "na"]).nullable().catch(null).default(null) }))
    .catch([])
    .default([]),
  avisos: z.array(z.string()).catch([]).default([]),
});

/** O cabeçalho da APR e quem participou. `IAIndisponivel` e `RespostaIAInvalida` sobem para quem chama, que segue sem a IA. */
export async function lerCabecalhoDaApr(ia: ProvedorIA, imagens: ImagemDeMensagem[], modelos: ModeloDaApr[]): Promise<CabecalhoLido> {
  const lista = modelos.map((m) => `- ${m.codigo}: ${m.titulo}`).join("\n");
  const resposta = await ia.conversar({
    modelo: "digitalizacao",
    mensagens: [
      { papel: "sistema", texto: INSTRUCAO_DO_CABECALHO, cache: true },
      { papel: "usuario", texto: `Modelos de APR que existem:\n${lista}\n\nLeia o cabeçalho e as pessoas desta APR e responda com o JSON.`, imagens },
    ],
    schemaDeSaida: ESQUEMA_DO_CABECALHO,
    maxTokens: 2000,
    tempoLimiteMs: 120_000,
  });
  const lido = esquemaCabecalho.safeParse(extrairJson(resposta));
  if (!lido.success) throw new RespostaIAInvalida("A IA devolveu um JSON fora do formato esperado");
  return { ...lido.data, participantes: lido.data.participantes.filter((p) => p.nome || p.matricula).slice(0, 20) };
}

/** A resposta de cada item do modelo (`ordem` do item → resposta); o que a IA deixou em branco ou inventou fora da lista não entra. */
export async function lerRespostasDaApr(
  ia: ProvedorIA,
  imagens: ImagemDeMensagem[],
  itens: { ordem: number; texto: string }[],
): Promise<{ respostas: Map<number, Resposta>; avisos: string[] }> {
  const lista = itens.map((i) => `${i.ordem}. ${i.texto}`).join("\n");
  const resposta = await ia.conversar({
    modelo: "digitalizacao",
    mensagens: [
      { papel: "sistema", texto: INSTRUCAO_DAS_RESPOSTAS, cache: true },
      { papel: "usuario", texto: `Itens do modelo, na ordem do formulário:\n${lista}\n\nLeia a marca de cada item nas folhas e responda com o JSON.`, imagens },
    ],
    schemaDeSaida: ESQUEMA_DAS_RESPOSTAS,
    maxTokens: 4000,
    tempoLimiteMs: 120_000,
  });
  const lido = esquemaRespostas.safeParse(extrairJson(resposta));
  if (!lido.success) throw new RespostaIAInvalida("A IA devolveu um JSON fora do formato esperado");
  const validas = new Set(itens.map((i) => i.ordem));
  const respostas = new Map<number, Resposta>();
  for (const r of lido.data.respostas) if (r.resposta && validas.has(r.item) && !respostas.has(r.item)) respostas.set(r.item, r.resposta);
  return { respostas, avisos: lido.data.avisos };
}

// ---- As conferências -----------------------------------------------------------------------------------------------

/** O nome escrito confere com o do cadastro quando cada parte dele está lá (a pessoa pode ter escrito só o primeiro e o último). */
export function mesmoNome(escrito: string, cadastrado: string): boolean {
  const partes = normalizar(escrito).split(" ").filter(Boolean);
  const nomes = new Set(normalizar(cadastrado).split(" "));
  return partes.length > 0 && partes.every((p) => nomes.has(p));
}

/**
 * Confere cada participante com o cadastro: a matrícula tem de ser de uma conta do sistema ou do registro de funcionários, e o
 * nome escrito tem de ser o dela. Quem não tem conta fica só com nome e matrícula (decisão 6 da seção 10.13 do vitoria.md).
 */
export async function conferirParticipantes(deps: Deps, lidos: Pick<ParticipanteLido, "nome" | "matricula" | "funcao">[]): Promise<ParticipanteLido[]> {
  const conferidos: ParticipanteLido[] = [];
  for (const p of lidos) {
    const base = { nome: p.nome, matricula: p.matricula, funcao: p.funcao, usuario_id: null as string | null };
    if (!p.matricula) {
      conferidos.push({ ...base, estado: p.nome ? "duvidoso" : "faltando", aviso: "Sem matrícula: nada confirma quem é." });
      continue;
    }
    const [conta] = await deps.db.select({ id: usuario.id, nome: usuario.nome }).from(usuario).where(eq(usuario.matricula, p.matricula));
    let cadastrado: string | null = conta?.nome ?? null;
    let aviso: string | null = null;
    if (!cadastrado) {
      try {
        cadastrado = (await deps.rh.obterFuncionario(p.matricula))?.nome ?? null;
      } catch (erro) {
        if (!(erro instanceof RegistroIndisponivel)) throw erro;
        aviso = "O registro de funcionários não respondeu: a matrícula ficou sem conferência.";
      }
    }
    if (!cadastrado) {
      conferidos.push({ ...base, estado: "duvidoso", aviso: aviso ?? `A matrícula ${p.matricula} não está no sistema nem no registro de funcionários: confira cada dígito.` });
    } else if (!p.nome) {
      conferidos.push({ ...base, usuario_id: conta?.id ?? null, estado: "duvidoso", aviso: `A matrícula ${p.matricula} é de ${cadastrado}: o nome não foi lido.` });
    } else if (mesmoNome(p.nome, cadastrado)) {
      conferidos.push({ ...base, usuario_id: conta?.id ?? null, estado: "confere", aviso });
    } else {
      conferidos.push({ ...base, usuario_id: conta?.id ?? null, estado: "duvidoso", aviso: `A matrícula ${p.matricula} é de ${cadastrado}, mas a folha diz "${p.nome}": um dos dois está errado.` });
    }
  }
  return conferidos;
}
