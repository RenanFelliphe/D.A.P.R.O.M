import { AdicionarFoto } from "@/components/ui/AdicionarFoto";
import { AnexarPdf } from "@/components/ui/AnexarPdf";
import { Field, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import type { DocumentoDoRascunho, EvidenciaDoItem, FotoDoRascunho, ItemReprovado } from "@/lib/apr";

interface EvidenciaCardProps {
  /** Item que a `api` reprovou ao validar a APR, com a evidência que ele pede. */
  item: ItemReprovado;
  observacao: string;
  fotos: FotoDoRascunho[];
  documentos: DocumentoDoRascunho[];
  aoObservar: (texto: string) => void;
  aoFotoEnviada: (foto: { arquivoId: string; previa: string }) => void;
  aoRemoverFoto: (fotoId: string) => void;
  aoPdfEnviado: (pdf: { arquivoId: string; nome: string }) => void;
  aoRemoverPdf: (documentoId: string) => void;
  /** Falha ao enviar uma foto ou um PDF. */
  aoErroDeFoto: (mensagem: string) => void;
}

/** O que cada tipo de item pede, dito ao técnico depois da validação. */
const INSTRUCAO: Record<EvidenciaDoItem, string> = {
  foto: "Registre o motivo e anexe ao menos 1 foto. Se tiver um documento (laudo, certificado), anexe também o PDF.",
  pdf: "Registre o motivo e anexe ao menos 1 documento em PDF (laudo, certificado, relatório). Fotos são opcionais.",
  texto: "Justifique em texto. A foto e o PDF são opcionais: condição pessoal não se comprova com foto, e cada pessoa tem direito de recusa.",
};

/**
 * Evidência de um item reprovado, pedida depois que a `api` validou a APR: observação e, conforme o item, ao menos uma
 * foto ou um PDF. Os dois tipos de arquivo são sempre aceitos.
 */
export function EvidenciaCard({ item, observacao, fotos, documentos, aoObservar, aoFotoEnviada, aoRemoverFoto, aoPdfEnviado, aoRemoverPdf, aoErroDeFoto }: EvidenciaCardProps) {

  return (
    <section className="evid" aria-label="Evidência do item reprovado" data-treino="ck-evidencia" data-treino-item={item.itemId}>
      <div className="row g8" style={{ color: "var(--blq)" }}>
        <Icon name="octagon" size={18} />
        <strong style={{ fontSize: 14 }}>Item reprovado · evidência obrigatória</strong>
      </div>
      <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{item.texto}</p>
      <p className="muted">{INSTRUCAO[item.evidencia] ?? INSTRUCAO.foto}</p>
      <Field
        label={
          <>
            Observação <Req>· obrigatória</Req>
          </>
        }
        htmlFor={`ev-obs-${item.itemId}`}
      >
        <textarea className="textarea" id={`ev-obs-${item.itemId}`} rows={3} placeholder="Descreva o motivo" value={observacao} onChange={(evento) => aoObservar(evento.target.value)} />
      </Field>
      <Field
        label={
          <>
            Fotos {item.evidencia === "foto" ? <Req>· ao menos 1</Req> : <span className="muted">· opcional</span>}
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
      <Field
        label={
          <>
            Documentos em PDF {item.evidencia === "pdf" ? <Req>· ao menos 1</Req> : <span className="muted">· opcional</span>}
          </>
        }
      >
        {documentos.length > 0 && (
          <ul className="doc-lista" style={{ marginBottom: 10 }}>
            {documentos.map((d) => (
              <li key={d.id} className="doc-item">
                <Icon name="file" size={16} />
                <span className="doc-nome" title={d.nome}>
                  {d.nome}
                </span>
                <button type="button" className="btn btn-line btn-sm" aria-label={`Remover o PDF ${d.nome}`} onClick={() => aoRemoverPdf(d.id)} style={{ height: 28, padding: "0 8px" }}>
                  <Icon name="x" size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="photo-grid">
          <AnexarPdf onEnviado={aoPdfEnviado} onErro={aoErroDeFoto} rotulo={documentos.length > 0 ? "Outro PDF" : "Anexar PDF"} />
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
