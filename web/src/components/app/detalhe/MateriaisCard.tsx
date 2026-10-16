import Link from "next/link";
import { ListaDoServico } from "@/components/web/catalogo/ListaDoServico";
import type { ServicoDaOs } from "@/lib/catalogo";
import { rotas } from "@/lib/rotas";

/**
 * O que levar para o campo: a lista do serviço do catálogo (a atividade da OS), com materiais, ferramentas e EPIs. A OS
 * sem atividade não tem serviço; aí valem as instruções do SAP.
 */
export function MateriaisCard({ servico }: { servico: ServicoDaOs | null }) {
  return (
    <div className="card stack g8" data-treino="os-materiais">
      <div className="row between" style={{ gap: 12, alignItems: "baseline" }}>
        <h2 style={{ fontSize: 15, fontWeight: 600 }}>Materiais recomendados</h2>
        {servico && (
          <Link className="small" href={`${rotas.app.catalogo}?busca=${encodeURIComponent(servico.codigo)}`}>
            Ver no catálogo
          </Link>
        )}
      </div>
      {!servico ? (
        <p className="muted" style={{ fontSize: 13.5 }}>
          Esta OS não tem serviço do catálogo, então não há materiais recomendados. Confira as instruções.
        </p>
      ) : servico.materiais.length === 0 ? (
        <p className="muted" style={{ fontSize: 13.5 }}>
          O catálogo ainda não lista materiais para o serviço {servico.descricao}. Confira as instruções.
        </p>
      ) : (
        <>
          <span className="small" style={{ color: "var(--ink4)" }}>
            Recomendado para o serviço {servico.descricao}, por execução. É só para consulta: leve o que a situação no local pedir.
          </span>
          <ListaDoServico materiais={servico.materiais} />
        </>
      )}
    </div>
  );
}
