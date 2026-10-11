import { Badge } from "@/components/ui/Badge";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { hora } from "@/lib/formatar";
import type { ItemReprovadoDaApr } from "@/lib/os-app";

/** Card de um item eliminatório reprovado, com a resposta, a observação e as fotos da evidência. */
export function ItemReprovadoCard({ item, numero }: { item: ItemReprovadoDaApr; numero: number }) {
  return (
    <div className="card stack g6">
      <span className="mono small">Item reprovado {numero} · Eliminatório</span>
      <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>{item.texto}</p>
      <div className="row between wrap">
        <Badge tone="dark" style={{ background: "var(--blq)" }}>
          Resposta: {item.resposta === "sim" ? "Sim" : item.resposta === "nao" ? "Não" : "NA"}
        </Badge>
        <span className="small">
          {item.fotos.length > 0 ? `Evidência: observação e ${item.fotos.length} foto${item.fotos.length > 1 ? "s" : ""}` : "Evidência: observação"}
        </span>
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
    </div>
  );
}
