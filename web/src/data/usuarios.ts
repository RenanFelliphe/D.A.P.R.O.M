/** Tipos e textos da tela de equipes e usuários. Os dados vêm da `api` (`GET /usuarios`, `GET /equipes`). */

import type { Liberacao, Perfil } from "@/lib/tipos";

export interface DescricaoPerfil {
  perfil: Perfil;
  descricao: string;
}

/** O que cada perfil pode fazer (tabela de perfis e permissões da especificação). */
export const descricaoDosPerfis: DescricaoPerfil[] = [
  { perfil: "tecnico", descricao: "aplica APR e executa as OS da equipe, no app ou na web; quem supervisiona equipes (definido na equipe) também acompanha o painel de gestão delas, faz a assinatura final das OS (depois de ler o relatório da execução) e recebe os alertas" },
  { perfil: "admin", descricao: "só gestão: importa e exporta OS, edita modelos de APR, gerencia usuários e equipes e vê todas as equipes" },
];

export const ordemDosPerfis: Perfil[] = ["tecnico", "admin"];

/** Resposta de `GET /equipes` com a contagem de técnicos que a tela soma. */
export interface EquipeComTecnicos {
  id: string;
  nome: string;
  centro_trabalho: string;
  supervisor_id: string | null;
  tecnicos: number;
}

/** Quem está olhando a tela: o admin gerencia tudo; o supervisor só vê os técnicos das equipes dele e cadastra novos (ficam pendentes). */
export type ModoUsuarios = "admin" | "supervisor";

/** Filtro "Acesso" da lista (`liberacao` de `GET /usuarios`). */
export const opcoesDeLiberacao: { valor: Liberacao; rotulo: string }[] = [
  { valor: "pendente", rotulo: "Pendentes de liberação" },
  { valor: "liberado", rotulo: "Liberados" },
  { valor: "recusado", rotulo: "Recusados" },
];

export const AVISO_DE_PENDENTE = "O acesso geral só é liberado depois que um administrador aprovar; enquanto isso a pessoa pode fazer o campo de treino.";
