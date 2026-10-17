import { DESTINOS, resolverAcao, type AcaoBruta, type AcaoResolvida } from "../../../shared/vitoria/destinos";
import { PADRAO, sugestoesDaTela, type SugestaoFixa } from "../../../shared/vitoria/sugestoes";
import type { ExpressaoVitoria } from "./treinamento-servico";

export { DESTINOS, resolverAcao, sugestoesDaTela, PADRAO };
export type { AcaoBruta, AcaoResolvida, SugestaoFixa };

/** Até quantas mensagens anteriores a web reenvia a cada pedido (a conversa não é guardada no servidor). */
export const HISTORICO_MAXIMO = 10;

export interface MensagemVitoria {
  id: string;
  papel: "usuario" | "assistente";
  texto: string;
  /** Só nas respostas da Vitória, para o avatar; o limite ou o fallback já vêm prontos do servidor. */
  expressao?: ExpressaoVitoria;
  acao?: AcaoResolvida | null;
}

interface RegraDeTela {
  padrao: RegExp;
  tela: string;
  contexto?: (m: RegExpMatchArray) => Record<string, string>;
}

/**
 * De um caminho (`usePathname()`) para a "tela atual" que a Vitória manda à `api` (a mesma chave das sugestões fixas,
 * `shared/vitoria/sugestoes.ts`) e o contexto necessário para ações `com_contexto` (ex.: o `os_id` da OS aberta). A
 * ordem importa: as regras mais específicas (APR, execução) vêm antes da genérica do detalhe da OS.
 */
const REGRAS_DE_TELA: RegraDeTela[] = [
  { padrao: /^\/app\/os\/([^/]+)\/apr(\/|$)/, tela: "apr", contexto: (m) => ({ os_id: m[1]! }) },
  { padrao: /^\/app\/os\/([^/]+)\/execucao(\/|$)/, tela: "execucao", contexto: (m) => ({ os_id: m[1]! }) },
  { padrao: /^\/app\/os\/([^/]+)/, tela: "os_detalhe", contexto: (m) => ({ os_id: m[1]! }) },
  { padrao: /^\/app\/lista/, tela: "quadro_os" },
  { padrao: /^\/app\/perfil/, tela: "perfil" },
  { padrao: /^\/app\/equipes\/([^/]+)/, tela: "equipe", contexto: (m) => ({ equipe_id: m[1]! }) },
  { padrao: /^\/app\/busca/, tela: "busca" },
  { padrao: /^\/app\/dashboard/, tela: "dashboard" },
  { padrao: /^\/app\/catalogo\/servicos\/([^/]+)\/treinamento/, tela: "treinamento_servico_editor", contexto: (m) => ({ servico_codigo: decodeURIComponent(m[1]!) }) },
  { padrao: /^\/app\/catalogo\/servicos\/([^/]+)\/treinar/, tela: "catalogo_servicos", contexto: (m) => ({ servico_codigo: decodeURIComponent(m[1]!) }) },
  { padrao: /^\/app\/catalogo/, tela: "catalogo_servicos" },
  { padrao: /^\/app\/gamificacao/, tela: "gamificacao" },
  { padrao: /^\/app\/treino(\/|$)/, tela: "treino_campo" },
  { padrao: /^\/app\/aguardando/, tela: "aguardando" },
  { padrao: /^\/app\/vitoria\/sem-resposta/, tela: "vitoria_sem_resposta" },
  { padrao: /^\/app\/usuarios/, tela: "usuarios" },
  { padrao: /^\/web\/apr\/modelos\/([^/]+)/, tela: "modelos_apr", contexto: (m) => ({ modelo_codigo: decodeURIComponent(m[1]!) }) },
  { padrao: /^\/web\/apr/, tela: "modelos_apr" },
  { padrao: /^\/web\/os\/importacao/, tela: "importacao" },
  { padrao: /^\/web\/auditoria/, tela: "auditoria" },
];

export interface TelaAtual {
  tela: string;
  contexto: Record<string, string>;
}

export function telaAtualDe(pathname: string): TelaAtual {
  for (const regra of REGRAS_DE_TELA) {
    const m = regra.padrao.exec(pathname);
    if (m) return { tela: regra.tela, contexto: regra.contexto?.(m) ?? {} };
  }
  return { tela: PADRAO, contexto: {} };
}
