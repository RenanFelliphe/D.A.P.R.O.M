import { ListaDoServico } from "@/components/web/catalogo/ListaDoServico";
import type { MaterialDoServico } from "@/lib/catalogo";

/**
 * Os materiais recomendados do serviço da OS, na revisão da APR: um lembrete antes de validar, só para leitura. Não pede
 * resposta e não muda o "Concluir e validar": o técnico escolhe o que levar conforme a situação no local.
 */
export function MateriaisRecomendados({ materiais }: { materiais: MaterialDoServico[] }) {
  return (
    <section className="card stack g12" aria-label="Materiais recomendados" data-treino="ck-materiais">
      <div className="stack g4">
        <h2 style={{ fontSize: 17, fontWeight: 600 }}>Materiais recomendados</h2>
        <p className="muted">Lembrete do que o serviço costuma usar. É só para consulta: leve o que a situação no local pedir.</p>
      </div>
      <ListaDoServico materiais={materiais} />
    </section>
  );
}
