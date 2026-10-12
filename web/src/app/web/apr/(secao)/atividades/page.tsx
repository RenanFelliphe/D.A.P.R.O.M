import type { Metadata } from "next";
import { editaModelos } from "@/components/web/apr/secao";
import { TabelaAtividades } from "@/components/web/modelos/TabelaAtividades";
import type { Atividade, ResumoModelo } from "@/data/modelos";
import { api, usuarioAtual } from "@/lib/api";
import type { Paginacao } from "@/lib/tipos";

export const metadata: Metadata = { title: "Atividades e modelos de APR" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO_ATIVIDADES = 50;

/**
 * Aba Atividades: a ligação entre a OS e o modelo. Cada OS chega do SAP com o código da atividade (plano de manutenção)
 * e esta tabela diz qual modelo de APR ela usa; a atividade sem modelo deixa o técnico escolher ao abrir a APR.
 */
export default async function AtividadesPage({ searchParams }: PageProps<"/web/apr/atividades">) {
  const params = await searchParams;
  const { usuario } = await usuarioAtual();
  const busca = um(params.busca)?.trim() || undefined;
  const semModelo = um(params.sem_modelo) === "true";
  const modelo = semModelo ? undefined : um(params.modelo)?.trim() || undefined;
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const [lista, publicados] = await Promise.all([
    api<{ atividades: Atividade[] } & Paginacao>("/atividades", {
      consulta: { busca, sem_modelo: semModelo ? true : undefined, modelo, pagina, tamanho: TAMANHO_ATIVIDADES },
    }),
    api<{ modelos: ResumoModelo[] }>("/modelos-apr", { consulta: { publicados: true, tamanho: 200 } }),
  ]);
  const codigos = [...new Set(publicados.modelos.map((m) => m.codigo))].sort();

  return (
    <>
      <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
        É por aqui que a OS encontra o modelo: ela chega do SAP com o código da atividade (plano de manutenção), e esta tabela diz qual modelo de APR essa
        atividade usa. Quando a atividade não tem modelo, o técnico escolhe um ao abrir a APR.
      </span>
      <TabelaAtividades
        atividades={lista.atividades}
        pagina={lista.pagina}
        tamanho={lista.tamanho}
        total={lista.total}
        busca={busca}
        semModelo={semModelo}
        modelo={modelo}
        modelos={codigos}
        podeEditar={editaModelos(usuario)}
      />
    </>
  );
}
