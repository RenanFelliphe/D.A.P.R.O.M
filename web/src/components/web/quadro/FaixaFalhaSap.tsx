import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { rotas } from "@/lib/rotas";

/** Aviso no topo do quadro quando a última leitura automática do SAP terminou com erro (analista e admin). */
export function FaixaFalhaSap() {
  return (
    <Notice tone="blq" icon="alert">
      <strong>Falha na leitura do SAP.</strong> A última leitura automática terminou com erro, então as OS podem estar
      desatualizadas.{" "}
      <Link href={rotas.web.importacao} style={{ fontWeight: 600 }}>
        Ver importações
      </Link>
    </Notice>
  );
}
