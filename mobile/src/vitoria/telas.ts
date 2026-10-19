import type { AcaoResolvida } from "@shared/vitoria/destinos";
import { PADRAO } from "@shared/vitoria/sugestoes";

/**
 * A "tela atual" que o app manda à Vitória (a mesma chave das sugestões fixas, `shared/vitoria/sugestoes.ts`) e o contexto das ações
 * `com_contexto` (o `os_id` da OS aberta). Os caminhos são os do Expo Router, sem os grupos: `/os/<id>/apr`, `/lista`, `/perfil`.
 * A ordem importa: as regras mais específicas (APR, execução) vêm antes da genérica do detalhe da OS.
 */
interface RegraDeTela {
  padrao: RegExp;
  tela: string;
  contexto?: (m: RegExpMatchArray) => Record<string, string>;
}

const REGRAS: RegraDeTela[] = [
  { padrao: /^\/os\/([^/]+)\/(apr|checklist|aprovada|bloqueio)(\/|$)/, tela: "apr", contexto: (m) => ({ os_id: m[1]! }) },
  { padrao: /^\/os\/([^/]+)\/execucao(\/|$)/, tela: "execucao", contexto: (m) => ({ os_id: m[1]! }) },
  { padrao: /^\/os\/([^/]+)/, tela: "os_detalhe", contexto: (m) => ({ os_id: m[1]! }) },
  { padrao: /^\/lista(\/|$)/, tela: "quadro_os" },
  { padrao: /^\/(perfil|ausencias|historico|emails|senha)(\/|$)/, tela: "perfil" },
  { padrao: /^\/pontos(\/|$)/, tela: "gamificacao" },
];

export interface TelaAtual {
  tela: string;
  contexto: Record<string, string>;
}

export function telaAtualDe(caminho: string): TelaAtual {
  for (const regra of REGRAS) {
    const m = regra.padrao.exec(caminho);
    if (m) return { tela: regra.tela, contexto: regra.contexto?.(m) ?? {} };
  }
  return { tela: PADRAO, contexto: {} };
}

/** Para onde o "Me leve lá" vai: uma tela do app, ou o caminho de uma tela que só existe na web. */
export type DestinoNoApp = { tipo: "app"; rota: string; params?: Record<string, string> } | { tipo: "web"; caminho: string };

/**
 * Leva o endereço de uma ação resolvida (`/app/os/<id>/apr`, o endereço da web) à tela equivalente do app. O que só existe na web
 * (dashboard, catálogo, usuários, equipes) vira `web`: o app abre o navegador no endereço da web, se ele estiver configurado.
 */
export function destinoDaAcaoNoApp(acao: Pick<AcaoResolvida, "url">): DestinoNoApp {
  const [caminho = "", consulta = ""] = acao.url.split("?");
  const caminhoSemFragmento = caminho.split("#")[0]!;
  const os = /^\/app\/os\/([^/]+)(?:\/(apr|execucao))?$/.exec(caminhoSemFragmento);
  if (os) return { tipo: "app", rota: `/os/${os[1]}${os[2] ? `/${os[2]}` : ""}` };
  if (/^\/app\/lista$/.test(caminhoSemFragmento) && !consulta) return { tipo: "app", rota: "/lista" };
  if (caminhoSemFragmento === "/app/perfil") return { tipo: "app", rota: "/perfil" };
  const jogo = /^\/app\/gamificacao\/(minha|ranking|conquistas)$/.exec(caminhoSemFragmento);
  if (jogo) return { tipo: "app", rota: "/pontos", params: { aba: jogo[1]! } };
  return { tipo: "web", caminho: acao.url };
}
