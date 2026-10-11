/** Tipos e textos da tela de equipes e usuários. Os dados vêm da `api` (`GET /usuarios`, `GET /equipes`). */

import type { Perfil } from "@/lib/tipos";

export interface DescricaoPerfil {
  perfil: Perfil;
  descricao: string;
}

/** O que cada perfil pode fazer (tabela de perfis e permissões da especificação). */
export const descricaoDosPerfis: DescricaoPerfil[] = [
  { perfil: "tecnico", descricao: "aplica APR e executa as OS da equipe, no app ou na web" },
  { perfil: "supervisor", descricao: "acompanha a equipe, dá ciência da execução e recebe os alertas" },
  { perfil: "analista", descricao: "importa, exporta e vê todas as equipes" },
  { perfil: "seguranca", descricao: "edita os modelos de APR e a tabela de atividades" },
  { perfil: "admin", descricao: "gerencia usuários e equipes" },
];

export const ordemDosPerfis: Perfil[] = ["tecnico", "supervisor", "analista", "seguranca", "admin"];

/** Resposta de `GET /equipes` com a contagem de técnicos que a tela soma. */
export interface EquipeComTecnicos {
  id: string;
  nome: string;
  centro_trabalho: string;
  supervisor_id: string | null;
  tecnicos: number;
}
