/** Uma falha do rascunho pela IA: o código da `api` (ou um da própria tela) e a mensagem pronta. */
export interface FalhaDaIA {
  codigo: string;
  mensagem: string;
}

/**
 * Título e origem de cada falha, para o admin saber de quem é o problema: da cota ou do servidor da IA (fora do SYNQ OS),
 * da configuração da `api`, da rede ou do próprio SYNQ OS. Os códigos vêm de `api/src/dominio/ia-falhas.ts`.
 */
const EXPLICACOES: Record<string, { titulo: string; origem: string }> = {
  ia_sem_cota: { titulo: "A cota da IA acabou", origem: "Cota do fornecedor da IA" },
  ia_limite_por_minuto: { titulo: "Pedidos demais em pouco tempo", origem: "Limite por minuto do fornecedor da IA" },
  ia_sobrecarregada: { titulo: "O servidor da IA está lotado", origem: "Servidor da IA, fora do SYNQ OS" },
  ia_chave_recusada: { titulo: "A chave da IA não foi aceita", origem: "Configuração da api" },
  ia_indisponivel: { titulo: "A IA não está ligada", origem: "Configuração da api" },
  ia_desligada: { titulo: "A função está desligada", origem: "Controle da IA, na página da Vitória" },
  ia_inacessivel: { titulo: "Sem conexão com a IA", origem: "Rede entre o SYNQ OS e a IA" },
  ia_falhou: { titulo: "A IA recusou o pedido", origem: "Fornecedor da IA" },
  resposta_ia_invalida: { titulo: "A resposta da IA veio fora do formato", origem: "Resposta da IA" },
  limite_ia: { titulo: "As rodadas da Vitória acabaram", origem: "Limite do SYNQ OS" },
  erro_interno: { titulo: "Erro no SYNQ OS", origem: "SYNQ OS" },
  conexao: { titulo: "A conexão caiu", origem: "Conexão com o servidor do SYNQ OS" },
};

export function explicarFalhaDaIA(falha: FalhaDaIA): { titulo: string; origem: string | null } {
  return EXPLICACOES[falha.codigo] ?? { titulo: "Não deu certo desta vez", origem: null };
}
