import { textoDaQuantidade, totalDeMudancas, type MudancaDeItem } from "@shared/api/sugestao-materiais";

/** O sinal de cada tipo de mudança, como a tela de avaliação da web: `+` entrou, `−` saiu, `~` mudou, e os iguais sem sinal. */
export const SINAL_DA_MUDANCA: Record<MudancaDeItem["tipo"], string> = { adicionado: "+", removido: "−", alterado: "~", igual: "=" };

/** O que mudou num item, em linhas curtas: "Quantidade: 1 un → 2 un", "Observação: sem → “tamanho M”". Vazio quando nada mudou. */
export function linhasDaMudanca(m: MudancaDeItem): string[] {
  if (m.tipo === "adicionado") return [`Entra com ${textoDaQuantidade(m.depois!.quantidade, m.unidade)}`, ...(m.depois!.observacao ? [`Observação: ${m.depois!.observacao}`] : [])];
  if (m.tipo === "removido") return [`Era ${textoDaQuantidade(m.antes!.quantidade, m.unidade)}`];
  if (m.tipo === "igual") return [textoDaQuantidade(m.depois!.quantidade, m.unidade), ...(m.depois!.observacao ? [m.depois!.observacao] : [])];
  const linhas: string[] = [];
  if (m.antes!.quantidade !== m.depois!.quantidade) linhas.push(`Quantidade: ${textoDaQuantidade(m.antes!.quantidade, m.unidade)} → ${textoDaQuantidade(m.depois!.quantidade, m.unidade)}`);
  if (m.antes!.observacao !== m.depois!.observacao) {
    const texto = (o: string | null) => (o ? `“${o}”` : "sem observação");
    linhas.push(`Observação: ${texto(m.antes!.observacao)} → ${texto(m.depois!.observacao)}`);
  }
  return linhas;
}

/** "3 mudanças", "1 mudança" ou "Nenhuma mudança". */
export function resumoDoTotal(mudancas: MudancaDeItem[]): string {
  const n = totalDeMudancas(mudancas);
  return n === 0 ? "Nenhuma mudança" : n === 1 ? "1 mudança" : `${n} mudanças`;
}
