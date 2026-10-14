/**
 * Contrato da API do registro de funcionários (ver `apifuncionarios.md`, seção 3): o que o DAPROM consulta do RH da empresa. O
 * simulador do próprio back-end responde no mesmo formato, e o DAPROM não sabe se fala com ele ou com o RH de verdade.
 */
export interface FuncionarioRh {
  matricula: string;
  nome: string;
  /** Institucional; é o login no DAPROM. */
  email: string;
  cargo: string;
  /** Código do centro de trabalho, o mesmo de `equipe.centro_trabalho`. */
  centro_trabalho: string;
  setor: string;
  registro_profissional?: string | null;
  situacao: "ativo" | "afastado" | "desligado";
  data_admissao?: string | null;
  data_nascimento?: string | null;
  telefone?: string | null;
  gestor_matricula?: string | null;
  lotacao?: string | null;
}

export interface PaginaDeFuncionarios {
  funcionarios: FuncionarioRh[];
  proxima_pagina?: number;
}

export interface ClienteRh {
  /** `null` quando a matrícula não está no registro; registro fora do ar ou não configurado lança exceção. */
  obterFuncionario(matricula: string): Promise<FuncionarioRh | null>;
  listarFuncionarios(opcoes: { pagina: number; tamanho: number }): Promise<PaginaDeFuncionarios>;
}

/** O registro não respondeu (fora do ar, não configurado ou resposta fora do formato): quem consulta recusa em vez de adivinhar. */
export class RegistroIndisponivel extends Error {}
