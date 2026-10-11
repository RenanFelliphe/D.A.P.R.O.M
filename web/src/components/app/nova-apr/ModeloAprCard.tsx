import { data } from "@/lib/formatar";
import type { ModeloCompleto } from "@/lib/apr";

/** Card com o modelo de APR que vale para esta APR: o publicado mais recente. */
export function ModeloAprCard({ modelo, daAtividade }: { modelo: Pick<ModeloCompleto, "codigo" | "titulo" | "versao" | "publicado_em">; daAtividade: boolean }) {
  return (
    <div className="card stack" style={{ gap: 2 }}>
      <span className="lbl">Modelo</span>
      <strong style={{ fontSize: 16 }}>
        {modelo.codigo} — {modelo.titulo}
      </strong>
      <span className="muted">
        Versão {modelo.versao}
        {modelo.publicado_em ? ` · publicada em ${data(modelo.publicado_em)} pela Segurança do Trabalho` : ""}
        {daAtividade ? " · definido pelo tipo de atividade da OS" : " · escolhido por você"}
      </span>
    </div>
  );
}
