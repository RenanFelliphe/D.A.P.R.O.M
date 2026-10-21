"use client";

import "leaflet/dist/leaflet.css";
import type { CircleMarker, LayerGroup, Map as MapaLeaflet, Marker } from "leaflet";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus, type OsStatus } from "@/lib/tipos";

export interface CelulaDoMapa {
  latitude: number;
  longitude: number;
  total: number;
  por_status: Partial<Record<OsStatus, number>>;
}

export type Intensidade = "baixa" | "media" | "alta";

/** As mesmas cores da legenda (`.calor-os-legenda` em `os.css`): a mancha e a legenda não podem divergir. */
const CORES: Record<Intensidade, string> = { baixa: "#E3A63B", media: "#DD6B33", alta: "#B3362A" };

/** Terço do volume da área mais movimentada: até 1/3 é baixa, até 2/3 é média, acima disso é alta. */
export const intensidadeDa = (total: number, maior: number): Intensidade => {
  const fracao = total / maior;
  return fracao <= 1 / 3 ? "baixa" : fracao <= 2 / 3 ? "media" : "alta";
};

/**
 * Anéis da mancha, de fora para dentro: `metros` no zoom de rua (a célula da `api` tem cerca de 1,1 km de lado, então o
 * anel externo cobre a célula e se mistura com as vizinhas) e `pixels` como mínimo, para a mancha não sumir quando o mapa
 * enquadra várias cidades. A área mais movimentada fica com os anéis maiores.
 */
const aneis = (fracao: number) => [
  { metros: 420 + 260 * fracao, pixels: 24 + 18 * fracao, opacidade: 0.16 },
  { metros: 280 + 170 * fracao, pixels: 18 + 11 * fracao, opacidade: 0.24 },
  { metros: 150 + 90 * fracao, pixels: 15 + 4 * fracao, opacidade: 0.42 },
];

/** Metros por pixel dos ladrilhos do OpenStreetMap (256 px) na latitude e no zoom dados. */
const metrosPorPixel = (latitude: number, zoom: number) => (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / 2 ** zoom;

const chaveDa = (c: CelulaDoMapa) => `${c.latitude}:${c.longitude}`;

const resumoDosStatus = (porStatus: CelulaDoMapa["por_status"]) =>
  (Object.entries(porStatus) as [OsStatus, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([status, n]) => `${rotuloDoStatus[status]}: ${n}`)
    .join(" · ");

const coordenadas = (c: CelulaDoMapa) => `${c.latitude.toFixed(3)}°, ${c.longitude.toFixed(3)}°`;

const reduzirMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * O mapa de calor sobre as ruas do OpenStreetMap (Leaflet), e ao lado as áreas com mais OS: tocar numa delas leva o mapa
 * até ela. O Leaflet mexe no `window`, então é carregado só no navegador, dentro do efeito.
 */
export function MapaDeCalor({ celulas }: { celulas: CelulaDoMapa[] }) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const marcadores = useRef(new Map<string, Marker>());
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);

  const maior = Math.max(1, ...celulas.map((c) => c.total));
  const vazio = celulas.length === 0;
  const maisMovimentadas = celulas.slice(0, 5);

  // Cria o mapa uma vez (a página só tem mapa quando há área para mostrar).
  useEffect(() => {
    if (vazio) return;
    let cancelado = false;
    void import("leaflet").then((L) => {
      if (cancelado || !elemento.current) return;
      const m = L.map(elemento.current, { scrollWheelZoom: false, minZoom: 4, maxZoom: 17 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      // A roda do mouse rola a página; depois de um clique no mapa, ela passa a dar zoom.
      m.on("click", () => m.scrollWheelZoom.enable());
      m.on("mouseout", () => m.scrollWheelZoom.disable());
      mapa.current = m;
      camada.current = L.layerGroup().addTo(m);
      setLeaflet(L);
    });
    return () => {
      cancelado = true;
      mapa.current?.remove();
      mapa.current = null;
      camada.current = null;
      setLeaflet(null);
    };
  }, [vazio]);

  // Desenha as manchas de novo a cada filtro aplicado e enquadra todas as áreas.
  useEffect(() => {
    const m = mapa.current;
    const grupo = camada.current;
    if (!leaflet || !m || !grupo || celulas.length === 0) return;
    grupo.clearLayers();
    marcadores.current.clear();
    const desenhados: { circulo: CircleMarker; latitude: number; metros: number; pixels: number }[] = [];
    for (const celula of celulas) {
      const centro = leaflet.latLng(celula.latitude, celula.longitude);
      const intensidade = intensidadeDa(celula.total, maior);
      const cor = CORES[intensidade];
      for (const anel of aneis(celula.total / maior)) {
        const circulo = leaflet.circleMarker(centro, { radius: anel.pixels, stroke: false, fillColor: cor, fillOpacity: anel.opacidade, interactive: false }).addTo(grupo);
        desenhados.push({ circulo, latitude: celula.latitude, metros: anel.metros, pixels: anel.pixels });
      }
      const marcador = leaflet
        .marker(centro, {
          icon: leaflet.divIcon({
            className: "calor-os-marcador",
            html: `<span data-intensidade="${intensidade}">${celula.total}</span>`,
            iconSize: [28, 28],
          }),
          keyboard: true,
          title: `${celula.total} OS`,
        })
        .bindTooltip(`<strong>${celula.total} OS</strong><br>${resumoDosStatus(celula.por_status)}`, { direction: "top", offset: [0, -14] })
        .on("click", () => setSelecionada(chaveDa(celula)))
        .addTo(grupo);
      marcadores.current.set(chaveDa(celula), marcador);
    }
    // O raio de cada anel acompanha o zoom: o tamanho em metros, sem ficar menor que o mínimo em pixels.
    const ajustarRaios = () => {
      const zoom = m.getZoom();
      for (const d of desenhados) d.circulo.setRadius(Math.max(d.pixels, d.metros / metrosPorPixel(d.latitude, zoom)));
    };
    m.on("zoomend", ajustarRaios);
    const limites = leaflet.latLngBounds(celulas.map((c) => [c.latitude, c.longitude]));
    if (celulas.length === 1) m.setView(limites.getCenter(), 14);
    else m.fitBounds(limites.pad(0.25), { maxZoom: 15 });
    ajustarRaios();
    return () => {
      m.off("zoomend", ajustarRaios);
    };
  }, [leaflet, celulas, maior]);

  const focar = (celula: CelulaDoMapa) => {
    const chave = chaveDa(celula);
    setSelecionada(chave);
    const m = mapa.current;
    if (!m) return;
    m.flyTo([celula.latitude, celula.longitude], Math.max(m.getZoom(), 15), { animate: !reduzirMovimento() });
    marcadores.current.get(chave)?.openTooltip();
  };

  return (
    <div className="calor-os-conteudo">
      <section className="calor-os-painel" aria-labelledby="calor-os-titulo">
        <div className="calor-os-painel-cabecalho">
          <div>
            <h3 id="calor-os-titulo">Concentração geográfica</h3>
            <p>Cada mancha agrupa as OS de uma área de cerca de 1 km; a cor e o tamanho crescem com o volume.</p>
          </div>
          <span className="calor-os-tag">
            {celulas.length} {celulas.length === 1 ? "área" : "áreas"}
          </span>
        </div>
        <div className="calor-os-area-mapa">
          {vazio ? (
            <div className="calor-os-vazio">
              <span className="calor-os-vazio-icone" aria-hidden="true">
                <Icon name="pin" size={24} />
              </span>
              <h4>Nenhuma OS com localização neste período</h4>
              <p>O mapa considera as OS com execução e posição GPS registrada no início ou no fim do serviço.</p>
            </div>
          ) : (
            <div ref={elemento} className="calor-os-mapa" role="region" aria-label="Mapa de calor das OS; a lista ao lado traz as mesmas áreas em texto" />
          )}
        </div>
        <div className="calor-os-legenda" aria-label="Legenda de intensidade">
          <span>Intensidade</span>
          <span>
            <i data-intensidade="baixa" />
            Baixa
          </span>
          <span>
            <i data-intensidade="media" />
            Média
          </span>
          <span>
            <i data-intensidade="alta" />
            Alta
          </span>
        </div>
      </section>

      <aside className="calor-os-lateral">
        <div className="calor-os-lateral-icone">
          <Icon name="bars" size={18} />
        </div>
        <h3>Áreas com mais OS</h3>
        {maisMovimentadas.length > 0 ? (
          <ol className="calor-os-lista">
            {maisMovimentadas.map((celula) => {
              const chave = chaveDa(celula);
              return (
                <li key={chave}>
                  <button type="button" onClick={() => focar(celula)} aria-pressed={selecionada === chave} title="Mostrar no mapa">
                    <span>
                      <strong>{celula.total} OS</strong>
                      <small>{coordenadas(celula)}</small>
                    </span>
                    <i aria-hidden="true">
                      <b data-intensidade={intensidadeDa(celula.total, maior)} style={{ width: `${Math.max(12, (celula.total / maior) * 100)}%` }} />
                    </i>
                    <em>{resumoDosStatus(celula.por_status)}</em>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p>Nenhuma OS geolocalizada foi encontrada para os filtros selecionados.</p>
        )}
        <div className="calor-os-nota">
          <Icon name="info" size={16} />
          <span>O mapa usa o GPS registrado na execução. OS sem posição continuam contabilizadas, mas não aparecem no mapa.</span>
        </div>
        <Link className="calor-os-link" href={rotas.app.lista}>
          Ver quadro de OS
        </Link>
      </aside>
    </div>
  );
}
