import { Field, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { PerguntaApr } from "@/data/checklist";

interface EvidenciaCardProps {
  pergunta: PerguntaApr;
  observacao: string;
  comFoto: boolean;
  aoObservar: (texto: string) => void;
  aoAnexarFoto: () => void;
}

/** Evidência exigida quando uma pergunta eliminatória recebe a resposta que reprova. */
export function EvidenciaCard({ pergunta, observacao, comFoto, aoObservar, aoAnexarFoto }: EvidenciaCardProps) {
  const apenasTexto = pergunta.evidencia === "texto";

  return (
    <section className="evid" aria-label="Evidência do item reprovado">
      <div className="row g8" style={{ color: "var(--blq)" }}>
        <Icon name="octagon" size={18} />
        <strong style={{ fontSize: 14 }}>Resposta reprovada · evidência obrigatória</strong>
      </div>
      <p className="muted">
        {apenasTexto
          ? "Justifique em texto. A foto é opcional: condição pessoal não se comprova com foto, e cada pessoa tem direito de recusa."
          : "Registre o motivo e anexe ao menos 1 foto. Você segue respondendo; a APR só é validada no fim."}
      </p>
      <Field
        label={
          <>
            Observação <Req>· obrigatória</Req>
          </>
        }
        htmlFor="ev-obs"
      >
        <textarea
          className="textarea"
          id="ev-obs"
          rows={3}
          placeholder="Descreva o motivo"
          value={observacao}
          onChange={(evento) => aoObservar(evento.target.value)}
        />
      </Field>
      <button
        className="photo-add"
        type="button"
        style={{ height: 52, flexDirection: "row" }}
        onClick={aoAnexarFoto}
      >
        {comFoto ? (
          <>
            <Icon name="check" size={18} />1 foto adicionada · 13/10 · GPS ok
          </>
        ) : (
          <>
            <Icon name="camera" size={18} />
            Adicionar foto{apenasTexto ? " (opcional)" : ""}
          </>
        )}
      </button>
    </section>
  );
}
