/**
 * Registro das telas do sistema. É a única fonte de verdade para rotas,
 * menu lateral de cada área e usuário exibido na barra superior.
 */

export type AreaTela = "tecnico" | "gestao" | "doc";
export type PerfilWeb = "sup" | "ana" | "luc" | "adm";

export interface Tela {
  area: AreaTela;
  titulo: string;
  href: string;
  /** Gestão: quem está "logado" nesta tela. */
  perfil?: PerfilWeb;
  /** Item do menu lateral que fica ativo nesta tela. */
  menu?: string;
}

export const rotas = {
  app: {
    entrar: "/app/entrar",
    lista: "/app/lista",
    detalhe: "/app/detalhe",
    novaApr: "/app/nova-apr",
    checklist: "/app/checklist",
    bloqueio: "/app/bloqueio",
    aprovada: "/app/aprovada",
    execucao: "/app/execucao",
    sync: "/app/sync",
    perfil: "/app/perfil",
  },
  web: {
    quadro: "/web/quadro",
    detalhe: "/web/detalhe",
    alertas: "/web/alertas",
    importacao: "/web/importacao",
    indicadores: "/web/indicadores",
    modelos: "/web/modelos",
    usuarios: "/web/usuarios",
  },
  doc: {
    pdf: "/doc/pdf",
  },
} as const;

export const telas: Tela[] = [
  { area: "tecnico", titulo: "OS da equipe", href: rotas.app.lista, menu: rotas.app.lista },
  { area: "tecnico", titulo: "Detalhe da OS", href: rotas.app.detalhe, menu: rotas.app.lista },
  { area: "tecnico", titulo: "Nova APR", href: rotas.app.novaApr, menu: rotas.app.lista },
  { area: "tecnico", titulo: "Checklist da APR", href: rotas.app.checklist, menu: rotas.app.lista },
  { area: "tecnico", titulo: "APR bloqueada", href: rotas.app.bloqueio, menu: rotas.app.lista },
  { area: "tecnico", titulo: "APR aprovada", href: rotas.app.aprovada, menu: rotas.app.lista },
  { area: "tecnico", titulo: "Execução", href: rotas.app.execucao, menu: rotas.app.lista },
  { area: "tecnico", titulo: "Fila e sincronização", href: rotas.app.sync, menu: rotas.app.sync },
  { area: "tecnico", titulo: "Perfil e histórico", href: rotas.app.perfil, menu: rotas.app.perfil },
  { area: "gestao", titulo: "Quadro de OS", href: rotas.web.quadro, perfil: "sup", menu: rotas.web.quadro },
  { area: "gestao", titulo: "Detalhe da OS", href: rotas.web.detalhe, perfil: "sup", menu: rotas.web.quadro },
  { area: "gestao", titulo: "Alertas e impedimento", href: rotas.web.alertas, perfil: "sup", menu: rotas.web.alertas },
  { area: "gestao", titulo: "Importação SAP", href: rotas.web.importacao, perfil: "ana", menu: rotas.web.importacao },
  { area: "gestao", titulo: "Indicadores e exportação", href: rotas.web.indicadores, perfil: "ana", menu: rotas.web.indicadores },
  { area: "gestao", titulo: "Modelos de APR", href: rotas.web.modelos, perfil: "luc", menu: rotas.web.modelos },
  { area: "gestao", titulo: "Equipes e usuários", href: rotas.web.usuarios, perfil: "adm", menu: rotas.web.usuarios },
  { area: "doc", titulo: "PDF da OS executada", href: rotas.doc.pdf, perfil: "sup", menu: rotas.web.quadro },
];

export const perfisWeb: Record<PerfilWeb, { iniciais: string; nome: string; cargo: string }> = {
  sup: { iniciais: "MT", nome: "Marcos Tavares", cargo: "Supervisor · Serviços Especiais" },
  ana: { iniciais: "AR", nome: "Ana Ribeiro", cargo: "Analista · todas as equipes" },
  luc: { iniciais: "LP", nome: "Luciana Prado", cargo: "Segurança do Trabalho" },
  adm: { iniciais: "RA", nome: "Renato Alves", cargo: "Administrador" },
};

/** Técnico "logado" nas telas da área de campo. */
export const tecnicoLogado = {
  iniciais: "CM",
  nome: "Carlos Menezes",
  cargo: "Técnico · mat. 10482",
};

/** Encontra a tela correspondente a um pathname (ignora barra final). */
export function telaPorPathname(pathname: string | null): Tela | undefined {
  if (!pathname) return undefined;
  const limpo = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return telas.find((t) => t.href === limpo);
}
