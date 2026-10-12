/** Formatos das respostas da `api` que o formulário de OS de apoio usa. */

export interface Local {
  id: string;
  codigo: string;
  endereco: string | null;
  plus_code: string | null;
  cliente: string | null;
  critico: boolean;
}

export interface Atividade {
  codigo: string;
  descricao: string;
  modelo_apr_codigo: string | null;
  provisorio: boolean;
}

/** Local escolhido para a OS de apoio: sempre um que já veio do SAP. */
export type LocalEscolhido = Pick<Local, "id" | "codigo" | "endereco">;

export const PRIORIDADES = ["Muito alto", "Alto", "Médio", "Baixo"] as const;
