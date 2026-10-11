/** Assinaturas do perfil exigidas na tela "APR aprovada". */

import type { PessoaAssinatura } from "@/components/ui/Assinatura";

export interface AssinanteApr {
  pessoa: PessoaAssinatura;
  nome: string;
  papel: string;
}

export const assinantesApr: AssinanteApr[] = [
  { pessoa: "carlos", nome: "Carlos Menezes", papel: "Responsável" },
  { pessoa: "diego", nome: "Diego Rocha", papel: "Executor" },
];
