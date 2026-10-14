import { MODELO_BLOQUEIO, MODELO_GUIADO } from "./ids";

/**
 * A orientação dos modelos de treino (o que o técnico vê ao escolher o modelo) e a recomendação pela leitura da OS, igual à
 * da `api` (`api/src/dominio/recomendacao-apr.ts`): palavras-chave achadas no título (peso 3), no serviço do catálogo (2) e
 * na descrição da OS (1); empate no topo não recomenda nenhum. Tudo fictício.
 */

export interface OrientacaoDoTreino {
  descricao: string;
  exemplos: string[];
  palavrasChave: string[];
}

export const ORIENTACOES_DO_TREINO: Record<string, OrientacaoDoTreino> = {
  [MODELO_GUIADO.codigo]: {
    descricao: "Inspeção e manutenção, feitas do chão, nos equipamentos da subestação e na iluminação: termografia, transformador, chaves seccionadoras, para-raios e troca de lâmpadas.",
    exemplos: ["Inspeção termográfica de quadro de média tensão", "Manutenção preventiva de transformador", "Limpeza e inspeção de chaves seccionadoras", "Troca de lâmpadas da iluminação"],
    palavrasChave: ["inspeção", "termográfica", "quadro", "transformador", "chave seccionadora", "para-raios", "lâmpada", "iluminação", "subestação"],
  },
  [MODELO_BLOQUEIO.codigo]: {
    descricao: "Serviços acima de 2 metros em poste e estrutura da rede: isoladores, religadores, elos fusíveis, conexões no alto e poda perto da rede.",
    exemplos: ["Substituição de isolador no poste", "Troca de elo fusível em religador", "Reaperto de conexões no alto da estrutura", "Poda de árvore próxima à rede"],
    palavrasChave: ["isolador", "religador", "elo fusível", "poste", "altura", "alimentador", "poda", "estrutura"],
  },
};

export const orientacaoDoTreino = (codigo: string): OrientacaoDoTreino => ORIENTACOES_DO_TREINO[codigo] ?? { descricao: "", exemplos: [], palavrasChave: [] };

const semAcento = (texto: string) => texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const palavrasDe = (texto: string) => [...texto.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ inicio: m.index, fim: m.index + m[0].length, normal: semAcento(m[0]) }));

const combina = (daChave: string, doTexto: string) => (daChave.length >= 4 ? doTexto.startsWith(daChave) : doTexto === daChave);

/** O modelo recomendado (ou `null`) e, por modelo, o que ele achou na OS, como a OS escreveu. */
export function recomendarModelo(textos: { titulo: string; servico?: string | null; descricao?: string | null }, codigos: string[]) {
  const campos = [
    { peso: 3, texto: textos.titulo },
    { peso: 2, texto: textos.servico ?? "" },
    { peso: 1, texto: textos.descricao ?? "" },
  ]
    .filter((c) => c.texto.trim() !== "")
    .map((c) => ({ ...c, palavras: palavrasDe(c.texto) }));

  const encontradas = new Map<string, string[]>();
  const pontos = new Map<string, number>();
  for (const codigo of codigos) {
    const achados: { texto: string; peso: number; posicao: number }[] = [];
    for (const bruta of new Set(orientacaoDoTreino(codigo).palavrasChave)) {
      const chave = palavrasDe(bruta).map((p) => p.normal);
      for (const campo of campos) {
        const i = campo.palavras.findIndex((_, k) => k + chave.length <= campo.palavras.length && chave.every((p, j) => combina(p, campo.palavras[k + j]!.normal)));
        if (chave.length > 0 && i >= 0) {
          const trecho = campo.texto.slice(campo.palavras[i]!.inicio, campo.palavras[i + chave.length - 1]!.fim);
          achados.push({ texto: trecho, peso: campo.peso, posicao: campo.palavras[i]!.inicio });
          break;
        }
      }
    }
    if (achados.length === 0) continue;
    pontos.set(codigo, achados.reduce((s, a) => s + a.peso, 0));
    const vistos = new Set<string>();
    encontradas.set(
      codigo,
      achados
        .sort((a, b) => b.peso - a.peso || a.posicao - b.posicao)
        .map((a) => a.texto)
        .filter((t) => !vistos.has(semAcento(t)) && Boolean(vistos.add(semAcento(t)))),
    );
  }
  const maior = Math.max(0, ...pontos.values());
  const noTopo = [...pontos].filter(([, p]) => p === maior);
  return { recomendado: maior > 0 && noTopo.length === 1 ? noTopo[0]![0] : null, encontradas };
}
