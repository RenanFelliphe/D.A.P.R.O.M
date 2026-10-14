import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Db } from "../db/conexao";
import { atividade, modeloApr, orientacaoModeloApr } from "../db/schema";
import type { UsuarioAutenticado } from "../http/autenticacao";
import { osVisivel } from "./painel-os";

/*
 * Escolha do modelo da APR: quem escolhe é sempre o técnico, entre os modelos publicados. O sistema só orienta: mostra a
 * descrição e os exemplos de cada modelo e recomenda o que mais combina com a OS, pelas palavras-chave da orientação
 * (`orientacao_modelo_apr`) achadas no título, no serviço do catálogo e na descrição da OS. A recomendação nunca é
 * aplicada sozinha: a tela pede para o técnico conferir.
 */

/** Sem acento e em minúsculas. */
const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

interface Palavra {
  inicio: number;
  fim: number;
  normal: string;
}

/** As palavras (letras e números) do texto, com a posição no original (para mostrar como a OS escreveu). */
function palavrasDe(texto: string): Palavra[] {
  return [...texto.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ inicio: m.index, fim: m.index + m[0].length, normal: semAcento(m[0]) }));
}

/** Palavra da chave com 4 letras ou mais vale como começo de palavra ("calibr" acha "calibração"); as curtas, inteiras ("PE", "tê"). */
const combina = (daChave: string, doTexto: string) => (daChave.length >= 4 ? doTexto.startsWith(daChave) : doTexto === daChave);

/** O trecho do texto que a palavra-chave acha (como está escrito na OS), ou `null`. */
function acharNoTexto(texto: string, palavras: Palavra[], chave: string[]): string | null {
  for (let i = 0; i + chave.length <= palavras.length; i++) {
    if (chave.every((p, j) => combina(p, palavras[i + j]!.normal))) return texto.slice(palavras[i]!.inicio, palavras[i + chave.length - 1]!.fim);
  }
  return null;
}

/** O que da OS é lido, do que mais pesa ao que menos pesa. */
export interface TextosDaOs {
  titulo: string;
  /** A descrição do serviço do catálogo (a atividade da OS). */
  servico?: string | null;
  descricao?: string | null;
}

const PESOS = { titulo: 3, servico: 2, descricao: 1 } as const;

export interface Recomendacao {
  /** O modelo que mais combinou; `null` quando nenhum combinou ou quando mais de um empatou no topo. */
  codigo: string | null;
  /** Por modelo, o que ele achou na OS, como a OS escreveu (do título primeiro). Modelo que nada achou não entra. */
  encontradas: Map<string, string[]>;
}

/**
 * Conta, para cada modelo, as palavras-chave achadas na OS: cada uma vale uma vez, pelo campo onde mais pesa (título 3,
 * serviço 2, descrição 1). Recomenda o de maior soma; empate no topo não recomenda nenhum.
 */
export function recomendarModelo(textos: TextosDaOs, orientacoes: { codigo: string; palavrasChave: string[] }[]): Recomendacao {
  const campos = (Object.keys(PESOS) as (keyof typeof PESOS)[])
    .map((campo) => ({ peso: PESOS[campo], texto: textos[campo] ?? "" }))
    .filter((c) => c.texto.trim() !== "")
    .map((c) => ({ ...c, palavras: palavrasDe(c.texto) }));

  const encontradas = new Map<string, string[]>();
  const pontos = new Map<string, number>();
  for (const o of orientacoes) {
    const achados: { texto: string; peso: number; posicao: number }[] = [];
    const vistas = new Set<string>();
    for (const bruta of o.palavrasChave) {
      const chave = palavrasDe(bruta).map((p) => p.normal);
      const id = chave.join(" ");
      if (chave.length === 0 || vistas.has(id)) continue;
      vistas.add(id);
      for (const campo of campos) {
        const trecho = acharNoTexto(campo.texto, campo.palavras, chave);
        if (trecho !== null) {
          achados.push({ texto: trecho, peso: campo.peso, posicao: campo.texto.indexOf(trecho) });
          break;
        }
      }
    }
    if (achados.length === 0) continue;
    pontos.set(o.codigo, achados.reduce((s, a) => s + a.peso, 0));
    // O mesmo trecho achado por duas chaves ("roçagem" e "roç") aparece uma vez.
    const textosVistos = new Set<string>();
    encontradas.set(
      o.codigo,
      achados
        .sort((a, b) => b.peso - a.peso || a.posicao - b.posicao)
        .map((a) => a.texto)
        .filter((t) => !textosVistos.has(semAcento(t)) && Boolean(textosVistos.add(semAcento(t)))),
    );
  }

  const maior = Math.max(0, ...pontos.values());
  const noTopo = [...pontos].filter(([, p]) => p === maior);
  return { codigo: maior > 0 && noTopo.length === 1 ? noTopo[0]![0] : null, encontradas };
}

/** A versão publicada mais recente de cada modelo não excluído, com a orientação, por código. */
export async function modelosParaEscolher(db: Db) {
  const linhas = await db
    .select({
      codigo: modeloApr.codigo,
      versao: modeloApr.versao,
      titulo: modeloApr.titulo,
      descricao: orientacaoModeloApr.descricao,
      exemplos: orientacaoModeloApr.exemplos,
      palavrasChave: orientacaoModeloApr.palavrasChave,
    })
    .from(modeloApr)
    .leftJoin(orientacaoModeloApr, eq(orientacaoModeloApr.codigo, modeloApr.codigo))
    .where(and(isNotNull(modeloApr.publicadoEm), isNull(modeloApr.arquivadoEm)))
    .orderBy(asc(modeloApr.codigo), desc(modeloApr.versao));
  const vistos = new Set<string>();
  return linhas
    .filter((l) => !vistos.has(l.codigo) && Boolean(vistos.add(l.codigo)))
    .map((l) => ({ ...l, descricao: l.descricao ?? "", exemplos: l.exemplos ?? [], palavrasChave: l.palavrasChave ?? [] }));
}

/**
 * `GET /os/{id}/modelos-apr`: os modelos que o técnico pode escolher para a APR desta OS, com a orientação, o que cada um
 * achou na OS e o recomendado. As palavras-chave não vão: o técnico vê só o que foi achado.
 */
export async function escolhaDoModelo(db: Db, eu: UsuarioAutenticado, osId: string) {
  const { os: o } = await osVisivel(db, eu, osId);
  const [servico] = o.codigoAtividade ? await db.select({ descricao: atividade.descricao }).from(atividade).where(eq(atividade.codigo, o.codigoAtividade)) : [];
  const modelos = await modelosParaEscolher(db);
  const { codigo, encontradas } = recomendarModelo({ titulo: o.titulo, servico: servico?.descricao, descricao: o.descricao }, modelos);
  return {
    recomendado: codigo,
    modelos: modelos.map(({ palavrasChave: _, ...m }) => ({ ...m, encontradas: encontradas.get(m.codigo) ?? [] })),
  };
}
