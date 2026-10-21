import type { FuncaoDeIA } from "../../../shared/ia/funcoes";

/** Uma função de IA em `GET /vitoria/ia` e no retorno de `PUT /vitoria/ia/{funcao}` (só o admin; `controle-da-ia.md`). */
export interface EstadoDaFuncaoDeIa {
  funcao: FuncaoDeIA;
  /** Pode chamar a IA agora (ligada e, quando só funciona com dados, com a leitura autorizada na versão atual do texto). */
  ligada: boolean;
  /** A IA recebe dado real nesta função agora. */
  com_dados: boolean;
  /** O texto do que ela lê mudou depois da assinatura: precisa assinar de novo. */
  texto_desatualizado: boolean;
  autorizado_por: { id: string; nome: string } | null;
  autorizado_em: string | null;
  /** O modelo real do fornecedor que esta função usa. */
  modelo: string;
}

export interface PainelDaIa {
  /** Há chave do fornecedor na `api`: sem ela nenhuma função chama a IA, mesmo ligada. */
  chave_configurada: boolean;
  provedor: "anthropic" | "gemini";
  funcoes: EstadoDaFuncaoDeIa[];
}

export const NOME_DO_PROVEDOR: Record<PainelDaIa["provedor"], string> = {
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini (gratuito, só na demonstração)",
};
