/** Dados da tela de execução: fotos já anexadas e executantes que assinaram. */

import type { PessoaAssinatura } from "@/components/ui/Assinatura";

export const fotosExecucao = ["09:52", "10:07", "10:41"];

export interface Executante {
  pessoa: PessoaAssinatura;
  identificacao: string;
}

export const executantes: Executante[] = [
  { pessoa: "carlos", identificacao: "Carlos Menezes · mat. 10482 · responsável" },
  { pessoa: "diego", identificacao: "Diego Rocha · mat. 12077 · executor" },
];
