/**
 * Identificadores fixos do campo de treino: a API fictícia (`treino/`) cria os dados com estes ids e o tutorial
 * direcionado (`components/treino/`) aponta para eles. Tudo aqui é fictício.
 */

/** OS do passo a passo: preventiva liberada, exige APR; o tutorial percorre APR, assinatura e execução nela. */
export const OS_GUIADA = "7e1a0000-0000-4000-8000-000000000001";
/** Segunda OS liberada, usada no tutorial para provocar o bloqueio (item eliminatório respondido errado). */
export const OS_BLOQUEIO = "7e1a0000-0000-4000-8000-000000000002";

// ---------------------------------------------------------------------------------------------------------------
// Acrescentados pela API fictícia (`api-ficticia.ts`): o tutorial usa estes valores para guiar cada passo.
// ---------------------------------------------------------------------------------------------------------------

/** Monta um UUID fixo do treino (`7e1a0000-…`): o `prefixo` (hexadecimal) separa o tipo de registro e `n` numera dentro dele. */
export const idTreino = (prefixo: string, n: number) => `7e1a0000-0000-4000-8000-${prefixo}${n.toString(16).padStart(12 - prefixo.length, "0")}`;

/** Equipe fictícia: o técnico que treina entra nela (a equipe real dele não aparece no treino). */
export const EQUIPE_TREINO = { id: idTreino("e", 1), nome: "Equipe Treino", centro_trabalho: "TREINO-01" } as const;

/** Colegas fictícios da Equipe Treino. O supervisor é o `supervisor_id` da equipe; `semAssinatura` não cadastrou a assinatura (a APR o recusa). */
export const COLEGAS_TREINO = {
  carlos: { id: idTreino("f", 1), nome: "Carlos Mendes", matricula: "TR0101", cargo: "Eletricista de Manutenção" },
  joana: { id: idTreino("f", 2), nome: "Joana Ribeiro", matricula: "TR0102", cargo: "Técnica de Manutenção" },
  paulo: { id: idTreino("f", 3), nome: "Paulo Henrique Lima", matricula: "TR0103", cargo: "Eletricista de Manutenção" },
  marcos: { id: idTreino("f", 4), nome: "Marcos Vieira", matricula: "TR0100", cargo: "Supervisor de Manutenção" },
  debora: { id: idTreino("f", 5), nome: "Débora Campos", matricula: "TR0104", cargo: "Auxiliar Técnica" },
} as const;
/** Supervisor da Equipe Treino (recebe os alertas de bloqueio fictícios). */
export const SUPERVISOR_TREINO = COLEGAS_TREINO.marcos;
/** Colega que ainda não cadastrou a assinatura: incluí-la como participante da APR é recusado (`assinatura_ausente`). */
export const COLEGA_SEM_ASSINATURA = COLEGAS_TREINO.debora;
/** Id (arquivo) da assinatura fictícia que o técnico em treino já "tem" no perfil. */
export const ASSINATURA_INICIAL_TREINO = idTreino("5", 1);

/**
 * Modelo de APR de `OS_GUIADA` (inspeção em subestação). Responder tudo "sim" aprova a APR. O item eliminatório é o dos EPIs
 * (`bloqueia` = a resposta que reprova; exige observação e foto).
 */
export const MODELO_GUIADO = {
  codigo: "TR-INSP-01",
  versao: 1,
  titulo: "APR - Inspeção e manutenção em subestação (treino)",
  itemEliminatorioId: idTreino("a", 3),
  itemEliminatorioTexto: "Todos os participantes usam os EPIs exigidos, em bom estado?",
} as const;

/**
 * Modelo de APR de `OS_BLOQUEIO` (trabalho em altura). O item eliminatório é o do cinto/talabarte: responder "não" reprova,
 * exige observação e foto, e a APR sai bloqueada (a OS fica pendente). Há outros dois eliminatórios nesse modelo.
 */
export const MODELO_BLOQUEIO = {
  codigo: "TR-ALTURA-01",
  versao: 1,
  titulo: "APR - Trabalho em altura em poste e estrutura (treino)",
  itemEliminatorioId: idTreino("a", 102),
  itemEliminatorioTexto: "O cinto tipo paraquedista e o talabarte foram inspecionados antes do uso?",
} as const;

/** Respostas do item eliminatório: a que o aprova e a que reprova (bloqueia a OS). */
export const RESPOSTA_CORRETA = "sim";
export const RESPOSTA_QUE_BLOQUEIA = "nao";

/** OS que o treino também traz, para o tutorial citar quando precisar. */
export const OS_CRITICA = idTreino("", 3);
export const OS_PENDENTE = idTreino("", 4);
export const OS_EM_EXECUCAO_DE_COLEGA = idTreino("", 5);
export const OS_ENCERRADA_PELO_TECNICO = idTreino("", 6);
export const OS_ENCERRADA_DE_COLEGA = idTreino("", 7);
export const OS_CANCELADA = idTreino("", 8);
/** Liberada sem atividade do catálogo (sem lista de materiais); o modelo da APR o técnico escolhe, como em toda OS. */
export const OS_SEM_MODELO = idTreino("", 9);

/** Endereços da API fictícia no navegador (o handler `app/api/[...caminho]` atende). */
export const ENDERECO_REINICIAR_TREINO = "/api/treino/reiniciar";
