"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as MapaLeaflet, Marker } from "leaflet";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Interruptor } from "@/components/ui/Interruptor";
import { Icon } from "@/components/ui/Icon";
import { rotas } from "@/lib/rotas";
import { rotuloDoStatus, type OsStatus } from "@/lib/tipos";

export interface CelulaDoMapa {
  latitude: number;
  longitude: number;
  total: number;
  por_status: Partial<Record<OsStatus, number>>;
}

export type Intensidade = "muito_baixa" | "baixa" | "media" | "alta" | "muito_alta";

/** Do menos para o mais intenso: cada nível é um quinto do volume da área mais movimentada. */
export const NIVEIS_DE_INTENSIDADE: { nivel: Intensidade; rotulo: string }[] = [
  { nivel: "muito_baixa", rotulo: "Muito baixa" },
  { nivel: "baixa", rotulo: "Baixa" },
  { nivel: "media", rotulo: "Média" },
  { nivel: "alta", rotulo: "Alta" },
  { nivel: "muito_alta", rotulo: "Muito alta" },
];

/**
 * As cores clássicas de mapa de calor, do frio ao quente: azul, verde, amarelo, laranja e vermelho. A radiação as mistura
 * num gradiente; os pontos, a legenda e as barras da lista lateral usam uma por nível de intensidade. As mesmas cores
 * estão em `os.css` (barras da lista e legenda dos pontos).
 */
const AZUL = "#2F6FE0";
const VERDE = "#34B54A";
const AMARELO = "#F7D117";
const LARANJA = "#F68A1E";
const VERMELHO = "#D8261D";

const CORES: Record<Intensidade, string> = { muito_baixa: AZUL, baixa: VERDE, media: AMARELO, alta: LARANJA, muito_alta: VERMELHO };

/** Quinto do volume da área mais movimentada: até 1/5 é muito baixa, até 2/5 baixa, até 3/5 média, até 4/5 alta, acima disso muito alta. */
export const intensidadeDa = (total: number, maior: number): Intensidade => {
  const fracao = total / maior;
  return fracao <= 0.2 ? "muito_baixa" : fracao <= 0.4 ? "baixa" : fracao <= 0.6 ? "media" : fracao <= 0.8 ? "alta" : "muito_alta";
};

/**
 * Pontos de cor da radiação, do halo quase invisível ao núcleo mais forte — vários degraus em vez de poucos, para a
 * transição ficar gradual (o que lê como "brilho irradiando") e não um salto rápido para a cor cheia (o que lê como
 * "mancha sólida"). A barra da legenda é pintada com este mesmo gradiente.
 */
const PONTOS_DO_GRADIENTE: [number, string][] = [
  [0, "rgba(47, 111, 224, 0)"],
  [0.1, "rgba(47, 111, 224, 0.3)"],
  [0.2, AZUL],
  [0.4, VERDE],
  [0.6, AMARELO],
  [0.8, LARANJA],
  [1, VERMELHO],
];
const BARRA_DO_GRADIENTE = `linear-gradient(to right, ${PONTOS_DO_GRADIENTE.map(([p, cor]) => `${cor} ${p * 100}%`).join(", ")})`;

/**
 * Nenhuma área some de todo, mas a opacidade e o tamanho do brilho (`ESCALA_MINIMA_DA_RADIACAO`) crescem com o
 * volume: é esse crescimento que dá a sensação de radiação. Um piso alto demais (como antes) deixa uma OS isolada
 * com o mesmo brilho de uma área cheia, e tudo vira uma mancha uniforme.
 */
const OPACIDADE_MINIMA_DA_RADIACAO = 0.25;
/** Expoente que levanta a opacidade na hora de pintar (fica entre 0 e 1: realça o que é fraco, sem endurecer a borda do brilho). */
const REALCE_DA_OPACIDADE = 0.6;
const ESCALA_MINIMA_DA_RADIACAO = 0.8;
/**
 * O quanto a mancha se espalha (pixels de tela, não metros reais — cresce ou encolhe junto com o zoom do mapa). O
 * desfoque dá a forma de brilho, mas um núcleo pequeno demais diante dele deixa o pico do carimbo quase transparente
 * (com 14 de núcleo e 50 de desfoque, ~15%): uma área isolada quase não aparecia. Com 30 e 40 o pico passa de 65%.
 */
const RAIO_DA_RADIACAO = 30;
const DESFOQUE_DA_RADIACAO = 40;

const chaveDa = (c: CelulaDoMapa) => `${c.latitude}:${c.longitude}`;

const resumoDosStatus = (porStatus: CelulaDoMapa["por_status"]) =>
  (Object.entries(porStatus) as [OsStatus, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([status, n]) => `${rotuloDoStatus[status]}: ${n}`)
    .join(" · ");

const coordenadas = (c: CelulaDoMapa) => `${c.latitude.toFixed(3)}°, ${c.longitude.toFixed(3)}°`;

const reduzirMovimento = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Tabela de 256 cores (uma por nível de opacidade acumulada), lida de um gradiente de 1×256 pixels. */
function tabelaDeCores(gradiente: [number, string][]): Uint8ClampedArray {
  const tela = document.createElement("canvas");
  tela.width = 1;
  tela.height = 256;
  const ctx = tela.getContext("2d")!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  for (const [posicao, cor] of gradiente) grad.addColorStop(posicao, cor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

/** O carimbo de cada ponto: um círculo invisível bem longe da tela, só para a sombra borrada aparecer. */
function carimboDoPonto(raio: number, desfoque: number): HTMLCanvasElement {
  const tela = document.createElement("canvas");
  const r = raio + desfoque;
  tela.width = tela.height = r * 2;
  const ctx = tela.getContext("2d")!;
  const distancia = r * 8;
  ctx.shadowOffsetX = ctx.shadowOffsetY = distancia;
  ctx.shadowBlur = desfoque;
  ctx.shadowColor = "#000";
  ctx.beginPath();
  ctx.arc(r - distancia, r - distancia, raio, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();
  return tela;
}

interface PontoDaRadiacao {
  lat: number;
  lng: number;
  peso: number;
}

/**
 * O estado da camada de radiação (os campos que `L.Layer.extend` guarda em cada instância). `extend` tipa `props`
 * como `any` — a tipagem aqui é só para o nosso próprio código, não muda o que o Leaflet aceita.
 */
interface EstadoDaCamada {
  _mapaDoLeaflet: MapaLeaflet;
  _tela: HTMLCanvasElement;
  _ctx: CanvasRenderingContext2D;
  _redesenhar: () => void;
  _redimensionar: () => void;
  _esconder: () => void;
  _aoParar: () => void;
}

/**
 * A radiação do mapa de calor, como camada própria do Leaflet (`L.Layer.extend`, a mesma API que o `leaflet.heat`
 * usa por baixo): cada ponto desenha o carimbo borrado, maior e mais opaco quanto mais perto do peso máximo; onde
 * vários se sobrepõem, a opacidade se acumula (a "energia" se somando), e por fim cada pixel troca a opacidade
 * acumulada pela cor equivalente do gradiente. Esse código é nosso, e não de um plugin de antes dos empacotadores de
 * módulo (que conta com um `L` global): aquele funcionava só depois do build de produção, nunca no ambiente de teste.
 */
function criarCamadaDeRadiacao(L: typeof import("leaflet"), pontos: PontoDaRadiacao[], maiorPeso: number, mapaEmMovimento: () => boolean) {
  const carimbo = carimboDoPonto(RAIO_DA_RADIACAO, DESFOQUE_DA_RADIACAO);
  const cores = tabelaDeCores(PONTOS_DO_GRADIENTE);
  const r = RAIO_DA_RADIACAO + DESFOQUE_DA_RADIACAO;
  // A opacidade do centro do carimbo: serve para saber quantas vezes desenhá-lo e chegar à intensidade que a área pede.
  const picoDoCarimbo = Math.min(0.99, Math.max(0.05, carimbo.getContext("2d")!.getImageData(r, r, 1, 1).data[3]! / 255));

  const Camada = L.Layer.extend({
    onAdd(this: EstadoDaCamada, mapaDoLeaflet: MapaLeaflet) {
      this._mapaDoLeaflet = mapaDoLeaflet;
      this._tela = L.DomUtil.create("canvas", "leaflet-heatmap-layer leaflet-layer") as HTMLCanvasElement;
      this._ctx = this._tela.getContext("2d")!;
      this._redimensionar();
      // A camada nasce escondida se o mapa já está se movendo (um novo filtro enquadra o mapa na hora): o fade-in vem ao parar.
      if (mapaEmMovimento()) this._tela.style.opacity = "0";
      mapaDoLeaflet.getPanes().overlayPane.appendChild(this._tela);
      // Em movimento o brilho esmaece: o mapa-base anda e o desenho não acompanha o zoom, e o borrão pareceria andar junto.
      mapaDoLeaflet.on("movestart zoomstart", this._esconder, this);
      mapaDoLeaflet.on("moveend", this._aoParar, this);
      mapaDoLeaflet.on("resize", this._redimensionar, this);
      this._redesenhar();
    },
    onRemove(this: EstadoDaCamada, mapaDoLeaflet: MapaLeaflet) {
      mapaDoLeaflet.getPanes().overlayPane.removeChild(this._tela);
      mapaDoLeaflet.off("movestart zoomstart", this._esconder, this);
      mapaDoLeaflet.off("moveend", this._aoParar, this);
      mapaDoLeaflet.off("resize", this._redimensionar, this);
    },
    _esconder(this: EstadoDaCamada) {
      this._tela.style.opacity = "0";
    },
    /** Parou: redesenha na posição nova e só então traz o brilho de volta (o fade fica no CSS, `.leaflet-heatmap-layer`). */
    _aoParar(this: EstadoDaCamada) {
      this._redesenhar();
      this._tela.style.opacity = "";
    },
    _redimensionar(this: EstadoDaCamada) {
      const tamanho = this._mapaDoLeaflet.getSize();
      this._tela.width = tamanho.x;
      this._tela.height = tamanho.y;
      this._redesenhar();
    },
    _redesenhar(this: EstadoDaCamada) {
      L.DomUtil.setPosition(this._tela, this._mapaDoLeaflet.containerPointToLayerPoint([0, 0]));
      const ctx = this._ctx;
      const largura = this._tela.width;
      const altura = this._tela.height;
      ctx.clearRect(0, 0, largura, altura);
      for (const ponto of pontos) {
        const p = this._mapaDoLeaflet.latLngToContainerPoint([ponto.lat, ponto.lng]);
        if (p.x < -r || p.x > largura + r || p.y < -r || p.y > altura + r) continue;
        const fracao = ponto.peso / maiorPeso;
        const escala = ESCALA_MINIMA_DA_RADIACAO + (1 - ESCALA_MINIMA_DA_RADIACAO) * fracao;
        const tamanho = carimbo.width * escala;
        // A intensidade que o centro da área deve atingir: de `OPACIDADE_MINIMA` (uma OS isolada) até 1 (a área mais cheia).
        // Quando o pico de um carimbo não chega nela, desenha-se de novo por cima: cada camada deixa passar (1 − a) do que
        // havia, então `n` camadas de opacidade `a` dão 1 − (1 − pico·a)ⁿ no centro.
        const alvo = Math.min(0.95, OPACIDADE_MINIMA_DA_RADIACAO + (1 - OPACIDADE_MINIMA_DA_RADIACAO) * fracao);
        const camadas = alvo <= picoDoCarimbo ? 1 : Math.ceil(Math.log(1 - alvo) / Math.log(1 - picoDoCarimbo));
        ctx.globalAlpha = Math.min(1, (1 - (1 - alvo) ** (1 / camadas)) / picoDoCarimbo);
        for (let i = 0; i < camadas; i++) ctx.drawImage(carimbo, p.x - tamanho / 2, p.y - tamanho / 2, tamanho, tamanho);
      }
      if (pontos.length === 0) return;
      const imagem = ctx.getImageData(0, 0, largura, altura);
      const dados = imagem.data;
      for (let i = 3; i < dados.length; i += 4) {
        const alfa = dados[i]!;
        if (!alfa) continue;
        const indice = alfa * 4;
        dados[i - 3] = cores[indice]!;
        dados[i - 2] = cores[indice + 1]!;
        dados[i - 1] = cores[indice + 2]!;
        dados[i] = Math.round(255 * (alfa / 255) ** REALCE_DA_OPACIDADE);
      }
      ctx.putImageData(imagem, 0, 0);
    },
  });
  return new Camada();
}

/**
 * O mapa sobre as ruas do OpenStreetMap (Leaflet), e ao lado as áreas com mais OS: tocar numa delas leva o mapa até
 * ela. A radiação (ligada por padrão, como os pontos) faz cada área emitir um brilho que se funde com o das vizinhas — o mapa de calor de
 * verdade, para enxergar regiões; os pontos são marcas coloridas no centro de cada área. As duas camadas são caixas
 * independentes: uma, as duas ou nenhuma. O Leaflet
 * mexe no `window`, então é carregado só no navegador, dentro do efeito.
 */
export function MapaDeCalor({ celulas }: { celulas: CelulaDoMapa[] }) {
  const elemento = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const camada = useRef<LayerGroup | null>(null);
  const marcadores = useRef(new Map<string, Marker>());
  const emMovimento = useRef(false);
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [radiacao, setRadiacao] = useState(true);
  const [pontos, setPontos] = useState(true);
  const [pretoEBranco, setPretoEBranco] = useState(true);

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
      // Se o mapa está parado ou não: a radiação sabe como nascer (veja `criarCamadaDeRadiacao`) e o CSS esmaece os pontos
      // pelo atributo (`data-movendo`, não uma classe: o Leaflet escreve nas classes do contêiner).
      const elementoDoMapa = m.getContainer();
      m.on("movestart zoomstart", () => {
        emMovimento.current = true;
        elementoDoMapa.dataset.movendo = "1";
      });
      m.on("moveend", () => {
        emMovimento.current = false;
        delete elementoDoMapa.dataset.movendo;
      });
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

  // Enquadra o mapa a cada novo filtro — não a cada troca das camadas, para as caixas não mexerem na visão.
  useEffect(() => {
    const m = mapa.current;
    if (!leaflet || !m || celulas.length === 0) return;
    const limites = leaflet.latLngBounds(celulas.map((c) => [c.latitude, c.longitude]));
    if (celulas.length === 1) m.setView(limites.getCenter(), 14);
    else m.fitBounds(limites.pad(0.25), { maxZoom: 15 });
  }, [leaflet, celulas]);

  // Desenha a radiação e/ou os pontos (cada camada é uma caixa; as duas, ou nenhuma, valem) e os alvos de clique a cada filtro ou troca de camada.
  useEffect(() => {
    const grupo = camada.current;
    if (!leaflet || !grupo || celulas.length === 0) return;
    grupo.clearLayers();
    marcadores.current.clear();

    if (radiacao) {
      const pontos = celulas.map((c): PontoDaRadiacao => ({ lat: c.latitude, lng: c.longitude, peso: c.total }));
      grupo.addLayer(criarCamadaDeRadiacao(leaflet, pontos, maior, () => emMovimento.current));
    }

    for (const celula of celulas) {
      const centro = leaflet.latLng(celula.latitude, celula.longitude);
      // Sem a camada de pontos, o ponto é só o alvo invisível do clique e do toque.
      if (pontos) {
        leaflet.circleMarker(centro, { radius: 7, weight: 2, color: "#fff", fillColor: CORES[intensidadeDa(celula.total, maior)], fillOpacity: 0.95, interactive: false }).addTo(grupo);
      }
      const marcador = leaflet
        .marker(centro, { icon: leaflet.divIcon({ className: "calor-os-alvo", html: "", iconSize: [26, 26] }), keyboard: true, title: `${celula.total} OS` })
        .bindTooltip(`<strong>${celula.total} OS</strong><br>${resumoDosStatus(celula.por_status)}`, { direction: "top", offset: [0, -14] })
        .on("click", () => setSelecionada(chaveDa(celula)))
        .addTo(grupo);
      marcadores.current.set(chaveDa(celula), marcador);
    }
  }, [leaflet, celulas, maior, radiacao, pontos]);

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
              {radiacao && pontos
                ? "Cada área emite um brilho que se funde com o das vizinhas, e o ponto marca o centro dela."
                : radiacao
                  ? "Cada área emite um brilho que se funde com o das vizinhas: quanto mais forte, mais movimentada a região."
                  : pontos
                    ? "Cada ponto é uma área de cerca de 1 km; a cor fica mais forte com o volume de OS."
                    : "Nenhuma camada ligada. Marque Radiação ou Pontos; passar o mouse ou tocar no mapa ainda mostra os dados de cada área."}
            </p>
          </div>
          <div className="calor-os-painel-acoes">
            <fieldset className="calor-os-camadas">
              <legend>Camadas do mapa</legend>
              <label className="busca-check">
                <input type="checkbox" checked={radiacao} onChange={(e) => setRadiacao(e.target.checked)} />
                <span>Radiação</span>
              </label>
              <label className="busca-check">
                <input type="checkbox" checked={pontos} onChange={(e) => setPontos(e.target.checked)} />
                <span>Pontos</span>
              </label>
            </fieldset>
            <Interruptor ligado={pretoEBranco} aoAlternar={setPretoEBranco} rotulo="Mapa em preto e branco, para destacar a radiação e os pontos">
              {pretoEBranco ? "Preto e branco" : "Colorido"}
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
            <div ref={elemento} className="calor-os-mapa" data-cor={pretoEBranco ? "pb" : "cor"} role="region" aria-label="Mapa de calor das OS; a lista ao lado traz as mesmas áreas em texto" />
          )}
        </div>
        <div className="calor-os-legenda" aria-label="Legenda de intensidade">
          <span>Intensidade</span>
          {radiacao && (
            <span className="calor-os-gradiente">
              <b>Menos</b>
              <span className="calor-os-gradiente-barra" style={{ background: BARRA_DO_GRADIENTE }} />
              <b>Mais</b>
            </span>
          )}
          {pontos && (
            <>
              {NIVEIS_DE_INTENSIDADE.map(({ nivel, rotulo }) => (
                <span key={nivel}>
                  <i data-intensidade={nivel} />
                  {rotulo}
                </span>
              ))}
            </>
          )}
          {!radiacao && !pontos && <span>Sem camadas ligadas</span>}
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
