import type { Metadata } from "next";
import { FiltrosOs, type FiltroAtivo } from "@/components/app/lista/FiltrosOs";
import { GrupoOs } from "@/components/app/lista/GrupoOs";
import { ListaCabecalho } from "@/components/app/lista/ListaCabecalho";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { api, usuarioAtual } from "@/lib/api";
import { ordemDosStatus, type ListaDeOs } from "@/lib/os-app";
import type { OsStatus } from "@/lib/tipos";

export const metadata: Metadata = { title: "OS da equipe" };

const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);

/** Lista de OS da equipe do técnico (a `api` só entrega a própria equipe), agrupada por status e com os filtros na URL. */
export default async function ListaPage({ searchParams }: PageProps<"/app/lista">) {
  const consulta = await searchParams;
  const status = ordemDosStatus.includes(primeiro(consulta.status) as OsStatus) ? (primeiro(consulta.status) as OsStatus) : undefined;
  const tipo = ["preventiva", "corretiva"].includes(primeiro(consulta.tipo) ?? "") ? (primeiro(consulta.tipo) as "preventiva" | "corretiva") : undefined;
  const critica = primeiro(consulta.critica) === "true";
  const busca = primeiro(consulta.busca)?.trim() || undefined;
  const filtro: FiltroAtivo = { status, tipo, critica, busca };

  const [{ equipe }, lista] = await Promise.all([
    usuarioAtual(),
    api<ListaDeOs>("/os", { consulta: { status, tipo, critica: critica ? true : undefined, busca, tamanho: 200 } }),
  ]);

  const grupos = ordemDosStatus.map((s) => ({ status: s, os: lista.os.filter((o) => o.status === s) })).filter((g) => g.os.length > 0);
  const total = Object.values(lista.contagem_por_status).reduce((soma, n) => soma + n, 0);
  const filtrando = Boolean(status || tipo || critica || busca);

  return (
    <Screen>
      <ListaCabecalho equipe={equipe?.nome ?? null} />
      <FiltrosOs ativo={filtro} contagem={lista.contagem_por_status} total={total} />
      {lista.total > lista.os.length && (
        <Notice tone="info" icon="info">
          Mostrando {lista.os.length} de {lista.total} OS. Use os filtros para ver as demais.
        </Notice>
      )}
      <div className="os-groups">
        {grupos.map((grupo) => (
          <GrupoOs key={grupo.status} status={grupo.status} os={grupo.os} />
        ))}
        {grupos.length === 0 && (
          <div className="card stack g6">
            <strong>{filtrando ? "Nenhuma OS com esses filtros." : "Nenhuma OS para a sua equipe por enquanto."}</strong>
            <span className="muted">
              {filtrando ? "Tire um filtro para ver mais OS." : "Quando o SAP trouxer ordens liberadas para a equipe, elas aparecem aqui."}
            </span>
          </div>
        )}
      </div>
    </Screen>
  );
}
