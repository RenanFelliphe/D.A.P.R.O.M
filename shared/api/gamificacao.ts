/**
 * Tipos e textos da gamificação (`docs/gamificacao-e-treinamentos.md`). Os dados vêm da `api` (`/gamificacao/*`, `GET /me`); chaves em snake_case,
 * como ela devolve. Tudo aqui é só leitura: os pontos são calculados e gravados pelo servidor.
 */

/**
 * O selo de uma patente: a imagem, o nome e a cor, como a barra, o ranking e o perfil o mostram. A `api` já manda a imagem do
 * contexto: a das pessoas nos selos de pessoa e a das equipes nos selos de equipe (ranking de equipes e perfil da equipe).
 */
export interface SeloDePatente {
  id: string;
  nome: string;
  cor: string;
  pontos_necessarios: number;
  imagem_url: string | null;
}

/** A patente do cadastro (escada de patentes), com a imagem das pessoas e a imagem das equipes (cada uma escolhida à parte). */
export interface Patente {
  id: string;
  nome: string;
  pontos_necessarios: number;
  cor: string;
  descricao: string | null;
  ativa: boolean;
  /** A imagem da patente nas pessoas (ranking de pessoas, perfil, barra). */
  imagem_url: string | null;
  /** A imagem da patente nas equipes (ranking de equipes e perfil da equipe). */
  imagem_equipe_url: string | null;
}

export interface ListaDePatentes {
  patentes: Patente[];
  /** A patente e os pontos de agora de quem joga; `null` para o admin. */
  voce: { patente_id: string | null; pontos_temporada: number } | null;
}

export interface DadosDaTemporada {
  codigo: string;
  nome: string;
  inicio: string;
  fim: string;
}

/** O resumo que `GET /me` traz para a barra superior; `null` para quem não joga (o admin). */
export interface ResumoDaBarra {
  temporada: { codigo: string; nome: string };
  pontos_temporada: number;
  patente: SeloDePatente | null;
  avisos_pendentes: number;
}

export type TipoDeConquista = "pessoa" | "equipe";

export interface ProgressoDaConquista {
  /** Onde a pessoa (ou a equipe) está; `null` quando ainda não há valor (posição sem temporada fechada). */
  atual: number | null;
  meta: number;
  cumprida: boolean;
}

export interface Conquista {
  id: string;
  titulo: string;
  descricao: string;
  criterio: string;
  criterio_rotulo: string;
  tipo: TipoDeConquista;
  quantidade: number;
  patente: { id: string; nome: string } | null;
  /** A meta em texto ("Complete 50 APRs"). */
  meta: string;
  pontos: number;
  imagem_url: string | null;
  ativa: boolean;
  /** Quantos técnicos ativos (ou equipes) a têm. */
  obtidas: number;
  /** A fração (0 a 1) dos técnicos ativos (ou das equipes) que a têm. */
  raridade: number;
  obtida_em: string | null;
  progresso: ProgressoDaConquista | null;
}

export interface CriterioDeConquista {
  codigo: string;
  rotulo: string;
  tipo: TipoDeConquista;
  pede_quantidade: boolean;
  pede_patente: boolean;
  unidade: string;
}

export interface ListaDeConquistas {
  conquistas: Conquista[];
  equipe_do_progresso: string | null;
  /** Os pontos das conquistas valem só enquanto a tarefa "Conquista obtida" está ativa. */
  pontos_ligados: boolean;
  criterios: CriterioDeConquista[];
  patentes: { id: string; nome: string }[];
}

export interface ConquistaObtida {
  id: string;
  titulo: string;
  descricao: string;
  pontos: number;
  obtida_em: string;
  imagem_url: string | null;
}

export interface MinhaPontuacao {
  temporada: DadosDaTemporada;
  pontos_temporada: number;
  pontos_gerais: number;
  patente: SeloDePatente | null;
  proxima_patente: (SeloDePatente & { faltam: number }) | null;
  /** Onde a barra de progresso começa e termina (a pontuação da patente de agora e a da próxima). */
  barra: { de: number; ate: number | null };
  maior_patente: SeloDePatente | null;
  posicao_temporada: number | null;
  participantes_temporada: number;
  posicao_geral: number | null;
  participantes_geral: number;
  ranking_anonimo: boolean;
  conquistas: Conquista[];
  avisos: { conquistas: ConquistaObtida[]; patente: SeloDePatente | null };
}

export interface LancamentoDoExtrato {
  id: string;
  regra: string;
  pontos: number;
  os_id: string | null;
  numero_ordem: string | null;
  ocorrido_em: string;
  temporada: string;
  /** "APR completa da OS 4019821". */
  descricao: string;
}

export interface Extrato {
  temporada: string;
  pontos: number;
  lancamentos: LancamentoDoExtrato[];
  pagina: number;
  tamanho: number;
  total: number;
}

export interface TemporadaDaLista extends DadosDaTemporada {
  fechada: boolean;
  fechada_em: string | null;
  atual: boolean;
}

export interface LinhaDePessoa {
  posicao: number;
  /** `null` na linha de quem está anônimo (para os outros). */
  usuario_id: string | null;
  nome: string;
  equipe_id: string | null;
  equipe_nome: string | null;
  anonimo: boolean;
  voce: boolean;
  pontos: number;
  patente: SeloDePatente | null;
}

export interface LinhaDeEquipe {
  posicao: number;
  equipe_id: string;
  nome: string;
  membros: number;
  pontos: number;
  media: number;
  voce: boolean;
  /** Na temporada, a patente da média por membro; no ranking geral, a maior patente já alcançada pela equipe. */
  patente: SeloDePatente | null;
}

interface CabecalhoDoRanking {
  escopo: string;
  temporada: (DadosDaTemporada & { fechada: boolean; atual: boolean }) | null;
}

export type RankingDePessoas = CabecalhoDoRanking & { tipo: "pessoas"; linhas: LinhaDePessoa[] };
export type RankingDeEquipes = CabecalhoDoRanking & { tipo: "equipes"; linhas: LinhaDeEquipe[] };

export interface RegraDePontuacao {
  codigo: string;
  nome: string;
  descricao: string;
  grupo: string;
  quem: string;
  quando: string;
  limite: string;
  pontos: number;
  ativa: boolean;
  /** `false` em "Conquista obtida": os pontos vêm de cada conquista. */
  valor_proprio: boolean;
  atualizada_em: string | null;
}

export interface ComoPontuar {
  regras: RegraDePontuacao[];
  regras_do_jogo: string[];
  nao_pontuam: { o_que: string; por_que: string }[];
}

/** O perfil de uma pessoa na gamificação (`GET /gamificacao/usuarios/{id}`); quem está anônimo só aparece a si e ao admin. */
export type PerfilDaPessoa =
  | { anonimo: true }
  | {
      anonimo: false;
      temporada: { codigo: string; nome: string };
      pontos_temporada: number;
      patente: SeloDePatente | null;
      maior_patente: SeloDePatente | null;
      conquistas: ConquistaObtida[];
    };

export interface PerfilDaEquipeNaGamificacao {
  equipe: { id: string; nome: string };
  temporada: { codigo: string; nome: string };
  pontos_temporada: number;
  media: number;
  membros: number;
  patente: SeloDePatente | null;
  /** A maior patente que a média da equipe já alcançou (numa temporada fechada ou na aberta). */
  maior_patente: SeloDePatente | null;
  posicao_temporada: number | null;
  equipes_no_ranking: number;
  pontos_gerais: number;
  media_geral: number;
  posicao_geral: number | null;
  conquistas: ConquistaObtida[];
  pessoas: { usuario_id: string | null; nome: string; anonimo: boolean; voce: boolean; pontos: number; patente: SeloDePatente | null }[];
}

/** O que as rotas que geram pontos devolvem para o aviso "+N pontos". */
export interface GanhoDePontos {
  regra: string;
  nome: string;
  pontos: number;
  os_id: string | null;
}

export interface RespostaComPontos {
  pontos_ganhos?: number;
  ganhos?: GanhoDePontos[];
}

/** `1.234` em pt-BR. */
export const numero = (n: number) => n.toLocaleString("pt-BR");

/** "1 ponto" / "35 pontos". */
export const pontos = (n: number) => `${numero(n)} ${n === 1 ? "ponto" : "pontos"}`;

/** Média por membro com até duas casas ("955", "92,5"). */
export const mediaDeEquipe = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

/** A raridade como porcentagem ("12%", "<1%" para o raro, "0%" quando ninguém tem). */
export function raridadeEmTexto(r: number): string {
  if (r <= 0) return "0%";
  const p = r * 100;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}

/** Os textos das posições: "1º", "12º". */
export const ordinal = (n: number) => `${n}º`;

/** Os rótulos das temporadas no seletor ("Primavera 2026 (atual)"). */
export const rotuloDaTemporada = (t: Pick<TemporadaDaLista, "nome" | "atual" | "fechada">) => `${t.nome}${t.atual ? " (atual)" : t.fechada ? " (fechada)" : ""}`;

/** Rotas da `api` que a gamificação lê; usadas pelo `data/gamificacao.ts` e pelos componentes de cliente. */
export const caminhosDaApi = {
  eu: "/gamificacao/eu",
  extrato: "/gamificacao/extrato",
  ranking: "/gamificacao/ranking",
  temporadas: "/gamificacao/temporadas",
  regras: "/gamificacao/regras",
  patentes: "/gamificacao/patentes",
  conquistas: "/gamificacao/conquistas",
  avisosVistos: "/gamificacao/avisos/vistos",
  rankingAnonimo: "/me/ranking-anonimo",
  equipe: (id: string) => `/gamificacao/equipes/${id}`,
  pessoa: (id: string) => `/gamificacao/usuarios/${id}`,
} as const;

/** O texto do aviso "+N pontos" com o que gerou (ex.: "+15 pontos: APR completa +10, Responsável pela APR +5"). `null` sem pontos. */
export function textoDosPontosGanhos(r: RespostaComPontos | null | undefined): string | null {
  const total = r?.pontos_ganhos ?? 0;
  if (total <= 0) return null;
  const detalhe = (r?.ganhos ?? []).filter((g) => g.pontos > 0).map((g) => `${g.nome} +${numero(g.pontos)}`);
  return `+${pontos(total)}${detalhe.length > 0 ? `: ${detalhe.join(", ")}` : ""}`;
}
