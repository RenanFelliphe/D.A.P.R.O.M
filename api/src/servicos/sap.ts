/**
 * Contrato da API do SAP (ver `docs/especificacao.md`, seção 7.1). O simulador do próprio back-end responde no mesmo
 * formato, e o adaptador de leitura não sabe se fala com um ou com o outro.
 */
export interface OrdemSap {
  numero_ordem: string;
  numero_nota?: string | null;
  /** `YBA1` (corretiva) ou `YBA2` (preventiva). */
  tipo_ordem: string;
  /** Texto do SAP, ex.: `Z01-Manutenção Corretiva`. */
  tipo_atividade?: string | null;
  codigo_atividade?: string | null;
  titulo: string;
  descricao?: string | null;
  centro_trabalho: string;
  local_instalacao: { codigo: string; endereco?: string | null; plus_code?: string | null; cliente?: string | null };
  equipamento?: string | null;
  prioridade?: string | null;
  data_inicio_prog: string;
  data_fim_prog?: string | null;
  /** Lista de códigos do sistema (`LIB IMPR CAPC`). */
  status_sap?: string | null;
  solicitante?: string | null;
  criado_por?: string | null;
  criada_em?: string | null;
  plano_manutencao?: string | null;
  item_manutencao?: string | null;
  /** Intervalo entre ciclos do plano da preventiva ("3 MON", "trimestral" ou `{quantidade, unidade}`); opcional. */
  intervalo_ciclo?: string | { quantidade: number; unidade: string } | null;
}

export interface PaginaDeOrdens {
  ordens: OrdemSap[];
  proxima_pagina?: number;
}

export interface ClienteSap {
  listarOrdens(opcoes: { alteradasDesde?: Date; pagina: number; tamanho: number }): Promise<PaginaDeOrdens>;
  obterOrdem(numeroOrdem: string): Promise<OrdemSap | null>;
}
