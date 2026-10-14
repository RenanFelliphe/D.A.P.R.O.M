import { Button } from "@/components/ui/Button";
import { data } from "@/lib/formatar";
import type { ModeloCompleto } from "@/lib/apr";

interface ModeloAprCardProps {
  modelo: Pick<ModeloCompleto, "codigo" | "titulo" | "versao" | "publicado_em">;
  /** O recomendado pela leitura da OS, para lembrar quando a escolha foi outra. */
  recomendado?: string | null;
  /** Abre a janela de escolha para trocar o modelo. */
  aoTrocar?: () => void;
}

/** Card com o modelo de APR escolhido pelo técnico: o publicado mais recente do código. */
export function ModeloAprCard({ modelo, recomendado, aoTrocar }: ModeloAprCardProps) {
  return (
    <div className="card stack" style={{ gap: 2 }} data-treino="apr-modelo">
      <span className="lbl">Modelo</span>
      <strong style={{ fontSize: 16 }}>
        {modelo.codigo} — {modelo.titulo}
      </strong>
      <span className="muted">
        Versão {modelo.versao}
        {modelo.publicado_em ? ` · publicada em ${data(modelo.publicado_em)} pela Segurança do Trabalho` : ""} · escolhido por você
        {recomendado && recomendado !== modelo.codigo ? ` (a recomendação era ${recomendado})` : ""}
      </span>
      {aoTrocar && (
        <div style={{ marginTop: 8 }}>
          <Button variant="line" sm onClick={aoTrocar} data-treino="apr-trocar-modelo">
            Trocar modelo
          </Button>
        </div>
      )}
    </div>
  );
}
