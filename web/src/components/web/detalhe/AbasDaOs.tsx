import Link from "next/link";
import { rotas } from "@/lib/rotas";

export type AbaDaOs = "resumo" | "aprs" | "historico";

const rotulos: Record<AbaDaOs, string> = {
  resumo: "Resumo",
  aprs: "APRs e execuções",
  historico: "Histórico",
};

export const abasDaOs = Object.keys(rotulos) as AbaDaOs[];

/** Aba pedida em `?aba=`; qualquer outro valor cai no resumo. */
export function abaDaConsulta(valor: string | string[] | undefined): AbaDaOs {
  return abasDaOs.find((a) => a === valor) ?? "resumo";
}

/** Abas do detalhe da OS (`?aba=`): só a aberta carrega o conteúdo; `contagens` mostra quantos itens cada aba guarda. */
export function AbasDaOs({ osId, atual, contagens }: { osId: string; atual: AbaDaOs; contagens: Partial<Record<AbaDaOs, number>> }) {
  return (
    <nav className="abas" aria-label="Seções da OS">
      {abasDaOs.map((aba) => (
        <Link key={aba} href={aba === "resumo" ? rotas.web.os(osId) : `${rotas.web.os(osId)}?aba=${aba}`} aria-current={aba === atual ? "page" : undefined}>
          {rotulos[aba]}
          {contagens[aba] ? <span className="small">({contagens[aba]})</span> : null}
        </Link>
      ))}
    </nav>
  );
}
