import type { Metadata } from "next";
import { editaModelos } from "@/components/web/apr/secao";
import { TabelaAtividades } from "@/components/web/modelos/TabelaAtividades";
import type { Atividade } from "@/data/modelos";
import { api, usuarioAtual } from "@/lib/api";
import type { Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Atividades" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO_ATIVIDADES = 50;

/**
 * Aba Atividades: os serviços do catálogo. Cada OS chega do SAP com o código da atividade (plano de manutenção), que diz o
 * serviço e a lista de materiais. A atividade não escolhe o modelo da APR: o técnico escolhe a cada APR, com a recomendação
 * que sai da orientação de cada modelo.
 */
export default async function AtividadesPage({ searchParams }: PageProps<"/web/apr/atividades">) {
  const params = await searchParams;
  const { usuario } = await usuarioAtual();
  const busca = um(params.busca)?.trim() || undefined;
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const lista = await api<{ atividades: Atividade[] } & Paginacao>("/atividades", { consulta: { busca, pagina, tamanho: TAMANHO_ATIVIDADES } });

  return (
    <>
      <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
        Cada OS chega do SAP com o código da atividade (plano de manutenção). A atividade é o serviço do catálogo: diz o serviço e a lista de materiais.
        Ela não escolhe o modelo da APR: o técnico escolhe a cada APR, e o sistema recomenda um pela orientação de cada modelo.
      </span>
      <TabelaAtividades
        atividades={lista.atividades}
        pagina={lista.pagina}
        tamanho={lista.tamanho}
        total={lista.total}
        busca={busca}
        podeEditar={editaModelos(usuario)}
      />
    </>
  );
}
