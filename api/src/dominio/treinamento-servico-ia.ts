import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { impressaoDoItem, itemSemRevisao, type MetaIA, type PendenciaDoItem } from "../../../shared/treinamento-servico/ia";
import { atividade, atividadeMaterial, material, treinamentoServicoVersao } from "../db/schema";
import type { Deps } from "../deps";
import { conflito, ErroApi, invalido, naoEncontrado } from "../http/erros";
import { IAIndisponivel, type BlocoDeMensagem, type PedidoDeTexto } from "../servicos/ia";
import { obterOuCriarRascunho, rascunhoDoTreinamento, rascunhoParaEditor, treinamentoDoCodigo, versaoPublicadaDoTreinamento, type RascunhoDoEditor } from "./treinamento-servico";
import {
  EXPRESSOES_VITORIA,
  esquemaFase,
  esquemaPassoExplicacao,
  validarConteudo,
  validarFasesContraCatalogo,
  type ExpressaoVitoria,
  type FaseEntrada,
  type PassoExplicacao,
} from "./treinamento-servico-esquema";

/**
 * O rascunho de treinamento pela IA (seção 3.6 do `vitoria.md`): o admin cola o texto do procedimento e a IA preenche
 * o rascunho no formato do editor; depois, ajustes pelo chat e "regerar esta fase". A IA é apoio: o editor manual
 * continua sendo a base, e sem a chave o botão some.
 *
 * - **O que vai à IA:** o texto do admin, o código e a descrição do serviço e os materiais dele no catálogo (com códigos
 *   curtos, `M1`, `M2`…, nunca o id). Nunca o modelo de APR, os tipos de item nem as respostas que bloqueiam.
 * - **O formato:** linhas JSON, um objeto por item, pedidas pela instrução. Cada objeto que fecha no streaming vira um
 *   passo de progresso ("montando a fase 5 de 10…"), e um item fora do formato é descartado sozinho, sem perder o resto.
 * - **As conferências** (trecho de origem que não está no texto, número que não aparece no texto, fase sem opção certa ou
 *   com mais de uma, material fora da lista do serviço, texto cortado) viram pendências no item (`shared/treinamento-servico/ia.ts`),
 *   que impedem publicar até o admin editar o item ou confirmá-lo.
 * - **Os limites** (variáveis de ambiente, `config.treinamentoIa`): quantos treinamentos podem usar a IA e quantas rodadas
 *   cada um tem. A primeira geração não conta como rodada; cada pedido no chat, fase regerada ou nova geração conta uma.
 *   Só a chamada que deu certo e foi gravada conta.
 */

type DepsDaIA = Pick<Deps, "db" | "ia" | "config">;

/**
 * O padrão do módulo de IA é 60 s; a geração leva minutos. Na conferência contra o Gemini gratuito (17/10/2026), o modelo
 * pensou 229 s antes de mandar o primeiro item; a tela mostra o progresso e o tempo corrido enquanto isso.
 */
const TEMPO_LIMITE_MS = 360_000;
export const LIMITE_TEXTO_PROCEDIMENTO = 20_000;

// ---- Situação e limites --------------------------------------------------------------------------------------------

export interface SituacaoIATreinamento {
  /** Há chave de IA configurada; sem ela, o botão de gerar some. */
  disponivel: boolean;
  /** Este treinamento já usou a IA (ocupa uma das vagas de `limiteTreinamentos`). */
  usaIa: boolean;
  treinamentosUsados: number;
  limiteTreinamentos: number;
  /** As rodadas deste treinamento, somando todas as versões. */
  rodadasUsadas: number;
  limiteRodadas: number;
  podeGerar: boolean;
  /** Pedir ajuste no chat ou regerar uma fase: só depois de uma geração (precisa do texto de origem). */
  podeAjustar: boolean;
  /** Por que o botão está desativado, quando está. */
  motivo: string | null;
}

const MOTIVO_LIMITE = "Limite da demonstração atingido";

export async function situacaoDaIA(deps: DepsDaIA, atividadeCodigo: string): Promise<SituacaoIATreinamento> {
  const { limiteTreinamentos, limiteRodadas } = deps.config.treinamentoIa;
  const disponivel = deps.ia.disponivel();
  const [usados] = await deps.db
    .select({ total: sql<number>`count(distinct ${treinamentoServicoVersao.treinamentoId})::int` })
    .from(treinamentoServicoVersao)
    .where(eq(treinamentoServicoVersao.geradoComIa, true));
  const treinamentosUsados = usados?.total ?? 0;

  const treinamento = await treinamentoDoCodigo(deps.db, atividadeCodigo);
  let usaIa = false;
  let rodadasUsadas = 0;
  let temTextoOrigem = false;
  if (treinamento) {
    const [soma] = await deps.db
      .select({
        rodadas: sql<number>`coalesce(sum(${treinamentoServicoVersao.rodadasIa}), 0)::int`,
        comIa: sql<boolean>`coalesce(bool_or(${treinamentoServicoVersao.geradoComIa}), false)`,
      })
      .from(treinamentoServicoVersao)
      .where(eq(treinamentoServicoVersao.treinamentoId, treinamento.id));
    usaIa = Boolean(soma?.comIa);
    rodadasUsadas = soma?.rodadas ?? 0;
    const rascunho = await rascunhoDoTreinamento(deps.db, treinamento.id);
    temTextoOrigem = Boolean(rascunho?.textoOrigem);
  }

  const restamRodadas = rodadasUsadas < limiteRodadas;
  // Gerar de novo um treinamento que já usou a IA gasta uma rodada; o primeiro uso gasta uma vaga de treinamento.
  const podeGerar = disponivel && (usaIa ? restamRodadas : treinamentosUsados < limiteTreinamentos);
  const podeAjustar = disponivel && usaIa && temTextoOrigem && restamRodadas;
  // Sem rodadas, `podeGerar` também é falso: um motivo cobre os dois botões.
  const motivo = !disponivel ? "A IA não está configurada" : !podeGerar ? MOTIVO_LIMITE : null;
  return { disponivel, usaIa, treinamentosUsados, limiteTreinamentos, rodadasUsadas, limiteRodadas, podeGerar, podeAjustar, motivo };
}

// ---- O que a IA recebe -----------------------------------------------------------------------------------------------

interface MaterialDoServico {
  codigo: string;
  id: string;
  descricao: string;
  categoria: string;
}

async function materiaisDoServico(deps: DepsDaIA, atividadeCodigo: string): Promise<MaterialDoServico[]> {
  const linhas = await deps.db
    .select({ id: material.id, descricao: material.descricao, categoria: material.categoria })
    .from(atividadeMaterial)
    .innerJoin(material, eq(material.id, atividadeMaterial.materialId))
    .where(and(eq(atividadeMaterial.atividadeCodigo, atividadeCodigo), eq(material.ativo, true)))
    .orderBy(asc(atividadeMaterial.ordem));
  return linhas.map((m, i) => ({ codigo: `M${i + 1}`, ...m }));
}

const ROTULO_DA_CATEGORIA: Record<string, string> = { material: "material", ferramenta: "ferramenta", epi: "EPI" };

const REGRAS = `Você é a Vitória, a assistente do sistema SYNQ OS, montando o rascunho de um treinamento de serviço para técnicos de campo. Um administrador vai revisar, corrigir e assinar o que você montar; quem treina joga no celular.

Regras que não têm exceção:
- Use SÓ o texto do procedimento colado pelo administrador. Não use conhecimento de fora: nenhuma norma, número, ferramenta, EPI ou passo que não esteja no texto.
- Em "origem", copie do texto, sem mudar nenhuma palavra, a frase (ou as frases) de onde o item saiu.
- Números (pressão, distância, ppm, prazo, quantidade) só se aparecerem no texto, escritos do mesmo jeito.
- Ensine o comportamento seguro que o texto descreve. Nunca fale de APR, de checklist, de item eliminatório ou de resposta que bloqueia.
- Português do Brasil, frases curtas e diretas.`;

const FORMATO = `Responda SOMENTE com objetos JSON, um por linha (JSON Lines), sem texto antes ou depois e sem marcação de código, nesta ordem:
{"item":"plano","passos":N,"fases":M}
N linhas de passo da explicação (a Vitória explicando o serviço, de 1 a 12 passos):
{"item":"passo","texto":"...","expressao":"explicando","origem":"trecho do texto"}
M linhas de fase do jogo (de 3 a 10 fases), cada uma de um destes tipos:
{"item":"fase","tipo":"quiz","enunciado":"pergunta","opcoes":[{"texto":"opção","certa":true},{"texto":"opção","certa":false},{"texto":"opção","certa":false}],"explicacao":"por que a certa é a certa","origem":"trecho do texto"}
{"item":"fase","tipo":"decisao","situacao":"uma situação de campo","opcoes":[{"texto":"atitude","consequencia":"o que acontece","certa":true},{"texto":"atitude","consequencia":"o que acontece","certa":false},{"texto":"atitude","consequencia":"o que acontece","certa":false}],"explicacao":"...","origem":"..."}
{"item":"fase","tipo":"separar_itens","enunciado":"Toque nos itens deste serviço","materiais":["M1","M2"],"quantidade_errados":3,"explicacao":"...","origem":"..."}
{"item":"fase","tipo":"ligar","pares":[{"esquerda":"...","direita":"..."},{"esquerda":"...","direita":"..."}],"explicacao":"...","origem":"..."}
{"item":"fase","tipo":"ordem","enunciado":"Ponha as etapas na ordem","etapas":["primeira","segunda","terceira"],"explicacao":"...","origem":"..."}
{"item":"resumo","texto":"uma frase sobre o que você montou"}

Regras do formato:
- expressao do passo: "explicando", "padrao", "feliz", "alerta" (cuidados e riscos) ou "comemorando" (o último passo).
- quiz e decisao: 3 ou 4 opções e exatamente uma com "certa": true; na decisão, a certa é a atitude segura.
- separar_itens: só os códigos da lista de materiais do serviço (de 2 a 10) e quantidade_errados de 1 a 5 (o sistema mistura itens de outros serviços). Não use este tipo se o serviço tiver menos de 2 materiais.
- ligar: de 2 a 5 pares. ordem: de 2 a 6 etapas, já na ordem certa.
- Tamanhos: texto do passo até 600 caracteres; enunciado e situação até 400; opção, par e etapa até 160; consequência até 300; explicação até 400.
- Varie os tipos de fase.`;

const INSTRUCAO_AJUSTE = `Agora você ajusta um rascunho já montado, a pedido do administrador. Devolva o rascunho INTEIRO, no mesmo formato (plano, passos, fases e resumo), mudando só o que o pedido pede; o que não mudar, repita igual, inclusive a origem. No resumo, diga em uma frase o que mudou. Se o pedido exigir algo que não está no texto do procedimento, não invente: repita o rascunho como está e diga isso no resumo.`;

const INSTRUCAO_FASE = `Agora você refaz uma única fase do rascunho, a pedido do administrador. Responda só com a linha da nova fase (item "fase") e a linha do resumo, nada mais.`;

function blocoDoServico(codigo: string, descricao: string, materiais: MaterialDoServico[], texto: string): string {
  const lista = materiais.length > 0 ? materiais.map((m) => `${m.codigo} — ${m.descricao} (${ROTULO_DA_CATEGORIA[m.categoria] ?? m.categoria})`).join("\n") : "(nenhum material cadastrado: não use o tipo separar_itens)";
  return `Serviço: ${codigo} — ${descricao}

Materiais, ferramentas e EPIs do serviço no catálogo (em "materiais", use só estes códigos):
${lista}

Texto do procedimento:
<<<
${texto}
>>>`;
}

/** O rascunho atual no formato da IA (para os ajustes): os materiais voltam aos códigos curtos e a certa, à marca `certa`. */
function rascunhoNoFormatoDaIA(explicacao: PassoExplicacao[], fases: FaseEntrada[], materiais: MaterialDoServico[]): string {
  const codigoDoMaterial = new Map(materiais.map((m) => [m.id, m.codigo]));
  const linhas: unknown[] = [{ item: "plano", passos: explicacao.length, fases: fases.length }];
  for (const p of explicacao) linhas.push({ item: "passo", texto: p.texto, expressao: p.expressao, origem: p.ia?.origem ?? "" });
  fases.forEach((f, i) => {
    const comum = { item: "fase", numero: i + 1, tipo: f.tipo, explicacao: f.explicacao, origem: f.ia?.origem ?? "" };
    if (f.tipo === "quiz") linhas.push({ ...comum, enunciado: f.enunciado, opcoes: f.opcoes.map((texto, k) => ({ texto, certa: k === f.correta })) });
    else if (f.tipo === "decisao") linhas.push({ ...comum, situacao: f.situacao, opcoes: f.opcoes.map((o, k) => ({ texto: o.texto, consequencia: o.consequencia, certa: k === f.correta })) });
    else if (f.tipo === "separar_itens") linhas.push({ ...comum, enunciado: f.enunciado, materiais: f.material_ids.flatMap((id) => codigoDoMaterial.get(id) ?? []), quantidade_errados: f.quantidade_errados });
    else if (f.tipo === "ligar") linhas.push({ ...comum, pares: f.pares });
    else linhas.push({ ...comum, enunciado: f.enunciado, etapas: f.etapas });
  });
  return linhas.map((l) => JSON.stringify(l)).join("\n");
}

// ---- Leitura do streaming ------------------------------------------------------------------------------------------

/**
 * Tira cada objeto JSON de primeiro nível do texto conforme ele chega, contando chaves fora das aspas. Aceita linhas JSON,
 * o mesmo formatado em várias linhas, a lista inteira entre colchetes e o embrulho em bloco de código: o que estiver fora
 * de um objeto é ignorado.
 */
export class LeitorDeObjetosJson {
  private atual = "";
  private profundidade = 0;
  private emTexto = false;
  private escapado = false;
  /** Objetos que fecharam mas não eram JSON válido. */
  invalidos = 0;

  alimentar(pedaco: string): unknown[] {
    const prontos: unknown[] = [];
    for (const ch of pedaco) {
      if (this.profundidade === 0 && ch !== "{") continue;
      this.atual += ch;
      if (this.emTexto) {
        if (this.escapado) this.escapado = false;
        else if (ch === "\\") this.escapado = true;
        else if (ch === '"') this.emTexto = false;
        continue;
      }
      if (ch === '"') this.emTexto = true;
      else if (ch === "{") this.profundidade++;
      else if (ch === "}" && --this.profundidade === 0) {
        try {
          prontos.push(JSON.parse(this.atual));
        } catch {
          this.invalidos++;
        }
        this.atual = "";
      }
    }
    return prontos;
  }
}

// Formato que a IA devolve (tolerante: o que passar do tamanho é cortado com pendência, não descartado).
const esquemaPlanoIA = z.object({ item: z.literal("plano"), passos: z.number().int().min(0).max(50).optional(), fases: z.number().int().min(0).max(50).optional() });
const esquemaResumoIA = z.object({ item: z.literal("resumo"), texto: z.string().max(2000) });
const esquemaPassoIA = z.object({ item: z.literal("passo"), texto: z.string().max(5000), expressao: z.string().optional(), origem: z.string().max(5000).optional() });
const esquemaOpcaoIA = z.object({ texto: z.string().max(2000), consequencia: z.string().max(2000).optional(), certa: z.boolean().optional() });
const esquemaFaseIA = z.object({
  item: z.literal("fase"),
  tipo: z.enum(["quiz", "decisao", "separar_itens", "ligar", "ordem"]),
  enunciado: z.string().max(5000).optional(),
  situacao: z.string().max(5000).optional(),
  opcoes: z.array(esquemaOpcaoIA).max(10).optional(),
  materiais: z.array(z.string().max(20)).max(20).optional(),
  quantidade_errados: z.number().optional(),
  pares: z.array(z.object({ esquerda: z.string().max(2000), direita: z.string().max(2000) })).max(10).optional(),
  etapas: z.array(z.string().max(2000)).max(10).optional(),
  explicacao: z.string().max(5000).optional(),
  origem: z.string().max(5000).optional(),
});
type FaseIA = z.infer<typeof esquemaFaseIA>;

// ---- Conversão e conferências ----------------------------------------------------------------------------------------

/** Sem acento, em minúsculas e só letras e números separados por um espaço: pontuação e aspas diferentes não contam. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Os números escritos no texto ("1,5", "1.5" e "15" são diferentes; ponto e vírgula valem o mesmo). */
function numerosDe(texto: string): string[] {
  return (texto.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => n.replace(/\./g, ","));
}

/** Os textos que quem treina lê num item (sem o tipo, a expressão, a imagem, os ids e a meta da IA). */
function textosVisiveis(valor: unknown): string[] {
  if (typeof valor === "string") return [valor];
  if (Array.isArray(valor)) return valor.flatMap(textosVisiveis);
  if (valor && typeof valor === "object") {
    return Object.entries(valor)
      .filter(([chave]) => !["tipo", "expressao", "imagem_path", "material_ids", "ia", "ordem", "correta", "quantidade_errados"].includes(chave))
      .flatMap(([, v]) => textosVisiveis(v));
  }
  return [];
}

interface ContextoDaConferencia {
  textoNormalizado: string;
  numerosDoTexto: Set<string>;
}

function contextoDaConferencia(texto: string): ContextoDaConferencia {
  return { textoNormalizado: ` ${normalizar(texto)} `, numerosDoTexto: new Set(numerosDe(texto)) };
}

/** As conferências da seção 3.6 que valem para qualquer item: o trecho de origem e os números. */
function conferirItem(item: object, origem: string, ctx: ContextoDaConferencia): PendenciaDoItem[] {
  const pendencias: PendenciaDoItem[] = [];
  // A IA às vezes junta frases de passos diferentes (o número do passo fica no meio) ou pula um pedaço com reticências:
  // vale cada frase do trecho estar no texto, sem nenhuma palavra trocada.
  const partes = origem
    .split(/\.{3}|…|[.!?;:\n]+(?=\s|$)/)
    .map(normalizar)
    .filter(Boolean);
  if (partes.length === 0) pendencias.push({ codigo: "origem_vazia", mensagem: "A IA não indicou o trecho do texto de onde o item saiu." });
  else if (partes.some((p) => !ctx.textoNormalizado.includes(` ${p} `))) pendencias.push({ codigo: "origem_fora_do_texto", mensagem: "O trecho de origem não está no texto do procedimento." });
  const fora = [...new Set(textosVisiveis(item).flatMap(numerosDe))].filter((n) => !ctx.numerosDoTexto.has(n));
  if (fora.length > 0) pendencias.push({ codigo: "numero_fora_do_texto", mensagem: `Número que não aparece no texto do procedimento: ${fora.slice(0, 5).join("; ")}.` });
  return pendencias;
}

/** Corta o que passou do tamanho do editor (com reticências) e anota a pendência uma vez por item. */
function cortador(pendencias: PendenciaDoItem[]) {
  return (valor: string | undefined, max: number): string => {
    const texto = (valor ?? "").trim();
    if (texto.length <= max) return texto;
    if (!pendencias.some((p) => p.codigo === "texto_cortado")) pendencias.push({ codigo: "texto_cortado", mensagem: "Um texto passou do tamanho máximo e foi cortado: revise o fim." });
    return `${texto.slice(0, max - 1).trimEnd()}…`;
  };
}

function comMeta<T extends object>(item: T, origem: string, pendencias: PendenciaDoItem[]): T & { ia: MetaIA } {
  return { ...item, ia: { origem: origem.trim().slice(0, 2000), impressao: impressaoDoItem(item), pendencias: pendencias.slice(0, 20), conferido: false } };
}

function converterPasso(bruto: z.infer<typeof esquemaPassoIA>, ordem: number, ctx: ContextoDaConferencia): PassoExplicacao | null {
  const pendencias: PendenciaDoItem[] = [];
  const cortar = cortador(pendencias);
  const expressao = (EXPRESSOES_VITORIA as readonly string[]).includes(bruto.expressao ?? "") ? (bruto.expressao as ExpressaoVitoria) : "explicando";
  const lido = esquemaPassoExplicacao.safeParse({ ordem, texto: cortar(bruto.texto, 600), expressao });
  if (!lido.success) return null;
  const origem = bruto.origem ?? "";
  return comMeta(lido.data, origem, [...conferirItem(lido.data, origem, ctx), ...pendencias]);
}

function converterFase(bruta: FaseIA, materiais: MaterialDoServico[], ctx: ContextoDaConferencia): FaseEntrada | null {
  const pendencias: PendenciaDoItem[] = [];
  const cortar = cortador(pendencias);
  const explicacao = cortar(bruta.explicacao, 400);
  let candidata: unknown;
  if (bruta.tipo === "quiz" || bruta.tipo === "decisao") {
    const opcoes = bruta.opcoes ?? [];
    const certas = opcoes.flatMap((o, i) => (o.certa ? [i] : []));
    if (certas.length === 0) pendencias.push({ codigo: "fase_sem_opcao_certa", mensagem: "A IA não marcou nenhuma opção como certa: escolha a certa." });
    if (certas.length > 1) pendencias.push({ codigo: "fase_com_mais_de_uma_certa", mensagem: `A IA marcou ${certas.length} opções como certas: deixe só uma.` });
    const correta = certas[0] ?? 0;
    candidata =
      bruta.tipo === "quiz"
        ? { tipo: "quiz", enunciado: cortar(bruta.enunciado, 400), opcoes: opcoes.map((o) => cortar(o.texto, 160)), correta, explicacao }
        : { tipo: "decisao", situacao: cortar(bruta.situacao ?? bruta.enunciado, 400), opcoes: opcoes.map((o) => ({ texto: cortar(o.texto, 160), consequencia: cortar(o.consequencia, 300) })), correta, explicacao };
  } else if (bruta.tipo === "separar_itens") {
    const porCodigo = new Map(materiais.map((m) => [m.codigo, m.id]));
    const codigos = [...new Set((bruta.materiais ?? []).map((c) => c.trim().toUpperCase()))];
    const desconhecidos = codigos.filter((c) => !porCodigo.has(c));
    if (desconhecidos.length > 0) pendencias.push({ codigo: "material_fora_do_catalogo", mensagem: `A IA citou material fora da lista do serviço (${desconhecidos.slice(0, 5).join(", ")}), que foi tirado.` });
    const errados = Math.min(10, Math.max(1, Math.round(bruta.quantidade_errados ?? 3)));
    candidata = { tipo: "separar_itens", enunciado: cortar(bruta.enunciado, 400), material_ids: codigos.flatMap((c) => porCodigo.get(c) ?? []).slice(0, 10), quantidade_errados: errados, explicacao };
  } else if (bruta.tipo === "ligar") {
    candidata = { tipo: "ligar", pares: (bruta.pares ?? []).map((p) => ({ esquerda: cortar(p.esquerda, 160), direita: cortar(p.direita, 160) })), explicacao };
  } else {
    candidata = { tipo: "ordem", enunciado: cortar(bruta.enunciado, 400), etapas: (bruta.etapas ?? []).map((e) => cortar(e, 160)), explicacao };
  }
  const lida = esquemaFase.safeParse(candidata);
  if (!lida.success) return null;
  const origem = bruta.origem ?? "";
  return comMeta(lida.data, origem, [...pendencias, ...conferirItem(lida.data, origem, ctx)]);
}

// ---- Progresso -------------------------------------------------------------------------------------------------------

export interface ProgressoDoRascunho {
  mensagem: string;
  passosProntos: number;
  fasesProntas: number;
  totalPassos: number | null;
  totalFases: number | null;
}

function mensagemDoProgresso(p: Omit<ProgressoDoRascunho, "mensagem">, soUmaFase: boolean): string {
  if (soUmaFase) return p.fasesProntas > 0 ? "Conferindo a fase…" : "Montando a fase nova…";
  const { passosProntos, fasesProntas, totalPassos, totalFases } = p;
  if (totalPassos !== null && passosProntos < totalPassos && fasesProntas === 0) return `Montando a explicação: passo ${passosProntos + 1} de ${totalPassos}…`;
  if (totalFases !== null && fasesProntas < totalFases) return `Montando a fase ${fasesProntas + 1} de ${totalFases}…`;
  if (totalFases !== null) return "Conferindo o rascunho…";
  return fasesProntas > 0 ? `Montando a fase ${fasesProntas + 1}…` : `Montando a explicação: passo ${passosProntos + 1}…`;
}

// ---- Preparo (antes do streaming: os erros ainda viram HTTP) ----------------------------------------------------------

export type PedidoDeRascunhoIA = { tipo: "gerar"; texto: string } | { tipo: "ajustar"; pedido?: string; fase?: number };

export interface ChamadaDeRascunhoIA {
  atividadeCodigo: string;
  pedido: PedidoDeTexto;
  /** Regerar uma fase só: a resposta traz uma fase, que substitui a da posição `fase`. */
  fase: number | null;
  tipo: PedidoDeRascunhoIA["tipo"];
  /** A primeira mensagem de progresso, antes da IA começar a responder. */
  mensagemInicial: string;
  /** Interno: o que a gravação precisa saber. */
  contexto: {
    treinamentoId: string;
    versaoId: string;
    texto: string;
    materiais: MaterialDoServico[];
    explicacaoAtual: PassoExplicacao[];
    fasesAtuais: FaseEntrada[];
    /** Gasta uma rodada (tudo, menos a primeira geração do treinamento). */
    contaRodada: boolean;
  };
}

const iaIndisponivel = () => new ErroApi(503, "ia_indisponivel", "A IA não está configurada: monte o treinamento à mão no editor");

/**
 * Confere tudo o que pode dar errado antes de chamar a IA (IA desligada → 503, limite → 409, ajuste sem texto de origem ou
 * fase inexistente → 422) e monta o pedido. Depois daqui a resposta já é streaming, e os erros viram o evento `erro`.
 */
export async function prepararRascunhoIA(deps: DepsDaIA, atividadeCodigo: string, usuarioId: string, entrada: PedidoDeRascunhoIA): Promise<ChamadaDeRascunhoIA> {
  if (!deps.ia.disponivel()) throw iaIndisponivel();
  const [servico] = await deps.db.select({ codigo: atividade.codigo, descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, atividadeCodigo)).limit(1);
  if (!servico) throw naoEncontrado("Serviço não encontrado no catálogo");

  // Garante o treinamento e o rascunho (o editor já os cria, mas a rota não depende disso).
  const rascunhoDoEditor = await obterOuCriarRascunho(deps.db, atividadeCodigo, usuarioId);
  const situacao = await situacaoDaIA(deps, atividadeCodigo);
  const materiais = await materiaisDoServico(deps, atividadeCodigo);

  if (entrada.tipo === "gerar") {
    if (!situacao.podeGerar) throw conflito("limite_ia", `${MOTIVO_LIMITE}: ${situacao.usaIa ? `as ${situacao.limiteRodadas} rodadas deste treinamento já foram usadas` : `${situacao.limiteTreinamentos} treinamentos já usaram a IA`}. Siga no editor.`);
    return {
      atividadeCodigo,
      tipo: "gerar",
      fase: null,
      mensagemInicial: "Lendo o texto do procedimento…",
      pedido: {
        modelo: "rascunho",
        maxTokens: deps.config.treinamentoIa.maxTokens,
        tempoLimiteMs: TEMPO_LIMITE_MS,
        mensagens: [
          { papel: "sistema", texto: `${REGRAS}\n\n${FORMATO}`, cache: true },
          { papel: "usuario", texto: `${blocoDoServico(servico.codigo, servico.descricao, materiais, entrada.texto)}\n\nMonte o rascunho completo.` },
        ],
      },
      contexto: {
        treinamentoId: rascunhoDoEditor.treinamentoId,
        versaoId: rascunhoDoEditor.versaoId,
        texto: entrada.texto,
        materiais,
        explicacaoAtual: rascunhoDoEditor.explicacao,
        fasesAtuais: rascunhoDoEditor.fases,
        contaRodada: situacao.usaIa,
      },
    };
  }

  const texto = rascunhoDoEditor.textoOrigem;
  if (!texto) throw invalido("sem_texto_origem", "Gere o rascunho com a Vitória antes de pedir ajustes: ela só usa o texto do procedimento");
  if (!situacao.podeAjustar) throw conflito("limite_ia", `${MOTIVO_LIMITE}: as ${situacao.limiteRodadas} rodadas deste treinamento já foram usadas. Siga no editor.`);
  const fase = entrada.fase ?? null;
  if (fase !== null && (fase < 0 || fase >= rascunhoDoEditor.fases.length)) throw invalido("fase_invalida", "Fase inexistente no rascunho");
  if (fase === null && !entrada.pedido?.trim()) throw invalido("pedido_vazio", "Escreva o ajuste que você quer");

  const atual = rascunhoNoFormatoDaIA(rascunhoDoEditor.explicacao, rascunhoDoEditor.fases, materiais);
  const ordem =
    fase === null
      ? `Pedido do administrador: ${entrada.pedido!.trim()}`
      : `Refaça a fase ${fase + 1}.${entrada.pedido?.trim() ? ` Pedido do administrador: ${entrada.pedido.trim()}` : " Faça uma fase diferente da atual, se possível sobre outro ponto do texto."}`;
  const mensagens: BlocoDeMensagem[] = [
    { papel: "sistema", texto: `${REGRAS}\n\n${FORMATO}`, cache: true },
    { papel: "sistema", texto: fase === null ? INSTRUCAO_AJUSTE : INSTRUCAO_FASE },
    { papel: "usuario", texto: `${blocoDoServico(servico.codigo, servico.descricao, materiais, texto)}\n\nRascunho atual:\n${atual}\n\n${ordem}` },
  ];
  return {
    atividadeCodigo,
    tipo: "ajustar",
    fase,
    mensagemInicial: fase === null ? "Lendo o seu pedido…" : `Refazendo a fase ${fase + 1}…`,
    pedido: { modelo: "rascunho", maxTokens: deps.config.treinamentoIa.maxTokens, tempoLimiteMs: TEMPO_LIMITE_MS, mensagens },
    contexto: {
      treinamentoId: rascunhoDoEditor.treinamentoId,
      versaoId: rascunhoDoEditor.versaoId,
      texto,
      materiais,
      explicacaoAtual: rascunhoDoEditor.explicacao,
      fasesAtuais: rascunhoDoEditor.fases,
      contaRodada: true,
    },
  };
}

// ---- Execução (já em streaming) ----------------------------------------------------------------------------------------

export interface ResultadoDoRascunhoIA {
  rascunho: RascunhoDoEditor;
  situacao: SituacaoIATreinamento;
  /** A frase da IA sobre o que montou ou mudou, para o chat de ajustes. */
  resumo: string;
  /** Itens que vieram fora do formato e foram descartados. */
  descartados: number;
}

const respostaInvalida = (mensagem: string) => new ErroApi(502, "resposta_ia_invalida", mensagem);

/**
 * Herda do rascunho anterior o que a IA não conhece: a imagem do passo (pelo texto igual) e a revisão do admin (o item
 * que voltou igual a um que já tinha sido editado, confirmado ou feito à mão volta confirmado, sem reabrir pendência).
 */
function herdarDoAnterior<T extends { ia?: MetaIA | null; texto?: string; imagem_path?: string | null }>(novo: T, anteriores: T[]): T {
  let item = novo;
  if ("texto" in novo && novo.texto) {
    const mesmoTexto = anteriores.find((a) => a.texto === novo.texto && a.imagem_path);
    if (mesmoTexto) {
      const { ia, ...conteudo } = { ...novo, imagem_path: mesmoTexto.imagem_path };
      item = { ...conteudo, ia: { ...ia!, impressao: impressaoDoItem(conteudo) } } as T;
    }
  }
  const impressao = impressaoDoItem(item);
  const revisado = anteriores.some((a) => impressaoDoItem(a) === impressao && !itemSemRevisao(a));
  return revisado ? ({ ...item, ia: { ...item.ia!, conferido: true } } as T) : item;
}

/**
 * Chama a IA em streaming, avisa o progresso a cada item que fecha, converte e confere tudo e grava no rascunho. Lança
 * `ErroApi` (`ia_indisponivel` ou `resposta_ia_invalida`) se a IA falhar ou não devolver nada aproveitável; nesse caso
 * nada é gravado e a rodada não conta.
 */
export async function executarRascunhoIA(deps: DepsDaIA, chamada: ChamadaDeRascunhoIA, aoProgredir: (p: ProgressoDoRascunho) => void): Promise<ResultadoDoRascunhoIA> {
  const { contexto } = chamada;
  const ctx = contextoDaConferencia(contexto.texto);
  const soUmaFase = chamada.fase !== null;
  const leitor = new LeitorDeObjetosJson();
  const passos: PassoExplicacao[] = [];
  const fases: FaseEntrada[] = [];
  let resumo = "";
  let descartados = 0;
  const estado: Omit<ProgressoDoRascunho, "mensagem"> = { passosProntos: 0, fasesProntas: 0, totalPassos: null, totalFases: null };
  const avisar = () => aoProgredir({ ...estado, mensagem: mensagemDoProgresso(estado, soUmaFase) });

  const receber = (objeto: unknown) => {
    const tipo = (objeto as { item?: unknown })?.item;
    if (tipo === "plano") {
      const plano = esquemaPlanoIA.safeParse(objeto);
      if (plano.success) {
        estado.totalPassos = plano.data.passos ?? null;
        estado.totalFases = plano.data.fases ?? null;
      }
    } else if (tipo === "resumo") {
      const lido = esquemaResumoIA.safeParse(objeto);
      if (lido.success) resumo = lido.data.texto.trim().slice(0, 500);
    } else if (tipo === "passo" && !soUmaFase) {
      const lido = esquemaPassoIA.safeParse(objeto);
      const passo = lido.success && passos.length < 12 ? converterPasso(lido.data, passos.length, ctx) : null;
      if (passo) passos.push(passo);
      else descartados++;
      estado.passosProntos = passos.length;
    } else if (tipo === "fase") {
      const lida = esquemaFaseIA.safeParse(objeto);
      const fase = lida.success && fases.length < (soUmaFase ? 1 : 10) ? converterFase(lida.data, contexto.materiais, ctx) : null;
      if (fase) fases.push(fase);
      else descartados++;
      estado.fasesProntas = fases.length;
    } else {
      descartados++;
    }
    avisar();
  };

  try {
    for await (const pedaco of deps.ia.conversarEmStreaming(chamada.pedido)) {
      for (const objeto of leitor.alimentar(pedaco.texto)) receber(objeto);
    }
  } catch (erro) {
    if (erro instanceof IAIndisponivel) console.warn(`Rascunho de treinamento: IA indisponível (${erro.message})`);
    else console.error("Rascunho de treinamento: a IA falhou de um jeito inesperado", erro);
    throw new ErroApi(503, "ia_indisponivel", "A IA não respondeu agora. Tente de novo em instantes ou siga no editor; nada foi gravado.");
  }
  descartados += leitor.invalidos;

  let explicacao: PassoExplicacao[];
  let novasFases: FaseEntrada[];
  if (soUmaFase) {
    const nova = fases[0];
    if (!nova) throw respostaInvalida("A IA não devolveu uma fase no formato do editor. Tente de novo; nada foi gravado.");
    explicacao = contexto.explicacaoAtual;
    novasFases = contexto.fasesAtuais.map((f, i) => (i === chamada.fase ? nova : f));
  } else if (chamada.tipo === "gerar") {
    if (passos.length === 0 && fases.length === 0) throw respostaInvalida("A IA não devolveu nada no formato do editor. Tente de novo; nada foi gravado.");
    explicacao = passos;
    novasFases = fases;
  } else {
    if (passos.length === 0 && fases.length === 0) throw respostaInvalida("A IA não devolveu o rascunho ajustado no formato do editor. Tente de novo; nada foi gravado.");
    // Um ajuste nunca apaga uma parte inteira: se a IA devolveu só os passos (ou só as fases), a outra parte fica como estava.
    explicacao = passos.length > 0 ? passos.map((p) => herdarDoAnterior(p, contexto.explicacaoAtual)) : contexto.explicacaoAtual;
    novasFases = fases.length > 0 ? fases.map((f) => herdarDoAnterior(f, contexto.fasesAtuais)) : contexto.fasesAtuais;
  }

  validarConteudo(explicacao, novasFases);
  await validarFasesContraCatalogo(deps.db, novasFases);
  const [salvo] = await deps.db
    .update(treinamentoServicoVersao)
    .set({
      explicacao,
      fases: novasFases,
      textoOrigem: contexto.texto,
      geradoComIa: true,
      ...(contexto.contaRodada ? { rodadasIa: sql`${treinamentoServicoVersao.rodadasIa} + 1` } : {}),
    })
    .where(and(eq(treinamentoServicoVersao.id, contexto.versaoId), eq(treinamentoServicoVersao.estado, "rascunho")))
    .returning();
  if (!salvo) throw conflito("rascunho_mudou", "O rascunho foi publicado enquanto a IA trabalhava; abra o editor de novo");

  const temPublicada = Boolean(await versaoPublicadaDoTreinamento(deps.db, contexto.treinamentoId));
  const rascunho = rascunhoParaEditor(contexto.treinamentoId, salvo, temPublicada);
  const situacao = await situacaoDaIA(deps, chamada.atividadeCodigo);
  const resumoFinal = resumo || (soUmaFase ? `Refiz a fase ${chamada.fase! + 1}.` : `Montei ${explicacao.length} passo(s) de explicação e ${novasFases.length} fase(s).`);
  return { rascunho, situacao, resumo: resumoFinal, descartados };
}
