import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import type { FotoDeEvidencia } from "@/data/detalhe";
import { hora } from "@/lib/formatar";

const moldura = { width: "100%", height: 110, objectFit: "cover", borderRadius: 8, background: "#CED6D8", display: "block" } as const;

/** Fotos de evidência (APR ou execução): miniatura, hora da captura e, se houver, a posição. */
export function FotosDaEvidencia({ fotos, descricao }: { fotos: FotoDeEvidencia[]; descricao: string }) {
  if (fotos.length === 0) return null;
  return (
    <div className="row g12 wrap" style={{ alignItems: "flex-start" }}>
      {fotos.map((foto) => (
        <figure key={foto.id} className="stack g6" style={{ margin: 0, flex: "0 1 160px", minWidth: 120 }}>
          <ImagemArquivo id={foto.foto_path} alt={`${descricao} às ${hora(foto.capturada_em)}`} style={moldura} />
          <figcaption className="small">
            <span className="mono">{hora(foto.capturada_em)}</span>
            {foto.latitude !== null && foto.longitude !== null && (
              <>
                {" "}
                · {foto.latitude.toFixed(4)} / {foto.longitude.toFixed(4)}
              </>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
