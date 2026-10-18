import type { LocalizacaoDaOs } from "@/data/detalhe";
import { linkDoMapa } from "@/lib/geolocalizacao";

const rotuloMedida = { color: "var(--ink4)" } as const;

/** As coordenadas como o relatório as mostra (seis casas, ponto de milímetro de precisão que o aparelho entrega). */
export const coordenadas = (p: LocalizacaoDaOs) => `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;

/** Endereço do mapa embutido (OpenStreetMap) com o ponto marcado e uma janela de ~700 m em volta. */
export function urlDoMapaEmbutido(p: LocalizacaoDaOs): string {
  const { latitude: lat, longitude: lon } = p;
  const caixa = [lon - 0.004, lat - 0.003, lon + 0.004, lat + 0.003].map((n) => n.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${caixa}&layer=mapnik&marker=${lat},${lon}`;
}

/**
 * Um ponto da execução (início, fim, pausa…): as coordenadas, o link para o mapa e, fora do modo `compacta`, um mapa pequeno
 * embutido. Sem posição (permissão negada, local coberto), diz "sem localização": o serviço não é bloqueado por isso. Quem
 * compara com o endereço da OS (`endereco`, em texto) confere sozinho; a distância não é calculada.
 */
export function LocalizacaoNoMapa({ titulo, ponto, endereco, compacta = false }: { titulo: string; ponto: LocalizacaoDaOs | null; endereco?: string | null; compacta?: boolean }) {
  return (
    <div className="stack g6" style={{ minWidth: 0, flex: "1 1 240px" }}>
      <div className="small" style={rotuloMedida}>
        {titulo}
      </div>
      {ponto ? (
        <>
          <span style={{ fontSize: 13.5 }}>
            <span className="mono">{coordenadas(ponto)}</span> ·{" "}
            <a href={linkDoMapa(ponto)} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
              Ver no mapa
            </a>
          </span>
          {!compacta && (
            <iframe
              title={`Mapa: ${titulo}`}
              src={urlDoMapaEmbutido(ponto)}
              loading="lazy"
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: 150, border: "1px solid var(--line)", borderRadius: 8, background: "#fff" }}
            />
          )}
        </>
      ) : (
        <span className="muted" style={{ fontSize: 13.5 }}>
          sem localização
        </span>
      )}
      {endereco && !compacta && <span className="small">Endereço da OS: {endereco}</span>}
    </div>
  );
}
