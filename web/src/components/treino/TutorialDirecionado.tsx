"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { Icon } from "@/components/ui/Icon";
import { textoDosPontosGanhos } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";
import { estadoDoTreino, gravarTreinamento, usePassoDoTreino } from "./estado";
import { passosDoTreino, type PassoDoTreino } from "./passos";

interface Retangulo {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Medida {
  /** Posição do alvo na janela; `null` = o alvo não está na tela. */
  rect: Retangulo | null;
  vw: number;
  vh: number;
}

/** Folga do destaque em volta do alvo. */
const FOLGA = 6;
/** Distância entre o destaque e o balão (a seta ocupa parte dela). */
const DISTANCIA = 14;
const LARGURA = 360;
/** Abaixo desta largura o balão vira folha fixa (alto ou baixo da tela). */
const TELA_PEQUENA = 640;
/** Quantos passos adiante o tutorial aceita "pular" sozinho quando a pessoa já está na tela de um passo seguinte. */
const JANELA_DE_SALTO = 6;

const total = passosDoTreino.length;
const limitar = (valor: number, minimo: number, maximo: number) => Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));
const reduzMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Primeiro elemento visível com a chave `data-treino`. */
function acharAlvo(chave: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-treino="${chave}"]`)) {
    const caixa = el.getBoundingClientRect();
    if (caixa.width > 0 && caixa.height > 0) return el;
  }
  return null;
}

function mesmoRetangulo(a: Retangulo | null, b: Retangulo | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return Math.abs(a.top - b.top) < 0.5 && Math.abs(a.left - b.left) < 0.5 && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5;
}

/** Leva o alvo para a parte visível da tela (uma vez por passo); no celular o balão ocupa a parte de baixo ou de cima. */
function mostrarAlvo(el: HTMLElement) {
  const caixa = el.getBoundingClientRect();
  const altura = window.innerHeight;
  const pequena = window.innerWidth < TELA_PEQUENA;
  const visivel = caixa.top >= 140 && caixa.bottom <= altura - (pequena ? 240 : 80);
  if (visivel) return;
  el.scrollIntoView({ block: pequena || caixa.height > altura * 0.6 ? "start" : "center", behavior: reduzMovimento() ? "auto" : "smooth" });
}

/** Mede o alvo do passo e o mantém atualizado quando a tela muda (rolagem, redimensionamento, conteúdo novo). */
function useMedida(chave: string | undefined, passoId: string): Medida {
  const [medida, setMedida] = useState<Medida>({ rect: null, vw: 0, vh: 0 });

  useEffect(() => {
    let quadro = 0;
    let rolou = false;
    const medir = () => {
      quadro = 0;
      const el = chave ? acharAlvo(chave) : null;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let rect: Retangulo | null = null;
      if (el) {
        if (!rolou) {
          rolou = true;
          mostrarAlvo(el);
        }
        const caixa = el.getBoundingClientRect();
        rect = { top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height };
      }
      setMedida((atual) => (atual.vw === vw && atual.vh === vh && mesmoRetangulo(atual.rect, rect) ? atual : { rect, vw, vh }));
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(medir);
    };
    const observador = new MutationObserver((registros) => {
      // Mudanças do próprio tutorial não precisam de nova medida.
      if (registros.every((r) => (r.target as Element).closest?.(".tr-raiz"))) return;
      agendar();
    });
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-treino", "hidden", "class", "disabled"] });
    window.addEventListener("resize", agendar);
    window.addEventListener("scroll", agendar, true);
    agendar();
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
      window.removeEventListener("resize", agendar);
      window.removeEventListener("scroll", agendar, true);
    };
  }, [chave, passoId]);

  return medida;
}

/** Posição do balão em relação ao alvo (desktop) ou folha fixa (celular e passos sem alvo). */
function posicionar(medida: Medida): { estilo: CSSProperties; lado: "centro" | "abaixo" | "acima" | "direita" | "esquerda" | "canto" | "folha-baixo" | "folha-topo" } {
  const { rect, vw, vh } = medida;
  if (!rect || vw === 0) return { estilo: {}, lado: "centro" };
  if (vw < TELA_PEQUENA) return { estilo: {}, lado: rect.top + rect.height / 2 > vh * 0.5 ? "folha-topo" : "folha-baixo" };

  const largura = Math.min(LARGURA, vw - 24);
  const centroX = rect.left + rect.width / 2;
  const esquerda = limitar(centroX - largura / 2, 12, vw - largura - 12);
  const base = rect.top + rect.height;
  const espacoAbaixo = vh - base - FOLGA - DISTANCIA;
  const espacoAcima = rect.top - FOLGA - DISTANCIA;
  const seta = (valor: number, maximo: number) => ({ "--seta": `${limitar(valor, 24, maximo - 24)}px` }) as CSSProperties;

  if (espacoAbaixo >= 250) return { lado: "abaixo", estilo: { top: base + FOLGA + DISTANCIA, left: esquerda, width: largura, ...seta(centroX - esquerda, largura) } };
  if (espacoAcima >= 250) return { lado: "acima", estilo: { bottom: vh - rect.top + FOLGA + DISTANCIA, left: esquerda, width: largura, ...seta(centroX - esquerda, largura) } };

  const topo = limitar(rect.top, 76, vh - 330);
  const centroY = rect.top + rect.height / 2;
  if (rect.left + rect.width + FOLGA + DISTANCIA + largura + 12 <= vw) {
    return { lado: "direita", estilo: { top: topo, left: rect.left + rect.width + FOLGA + DISTANCIA, width: largura, ...seta(centroY - topo, 230) } };
  }
  if (rect.left - FOLGA - DISTANCIA - largura - 12 >= 0) {
    return { lado: "esquerda", estilo: { top: topo, left: rect.left - FOLGA - DISTANCIA - largura, width: largura, ...seta(centroY - topo, 230) } };
  }
  // Alvo grande ocupando a tela: o balão fica num canto, sem seta.
  return { lado: "canto", estilo: { bottom: 16, right: 16, width: largura } };
}

/** Texto do indicador de passo: "3 de 17". */
const rotuloDoPasso = (indice: number) => `${indice + 1} de ${total}`;

/**
 * Tutorial direcionado: balões ancorados em elementos reais da tela, com o resto escurecido. Cada passo avança com
 * "Próximo" ou quando a pessoa faz a tarefa (clicar no alvo, chegar à rota esperada, ver um elemento aparecer). O passo
 * fica no `sessionStorage`; se a pessoa sai do roteiro, o tutorial pausa e oferece "Retomar tutorial".
 */
export function TutorialDirecionado({ pendente = false }: { pendente?: boolean }) {
  const pathname = usePathname();
  const roteador = useRouter();
  const exibirAviso = useToast();
  const idTitulo = useId();
  const salvo = usePassoDoTreino();
  const indice = Math.min(salvo, total - 1);
  const passo: PassoDoTreino = passosDoTreino[indice];
  const medida = useMedida(passo.alvo, passo.id);
  const balao = useRef<HTMLDivElement>(null);
  const indiceAtual = useRef(indice);
  const [gravando, setGravando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    indiceAtual.current = indice;
  });

  const irParaPasso = (novo: number) => {
    setErro(null);
    estadoDoTreino.definirPasso(limitar(novo, 0, total - 1));
  };

  // O passo avança sozinho ao chegar na rota esperada; se a pessoa está na tela de um passo seguinte, o roteiro acompanha.
  useEffect(() => {
    if (passo.avanca?.rota?.(pathname)) {
      estadoDoTreino.definirPasso(indice + 1);
      return;
    }
    if (!passo.rota || passo.rota(pathname)) return;
    for (let i = indice + 1; i < Math.min(total, indice + 1 + JANELA_DE_SALTO); i++) {
      if (passosDoTreino[i].rota?.(pathname)) {
        estadoDoTreino.definirPasso(i);
        return;
      }
    }
  }, [pathname, indice, passo]);

  // O passo avança sozinho quando o elemento esperado aparece na tela.
  const aparece = passo.avanca?.aparece;
  useEffect(() => {
    if (!aparece) return;
    let quadro = 0;
    const verificar = () => {
      quadro = 0;
      if (acharAlvo(aparece) && indiceAtual.current === indice) estadoDoTreino.definirPasso(indice + 1);
    };
    const agendar = () => {
      if (!quadro) quadro = requestAnimationFrame(verificar);
    };
    const observador = new MutationObserver(agendar);
    observador.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-treino", "hidden", "class"] });
    agendar();
    return () => {
      cancelAnimationFrame(quadro);
      observador.disconnect();
    };
  }, [aparece, indice]);

  // O passo avança sozinho quando a pessoa clica no alvo (a ação do clique segue normalmente: o tutorial só observa).
  const cliqueEm = passo.avanca?.clique;
  useEffect(() => {
    if (!cliqueEm) return;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const aoClicar = (evento: MouseEvent) => {
      if (!(evento.target instanceof Element) || !evento.target.closest(`[data-treino="${cliqueEm}"]`)) return;
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        if (indiceAtual.current === indice) estadoDoTreino.definirPasso(indice + 1);
      }, 200);
    };
    document.addEventListener("click", aoClicar, true);
    return () => {
      clearTimeout(temporizador);
      document.removeEventListener("click", aoClicar, true);
    };
  }, [cliqueEm, indice]);

  // Esc pausa o tutorial (só quando o foco está no balão ou solto na página, para não brigar com menus e diálogos).
  // Alt+T leva o foco ao balão, para quem navega pelo teclado.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.altKey && evento.key.toLowerCase() === "t") {
        evento.preventDefault();
        balao.current?.querySelector<HTMLElement>("[data-foco-balao]")?.focus();
        return;
      }
      if (evento.key !== "Escape" || evento.defaultPrevented) return;
      const foco = document.activeElement;
      if (foco && foco !== document.body && !balao.current?.contains(foco)) return;
      estadoDoTreino.definirModo("livre");
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  if (pathname === rotas.app.treino) return null;

  const foraDoRoteiro = Boolean(passo.rota && !passo.rota(pathname));
  const alvoNaTela = Boolean(passo.alvo && medida.rect);
  const sair = () => estadoDoTreino.definirModo("livre");

  function proximo() {
    const seguinte = passosDoTreino[indice + 1];
    irParaPasso(indice + 1);
    if (seguinte?.rota && !seguinte.rota(pathname) && seguinte.navegavel && seguinte.ir) roteador.push(seguinte.ir);
  }

  function anterior() {
    const anteriorPasso = passosDoTreino[indice - 1];
    irParaPasso(indice - 1);
    if (anteriorPasso?.rota && !anteriorPasso.rota(pathname) && anteriorPasso.navegavel && anteriorPasso.ir) roteador.push(anteriorPasso.ir);
  }

  async function concluir(destino: "livre" | "real") {
    setErro(null);
    setGravando(true);
    try {
      const pontos = textoDosPontosGanhos(await gravarTreinamento("concluido"));
      // O aviso só aparece quando o técnico segue no treino livre; ao sair para o sistema real a barra e o aviso de conquista mostram os pontos.
      if (pontos && destino === "livre") exibirAviso(`Treino concluído · ${pontos}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar agora. Tente de novo.");
      setGravando(false);
      return;
    }
    if (destino === "real") {
      estadoDoTreino.limpar();
      window.location.assign(rotas.app.treinoSair);
      return;
    }
    estadoDoTreino.definirModo("livre");
    estadoDoTreino.definirPasso(0);
    roteador.push(rotas.app.lista);
    setGravando(false);
  }

  // ---- Pausado: a pessoa saiu da tela do passo ----
  if (foraDoRoteiro) {
    return (
      <div className="tr-raiz">
        <div className="tr-pausa" role="region" aria-label="Tutorial em pausa">
          <div className="tr-pausa-texto">
            <span className="tr-passo-selo">Passo {rotuloDoPasso(indice)}</span>
            <strong>Tutorial em pausa</strong>
            <span>Você saiu da tela deste passo: {passo.titulo.toLowerCase()}.</span>
          </div>
          <div className="tr-pausa-acoes">
            <button type="button" className="tr-btn tr-btn-p" data-foco-balao onClick={() => roteador.push(passo.ir ?? rotas.app.lista)}>
              Retomar tutorial
            </button>
            <button type="button" className="tr-btn tr-btn-g" onClick={sair}>
              Sair do tutorial
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { estilo, lado } = posicionar(medida);
  const rect = medida.rect;
  const semAlvo = !passo.final && passo.alvo && !alvoNaTela;
  const centralizado = lado === "centro";

  return (
    <div className="tr-raiz">
      {/* Anúncio para leitores de tela a cada passo. */}
      <p className="sr" role="status" aria-live="polite">
        Passo {indice + 1} de {total}: {passo.titulo}
      </p>
      {rect && alvoNaTela ? (
        <div
          className="tr-destaque"
          aria-hidden="true"
          style={{ top: rect.top - FOLGA, left: rect.left - FOLGA, width: rect.width + FOLGA * 2, height: rect.height + FOLGA * 2 }}
        />
      ) : (
        <div className="tr-cortina" aria-hidden="true" />
      )}
      <div
        ref={balao}
        className="tr-balao"
        data-lado={lado}
        data-final={passo.final ? "" : undefined}
        style={estilo}
        role="dialog"
        aria-modal="false"
        aria-labelledby={idTitulo}
        aria-keyshortcuts="Alt+T"
        tabIndex={-1}
      >
        <div className="tr-balao-cab">
          <span className="tr-passo-selo" aria-label={`Passo ${indice + 1} de ${total}`}>
            {passo.final ? "Fim" : `Passo ${rotuloDoPasso(indice)}`}
          </span>
          <div
            className="tr-progresso"
            role="progressbar"
            aria-label="Progresso do tutorial"
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={indice + 1}
          >
            <span style={{ width: `${((indice + 1) / total) * 100}%` }} />
          </div>
        </div>
        <div className="tr-balao-corpo" key={passo.id}>
          {passo.final && (
            <div className="tr-festa" aria-hidden="true">
              <Icon name="check" size={24} />
            </div>
          )}
          <h2 id={idTitulo}>{passo.titulo}</h2>
          <p>{passo.texto}</p>
          {semAlvo && passo.semAlvo && <p className="tr-aviso">{passo.semAlvo}</p>}
          {semAlvo && passo.atalho && (
            <button type="button" className="tr-btn tr-btn-l" onClick={() => roteador.push(passo.atalho!.href)}>
              {passo.atalho.rotulo}
            </button>
          )}
          {passo.tarefa && !passo.final && (
            <p className="tr-tarefa">
              <span className="tr-ponto" aria-hidden="true" />
              {passo.tarefa} <span className="tr-tarefa-ou">Ou toque em Próximo.</span>
            </p>
          )}
          {erro && (
            <p className="tr-erro" role="alert">
              {erro}
            </p>
          )}
        </div>
        <div className="tr-balao-rodape">
          {passo.final ? (
            <>
              <button type="button" className="tr-btn tr-btn-p" data-foco-balao disabled={gravando} aria-busy={gravando} onClick={() => concluir("livre")}>
                {gravando ? "Salvando…" : erro ? "Tentar de novo" : "Explorar no modo livre"}
              </button>
              <button type="button" className="tr-btn tr-btn-l" disabled={gravando} onClick={() => concluir("real")}>
                {/* Pendente: sair do treino leva à tela de espera, não ao sistema. */}
                {pendente ? "Ver situação do meu acesso" : "Ir para o início do sistema"}
              </button>
              <button type="button" className="tr-btn tr-btn-g" disabled={gravando} onClick={anterior}>
                Voltar
              </button>
            </>
          ) : (
            <>
              <button type="button" className="tr-btn tr-btn-g tr-sair" onClick={sair}>
                Sair do tutorial
              </button>
              <span className="tr-nav">
                <button type="button" className="tr-btn tr-btn-l" disabled={indice === 0} onClick={anterior}>
                  <Icon name="left" size={16} />
                  Voltar
                </button>
                <button type="button" className="tr-btn tr-btn-p" data-foco-balao onClick={proximo}>
                  Próximo
                  <Icon name="right" size={16} />
                </button>
              </span>
            </>
          )}
        </div>
        {centralizado && <span className="sr">Pressione Esc para pausar o tutorial.</span>}
      </div>
    </div>
  );
}
