import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { PaginacaoLista } from "@/components/web/PaginacaoLista";
import { CartaoServico } from "@/components/web/catalogo/CartaoServico";
import { editaCatalogo } from "@/components/web/catalogo/secao";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { ListaDeServicos, Material } from "@/lib/catalogo";
import { rotas } from "@/lib/rotas";
import type { TreinamentoResumo } from "@/lib/treinamento-servico";

export const metadata: Metadata = { title: "Catálogo de serviço" };

const um = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
const TAMANHO = 24;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Aba Serviços: cada serviço é uma atividade do plano de manutenção (a mesma que escolhe o modelo de APR) com o que ele
 * usa. A OS mostra essa lista no detalhe. Filtros: busca, "só sem materiais" e um material (vindo da aba Materiais).
 */
export default async function ServicosDoCatalogoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { usuario } = await usuarioAtual();
  const podeEditar = editaCatalogo(usuario);
  const busca = um(params.busca)?.trim() || undefined;
  const semMateriais = um(params.sem_materiais) === "true";
  const materialId = um(params.material_id)?.trim();
  const filtroDeMaterial = materialId && UUID.test(materialId) ? materialId : undefined;
  const pagina = Math.max(1, Number.parseInt(um(params.pagina) ?? "1", 10) || 1);

  const [lista, material, treinamentos] = await Promise.all([
    api<ListaDeServicos>("/catalogo/servicos", {
      consulta: { busca, sem_materiais: semMateriais ? true : undefined, material_id: filtroDeMaterial, pagina, tamanho: TAMANHO },
    }),
    // O nome do material do filtro; a lista de materiais é pequena e já ordenada, então basta procurar nela.
    filtroDeMaterial ? apiOuNulo<{ materiais: Material[] }>("/catalogo/materiais", { consulta: { tamanho: 200 } }) : null,
    // Os treinamentos publicados, com a situação de quem pede; a aba Treinamento do cartão busca aqui pelo código.
    apiOuNulo<{ treinamentos: TreinamentoResumo[] }>("/treinamentos"),
  ]);
  const nomeDoMaterial = material?.materiais.find((m) => m.id === filtroDeMaterial)?.descricao;
  const treinamentoPorCodigo = new Map((treinamentos?.treinamentos ?? []).map((t) => [t.atividade_codigo, t]));
  const consulta = { busca, sem_materiais: semMateriais ? "true" : undefined, material_id: filtroDeMaterial };

  return (
    <>
      <span className="muted" style={{ fontSize: 14, maxWidth: 820 }}>
        O que cada serviço leva para o campo: materiais, ferramentas e EPIs, com a quantidade prevista por execução. O serviço é a atividade do plano de
        manutenção que vem na OS; o técnico vê esta lista no detalhe da OS.{podeEditar ? " Os serviços são cadastrados em APR › Atividades." : ""}
      </span>
      {filtroDeMaterial && (
        <Notice tone="info" icon="filter">
          Serviços que usam <strong>{nomeDoMaterial ?? "o material escolhido"}</strong>. <Link href={rotas.app.catalogo}>Ver todos</Link>
        </Notice>
      )}
      <form method="get" action={rotas.app.catalogo} className="filtros-lista">
        {filtroDeMaterial && <input type="hidden" name="material_id" value={filtroDeMaterial} />}
        <div className="field">
          <label htmlFor="busca-servico">Buscar</label>
          <input id="busca-servico" name="busca" className="input" defaultValue={busca} placeholder="Código ou descrição do serviço" />
        </div>
        <label className="row g6 small" style={{ height: 36 }}>
          <input type="checkbox" name="sem_materiais" value="true" defaultChecked={semMateriais} />
          Só sem materiais
        </label>
        <button type="submit" className="btn btn-line btn-sm" style={{ height: 36 }}>
          Filtrar
        </button>
      </form>
      {lista.servicos.length === 0 ? (
        <p className="muted">{semMateriais ? "Todos os serviços já têm materiais." : "Nenhum serviço encontrado."}</p>
      ) : (
        <div className="servicos-catalogo">
          {lista.servicos.map((s) => (
            <CartaoServico key={s.codigo} servico={s} podeEditar={podeEditar} treinamento={treinamentoPorCodigo.get(s.codigo) ?? null} />
          ))}
        </div>
      )}
      <PaginacaoLista caminho={rotas.app.catalogo} consulta={consulta} pagina={lista.pagina} tamanho={lista.tamanho} total={lista.total} />
    </>
  );
}
