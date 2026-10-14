import type { Criterio } from "../schema";

/**
 * A carga inicial da gamificação (seções 3.3 e 7.4 do `gameficacao.md`): as 5 patentes e as 23 conquistas. As linhas entram
 * pela migração `0016_gamificacao` (uma única vez por banco, então o que o admin apagar não volta); este arquivo guarda os
 * mesmos dados para gerar as imagens (`imagens-gamificacao.ts`) e para o teste que confere a migração. Os ids são fixos: o
 * `imagem_path` de cada linha é o id do arquivo no bucket `gamificacao`, que a subida da `api` grava se ainda não existir.
 */

export type Emblema = "estrela" | "visto" | "escudo" | "engrenagem" | "raio" | "pessoas" | "alvo" | "relogio" | "mapa" | "coroa" | "livro";

export interface PatenteDaCarga {
  id: string;
  /** O id do arquivo da imagem da patente das pessoas (uma medalha). */
  imagemId: string;
  /** O id do arquivo da imagem da patente das equipes (um brasão): diferente da das pessoas. */
  imagemEquipeId: string;
  nome: string;
  pontosNecessarios: number;
  cor: string;
  descricao: string;
}

export const PATENTES_DA_CARGA: PatenteDaCarga[] = [
  { id: "a0000000-0000-4000-8000-000000000001", imagemId: "a1000000-0000-4000-8000-000000000001", imagemEquipeId: "a2000000-0000-4000-8000-000000000001", nome: "Bronze", pontosNecessarios: 0, cor: "#CD7F32", descricao: "O ponto de partida de toda temporada." },
  { id: "a0000000-0000-4000-8000-000000000002", imagemId: "a1000000-0000-4000-8000-000000000002", imagemEquipeId: "a2000000-0000-4000-8000-000000000002", nome: "Prata", pontosNecessarios: 300, cor: "#A8A9AD", descricao: "Primeira subida: o ritmo de campo já aparece." },
  { id: "a0000000-0000-4000-8000-000000000003", imagemId: "a1000000-0000-4000-8000-000000000003", imagemEquipeId: "a2000000-0000-4000-8000-000000000003", nome: "Ouro", pontosNecessarios: 1500, cor: "#D4AF37", descricao: "Constância ao longo das semanas." },
  { id: "a0000000-0000-4000-8000-000000000004", imagemId: "a1000000-0000-4000-8000-000000000004", imagemEquipeId: "a2000000-0000-4000-8000-000000000004", nome: "Platina", pontosNecessarios: 3000, cor: "#9DB4C0", descricao: "Perto do fim da temporada, com muito serviço feito." },
  { id: "a0000000-0000-4000-8000-000000000005", imagemId: "a1000000-0000-4000-8000-000000000005", imagemEquipeId: "a2000000-0000-4000-8000-000000000005", nome: "Diamante", pontosNecessarios: 5000, cor: "#4FC3F7", descricao: "O topo: só quem rende bem acima da média." },
];

const patenteDoMetal = (nome: string) => PATENTES_DA_CARGA.find((p) => p.nome === nome)!.id;

export interface ConquistaDaCarga {
  id: string;
  imagemId: string;
  titulo: string;
  descricao: string;
  criterio: Criterio;
  quantidade: number;
  /** O nome do metal, nos critérios de patente. */
  patente?: string;
  pontos: number;
  emblema: Emblema;
}

const id = (n: number) => `c0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const imagem = (n: number) => `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Entrada = Omit<ConquistaDaCarga, "id" | "imagemId">;
const ENTRADAS: Entrada[] = [
  // Pessoa
  { titulo: "Primeiro passo", descricao: "Todo serviço seguro começa com uma APR.", criterio: "aprs_completas", quantidade: 1, pontos: 25, emblema: "visto" },
  { titulo: "Olho vivo", descricao: "Cinquenta análises antes de pôr a mão no serviço.", criterio: "aprs_completas", quantidade: 50, pontos: 50, emblema: "visto" },
  { titulo: "Guardião da APR", descricao: "A segurança virou hábito.", criterio: "aprs_completas", quantidade: 500, pontos: 100, emblema: "escudo" },
  { titulo: "Líder de campo", descricao: "Liderou a equipe na APR.", criterio: "responsavel_apr", quantidade: 50, pontos: 50, emblema: "coroa" },
  { titulo: "Mão na massa", descricao: "Cinquenta serviços concluídos em campo.", criterio: "execucoes_concluidas", quantidade: 50, pontos: 50, emblema: "engrenagem" },
  { titulo: "Veterano de campo", descricao: "Quinhentos serviços concluídos em campo.", criterio: "execucoes_concluidas", quantidade: 500, pontos: 100, emblema: "engrenagem" },
  { titulo: "Relógio suíço", descricao: "O plano de manutenção em dia.", criterio: "preventivas_em_dia", quantidade: 25, pontos: 50, emblema: "relogio" },
  { titulo: "Ponto crítico", descricao: "De confiança onde a operação não pode parar.", criterio: "locais_criticos", quantidade: 25, pontos: 50, emblema: "alvo" },
  { titulo: "Resgate", descricao: "Retomou o que ficou pendente.", criterio: "os_retomadas", quantidade: 5, pontos: 50, emblema: "raio" },
  { titulo: "Reforço", descricao: "Apoiou outra equipe quando ela precisou.", criterio: "os_apoio", quantidade: 3, pontos: 50, emblema: "pessoas" },
  { titulo: "Mentor", descricao: "Levou quem está chegando para aprender em campo.", criterio: "tecnicos_novos", quantidade: 10, pontos: 50, emblema: "livro" },
  { titulo: "Explorador", descricao: "Conhece a operação de ponta a ponta.", criterio: "locais_diferentes", quantidade: 20, pontos: 50, emblema: "mapa" },
  { titulo: "Pronto para o campo", descricao: "Treinou antes de ir a campo.", criterio: "campo_de_treino", quantidade: 1, pontos: 25, emblema: "livro" },
  { titulo: "De olho na equipe", descricao: "Acompanhou de perto o trabalho da equipe.", criterio: "ciencias_no_prazo", quantidade: 50, pontos: 50, emblema: "visto" },
  { titulo: "Planejador", descricao: "Deixou o ciclo das preventivas pronto para avisar.", criterio: "intervalos_definidos", quantidade: 10, pontos: 50, emblema: "relogio" },
  { titulo: "Pódio", descricao: "Entre os três melhores da temporada.", criterio: "posicao", quantidade: 3, pontos: 100, emblema: "estrela" },
  { titulo: "Brilho de diamante", descricao: "Chegou ao topo numa temporada.", criterio: "patente", quantidade: 1, patente: "Diamante", pontos: 100, emblema: "estrela" },
  // Equipe (sem pontos)
  { titulo: "Equipe em campo", descricao: "Cem serviços concluídos juntos.", criterio: "execucoes_da_equipe", quantidade: 100, pontos: 0, emblema: "pessoas" },
  { titulo: "Plano em dia", descricao: "Cem preventivas em dia.", criterio: "preventivas_em_dia_da_equipe", quantidade: 100, pontos: 0, emblema: "relogio" },
  { titulo: "Temporada impecável", descricao: "Uma temporada sem preventiva atrasada sem justificativa.", criterio: "temporadas_impecaveis", quantidade: 1, pontos: 0, emblema: "escudo" },
  { titulo: "Equipe de ouro", descricao: "A média da equipe chegou ao Ouro.", criterio: "patente_da_equipe", quantidade: 1, patente: "Ouro", pontos: 0, emblema: "coroa" },
  { titulo: "Equipe diamante", descricao: "A média da equipe chegou ao Diamante.", criterio: "patente_da_equipe", quantidade: 1, patente: "Diamante", pontos: 0, emblema: "estrela" },
  { titulo: "Campeã da temporada", descricao: "A melhor equipe da temporada.", criterio: "posicao_da_equipe", quantidade: 1, pontos: 0, emblema: "coroa" },
];

export const CONQUISTAS_DA_CARGA: ConquistaDaCarga[] = ENTRADAS.map((e, i) => ({ ...e, id: id(i + 1), imagemId: imagem(i + 1) }));

/** O id da patente (do banco) que a conquista da carga tem como meta. */
export const patenteDaConquistaDaCarga = (c: ConquistaDaCarga): string | null => (c.patente ? patenteDoMetal(c.patente) : null);

const aspas = (texto: string) => `'${texto.replaceAll("'", "''")}'`;

/**
 * O SQL das linhas da carga (patentes e conquistas), que foi colado na migração `0016_gamificacao`. Fica aqui só para o
 * teste conferir que a migração tem exatamente estes dados.
 */
export function sqlDaCarga(): string {
  const patentes = PATENTES_DA_CARGA.map(
    (p) => `(${aspas(p.id)}, ${aspas(p.nome)}, ${p.pontosNecessarios}, ${aspas(p.imagemId)}, ${aspas(p.cor)}, ${aspas(p.descricao)})`,
  ).join(",\n");
  const conquistas = CONQUISTAS_DA_CARGA.map(
    (c) =>
      `(${aspas(c.id)}, ${aspas(c.titulo)}, ${aspas(c.descricao)}, ${aspas(c.criterio)}, ${c.quantidade}, ${patenteDaConquistaDaCarga(c) ? aspas(patenteDaConquistaDaCarga(c)!) : "NULL"}, ${c.pontos}, ${aspas(c.imagemId)})`,
  ).join(",\n");
  return `INSERT INTO "patente" ("id", "nome", "pontos_necessarios", "imagem_path", "cor", "descricao") VALUES\n${patentes};\n--> statement-breakpoint\nINSERT INTO "conquista" ("id", "titulo", "descricao", "criterio", "quantidade", "patente_id", "pontos", "imagem_path") VALUES\n${conquistas};`;
}

/**
 * O SQL que dá às 5 patentes da carga a imagem de equipe, colado na migração `0017_patente_imagem_da_equipe` (a coluna
 * `imagem_equipe_path` nasceu depois da `0016`). Fica aqui só para o teste conferir que a migração tem exatamente estes ids.
 */
export function sqlDaImagemDaEquipe(): string {
  const casos = PATENTES_DA_CARGA.map((p) => `WHEN ${aspas(p.id)} THEN ${aspas(p.imagemEquipeId)}`).join(" ");
  const ids = PATENTES_DA_CARGA.map((p) => aspas(p.id)).join(", ");
  return `UPDATE "patente" SET "imagem_equipe_path" = CASE "id" ${casos} END WHERE "id" IN (${ids}) AND "imagem_equipe_path" IS NULL;`;
}
