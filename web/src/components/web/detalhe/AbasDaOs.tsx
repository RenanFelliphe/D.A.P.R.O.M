import Link from "next/link";
import { rotas } from "@/lib/rotas";

export type AbaDaOs = "resumo" | "aprs" | "relatorio" | "historico";

const rotulos: Record<AbaDaOs, string> = {
  resumo: "Resumo",
  aprs: "APRs e execuções",
  relatorio: "Relatório da execução",
  historico: "Histórico",
};

export const abasDaOs = Object.keys(rotulos) as AbaDaOs[];

/** As abas que a pessoa vê: o relatório da execução é do supervisor da equipe e do admin, e só existe com uma execução finalizada. */
export const abasVisiveis = (comRelatorio: boolean): AbaDaOs[] => abasDaOs.filter((a) => a !== "relatorio" || comRelatorio);

/** Aba pedida em `?aba=`; qualquer outro valor (ou o relatório sem direito a ele) cai no resumo. */
export function abaDaConsulta(valor: string | string[] | undefined, comRelatorio = false): AbaDaOs {
  return abasVisiveis(comRelatorio).find((a) => a === valor) ?? "resumo";
}

/** Abas do detalhe da OS (`?aba=`): só a aberta carrega o conteúdo; `contagens` mostra quantos itens cada aba guarda. */
export function AbasDaOs({ osId, atual, contagens, comRelatorio = false }: { osId: string; atual: AbaDaOs; contagens: Partial<Record<AbaDaOs, number>>; comRelatorio?: boolean }) {
  return (
    <nav className="abas" aria-label="Seções da OS">
      {abasVisiveis(comRelatorio).map((aba) => (
        <Link key={aba} href={aba === "resumo" ? rotas.app.os(osId) : `${rotas.app.os(osId)}?aba=${aba}`} aria-current={aba === atual ? "page" : undefined}>
          {rotulos[aba]}
          {contagens[aba] ? <span className="small">({contagens[aba]})</span> : null}
        </Link>
      ))}
    </nav>
  );
}
