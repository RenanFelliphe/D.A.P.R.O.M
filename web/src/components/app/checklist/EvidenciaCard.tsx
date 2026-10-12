import { AdicionarFoto } from "@/components/ui/AdicionarFoto";
import { Field, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { FotoDoRascunho, ItemDoModelo } from "@/lib/apr";

interface EvidenciaCardProps {
  item: ItemDoModelo;
  observacao: string;
  fotos: FotoDoRascunho[];
  aoObservar: (texto: string) => void;
  aoFotoEnviada: (foto: { arquivoId: string; previa: string }) => void;
  aoRemoverFoto: (fotoId: string) => void;
  aoErroDeFoto: (mensagem: string) => void;
}

/** Evidência exigida quando um item eliminatório recebe a resposta que reprova: observação e, se o item pede, foto. */
export function EvidenciaCard({ item, observacao, fotos, aoObservar, aoFotoEnviada, aoRemoverFoto, aoErroDeFoto }: EvidenciaCardProps) {
  const apenasTexto = item.evidencia === "texto";

  return (
    <section className="evid" aria-label="Evidência do item reprovado" data-treino="ck-evidencia">
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
        <textarea className="textarea" id="ev-obs" rows={3} placeholder="Descreva o motivo" value={observacao} onChange={(evento) => aoObservar(evento.target.value)} />
      </Field>
      <Field
        label={
          <>
            Fotos {apenasTexto ? <span className="muted">· opcional</span> : <Req>· ao menos 1</Req>}
          </>
        }
      >
        <div className="photo-grid">
          {fotos.map((foto, i) => (
            <div key={foto.id} className="photo sq" style={{ position: "relative", overflow: "hidden", padding: 0 }}>
              {foto.miniatura ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={foto.miniatura} alt={`Foto ${i + 1} do item reprovado`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ padding: 8 }}>Foto {i + 1}</span>
              )}
              <button
                type="button"
                className="btn btn-line btn-sm"
                aria-label={`Remover a foto ${i + 1}`}
                onClick={() => aoRemoverFoto(foto.id)}
                style={{ position: "absolute", top: 4, right: 4, height: 28, padding: "0 8px" }}
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ))}
          <AdicionarFoto onEnviada={aoFotoEnviada} onErro={aoErroDeFoto} rotulo={fotos.length > 0 ? "Outra foto" : "Adicionar foto"} />
        </div>
      </Field>
    </section>
  );
}

interface ObservacaoNaCardProps {
  observacao: string;
  aoObservar: (texto: string) => void;
}

/** "NA" passa, mas pede o motivo. */
export function ObservacaoNaCard({ observacao, aoObservar }: ObservacaoNaCardProps) {
  return (
    <section className="card stack g8" aria-label="Observação do NA">
      <Field
        label={
          <>
            Observação <Req>· obrigatória para NA</Req>
          </>
        }
        htmlFor="na-obs"
      >
        <textarea className="textarea" id="na-obs" rows={3} placeholder="Explique por que este item não se aplica" value={observacao} onChange={(evento) => aoObservar(evento.target.value)} />
      </Field>
    </section>
  );
}
