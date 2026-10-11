/** Formatos das respostas da `api` que o formulário de OS nova (manual ou de apoio) usa. */

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

/** Local escolhido para a OS: um já cadastrado ou um novo, que o formulário cadastra (`POST /locais`) antes de criar a OS. */
export type LocalEscolhido =
  | { tipo: "existente"; id: string; codigo: string; endereco: string | null }
  | { tipo: "novo"; codigo: string; endereco: string; plus_code: string; cliente: string };

export const PRIORIDADES = ["Muito alto", "Alto", "Médio", "Baixo"] as const;
