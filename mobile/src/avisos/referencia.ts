import { alvoDoAlerta, referenciaDoAlerta, type Alerta } from "@shared/api/alertas";
import type { NomeDeIcone } from "@/ui/Icone";

/** Os avisos da lista de materiais de um serviço (a sugestão, a resposta, a lista que mudou) apontam para o serviço, não para uma OS. */
const ehDeMateriais = (a: Pick<Alerta, "tipo">) => alvoDoAlerta(a) === "sugestao" || alvoDoAlerta(a) === "servico";

/**
 * A que o aviso se refere, como o `CartaoDeAviso` mostra. Igual à de `referenciaDoAlerta`, menos nos avisos de materiais, que
 * ela trataria como OS ("OS de apoio"): aqui mostram o código do serviço.
 */
export function referenciaNoApp(a: Alerta): { codigo: string | null; texto: string } {
  if (ehDeMateriais(a)) return { codigo: a.servico_codigo, texto: "Lista de materiais" };
  return referenciaDoAlerta(a);
}

/** O ícone do aviso: o de materiais é a lista; o urgente, o triângulo; os demais, o sino. */
export function iconeDoAviso(a: Alerta, urgente: boolean): NomeDeIcone {
  if (urgente) return "warning-outline";
  return ehDeMateriais(a) ? "list-outline" : "notifications-outline";
}
