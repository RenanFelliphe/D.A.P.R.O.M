import type { Emblema } from "./gamificacao-dados";

/**
 * A conquista de sincronização offline (pendência 8; seção 7.4 do `gameficacao.md`), no mesmo espírito de
 * `treinamento-servico-dados.ts`: o dado fica aqui, vira `INSERT` colado na migração que o criou (`0037`, que não mexe nas
 * anteriores) e a imagem é gerada e gravada pela subida da `api` (`sincronizacao-offline-imagens.ts`). Fica num arquivo à
 * parte porque `CONQUISTAS_DA_CARGA` é o retrato fechado da migração `0016`.
 *
 * **Vale 0 ponto, de propósito:** a regra 2.2 do `gameficacao.md` diz que a sincronização não pontua (pontuaria desligar o
 * sinal de propósito). O troféu reconhece o trabalho feito em contingência que chegou ao painel; o admin pode dar pontos
 * a ele no cadastro de conquistas, se a empresa quiser.
 */

export interface ConquistaDeSincronizacaoOffline {
  id: string;
  imagemId: string;
  titulo: string;
  descricao: string;
  criterio: "sincronizacoes_offline";
  quantidade: number;
  pontos: number;
  emblema: Emblema;
}

export const CONQUISTAS_SINCRONIZACAO_OFFLINE: ConquistaDeSincronizacaoOffline[] = [
  {
    id: "e0000000-0000-4000-8000-000000000001",
    imagemId: "e1000000-0000-4000-8000-000000000001",
    titulo: "Sem sinal, sem problema",
    descricao: "Trabalhou onde o sinal não chega e o registro chegou ao painel quando ele voltou.",
    criterio: "sincronizacoes_offline",
    quantidade: 1,
    pontos: 0,
    emblema: "raio",
  },
];

const aspas = (texto: string) => `'${texto.replaceAll("'", "''")}'`;

/** O SQL colado na migração `0037` para esta conquista, no mesmo formato de `sqlDaCarga()`. */
export function sqlDaCargaDeSincronizacaoOffline(): string {
  const linhas = CONQUISTAS_SINCRONIZACAO_OFFLINE.map(
    (c) => `(${aspas(c.id)}, ${aspas(c.titulo)}, ${aspas(c.descricao)}, ${aspas(c.criterio)}, ${c.quantidade}, NULL, ${c.pontos}, ${aspas(c.imagemId)})`,
  ).join(",\n");
  return `INSERT INTO "conquista" ("id", "titulo", "descricao", "criterio", "quantidade", "patente_id", "pontos", "imagem_path") VALUES\n${linhas};`;
}
