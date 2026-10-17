import type { Emblema } from "./gamificacao-dados";

/**
 * As 3 conquistas dos treinamentos de serviço (seção 3.8 do `vitoria.md`, seção 13 do `gameficacao.md`), no mesmo espírito
 * de `gamificacao-dados.ts`: os dados ficam aqui, viram `INSERT` colado na migração que os criou (`0027`, que não mexe em
 * `0016`/`0017`) e as imagens são geradas e gravadas pela subida da `api` (`treinamento-servico-imagens.ts`). Ficam num
 * arquivo à parte, e não dentro de `CONQUISTAS_DA_CARGA`, porque aquele array é o retrato fechado da migração `0016`
 * (o teste de gamificação confere que tem exatamente 23 conquistas).
 */

export interface ConquistaDeTreinamentoServico {
  id: string;
  imagemId: string;
  titulo: string;
  descricao: string;
  criterio: "treinamentos_servico_concluidos" | "treinamentos_gabaritados";
  quantidade: number;
  pontos: number;
  emblema: Emblema;
}

export const CONQUISTAS_TREINAMENTO_SERVICO: ConquistaDeTreinamentoServico[] = [
  {
    id: "d0000000-0000-4000-8000-000000000001",
    imagemId: "d1000000-0000-4000-8000-000000000001",
    titulo: "Aprendiz",
    descricao: "Concluiu os primeiros treinamentos de serviço.",
    criterio: "treinamentos_servico_concluidos",
    quantidade: 3,
    pontos: 25,
    emblema: "livro",
  },
  {
    id: "d0000000-0000-4000-8000-000000000002",
    imagemId: "d1000000-0000-4000-8000-000000000002",
    titulo: "Especialista",
    descricao: "Treinou em boa parte dos serviços do catálogo.",
    criterio: "treinamentos_servico_concluidos",
    quantidade: 10,
    pontos: 50,
    emblema: "livro",
  },
  {
    id: "d0000000-0000-4000-8000-000000000003",
    imagemId: "d1000000-0000-4000-8000-000000000003",
    titulo: "Nota máxima",
    descricao: "Gabaritou um treinamento de serviço na primeira tentativa.",
    criterio: "treinamentos_gabaritados",
    quantidade: 1,
    pontos: 25,
    emblema: "estrela",
  },
];

const aspas = (texto: string) => `'${texto.replaceAll("'", "''")}'`;

/** O SQL colado na migração `0027` para estas 3 conquistas, no mesmo formato de `sqlDaCarga()`. */
export function sqlDaCargaDeTreinamentoServico(): string {
  const linhas = CONQUISTAS_TREINAMENTO_SERVICO.map(
    (c) => `(${aspas(c.id)}, ${aspas(c.titulo)}, ${aspas(c.descricao)}, ${aspas(c.criterio)}, ${c.quantidade}, NULL, ${c.pontos}, ${aspas(c.imagemId)})`,
  ).join(",\n");
  return `INSERT INTO "conquista" ("id", "titulo", "descricao", "criterio", "quantidade", "patente_id", "pontos", "imagem_path") VALUES\n${linhas};`;
}
