import { dataBr } from "./tempo";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"] as const;

/** Como a pessoa chama os três primeiros meses da tabela, do mais recente para trás. */
const RELATIVOS = ["este mês", "mês passado", "mês retrasado"] as const;

/**
 * A data de hoje e os últimos 12 meses (`AAAA-MM`), do pedido à IA (`vitoria.md`, seção 2.10.5). A IA não sabe que dia é
 * hoje, e "mês passado" (com a virada do ano) e "maio" sem o ano são contas de calendário que ela erra: quem calcula é o
 * servidor, e a IA só consulta a tabela. Pelo nome, o mês vale a ocorrência mais recente, nunca no futuro.
 *
 * `hoje` é o dia do negócio (`AAAA-MM-DD`, fuso de São Paulo), o mesmo de `diaDe`.
 */
export function blocoDeDatas(hoje: string): string {
  const [ano, mes] = hoje.split("-").map(Number) as [number, number];
  const linhas = Array.from({ length: 12 }, (_, i) => {
    const primeiroDia = new Date(Date.UTC(ano, mes - 1 - i, 1));
    const anoDoMes = primeiroDia.getUTCFullYear();
    const mesDoAno = primeiroDia.getUTCMonth();
    const relativo = RELATIVOS[i];
    return `- ${MESES[mesDoAno]} de ${anoDoMes} = ${anoDoMes}-${String(mesDoAno + 1).padStart(2, "0")}${relativo ? ` (${relativo})` : ""}`;
  });
  return [
    `Hoje é ${dataBr(hoje)}. Meses para o filtro de período (AAAA-MM), do mais recente ao mais antigo; consulte a tabela, não calcule:`,
    ...linhas,
    "Se a pessoa disser só o nome do mês, vale o mais recente da tabela. Se disser o ano, vale o ano dela, mesmo fora da tabela.",
  ].join("\n");
}
