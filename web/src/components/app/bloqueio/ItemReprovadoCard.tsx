import { Badge } from "@/components/ui/Badge";
import { DocumentosAnexados } from "@/components/ui/DocumentosAnexados";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { hora } from "@/lib/formatar";
import type { ItemReprovadoDaApr } from "@/lib/os-app";

/** "observação, 2 fotos e 1 PDF": o que a evidência do item reprovado reuniu. */
function resumoDaEvidencia(fotos: number, pdfs: number) {
  const partes = ["observação"];
  if (fotos > 0) partes.push(`${fotos} foto${fotos > 1 ? "s" : ""}`);
  if (pdfs > 0) partes.push(`${pdfs} PDF${pdfs > 1 ? "s" : ""}`);
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

/** Card de um item reprovado, com a resposta, a observação, as fotos e os PDFs da evidência. */
export function ItemReprovadoCard({ item, numero }: { item: ItemReprovadoDaApr; numero: number }) {
  const documentos = item.documentos ?? [];
  return (
    <div className="card stack g6">
      <span className="mono small">Item reprovado {numero}</span>
      <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{item.texto}</p>
      <div className="row between wrap">
        <Badge tone="dark" style={{ background: "var(--blq)" }}>
          Resposta: {item.resposta === "sim" ? "Sim" : item.resposta === "nao" ? "Não" : "NA"}
        </Badge>
        <span className="small">Evidência: {resumoDaEvidencia(item.fotos.length, documentos.length)}</span>
      </div>
      {item.observacao && (
        <p className="muted" style={{ fontSize: 13.5 }}>
          “{item.observacao}”
        </p>
      )}
      {item.fotos.length > 0 && (
        <div className="photo-grid">
          {item.fotos.map((foto, i) => (
            <figure key={foto.id} style={{ margin: 0 }} className="stack g4">
              <ImagemArquivo
                id={foto.foto_path}
                alt={`Foto ${i + 1} do item reprovado`}
                className="photo sq"
                style={{ width: "100%", objectFit: "cover", display: "block" }}
              />
              <figcaption className="small">
                Foto {i + 1} · {hora(foto.capturada_em)}
                {foto.latitude !== null ? " · GPS ok" : ""}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <DocumentosAnexados documentos={documentos} />
    </div>
  );
}
