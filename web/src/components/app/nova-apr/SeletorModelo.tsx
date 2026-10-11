import { Field } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import type { ModeloResumo } from "@/lib/apr";

interface SeletorModeloProps {
  /** Modelo que a atividade da OS indica, mas que ainda não tem versão publicada. */
  codigoMapeado: string | null;
  modelos: ModeloResumo[];
  escolhido: string;
  carregando: boolean;
  aoEscolher: (codigo: string) => void;
}

/** Quando a OS não tem atividade mapeada, o técnico escolhe o modelo entre os publicados (sempre a versão mais recente). */
export function SeletorModelo({ codigoMapeado, modelos, escolhido, carregando, aoEscolher }: SeletorModeloProps) {
  return (
    <div className="stack g8">
      <h2 style={{ fontSize: 16, fontWeight: 600 }}>Modelo de APR</h2>
      <Notice tone="info" icon="info">
        {codigoMapeado
          ? `O modelo ${codigoMapeado} desta atividade ainda não tem versão publicada. `
          : "A atividade desta OS ainda não está ligada a um modelo de APR. "}
        Escolha o modelo que vale para o serviço; vale a versão publicada mais recente.
      </Notice>
      <Field label="Modelo" htmlFor="modelo-apr">
        <select className="select" id="modelo-apr" value={escolhido} disabled={carregando} onChange={(evento) => aoEscolher(evento.target.value)}>
          <option value="">Escolha o modelo</option>
          {modelos.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.codigo} — {m.titulo} (versão {m.versao})
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
