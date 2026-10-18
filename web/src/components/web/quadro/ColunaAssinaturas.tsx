import Link from "next/link";
import { aparenciaDoStatus } from "@/components/web/quadro/ColunaQuadro";
import { CARTOES_POR_COLUNA, STATUS_DAS_ASSINATURAS, type OsDoQuadro } from "@/data/quadro";
import type { OsStatus } from "@/lib/tipos";
import { CartaoOs } from "./CartaoOs";
import { ColunaRecolhivel } from "./ColunaRecolhivel";

/** O que cada passo das assinaturas diz sobre quem está esperando (o cartão e os links usam o mesmo texto). */
const rotuloDaEspera: Record<(typeof STATUS_DAS_ASSINATURAS)[number], string> = {
  aguardando_supervisor: "Aguardando o supervisor",
  encerrando: "Aguardando o responsável",
};

interface ColunaAssinaturasProps {
  /** As duas consultas (`aguardando_supervisor` e `encerrando`), cada uma com o próprio total. */
  colunas: { status: OsStatus; total: number; os: OsDoQuadro[] }[];
  hrefTodas: (status: OsStatus) => string;
  gestao: boolean;
  usuarioId: string;
}

/**
 * Coluna "Aguardando assinaturas": reúne as OS que já terminaram a execução e esperam uma assinatura, a do responsável
 * (`encerrando`) e a do supervisor (`aguardando_supervisor`, que vem primeiro: é a que pede ação da gestão). Cada cartão traz a
 * marca de qual passo é; o "Ver todas" de cada passo leva à visão daquele status.
 */
export function ColunaAssinaturas({ colunas, hrefTodas, gestao, usuarioId }: ColunaAssinaturasProps) {
  const ordenadas = STATUS_DAS_ASSINATURAS.map((s) => colunas.find((c) => c.status === s)).filter((c) => c !== undefined);
  const total = ordenadas.reduce((soma, c) => soma + c.total, 0);
  // A coluna mostra no máximo o mesmo tanto de cartões das outras; o resto fica atrás do "Ver todas" do passo.
  const exibidas = ordenadas.map((c, i) => {
    const jaMostradas = ordenadas.slice(0, i).reduce((soma, anterior) => soma + Math.min(anterior.os.length, CARTOES_POR_COLUNA), 0);
    const os = c.os.slice(0, Math.max(0, CARTOES_POR_COLUNA - jaMostradas));
    return { ...c, os, restantes: c.total - os.length };
  });
  const a = aparenciaDoStatus.aguardando_supervisor;
  return (
    <ColunaRecolhivel status="assinaturas" titulo="Aguardando assinaturas" icone={a.icone} cor={a.cor} tom={a.tom} total={total}>
      {total === 0 && (
        <span className="muted" style={{ padding: 6, fontSize: 13 }}>
          Nenhuma OS.
        </span>
      )}
      {exibidas.flatMap((c) => c.os.map((o) => <CartaoOs key={o.id} os={o} gestao={gestao} usuarioId={usuarioId} />))}
      {exibidas.map(
        (c) =>
          c.restantes > 0 && (
            <Link key={c.status} className="more" href={hrefTodas(c.status)} style={{ color: "var(--brand)" }}>
              {rotuloDaEspera[c.status as keyof typeof rotuloDaEspera]} · mais {c.restantes} OS
            </Link>
          ),
      )}
    </ColunaRecolhivel>
  );
}
