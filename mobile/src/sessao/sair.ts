/**
 * O Sair é recusado enquanto houver registro esperando para subir: sair apaga a sessão, e sem ela a fila não tem como subir. A fila nunca
 * se perde (decisão-chave 2, `docs/especificacao.md`, seção 2.2), então o app prefere segurar a pessoa a deixar um registro de campo preso num aparelho que ela não usa mais.
 */
export function mensagemDeSairComFila(pendentes: number): string {
  const quantos = pendentes === 1 ? "1 registro de campo que ainda não subiu para o servidor" : `${pendentes} registros de campo que ainda não subiram para o servidor`;
  return `Você tem ${quantos}. Conecte-se e toque em "Sincronizar" no perfil antes de sair.`;
}
