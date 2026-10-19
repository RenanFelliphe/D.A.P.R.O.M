import type { Deps } from "../deps";
import { IAIndisponivel, RespostaIAInvalida, type ImagemDeMensagem } from "../servicos/ia";
import type { FolhaLidaPorOcr } from "../servicos/ocr";
import {
  codigoNaFolha,
  conferirParticipantes,
  ehFolhaDeApr,
  lerCabecalhoDaApr,
  lerRespostasDaApr,
  modelosParaEscolha,
  type AprLida,
  type EstadoDaIa,
} from "./digitalizacao-apr";
import { MAX_IMAGENS_POR_OS, recortarFolha } from "./digitalizacao-ia";
import { numeroDaFolha } from "./importacao-pdf";
import { lerRiscosEItens } from "./modelo-apr-banco";

/**
 * Digitalização, a leitura da APR em papel dentro do PDF: acha as folhas da APR, descobre de qual OS cada uma é e lê o cabeçalho, as
 * pessoas e a marca de cada item (`digitalizacao-apr.ts`). Quem chama é `processarDigitalizacao`, depois do manuscrito das OS.
 */

/**
 * Separa as folhas da APR das demais antes de ler as OS: a APR tem as próprias etiquetas ("Data:", "Serviço:") e um número de OS
 * escrito à mão, que não podem se misturar com o cabeçalho impresso da OS. Uma APR é a folha com o título "Análise Preliminar de
 * Risco" e as folhas sem número de OS que vêm logo depois dela (a APR pode ter mais de uma folha); uma folha com número de OS
 * encerra a APR. `grupos` são as folhas de cada APR, na ordem do PDF; `restantes` seguem para a leitura das OS.
 */
export function separarFolhasDaApr<T extends FolhaLidaPorOcr>(paginas: T[]): { grupos: number[][]; restantes: T[] } {
  const grupos: number[][] = [];
  const restantes: T[] = [];
  let aberto = false;
  for (const p of paginas) {
    if (ehFolhaDeApr(p.linhas)) {
      grupos.push([p.numero]);
      aberto = true;
    } else if (aberto && numeroDaFolha(p) === null) grupos.at(-1)!.push(p.numero);
    else {
      aberto = false;
      restantes.push(p);
    }
  }
  return { grupos, restantes };
}

/** A OS lida, no que a leitura da APR precisa dela. */
export interface OsParaApr {
  ordem: { numero_ordem: string };
  paginas: number[];
  manuscrito: { inicio: string | null };
  apr: AprLida | null;
  avisos: string[];
}

/**
 * De quem é a APR: da OS cujo número a APR traz escrito à mão, se ele é de uma OS deste PDF; senão da OS que vem antes dela no PDF
 * (a APR é grampeada depois da folha da OS); se ela abre o PDF, da primeira OS. `paginasDaOs` são as folhas de cada OS antes de
 * juntar as da APR.
 */
function donaDaApr<O extends OsParaApr>(ordens: O[], paginasDaOs: Map<O, number[]>, primeiraFolha: number, numeroLido: string | null): O {
  const pelaFolha = numeroLido ? ordens.find((o) => o.ordem.numero_ordem === numeroLido) : undefined;
  if (pelaFolha) return pelaFolha;
  const ultimaAntes = (o: O) => Math.max(0, ...paginasDaOs.get(o)!.filter((p) => p < primeiraFolha));
  const antes = ordens.filter((o) => ultimaAntes(o) > 0);
  if (antes.length > 0) return antes.reduce((a, b) => (ultimaAntes(a) >= ultimaAntes(b) ? a : b));
  return ordens.reduce((a, b) => (Math.min(...paginasDaOs.get(a)!) <= Math.min(...paginasDaOs.get(b)!) ? a : b));
}

/** O dia de uma data e hora `AAAA-MM-DDTHH:MM`. */
const dia = (v: string) => v.slice(0, 10);

/** `[2]` → `folha 2`; `[2, 3]` → `folhas 2 e 3`. */
const folhas = (paginas: number[]) => (paginas.length === 1 ? `folha ${paginas[0]}` : `folhas ${paginas.slice(0, -1).join(", ")} e ${paginas.at(-1)}`);

/**
 * Lê as APR em papel do PDF (uma por grupo de folhas) e põe cada uma na OS dona (`apr`), com as folhas dela entre as da OS. O código
 * do modelo vem do título impresso (OCR); a IA, se estiver ligada, lê o cabeçalho (inclusive o número da OS, que diz de quem é a APR),
 * as pessoas e a marca de cada item. Sem a IA, a APR fica só com as folhas e o modelo achado, e a pessoa preenche na conferência. Uma
 * OS só tem uma APR: a segunda folha de APR que cair na mesma OS fica só nas imagens, com um aviso.
 */
export async function lerAprs<O extends OsParaApr>(
  deps: Deps,
  ordens: O[],
  grupos: number[][],
  folhasLidas: Map<number, FolhaLidaPorOcr>,
  lerJpeg: (numero: number) => Promise<Uint8Array>,
  ia: EstadoDaIa,
): Promise<void> {
  if (grupos.length === 0 || ordens.length === 0) return;
  const modelos = await modelosParaEscolha(deps.db);
  const paginasDaOs = new Map<O, number[]>(ordens.map((o) => [o, [...o.paginas]]));

  for (const paginas of grupos) {
    const avisos: string[] = [];
    const codigoImpresso = paginas.map((n) => codigoNaFolha(folhasLidas.get(n)?.linhas ?? [])).find(Boolean) ?? null;
    const apr: AprLida = { paginas, lido_por: "nenhum", modelo: null, numero_os: null, data_hora: null, servico: null, participantes: [], respostas: [], avisos };
    let codigo = codigoImpresso;

    /** A IA caiu (sem cota, rede) ou devolveu lixo: a leitura da APR segue sem ela, e a pessoa preenche o que faltar. */
    const seguirSemIa = (erro: unknown) => {
      if (erro instanceof IAIndisponivel) ia.motivo = "A IA de leitura está indisponível agora: o escrito à mão é digitado na conferência.";
      else if (erro instanceof RespostaIAInvalida) avisos.push("A IA não conseguiu ler esta parte da APR: preencha-a na conferência.");
      else throw erro;
    };

    // O cabeçalho e as pessoas.
    let imagens: ImagemDeMensagem[] = [];
    if (ia.motivo === null) {
      try {
        imagens = await Promise.all(paginas.slice(0, MAX_IMAGENS_POR_OS).map(async (n) => recortarFolha(await lerJpeg(n))));
        const cabecalho = await lerCabecalhoDaApr(deps.ia, imagens, modelos);
        ia.usou = true;
        apr.lido_por = "ia";
        apr.numero_os = cabecalho.numero_os;
        apr.data_hora = cabecalho.data_hora;
        apr.servico = cabecalho.servico;
        apr.participantes = await conferirParticipantes(deps, cabecalho.participantes);
        avisos.push(...cabecalho.avisos);
        const lido = cabecalho.modelo_codigo ? modelos.find((m) => m.codigo.replace(/\s+/g, "") === cabecalho.modelo_codigo!.replace(/\s+/g, ""))?.codigo : undefined;
        if (codigoImpresso && lido && lido !== codigoImpresso) avisos.push(`O título impresso diz ${codigoImpresso}, mas a IA leu ${lido}: vale o impresso, confira o modelo.`);
        codigo ??= lido ?? null;
      } catch (erro) {
        seguirSemIa(erro);
      }
    }

    const dona = donaDaApr(ordens, paginasDaOs, paginas[0]!, apr.numero_os);
    dona.paginas = [...new Set([...dona.paginas, ...paginas])].sort((a, b) => a - b);
    if (dona.apr) {
      dona.avisos.push(`Esta OS tem mais de uma APR no PDF (${folhas(paginas)}): só a primeira foi lida, e esta fica apenas nas imagens das folhas.`);
      continue;
    }

    const escolhido = codigo ? modelos.find((m) => m.codigo === codigo) : undefined;
    if (escolhido) apr.modelo = { id: escolhido.id, codigo: escolhido.codigo, versao: escolhido.versao, titulo: escolhido.titulo };
    else avisos.push(codigo ? `O modelo ${codigo} não está cadastrado: escolha o modelo da APR.` : "O modelo da APR não foi identificado: escolha-o.");

    // A marca de cada item, só com o modelo conhecido (a IA precisa da lista de itens para devolver a coluna de cada um).
    if (escolhido && apr.lido_por === "ia" && ia.motivo === null) {
      try {
        const { riscos, itens } = await lerRiscosEItens(deps.db, escolhido.id);
        const nomeDoRisco = new Map(riscos.map((r) => [r.id, r.nome]));
        const lista = itens.map((i) => ({ ordem: i.ordem, texto: i.riscoId ? `${nomeDoRisco.get(i.riscoId)}: ${i.texto}` : i.texto }));
        const { respostas, avisos: avisosDasRespostas } = await lerRespostasDaApr(deps.ia, imagens, lista);
        apr.respostas = itens.filter((i) => respostas.has(i.ordem)).map((i) => ({ item_id: i.id, resposta: respostas.get(i.ordem)! }));
        avisos.push(...avisosDasRespostas);
        if (apr.respostas.length === 0) avisos.push("Nenhuma resposta da APR foi lida: marque-as na conferência.");
      } catch (erro) {
        seguirSemIa(erro);
      }
    }

    // O número da OS e a data da APR têm de bater com a folha da OS e com o início da execução.
    if (apr.numero_os && apr.numero_os !== dona.ordem.numero_ordem) {
      avisos.push(`A APR traz o número de OS ${apr.numero_os}, e a folha da OS é a ${dona.ordem.numero_ordem}: confira se a APR é desta OS.`);
    }
    if (apr.data_hora && dona.manuscrito.inicio && dia(apr.data_hora) !== dia(dona.manuscrito.inicio)) {
      avisos.push(`A data da APR (${dia(apr.data_hora)}) é diferente da do início da execução (${dia(dona.manuscrito.inicio)}).`);
    }
    dona.apr = apr;
  }
}
