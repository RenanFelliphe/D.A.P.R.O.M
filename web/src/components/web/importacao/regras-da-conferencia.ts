import type { z } from "zod";
import type { OrdemDoPdf } from "./tipos";

/** Caminho de um campo dentro dos valores do formulário (`["ordens", 0, "ordem", "titulo"]`). */
export type Caminho = (string | number)[];

/**
 * Regras do esquema Zod que as duas conferências (PDF do SAP e Digitalização) compartilham sobre a OS lida: os campos
 * obrigatórios e o fim programado depois do início. Cada mensagem vai para o campo certo (`caminho` aponta para a `ordem`).
 * Com `conferirNumero`, o número da ordem também precisa ter de 6 a 12 dígitos (na Digitalização ele é digitado; no PDF vem
 * pronto e não muda).
 */
export function regrasDaOrdem(o: OrdemDoPdf, ctx: z.RefinementCtx, caminho: Caminho, conferirNumero = false) {
  const falta = (campo: Caminho, message: string) => ctx.addIssue({ code: "custom", path: [...caminho, ...campo], message });
  const vazio = (v: string | null) => !v?.trim();

  if (conferirNumero && !/^\d{6,12}$/.test(o.numero_ordem.trim())) falta(["numero_ordem"], "O número da ordem precisa ter de 6 a 12 dígitos.");
  if (vazio(o.tipo_ordem)) falta(["tipo_ordem"], "Escolha o tipo da OS: corretiva (YBA1) ou preventiva (YBA2).");
  if (vazio(o.titulo)) falta(["titulo"], "Informe o título da OS.");
  if (vazio(o.centro_trabalho)) falta(["centro_trabalho"], "Informe o centro de trabalho.");
  if (vazio(o.local_instalacao.codigo)) falta(["local_instalacao", "codigo"], "Informe o local de instalação.");
  if (vazio(o.data_inicio_prog)) falta(["data_inicio_prog"], "Informe o início programado.");
  if (o.data_inicio_prog && o.data_fim_prog && o.data_fim_prog < o.data_inicio_prog) falta(["data_fim_prog"], "O fim programado não pode ser anterior ao início programado.");
}
