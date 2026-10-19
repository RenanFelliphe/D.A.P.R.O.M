import type { ReactNode } from "react";
import { AbasDoTreinamento } from "@/components/web/treinamento-servico/editor/AbasDoTreinamento";
import { codigoDaRota, reportesDoTreinamento } from "@/lib/treinamento-servico-servidor";

/** As abas do treinamento: visão geral, explicação, fases, revisão, versões e problemas (com os em aberto contados). */
export default async function PainelDoTreinamentoLayout({ children, params }: { children: ReactNode; params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const reportes = await reportesDoTreinamento(codigo);
  return (
    <>
      <AbasDoTreinamento codigo={codigo} problemasAbertos={reportes.filter((r) => !r.tratado_em).length} />
      {children}
    </>
  );
}
