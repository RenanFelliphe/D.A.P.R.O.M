import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Perfil } from "../db/schema";

/**
 * Carrega e cacheia os manuais da Vitória (`docs/ia-e-vitoria.md`, seção 4.4): em Markdown, um por perfil, lidos uma única vez
 * por processo (cerca de 20 mil tokens, cabem inteiros no pedido com cache — não precisa de banco vetorial). Perfil
 * `supervisor` não existe como perfil de verdade (é uma equipe supervisionada por um técnico), e quem aguarda
 * liberação (`pendente`) continua sendo um técnico: os dois caem no manual do técnico.
 */

const PASTA = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../conteudo/vitoria");

const ARQUIVO_DO_PERFIL: Record<Perfil, string> = {
  tecnico: path.join(PASTA, "manual-tecnico.md"),
  admin: path.join(PASTA, "manual-admin.md"),
};

const cache = new Map<Perfil, string>();

/** O texto inteiro do manual do perfil (lido do disco só na primeira vez). */
export function manualDoPerfil(perfil: Perfil): string {
  const existente = cache.get(perfil);
  if (existente !== undefined) return existente;
  const texto = readFileSync(ARQUIVO_DO_PERFIL[perfil], "utf8");
  cache.set(perfil, texto);
  return texto;
}

/** Só para teste: descarta o cache (o conteúdo do `.md` lido em disco pode ter mudado entre dois testes). */
export function limparCacheDoManual(): void {
  cache.clear();
}

export interface EntradaDoManual {
  /** O texto do item, como está no manual (sem o `[chave]` final). */
  texto: string;
  /** A chave do manifesto de destinos citada no fim do item (`shared/vitoria/destinos.ts`), quando houver. */
  chave: string | null;
}

const FIM_DE_ITEM = /^(.*?)(?:\s*\[([a-z0-9_]+)\])?$/;

/**
 * Cada item de lista do manual (as entradas que a busca sem IA e o teste de sincronismo usam). Um item começa numa
 * linha "- " e pode continuar nas linhas seguintes (o Markdown quebra o parágrafo, mas é a mesma entrada); termina na
 * primeira linha em branco, num título (`#`) ou no próximo item.
 */
export function entradasDoManual(perfil: Perfil): EntradaDoManual[] {
  const entradas: EntradaDoManual[] = [];
  let atual: string[] | null = null;

  const fechar = () => {
    if (!atual) return;
    const texto = atual.join(" ").replace(/\s+/g, " ").trim();
    const m = FIM_DE_ITEM.exec(texto)!;
    entradas.push({ texto: m[1]!.trim(), chave: m[2] ?? null });
    atual = null;
  };

  for (const linhaBruta of manualDoPerfil(perfil).split("\n")) {
    const linha = linhaBruta.trim();
    if (linha.startsWith("- ")) {
      fechar();
      atual = [linha.slice(2)];
    } else if (atual && linha && !linha.startsWith("#")) {
      atual.push(linha);
    } else {
      fechar();
    }
  }
  fechar();

  return entradas;
}

/** Todas as chaves citadas nos dois manuais (`tecnico` e `admin`), para o teste de sincronismo do manifesto. */
export function todasAsChavesCitadas(): { perfil: Perfil; chave: string }[] {
  const saida: { perfil: Perfil; chave: string }[] = [];
  for (const perfil of Object.keys(ARQUIVO_DO_PERFIL) as Perfil[]) {
    for (const entrada of entradasDoManual(perfil)) if (entrada.chave) saida.push({ perfil, chave: entrada.chave });
  }
  return saida;
}

const SEM_ACENTO: Record<string, string> = { á: "a", à: "a", ã: "a", â: "a", é: "e", ê: "e", í: "i", ó: "o", ô: "o", õ: "o", ú: "u", ç: "c" };

/** Minúsculo, sem acento, só letras/números/espaço: para comparar palavras da pergunta com as do manual. */
function normalizar(texto: string): string {
  let s = texto.toLowerCase();
  for (const [com, sem] of Object.entries(SEM_ACENTO)) s = s.replaceAll(com, sem);
  return s.replace(/[^a-z0-9\s]/g, " ");
}

const PALAVRAS_IGNORADAS = new Set(["a", "o", "e", "de", "do", "da", "em", "um", "uma", "que", "para", "com", "os", "as", "no", "na", "é", "como", "qual", "quais", "eu", "me", "meu", "minha", "isso", "sem", "ou"]);

function palavrasDe(texto: string): Set<string> {
  return new Set(normalizar(texto).split(/\s+/).filter((p) => p.length > 2 && !PALAVRAS_IGNORADAS.has(p)));
}

/**
 * Busca sem IA (`docs/ia-e-vitoria.md`, seção 4.8): conta quantas palavras da pergunta aparecem no item do manual (texto + a
 * própria pergunta de exemplo, quando a entrada carrega uma); devolve a entrada com mais acertos, ou `null` sem
 * nenhum. Simples de propósito — é a reserva para quando não há IA, não a resposta principal.
 */
export function buscarNoManual(perfil: Perfil, pergunta: string): EntradaDoManual | null {
  const alvo = palavrasDe(pergunta);
  if (alvo.size === 0) return null;
  let melhor: { entrada: EntradaDoManual; pontos: number } | null = null;
  for (const entrada of entradasDoManual(perfil)) {
    const palavrasDoItem = palavrasDe(entrada.texto);
    let pontos = 0;
    for (const palavra of alvo) if (palavrasDoItem.has(palavra)) pontos++;
    if (pontos > 0 && (!melhor || pontos > melhor.pontos)) melhor = { entrada, pontos };
  }
  return melhor ? melhor.entrada : null;
}
