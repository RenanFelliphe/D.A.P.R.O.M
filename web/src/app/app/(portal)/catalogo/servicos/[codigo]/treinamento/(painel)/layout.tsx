import type { ReactNode } from "react";
import { AbasDoTreinamento } from "@/components/web/treinamento-servico/editor/AbasDoTreinamento";
import { usuarioAtual } from "@/lib/api";
import { ehAdmin } from "@/lib/tipos";
import { codigoDaRota, reportesDoTreinamento } from "@/lib/treinamento-servico-servidor";

/** As abas do treinamento: visão geral, explicação, fases, revisão, versões e problemas (com os em aberto contados). */
export default async function PainelDoTreinamentoLayout({ children, params }: { children: ReactNode; params: Promise<{ codigo: string }> }) {
  const codigo = codigoDaRota((await params).codigo);
  const [reportes, { usuario }] = await Promise.all([reportesDoTreinamento(codigo), usuarioAtual()]);
  return (
    <>
      <AbasDoTreinamento codigo={codigo} problemasAbertos={reportes.filter((r) => !r.tratado_em).length} admin={ehAdmin(usuario)} />
      {children}
    </>
  );
}
