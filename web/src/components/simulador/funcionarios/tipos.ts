/** Formas das respostas de `/rh-simulado/gestao/...` (chaves em snake_case, como a `api` devolve). */

export type SituacaoFuncionario = "ativo" | "afastado" | "desligado";

export const rotuloDaSituacao: Record<SituacaoFuncionario, string> = { ativo: "Ativo", afastado: "Afastado", desligado: "Desligado" };

export interface ContaNoSynqOs {
  id: string;
  perfil: "tecnico" | "admin";
  equipe_id: string | null;
  ativo: boolean;
  liberacao: "liberado" | "pendente" | "recusado";
}

export interface Funcionario {
  matricula: string;
  nome: string;
  email: string;
  cargo: string;
  centro_trabalho: string;
  setor: string;
  registro_profissional: string | null;
  situacao: SituacaoFuncionario;
  data_admissao: string | null;
  data_nascimento: string | null;
  telefone: string | null;
  gestor_matricula: string | null;
  lotacao: string | null;
  criado_em: string;
  alterado_em: string;
  /** A conta que a pessoa tem no SYNQ OS, ou `null`. */
  conta_no_synq_os: ContaNoSynqOs | null;
}

export interface ListaDeFuncionarios {
  funcionarios: Funcionario[];
  total: number;
  pagina: number;
  tamanho: number;
  /** Contador de todos os funcionários por situação (não só os da busca). */
  contagem: Record<SituacaoFuncionario, number>;
}

export interface SetorDoCatalogo {
  centro_trabalho: string;
  nome: string;
  cargos: string[];
  /** Nome da equipe do SYNQ OS que tem este centro de trabalho; `null` quando o setor não tem equipe lá. */
  equipe_no_synq_os: string | null;
}

export interface CatalogoDeFuncionarios {
  setores: SetorDoCatalogo[];
  situacoes: SituacaoFuncionario[];
  proxima_matricula: string;
}

export interface RecusadoEmMassa {
  matricula: string;
  motivo: string;
}

export type AcaoEmMassa = "excluir" | "mudar_setor" | "mudar_situacao";
