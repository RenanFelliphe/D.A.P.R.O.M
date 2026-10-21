"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as MapaLeaflet, Marker } from "leaflet";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Interruptor } from "@/components/ui/Interruptor";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus, type OsStatus } from "@/lib/tipos";

export interface CelulaDoMapa {
  latitude: number;
  longitude: number;
  total: number;
  por_status: Partial<Record<OsStatus, number>>;
}

export type Intensidade = "baixa" | "media" | "alta";

/**
 * Cores da intensidade, do mais fraco ao mais forte — de propósito sem vermelho ou amarelo puros (muito intensos,
 * cansam a vista e lembram alarme): um dourado opaco até um terracota, nunca um tom "neon". A mancha da radiação,
 * os pontos sem radiação e a legenda usam sempre esta mesma escala, para nunca divergir.
 */
const CORES: Record<Intensidade, string> = { baixa: "#E3A63B", media: "#DD6B33", alta: "#B3362A" };

/** Terço do volume da área mais movimentada: até 1/3 é baixa, até 2/3 é média, acima disso é alta. */
export const intensidadeDa = (total: number, maior: number): Intensidade => {
  const fracao = total / maior;
  return fracao <= 1 / 3 ? "baixa" : fracao <= 2 / 3 ? "media" : "alta";
};

/**
 * Pontos de cor da radiação (`leaflet.heat`): da quase transparente (uma OS isolada) até a mais forte (a área mais
 * movimentada), nas mesmas três cores de `CORES`. A barra da legenda é pintada com este mesmo gradiente.
 */
const PONTOS_DO_GRADIENTE: [number, string][] = [
  [0.12, "rgba(227, 166, 59, 0.35)"],
  [0.4, CORES.baixa],
  [0.7, CORES.media],
  [1, CORES.alta],
];
const GRADIENTE_DA_RADIACAO = Object.fromEntries(PONTOS_DO_GRADIENTE) as Record<number, string>;
const BARRA_DO_GRADIENTE = `linear-gradient(to right, ${PONTOS_DO_GRADIENTE.map(([p, cor]) => `${cor} ${p * 100}%`).join(", ")})`;

const chaveDa = (c: CelulaDoMapa) => `${c.latitude}:${c.longitude}`;

const resumoDosStatus = (porStatus: CelulaDoMapa["por_status"]) =>
  (Object.entries(porStatus) as [OsStatus, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([status, n]) => `${rotuloDoStatus[status]}: ${n}`)
    .join(" · ");

const coordenadas = (c: CelulaDoMapa) => `${c.latitude.toFixed(3)}°, ${c.longitude.toFixed(3)}°`;

const reduzirMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * `leaflet.heat` é de antes dos empacotadores de módulo: ele não importa o Leaflet, só espera um `L` global já
 * carregado e pendura `heatLayer` nele. Por isso resolvemos sempre o mesmo objeto "de verdade" (nunca o `namespace`
 * do ES module, que pode vir congelado) e o colocamos em `window.L` antes de carregar o plugin.
 */
async function carregarLeaflet() {
  const modulo = await import("leaflet");
  const L = ((modulo as unknown as { default?: typeof modulo }).default ?? modulo) as typeof modulo;
  (window as unknown as { L: typeof L }).L = L;
  await import("leaflet.heat");
  return L;
}

/**
 * O mapa sobre as ruas do OpenStreetMap (Leaflet), e ao lado as áreas com mais OS: tocar numa delas leva o mapa até
 * ela. Com a radiação ligada (padrão), cada área emite um brilho que se funde com o das vizinhas — o mapa de calor de
 * verdade, para enxergar regiões, não só pontos; desligada, mostra só os pontos coloridos, sem o brilho. O Leaflet
 * mexe no `window`, então é carregado só no navegador, dentro do efeito.
 */
export function MapaDeCalor({ celulas }: { celulas: CelulaDoMapa[] }) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const marcadores = useRef(new Map<string, Marker>());
  const [leaflet, setLeaflet] = useState<Awaited<ReturnType<typeof carregarLeaflet>> | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [radiacao, setRadiacao] = useState(true);

  const maior = Math.max(1, ...celulas.map((c) => c.total));
  const vazio = celulas.length === 0;
  const maisMovimentadas = celulas.slice(0, 5);

  // Cria o mapa uma vez (a página só tem mapa quando há área para mostrar).
  useEffect(() => {
    if (vazio) return;
    let cancelado = false;
    void carregarLeaflet().then((L) => {
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

  // Enquadra o mapa a cada novo filtro — não a cada troca da radiação, para o interruptor não mexer na visão.
  useEffect(() => {
    const m = mapa.current;
    if (!leaflet || !m || celulas.length === 0) return;
    const limites = leaflet.latLngBounds(celulas.map((c) => [c.latitude, c.longitude]));
    if (celulas.length === 1) m.setView(limites.getCenter(), 14);
    else m.fitBounds(limites.pad(0.25), { maxZoom: 15 });
  }, [leaflet, celulas]);

  // Desenha a radiação (ou os pontos simples) e os alvos de clique a cada filtro ou troca do interruptor.
  useEffect(() => {
    const grupo = camada.current;
    if (!leaflet || !grupo || celulas.length === 0) return;
    grupo.clearLayers();
    marcadores.current.clear();

    if (radiacao) {
      const pontos = celulas.map((c): [number, number, number] => [c.latitude, c.longitude, c.total]);
      grupo.addLayer(leaflet.heatLayer(pontos, { radius: 32, blur: 26, max: maior, minOpacity: 0.28, gradient: GRADIENTE_DA_RADIACAO }));
    }

    for (const celula of celulas) {
      const centro = leaflet.latLng(celula.latitude, celula.longitude);
      // Sem radiação, o próprio ponto some; com ela, o ponto é só o alvo invisível do clique e do toque.
      if (!radiacao) {
        leaflet.circleMarker(centro, { radius: 7, weight: 2, color: "#fff", fillColor: CORES[intensidadeDa(celula.total, maior)], fillOpacity: 0.95, interactive: false }).addTo(grupo);
      }
      const marcador = leaflet
        .marker(centro, { icon: leaflet.divIcon({ className: "calor-os-alvo", html: "", iconSize: [26, 26] }), keyboard: true, title: `${celula.total} OS` })
        .bindTooltip(`<strong>${celula.total} OS</strong><br>${resumoDosStatus(celula.por_status)}`, { direction: "top", offset: [0, -14] })
        .on("click", () => setSelecionada(chaveDa(celula)))
        .addTo(grupo);
      marcadores.current.set(chaveDa(celula), marcador);
    }
  }, [leaflet, celulas, maior, radiacao]);

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
            <p>
              {radiacao
                ? "Cada área emite um brilho que se funde com o das vizinhas: quanto mais forte, mais movimentada a região."
                : "Cada ponto é uma área de cerca de 1 km; a cor fica mais forte com o volume de OS."}
            </p>
          </div>
          <div className="calor-os-painel-acoes">
            <Interruptor ligado={radiacao} aoAlternar={setRadiacao} rotulo="Radiação: o brilho do mapa de calor">
              <Icon name="fogo" size={13} fill={radiacao} />
              {radiacao ? "Radiação" : "Só pontos"}
            </Interruptor>
            <span className="calor-os-tag">
              {celulas.length} {celulas.length === 1 ? "área" : "áreas"}
            </span>
          </div>
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
          {radiacao ? (
            <span className="calor-os-gradiente">
              <b>Menos</b>
              <span className="calor-os-gradiente-barra" style={{ background: BARRA_DO_GRADIENTE }} />
              <b>Mais</b>
            </span>
          ) : (
            <>
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
            </>
          )}
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
