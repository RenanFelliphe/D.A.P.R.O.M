/** Entidades que a trilha de auditoria registra, na ordem do filtro, com o rótulo da tela. */
export const entidadesDaAuditoria = [
  { valor: "usuario", rotulo: "Usuário" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "modelo_apr", rotulo: "Modelo de APR" },
  { valor: "atividade", rotulo: "Atividade" },
  { valor: "material", rotulo: "Material do catálogo" },
  { valor: "os", rotulo: "Ordem de serviço" },
  { valor: "importacao", rotulo: "Importação" },
  { valor: "exportacao", rotulo: "Exportação" },
  { valor: "plano_preventiva", rotulo: "Ciclo de preventiva" },
  { valor: "patente", rotulo: "Patente" },
  { valor: "conquista", rotulo: "Conquista" },
  { valor: "regra_pontuacao", rotulo: "Pontos da tarefa" },
  { valor: "rh", rotulo: "Registro de funcionários" },
  { valor: "ia_funcao", rotulo: "Função de IA" },
] as const;

export type EntidadeDaAuditoria = (typeof entidadesDaAuditoria)[number]["valor"];

export const rotuloDaEntidade: Record<EntidadeDaAuditoria, string> = Object.fromEntries(entidadesDaAuditoria.map((e) => [e.valor, e.rotulo])) as Record<EntidadeDaAuditoria, string>;

/** Um registro de `GET /auditoria`. */
export interface RegistroDeAuditoria {
  id: string;
  em: string;
  /** `null` quando quem agiu foi um sistema (o registro de funcionários), e não uma pessoa. */
  ator_id: string | null;
  ator_nome: string;
  /** `entidade.verbo`, ex.: `usuario.criar`. */
  acao: string;
  entidade: EntidadeDaAuditoria;
  entidade_id: string | null;
  alvo: string | null;
  resumo: string;
  /** O que mudou (`{campo: {de, para}}`) ou dados extras da ação. */
  detalhes: Record<string, unknown> | null;
}

/** Nomes dos campos que aparecem nos detalhes, como a tela os mostra. */
export const rotuloDoCampo: Record<string, string> = {
  nome: "Nome",
  email: "E-mail",
  perfil: "Perfil",
  equipe_id: "Equipe",
  cargo: "Cargo",
  registro_profissional: "Registro profissional",
  ativo: "Ativo",
  matricula: "Matrícula",
  situacao_registro: "Situação no registro",
  email_no_registro: "E-mail no registro",
  supervisor_id: "Supervisor",
  centro_trabalho: "Centro de trabalho",
  descricao: "Descrição",
  exemplos: "Exemplos de serviço",
  palavras_chave: "Palavras-chave",
  /** Só em registros antigos: a atividade escolhia o modelo da APR. */
  modelo_apr_codigo: "Modelo de APR",
  provisorio: "Provisória",
  motivo: "Motivo",
  justificativa: "Justificativa",
  versao: "Versão",
  copiar_de: "Copiado de",
  resultado: "Resultado",
  /** Só em registros antigos: excluir o modelo passava as atividades dele para um substituto. */
  atividades_movidas: "Atividades movidas",
  substituto: "Modelo substituto",
  criadas: "Criadas",
  atualizadas: "Atualizadas",
  ignoradas: "Ignoradas",
  os_exportadas: "OS exportadas",
  os_origem_id: "OS de origem",
  data_inicio_prog: "Início programado",
  materiais: "Materiais",
  unidade: "Unidade",
  categoria: "Categoria",
  codigo: "Código no SAP",
  intervalo: "Intervalo entre ciclos",
  base_do_ciclo: "Contado a partir de",
  antecedencia_dias: "Antecedência do aviso (dias)",
  observacao: "Observação",
  titulo: "Título",
  criterio: "Critério",
  quantidade: "Quantidade",
  patente_id: "Patente",
  pontos: "Pontos",
  pontos_necessarios: "Pontos necessários",
  cor: "Cor",
  ativa: "Ativa",
};
