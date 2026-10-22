/** O contrato vive em `shared/api/assinatura-juridica.ts`: o app (`mobile`) usa o mesmo código. */
export * from "../../../shared/api/assinatura-juridica";

/**
 * A assinatura com validade jurídica que o ato em curso vai usar (só no navegador). A janela de assinatura guarda aqui o código da
 * assinatura já confirmada no provedor enquanto o ato é enviado: o cliente da `api` (`lib/cliente-api.ts`) o leva no cabeçalho das rotas
 * que alteram e no `payload` dos eventos assinados. Fica de pé só durante a chamada do ato; a janela o limpa ao terminar.
 */
let codigoAtivo: string | null = null;

export const assinaturaJuridicaAtiva = () => codigoAtivo;
export const definirAssinaturaJuridicaAtiva = (id: string) => {
  codigoAtivo = id;
};
export const limparAssinaturaJuridicaAtiva = () => {
  codigoAtivo = null;
};

/** O código de erro de uma falha da `api` (`ErroCliente` ou `ErroDeEvento`), para a janela decidir se a assinatura ainda serve. */
export function codigoDoErro(erro: unknown): string | undefined {
  const codigo = (erro as { codigo?: unknown } | null)?.codigo;
  return typeof codigo === "string" ? codigo : undefined;
}

/**
 * A `api` recusou o ato por causa da assinatura (já usada, de outra pessoa, vencida, ainda não assinada…): a janela descarta a que tinha e
 * pede uma nova. Qualquer outra recusa (campo faltando, regra do ato) deixa a assinatura de pé: ela vale 30 minutos para o mesmo ato.
 */
export const erroDaAssinaturaJuridica = (erro: unknown) => codigoDoErro(erro)?.startsWith("assinatura_juridica") ?? false;
