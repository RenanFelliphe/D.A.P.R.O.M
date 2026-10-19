/** Erro de uma resposta da `api` (`{erro: {codigo, mensagem}}`). `detalhes` é o objeto `erro` inteiro (alguns códigos trazem mais campos). */
export class ErroDaApi extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly detalhes: Record<string, unknown> = {},
  ) {
    super(mensagem);
    this.name = "ErroDaApi";
  }
}

/** Não chegou à `api`: sem sinal, servidor fora do ar ou tempo esgotado. Nada foi gravado no servidor. */
export class ErroDeRede extends Error {
  constructor(mensagem = "Sem conexão com o servidor. Confira o sinal e tente de novo.") {
    super(mensagem);
    this.name = "ErroDeRede";
  }
}

/**
 * Sem sinal e sem como confiar no que o aparelho guarda (nunca houve login com sinal, ou já passaram 7 dias da última confirmação da
 * conta): a pessoa precisa se conectar. Não é `ErroDeRede` de propósito: a consulta não deve ser repetida, nada mudaria sem sinal.
 */
export class ErroDeConexaoNecessaria extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "ErroDeConexaoNecessaria";
  }
}

/** A sessão não vale mais (renovação recusada, conta desativada ou cadastro recusado): o app volta para a entrada. */
export const encerraASessao = (e: unknown): boolean => e instanceof ErroDaApi && (e.codigo === "nao_autenticado" || e.codigo === "acesso_revogado" || e.codigo === "acesso_recusado");

/** O texto para a pessoa: o da `api` (já em português), com um tratamento próprio para os casos que o app explica melhor. */
export function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroDeRede) return e.message;
  if (e instanceof ErroDaApi) {
    switch (e.codigo) {
      case "nao_autenticado":
        return "Sua sessão terminou. Entre de novo.";
      case "acesso_revogado":
        return "Seu acesso foi desativado. Procure o seu supervisor.";
      case "assinatura_pendente":
        return "Cadastre a sua assinatura antes de continuar.";
      case "usuario_ausente":
        return e.message || "Você está ausente: o sistema fica só para consulta.";
      default:
        return e.message || "Erro ao falar com o servidor.";
    }
  }
  if (e instanceof Error && e.message) return e.message;
  return "Algo deu errado. Tente de novo.";
}
