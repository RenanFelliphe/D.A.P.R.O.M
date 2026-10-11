/** Dados fictícios da tela de equipes e usuários. */

export interface Usuario {
  nome: string;
  matricula: string;
  perfil: string;
  equipe: string;
  situacao: string;
}

export const usuarios: Usuario[] = [
  { nome: "Carlos Menezes", matricula: "10482", perfil: "Técnico", equipe: "Serviços Especiais", situacao: "Ativo" },
  { nome: "Diego Rocha", matricula: "12077", perfil: "Técnico", equipe: "Serviços Especiais", situacao: "Ativo" },
  { nome: "Fernanda Lopes", matricula: "11350", perfil: "Técnico", equipe: "Serviços Especiais", situacao: "Ativo" },
  { nome: "Paulo Ribeiro", matricula: "11893", perfil: "Técnico", equipe: "Serviços Especiais", situacao: "Ativo" },
  { nome: "Marcos Tavares", matricula: "9034", perfil: "Supervisor", equipe: "Serviços Especiais", situacao: "Ativo" },
  { nome: "Ana Ribeiro", matricula: "9120", perfil: "Analista", equipe: "Todas", situacao: "Ativo" },
  { nome: "Luciana Prado", matricula: "9277", perfil: "Segurança do Trabalho", equipe: "Todas", situacao: "Ativo" },
  { nome: "Renato Alves", matricula: "8801", perfil: "Administrador", equipe: "Todas", situacao: "Ativo" },
];

export interface Equipe {
  nome: string;
  /** Centro de trabalho do SAP que define a equipe. */
  centro: string;
  tecnicos: number;
  supervisor?: string;
}

export const equipes: Equipe[] = [
  { nome: "Serviços Especiais", centro: "SERV_ESP", tecnicos: 9, supervisor: "Marcos Tavares" },
  { nome: "Instrumentação", centro: "INSTRUM", tecnicos: 11 },
  { nome: "Manutenção Civil", centro: "MAN_CIV", tecnicos: 14 },
  { nome: "Inspeção de Rede", centro: "INSP_RD", tecnicos: 8 },
  { nome: "Atendimento Residencial", centro: "ATD_RES", tecnicos: 6 },
];

export interface Perfil {
  nome: string;
  descricao: string;
}

export const perfis: Perfil[] = [
  { nome: "Técnico", descricao: "usa o app" },
  { nome: "Supervisor", descricao: "acompanha a equipe" },
  { nome: "Analista", descricao: "importa, exporta e vê tudo" },
  { nome: "Segurança do Trabalho", descricao: "edita os modelos de APR" },
  { nome: "Administrador", descricao: "gerencia usuários e equipes" },
];
