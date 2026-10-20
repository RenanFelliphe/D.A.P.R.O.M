"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Figurinha } from "@/components/vitoria/Figurinha";
import { cx } from "@/lib/cx";
import {
  celulasEntre,
  chaveDaPalavra,
  coresDoPalpite,
  decodificarTermo,
  formatarMultiplicador,
  formatarTempo,
  infoDoTipo,
  letrasDaGrade,
  letrasDaPalavra,
  multiplicadorDoTempo,
  type Celula,
  type CorDoTermo,
  type FaseParaJogar,
  type ResultadoDaResposta,
} from "@/lib/treinamento-servico";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { useConfirmacao } from "./confirmacao";
import { AberturaDaFase, Explosao, useSom, useTecla } from "./efeitos";

const LETRAS = ["A", "B", "C", "D"];
const FRASES_CERTA = ["Isso mesmo!", "Mandou bem!", "Certinho!", "Perfeito!"];
const FRASES_ERRADA = ["Não foi dessa vez.", "Quase!", "Não é bem assim.", "Essa pegou!"];

/**
 * Estado visual de uma opção: escolhida antes de confirmar (e a outra, em cinza, no verdadeiro ou falso) e, depois da
 * correção, certa, errada, faltou ou apagada.
 */
type Estado = "marcada" | "desmarcada" | "certa" | "errada" | "faltou" | "apagada" | undefined;

interface FaseDoJogoProps {
  fase: FaseParaJogar;
  numero: number;
  total: number;
  /** A correção do servidor; sem ela a fase está esperando a resposta. */
  retorno: ResultadoDaResposta | null;
  /** Acertos seguidos até esta fase (com ela), para a Vitória comemorar a sequência. */
  sequencia: number;
  /** Mostra "Fase N · tipo" passando pela tela ao entrar (a primeira fase já vem da contagem "3, 2, 1"). */
  abertura: boolean;
  ocupado: boolean;
  erro: string | null;
  aoResponder: (resposta: unknown) => void;
  /** A resposta guardada desta fase (a confirmada ou a que estava em andamento), para voltar a ela como estava. */
  inicial: unknown;
  /** A resposta em andamento mudou (a janela guarda o progresso, que conta ao finalizar sem confirmar). */
  aoProgredir: (resposta: unknown) => void;
  /** Voltar à fase anterior (nula na primeira) e avançar para a próxima, mesmo sem responder (na última, finalizar). */
  aoVoltar: (() => void) | null;
  aoAvancar: () => void;
  /** O tempo já gasto nesta fase em visitas anteriores (o cronômetro continua de onde parou). */
  tempoInicialMs: number;
  ultima: boolean;
  /** O botão "Reportar problema" (só no jogo de verdade: o admin não reporta). */
  reportar?: ReactNode;
}

type Inicial = Record<string, unknown> | null;

interface PropsDoTipo<F> {
  fase: F;
  retorno: ResultadoDaResposta | null;
  ocupado: boolean;
  aoResponder: (resposta: unknown) => void;
  /** A resposta guardada (confirmada ou em andamento), para começar de onde a pessoa parou. */
  inicial: Inicial;
  /** O cabeçalho da fase e a Vitória com a instrução, iguais em todos os tipos. */
  topo: ReactNode;
  /**
   * O rodapé: "Confirmar", "Voltar" e "Avançar" antes da correção e o painel do retorno depois. `resposta` é a resposta em
   * andamento (nula enquanto não há nada): o rodapé avisa a janela quando ela muda, para guardar o progresso.
   */
  rodape: (pronto: boolean, confirmar: () => void, resposta: unknown) => ReactNode;
  corpoRef: RefObject<HTMLDivElement | null>;
}

/** Um campo da resposta guardada ("escolha", "pares"...), se houver. */
const campo = <T,>(inicial: Inicial, nome: string): T | undefined => (inicial?.[nome] as T | undefined) ?? undefined;

const atraso = (i: number) => ({ "--i": i }) as CSSProperties;

/** "Recomeçar" (ou "Desfazer tudo") de uma fase: pede confirmação antes de limpar o que a pessoa já pôs. */
function useRecomecarFase() {
  const confirmar = useConfirmacao();
  return (limpar: () => void) =>
    confirmar({
      titulo: "Recomeçar esta fase?",
      texto: "Tudo o que você já pôs nesta fase sai, e você monta de novo. O tempo da fase continua contando.",
      confirmar: "Recomeçar a fase",
      aoConfirmar: limpar,
    });
}

/**
 * Uma fase do jogo (seção 3.3 do `vitoria.md`), de um dos 10 minijogos; `data-jogo` dá a cor e o fundo de cada um. A
 * Vitória dá a instrução no topo, ao lado do cronômetro da fase; ao confirmar, um painel sobe do rodapé com a reação dela
 * (`certo` com estrelinhas ou `errada`), a explicação, os pontos da fase e o "continuar". Dá para voltar e avançar sem
 * responder (seção 12 do `treinamentos-de-servico.md`): a resposta em andamento é guardada, e a confirmada fica travada. Tudo por toque, sem arrastar; no
 * computador também pelo teclado (1 a 4 ou A a D para escolher, Enter para confirmar e seguir). A seleção fica na tela
 * depois da resposta, colorida pelo gabarito, para quem joga ver onde errou.
 */
export function FaseDoJogo({
  fase,
  numero,
  total,
  retorno,
  sequencia,
  abertura,
  ocupado,
  erro,
  aoResponder,
  inicial,
  aoProgredir,
  aoVoltar,
  aoAvancar,
  tempoInicialMs,
  ultima,
  reportar,
}: FaseDoJogoProps) {
  const info = infoDoTipo(fase.tipo);
  const corpo = useRef<HTMLDivElement>(null);

  const topo = (
    <>
      <div className="ts-fase-topo">
        <span className="ts-fase-num" data-foco tabIndex={-1}>
          Fase {numero} de {total}
        </span>
        <span className="ts-fase-tipo">
          <Icon name={info.icone} size={13} />
          {info.rotulo}
        </span>
        <Cronometro key={`cronometro-${numero}`} inicialMs={tempoInicialMs} retorno={retorno} />
        {reportar}
      </div>
      {!retorno && (
        <VitoriaNaCena chave={`fase-${numero}`} tamanho={72} className="ts-cena-instrucao">
          <p>{ocupado ? "Deixa eu conferir…" : info.instrucao}</p>
        </VitoriaNaCena>
      )}
    </>
  );

  const rodape = (pronto: boolean, confirmar: () => void, resposta: unknown) => (
    <RodapeDaFase
      retorno={retorno}
      numero={numero}
      sequencia={sequencia}
      ultima={ultima}
      ocupado={ocupado}
      erro={erro}
      pronto={pronto}
      resposta={resposta}
      aoConfirmar={confirmar}
      aoProgredir={aoProgredir}
      aoVoltar={aoVoltar}
      aoAvancar={aoAvancar}
    />
  );

  const comum = { retorno, ocupado, aoResponder, inicial: (inicial ?? null) as Inicial, topo, rodape, corpoRef: corpo };
  return (
    <div className="ts-tela ts-tela-fase" data-jogo={fase.tipo}>
      {abertura && <AberturaDaFase numero={numero} total={total} rotulo={info.rotulo} icone={info.icone} tipo={fase.tipo} frase={info.frase} />}
      {fase.tipo === "quiz" && <Escolha {...comum} fase={fase} enunciado={fase.enunciado} />}
      {fase.tipo === "decisao" && <Escolha {...comum} fase={fase} enunciado={fase.situacao} decisao />}
      {fase.tipo === "ligar" && <Ligar {...comum} fase={fase} />}
      {fase.tipo === "ordem" && <PorEmOrdem {...comum} fase={fase} />}
      {fase.tipo === "verdadeiro_falso" && <VerdadeiroFalso {...comum} fase={fase} />}
      {fase.tipo === "caca_palavras" && <CacaPalavras {...comum} fase={fase} />}
      {fase.tipo === "memoria" && <Memoria {...comum} fase={fase} />}
      {fase.tipo === "selecione" && <Selecione {...comum} fase={fase} />}
      {fase.tipo === "desembaralhe" && <Desembaralhe {...comum} fase={fase} />}
      {fase.tipo === "termo" && <Termo {...comum} fase={fase} />}
    </div>
  );
}

/** O miolo de cada tipo: o topo e o conteúdo rolam juntos; o rodapé fica fixo embaixo, fora da rolagem. */
function Corpo({ corpoRef, topo, children, rodape }: { corpoRef: RefObject<HTMLDivElement | null>; topo: ReactNode; children: ReactNode; rodape: ReactNode }) {
  return (
    <>
      <div ref={corpoRef} className="ts-jogo-corpo">
        {topo}
        {children}
      </div>
      {rodape}
    </>
  );
}

// ---- O cronômetro da fase ---------------------------------------------------------------------------------------------------

/**
 * O tempo nesta fase e o multiplicador de agora (seção 12 do `treinamentos-de-servico.md`): conta desde que a fase apareceu,
 * somando as visitas anteriores; depois da resposta, mostra o tempo e o multiplicador que o servidor registrou. É só para quem
 * joga acompanhar: o tempo que vale é o do servidor.
 */
function Cronometro({ inicialMs, retorno }: { inicialMs: number; retorno: ResultadoDaResposta | null }) {
  const [inicio] = useState(() => Date.now());
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (retorno) return;
    const id = window.setInterval(() => setAgora(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [retorno]);
  const ms = retorno ? retorno.tempo_ms : inicialMs + (agora - inicio);
  const multiplicador = retorno ? retorno.multiplicador : multiplicadorDoTempo(ms);
  return (
    <span className="ts-cronometro" data-multiplicador={Math.round(multiplicador * 10)} title="O tempo nesta fase e o multiplicador dos pontos" aria-label={`Tempo nesta fase: ${formatarTempo(ms)}, multiplicador ${formatarMultiplicador(multiplicador)}`}>
      <Icon name="clock" size={13} />
      <span className="ts-cronometro-tempo">{formatarTempo(ms)}</span>
      <span className="ts-cronometro-mult">{formatarMultiplicador(multiplicador)}</span>
    </span>
  );
}

/** Avisa a janela quando a resposta em andamento muda (não na montagem, nem depois de confirmada). */
function useProgresso(resposta: unknown, aoProgredir: (resposta: unknown) => void, travada: boolean) {
  const chave = JSON.stringify(resposta ?? null);
  const anterior = useRef(chave);
  const atual = useRef({ resposta, aoProgredir, travada });
  useEffect(() => {
    atual.current = { resposta, aoProgredir, travada };
  });
  useEffect(() => {
    if (chave === anterior.current) return;
    anterior.current = chave;
    const { resposta: r, aoProgredir: avisar, travada: t } = atual.current;
    if (!t && r !== null && r !== undefined) avisar(r);
  }, [chave]);
}

// ---- Rodapé: confirmar, voltar, avançar e o painel do retorno -----------------------------------------------------------------

function RodapeDaFase({
  retorno,
  numero,
  sequencia,
  ultima,
  ocupado,
  erro,
  pronto,
  resposta,
  aoConfirmar,
  aoProgredir,
  aoVoltar,
  aoAvancar,
}: {
  retorno: ResultadoDaResposta | null;
  numero: number;
  sequencia: number;
  ultima: boolean;
  ocupado: boolean;
  erro: string | null;
  pronto: boolean;
  resposta: unknown;
  aoConfirmar: () => void;
  aoProgredir: (resposta: unknown) => void;
  aoVoltar: (() => void) | null;
  aoAvancar: () => void;
}) {
  useProgresso(resposta, aoProgredir, Boolean(retorno));
  useTecla({ Enter: ocupado ? undefined : retorno ? aoAvancar : pronto ? aoConfirmar : undefined });
  const rotuloAvancar = ultima ? "Finalizar" : "Avançar";

  const voltar = aoVoltar && (
    <Button variant="ghost" onClick={aoVoltar} disabled={ocupado} aria-label="Voltar à fase anterior">
      <Icon name="left" size={16} />
      <span className="ts-so-largo">Voltar</span>
    </Button>
  );

  const aviso = erro && (
    <Notice tone="blq" icon="alert" role="alert" className="ts-rodape-aviso">
      {erro}
    </Notice>
  );

  if (!retorno) {
    return (
      <div className="ts-jogo-rodape">
        {aviso}
        {voltar}
        <span className="ts-dica-teclado">
          <kbd>Enter</kbd> confirma
        </span>
        <span className="ts-rodape-espaco" />
        <Button variant="line" onClick={aoAvancar} disabled={ocupado} title={ultima ? "Encerrar o jogo" : "Ir para a próxima fase sem responder esta"}>
          {rotuloAvancar}
          <Icon name={ultima ? "flag" : "right"} size={16} />
        </Button>
        <Button variant="p" className="ts-botao-principal ts-botao-confirmar" onClick={aoConfirmar} disabled={!pronto || ocupado} aria-busy={ocupado} data-pronto={pronto || undefined}>
          {ocupado ? "Conferindo…" : "Confirmar"}
          <Icon name="check" size={16} />
        </Button>
      </div>
    );
  }

  const frase = (retorno.certa ? FRASES_CERTA : FRASES_ERRADA)[(numero - 1) % 4];
  return (
    <div className="ts-retorno" data-certa={retorno.certa || undefined} role="status" aria-live="polite">
      {aviso}
      <div className="ts-retorno-vitoria">
        {retorno.certa && <Explosao />}
        <Figurinha key={`retorno-${numero}`} reacao={retorno.certa ? "certo" : "errada"} tocar tamanho={88} />
      </div>
      <div className="ts-retorno-texto">
        <strong className="ts-retorno-titulo">
          <span className="ts-retorno-marca" aria-hidden="true">
            <Icon name={retorno.certa ? "check" : "x"} size={16} />
          </span>
          {frase}
          {retorno.certa && sequencia >= 2 && (
            <span className="ts-retorno-sequencia">
              <Icon name="fogo" size={13} fill />
              {sequencia} seguidas
            </span>
          )}
        </strong>
        <p>{retorno.explicacao}</p>
        <span className="ts-retorno-pontos">
          <Icon name="star" size={13} fill />
          {retorno.pontos.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} {retorno.pontos === 1 ? "ponto" : "pontos"} nesta fase
          {retorno.possiveis > 1 && ` · ${retorno.acertos} de ${retorno.possiveis} acertos`} · {formatarTempo(retorno.tempo_ms)} ({formatarMultiplicador(retorno.multiplicador)})
        </span>
      </div>
      <div className="ts-retorno-acoes">
        {voltar}
        <Button variant="p" className="ts-botao-principal ts-retorno-botao" onClick={aoAvancar} disabled={ocupado}>
          {ocupado ? "Abrindo o resultado…" : ultima ? "Finalizar" : "Continuar"}
          <Icon name={ultima ? "flag" : "right"} size={16} />
        </Button>
      </div>
    </div>
  );
}

// ---- Quiz e decisão ---------------------------------------------------------------------------------------------------------

function Escolha({
  fase,
  enunciado,
  decisao,
  retorno,
  ocupado,
  aoResponder,
  inicial,
  topo,
  rodape,
  corpoRef,
}: PropsDoTipo<Extract<FaseParaJogar, { tipo: "quiz" | "decisao" }>> & { enunciado: string; decisao?: boolean }) {
  const { tocar } = useSom();
  const [escolhida, setEscolhida] = useState<number | null>(() => campo<number>(inicial, "escolha") ?? null);
  const correta = retorno?.gabarito.opcao_correta;
  const travado = Boolean(retorno) || ocupado;

  function escolher(i: number) {
    if (travado || i >= fase.opcoes.length) return;
    setEscolhida(i);
    tocar("toque");
  }

  // 1 a 4 ou A a D escolhem a opção pela posição.
  const atalhos: Record<string, () => void> = {};
  fase.opcoes.forEach((_, i) => {
    atalhos[String(i + 1)] = () => escolher(i);
    atalhos[LETRAS[i]!.toLowerCase()] = () => escolher(i);
  });
  useTecla(atalhos, !travado);

  function estadoDa(i: number): Estado {
    if (!retorno) return escolhida === i ? "marcada" : undefined;
    if (i === correta) return "certa";
    return i === escolhida ? "errada" : "apagada";
  }

  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(escolhida !== null, () => escolhida !== null && aoResponder({ escolha: escolhida }), escolhida === null ? null : { escolha: escolhida })}>
      <h3 className="ts-pergunta">{enunciado}</h3>
      <div className={cx("ts-opcoes", !decisao && "ts-opcoes-blocos")} role="radiogroup" aria-label={decisao ? "Atitudes" : "Opções"}>
        {fase.opcoes.map((texto, i) => {
          const estado = estadoDa(i);
          const consequencia = retorno && decisao ? (i === escolhida ? retorno.gabarito.consequencia_escolhida : i === correta ? retorno.gabarito.consequencia_correta : null) : null;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={escolhida === i}
              className={`ts-opcao ts-cor-${i}`}
              data-estado={estado}
              data-escolha
              style={atraso(i)}
              disabled={travado}
              onClick={() => escolher(i)}
            >
              <span className="ts-opcao-marca" aria-hidden="true">
                {estado === "certa" ? <Icon name="check" size={16} /> : estado === "errada" ? <Icon name="x" size={16} /> : LETRAS[i]}
              </span>
              <span className="ts-opcao-texto">
                {texto}
                {consequencia && (
                  <span className="ts-consequencia">
                    <strong>{i === escolhida ? "O que acontece: " : "Com a atitude certa: "}</strong>
                    {consequencia}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </Corpo>
  );
}

// ---- Ligar ---------------------------------------------------------------------------------------------------------------------

interface Linha {
  par: number;
  d: string;
}

/** As curvas entre os pares, medidas na tela (e de novo a cada mudança de tamanho, como girar o celular). */
function useLinhas(area: RefObject<HTMLDivElement | null>, esquerda: RefObject<(HTMLElement | null)[]>, direita: RefObject<(HTMLElement | null)[]>, pares: { esquerda: number; direita: number }[]) {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  useEffect(() => {
    const caixa = area.current;
    if (!caixa) return;
    const medir = () => {
      const base = caixa.getBoundingClientRect();
      const novas: Linha[] = [];
      pares.forEach((p, k) => {
        const a = esquerda.current[p.esquerda]?.getBoundingClientRect();
        const b = direita.current[p.direita]?.getBoundingClientRect();
        if (!a || !b) return;
        const x1 = a.right - base.left;
        const y1 = a.top + a.height / 2 - base.top;
        const x2 = b.left - base.left;
        const y2 = b.top + b.height / 2 - base.top;
        const curva = Math.max(16, (x2 - x1) * 0.55);
        novas.push({ par: k, d: `M ${x1} ${y1} C ${x1 + curva} ${y1}, ${x2 - curva} ${y2}, ${x2} ${y2}` });
      });
      setLinhas(novas);
    };
    // O ResizeObserver mede logo ao começar a observar e de novo a cada mudança de tamanho dos itens.
    const observador = new ResizeObserver(medir);
    observador.observe(caixa);
    caixa.querySelectorAll(".ts-ligar-item").forEach((el) => observador.observe(el));
    return () => observador.disconnect();
  }, [area, esquerda, direita, pares]);
  return linhas;
}

function Ligar({ fase, retorno, ocupado, aoResponder, inicial, topo, rodape, corpoRef }: PropsDoTipo<Extract<FaseParaJogar, { tipo: "ligar" }>>) {
  const { tocar } = useSom();
  const recomecar = useRecomecarFase();
  const [pares, setPares] = useState<{ esquerda: number; direita: number }[]>(() => campo<{ esquerda: number; direita: number }[]>(inicial, "pares") ?? []);
  const [escolhida, setEscolhida] = useState<number | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const refsEsquerda = useRef<(HTMLElement | null)[]>([]);
  const refsDireita = useRef<(HTMLElement | null)[]>([]);
  const linhas = useLinhas(area, refsEsquerda, refsDireita, pares);
  const travado = Boolean(retorno) || ocupado;
  const parDaEsquerda = (i: number) => pares.findIndex((p) => p.esquerda === i);
  const parDaDireita = (i: number) => pares.findIndex((p) => p.direita === i);

  function tocarEsquerda(i: number) {
    if (travado) return;
    tocar("toque");
    const ligado = parDaEsquerda(i);
    if (ligado >= 0) setPares((atual) => atual.filter((_, k) => k !== ligado));
    setEscolhida(escolhida === i && ligado < 0 ? null : i);
  }

  function tocarDireita(i: number) {
    if (travado) return;
    const ligado = parDaDireita(i);
    if (escolhida === null) {
      // Sem item da esquerda escolhido, tocar num par já feito desfaz o par.
      if (ligado >= 0) {
        tocar("toque");
        setPares((atual) => atual.filter((_, k) => k !== ligado));
      }
      return;
    }
    tocar("pagina");
    setPares((atual) => [...atual.filter((p) => p.direita !== i && p.esquerda !== escolhida), { esquerda: escolhida, direita: i }]);
    setEscolhida(null);
  }

  const marcaDoPar = (k: number) => (k >= 0 ? <span className={`ts-par-marca ts-par-${k % 5}`}>{k + 1}</span> : null);

  if (retorno) {
    const certoDe = (esquerda: string) => retorno.gabarito.pares?.find((p) => p.esquerda === esquerda)?.direita;
    return (
      <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(true, () => {}, null)}>
        <h3 className="ts-pergunta">Os pares que você ligou</h3>
        <ul className="ts-correcao">
          {fase.esquerda.map((esquerda, i) => {
            const par = pares.find((p) => p.esquerda === i);
            const escolhido = par ? fase.direita[par.direita] : undefined;
            const certo = certoDe(esquerda);
            const acertou = escolhido !== undefined && escolhido === certo;
            return (
              <li key={i} data-estado={acertou ? "certa" : "errada"} style={atraso(i)}>
                <span className="ts-correcao-marca" aria-label={acertou ? "Certo" : "Errado"}>
                  <Icon name={acertou ? "check" : "x"} size={13} />
                </span>
                <span className="ts-correcao-texto">
                  <strong>{esquerda}</strong>
                  <span className="ts-correcao-seta">
                    <Icon name="link" size={13} /> {escolhido ?? "—"}
                  </span>
                  {!acertou && certo && <span className="ts-correcao-certo">O par certo: {certo}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </Corpo>
    );
  }

  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(pares.length === fase.esquerda.length, () => aoResponder({ pares }), pares.length > 0 ? { pares } : null)}>
      <div className="row between wrap g8">
        <span className="ts-ligar-dica">
          {escolhida !== null ? (
            <>
              <Icon name="right" size={13} />
              Agora toque no par dele, à direita.
            </>
          ) : (
            `${pares.length} de ${fase.esquerda.length} pares ligados`
          )}
        </span>
        {pares.length > 0 && (
          <Button variant="ghost" sm onClick={() => recomecar(() => setPares([]))} disabled={ocupado}>
            Desfazer tudo
          </Button>
        )}
      </div>
      <div ref={area} className="ts-ligar">
        <svg className="ts-ligar-linhas" aria-hidden="true">
          {linhas.map((l) => (
            <path key={`${l.par}-${l.d}`} className={`ts-ligar-linha ts-par-${l.par % 5}`} d={l.d} pathLength={1} />
          ))}
        </svg>
        <div className="ts-ligar-coluna" role="group" aria-label="Itens da esquerda">
          {fase.esquerda.map((texto, i) => {
            const k = parDaEsquerda(i);
            return (
              <button
                key={i}
                ref={(el) => {
                  refsEsquerda.current[i] = el;
                }}
                type="button"
                className={cx("ts-ligar-item", k >= 0 && `ts-par-${k % 5}`)}
                aria-pressed={escolhida === i}
                data-estado={escolhida === i ? "marcada" : k >= 0 ? "ligada" : undefined}
                data-escolha
                style={atraso(i)}
                disabled={ocupado}
                onClick={() => tocarEsquerda(i)}
              >
                <span>{texto}</span>
                {marcaDoPar(k)}
              </button>
            );
          })}
        </div>
        <div className="ts-ligar-coluna" role="group" aria-label="Itens da direita">
          {fase.direita.map((texto, i) => {
            const k = parDaDireita(i);
            return (
              <button
                key={i}
                ref={(el) => {
                  refsDireita.current[i] = el;
                }}
                type="button"
                className={cx("ts-ligar-item", "ts-ligar-direita", k >= 0 && `ts-par-${k % 5}`)}
                data-estado={k >= 0 ? "ligada" : escolhida !== null ? "alvo" : undefined}
                data-escolha
                style={atraso(i)}
                disabled={ocupado || (escolhida === null && k < 0)}
                onClick={() => tocarDireita(i)}
              >
                {marcaDoPar(k)}
                <span>{texto}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Corpo>
  );
}

// ---- Pôr em ordem --------------------------------------------------------------------------------------------------------------

function PorEmOrdem({ fase, retorno, ocupado, aoResponder, inicial, topo, rodape, corpoRef }: PropsDoTipo<Extract<FaseParaJogar, { tipo: "ordem" }>>) {
  const { tocar } = useSom();
  const recomecar = useRecomecarFase();
  const [sequencia, setSequencia] = useState<number[]>(() => campo<number[]>(inicial, "sequencia") ?? []);
  const usados = new Set(sequencia);
  const travado = Boolean(retorno) || ocupado;

  function por(i: number) {
    if (travado) return;
    tocar("toque");
    setSequencia((atual) => [...atual, i]);
  }

  function tirar(posicao: number) {
    if (travado) return;
    tocar("toque");
    setSequencia((atual) => atual.filter((_, k) => k !== posicao));
  }

  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(sequencia.length === fase.etapas.length, () => aoResponder({ sequencia }), sequencia.length > 0 ? { sequencia } : null)}>
      <h3 className="ts-pergunta">{fase.enunciado}</h3>
      <ol className="ts-ordem-vagas" aria-label="Sua sequência">
        {fase.etapas.map((_, posicao) => {
          const escolhida = sequencia[posicao];
          const texto = escolhida === undefined ? null : fase.etapas[escolhida];
          const certa = retorno?.gabarito.etapas?.[posicao];
          const estado: Estado = retorno ? (texto === certa ? "certa" : "errada") : texto ? "marcada" : undefined;
          return (
            <li key={posicao} data-estado={estado} data-proxima={!retorno && posicao === sequencia.length ? "" : undefined} style={atraso(posicao)}>
              <span className="ts-vaga-num">{retorno ? <Icon name={estado === "certa" ? "check" : "x"} size={13} /> : posicao + 1}</span>
              {texto ? (
                <button
                  key={`${posicao}-${escolhida}`}
                  type="button"
                  className="ts-vaga-texto"
                  data-escolha
                  disabled={travado}
                  onClick={() => tirar(posicao)}
                  aria-label={`${posicao + 1}º: ${texto}. Toque para tirar.`}
                >
                  {texto}
                  {retorno && estado === "errada" && certa && <span className="ts-correcao-certo">Aqui era: {certa}</span>}
                </button>
              ) : (
                <span className="ts-vaga-vazia">{posicao === sequencia.length ? "Toque na próxima etapa abaixo" : ""}</span>
              )}
            </li>
          );
        })}
      </ol>
      {!retorno && sequencia.length < fase.etapas.length && (
        <div className="ts-ordem-pool" role="group" aria-label="Etapas para pôr em ordem">
          {fase.etapas.map((texto, i) =>
            usados.has(i) ? null : (
              <button key={i} type="button" className="ts-item ts-ordem-etapa" data-escolha style={atraso(i)} disabled={travado} onClick={() => por(i)}>
                <span className="ts-ordem-mais" aria-hidden="true">
                  <Icon name="plus" size={13} />
                </span>
                <span>{texto}</span>
              </button>
            ),
          )}
        </div>
      )}
      {!retorno && sequencia.length > 0 && (
        <div className="row g8 wrap">
          <Button variant="ghost" sm onClick={() => tirar(sequencia.length - 1)} disabled={ocupado}>
            Desfazer a última
          </Button>
          <Button variant="ghost" sm onClick={() => recomecar(() => setSequencia([]))} disabled={ocupado}>
            Recomeçar
          </Button>
        </div>
      )}
    </Corpo>
  );
}

// ---- Verdadeiro ou falso -------------------------------------------------------------------------------------------------------

function VerdadeiroFalso({ fase, retorno, ocupado, aoResponder, inicial, topo, rodape, corpoRef }: PropsDoTipo<Extract<FaseParaJogar, { tipo: "verdadeiro_falso" }>>) {
  const { tocar } = useSom();
  const [escolha, setEscolha] = useState<boolean | null>(() => campo<boolean>(inicial, "verdadeira") ?? null);
  const travado = Boolean(retorno) || ocupado;
  const gabarito = retorno?.gabarito.verdadeira;

  function escolher(valor: boolean) {
    if (travado) return;
    setEscolha(valor);
    tocar("toque");
  }
  useTecla({ v: () => escolher(true), f: () => escolher(false), "1": () => escolher(true), "2": () => escolher(false) }, !travado);

  // Escolhida uma carta, a outra fica em cinza (continua dando para trocar até confirmar).
  function estadoDa(valor: boolean): Estado {
    if (!retorno) return escolha === null ? undefined : escolha === valor ? "marcada" : "desmarcada";
    if (valor === gabarito) return "certa";
    return escolha === valor ? "errada" : "apagada";
  }

  const cartas = [
    { valor: true, rotulo: "Verdadeiro", icone: "check" as const, tecla: "V" },
    { valor: false, rotulo: "Falso", icone: "x" as const, tecla: "F" },
  ];

  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(escolha !== null, () => escolha !== null && aoResponder({ verdadeira: escolha }), escolha === null ? null : { verdadeira: escolha })}>
      <blockquote className="ts-vf-afirmacao">
        <span className="ts-vf-aspas" aria-hidden="true">
          “
        </span>
        <p>{fase.afirmacao}</p>
      </blockquote>
      <div className="ts-vf-cartas" role="radiogroup" aria-label="Verdadeiro ou falso">
        {cartas.map((c, i) => (
          <button
            key={c.rotulo}
            type="button"
            role="radio"
            aria-checked={escolha === c.valor}
            className="ts-vf-carta"
            data-valor={c.valor ? "v" : "f"}
            data-estado={estadoDa(c.valor)}
            data-escolha
            style={atraso(i)}
            disabled={travado}
            onClick={() => escolher(c.valor)}
          >
            <span className="ts-vf-selo" aria-hidden="true">
              <Icon name={c.icone} size={24} />
            </span>
            <strong>{c.rotulo}</strong>
            <kbd className="ts-vf-tecla" aria-hidden="true">
              {c.tecla}
            </kbd>
          </button>
        ))}
      </div>
    </Corpo>
  );
}

// ---- Caça-palavras --------------------------------------------------------------------------------------------------------------

interface Achado {
  palavra: number;
  inicio: Celula;
  fim: Celula;
}

const chaveDaCelula = ([l, c]: Celula) => `${l}:${c}`;

function CacaPalavras({ fase, retorno, ocupado, aoResponder, inicial, topo, rodape, corpoRef }: PropsDoTipo<Extract<FaseParaJogar, { tipo: "caca_palavras" }>>) {
  const { tocar, vibrar } = useSom();
  const lado = fase.grade.length;
  const [inicio, setInicio] = useState<Celula | null>(null);
  const [alvo, setAlvo] = useState<Celula | null>(null);
  // Voltando à fase: cada marcação guardada vira de novo a palavra que ela achou.
  const [achados, setAchados] = useState<Achado[]>(() =>
    (campo<{ inicio: Celula; fim: Celula }[]>(inicial, "selecoes") ?? []).flatMap((s) => {
      const linha = celulasEntre(s.inicio, s.fim, lado);
      if (!linha) return [];
      const chave = chaveDaPalavra(linha.map(([l, c]) => fase.grade[l]![c]).join(""));
      const palavra = fase.palavras.findIndex((p) => p.chave === chave);
      return palavra >= 0 ? [{ palavra, inicio: linha[0]!, fim: linha[linha.length - 1]! }] : [];
    }),
  );
  const [falha, setFalha] = useState<Set<string>>(new Set());
  const travado = Boolean(retorno) || ocupado;

  // Depois da resposta, a grade mostra onde estava cada palavra (achada ou não), pelo gabarito.
  const marcas = new Map<string, { palavra: number; faltou: boolean }>();
  const posicoes: Achado[] = retorno?.gabarito.palavras
    ? retorno.gabarito.palavras.map((p, i) => ({ palavra: i, inicio: p.inicio, fim: p.fim }))
    : achados;
  for (const a of posicoes) {
    const faltou = Boolean(retorno?.gabarito.palavras && !retorno.gabarito.palavras[a.palavra]?.achada);
    for (const celula of celulasEntre(a.inicio, a.fim, lado) ?? []) if (!marcas.has(chaveDaCelula(celula))) marcas.set(chaveDaCelula(celula), { palavra: a.palavra, faltou });
  }
  const previa = new Set((inicio && alvo ? (celulasEntre(inicio, alvo, lado) ?? []) : inicio ? [inicio] : []).map(chaveDaCelula));

  function tocarCelula(celula: Celula) {
    if (travado) return;
    if (!inicio) {
      setInicio(celula);
      tocar("toque");
      return;
    }
    const linha = celulasEntre(inicio, celula, lado);
    if (!linha || linha.length < 2) {
      // Fora da linha reta ou a mesma letra: recomeça a marcação daqui (ou cancela, se tocou na mesma).
      setInicio(chaveDaCelula(inicio) === chaveDaCelula(celula) ? null : celula);
      return;
    }
    const lido = linha.map(([l, c]) => fase.grade[l]![c]).join("");
    const chave = chaveDaPalavra(lido);
    const i = fase.palavras.findIndex((p, k) => p.chave === chave && !achados.some((a) => a.palavra === k));
    setInicio(null);
    setAlvo(null);
    if (i >= 0) {
      setAchados((atual) => [...atual, { palavra: i, inicio: linha[0]!, fim: linha[linha.length - 1]! }]);
      tocar("estrela");
      return;
    }
    tocar("toque");
    vibrar(40);
    setFalha(new Set(linha.map(chaveDaCelula)));
    window.setTimeout(() => setFalha(new Set()), 550);
  }

  const palavraAchada = (k: number) => achados.find((a) => a.palavra === k);
  const lidaNaGrade = (a: Achado) => (celulasEntre(a.inicio, a.fim, lado) ?? []).map(([l, c]) => fase.grade[l]![c]).join("");

  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(
        true,
        () => aoResponder({ selecoes: achados.map(({ inicio, fim }) => ({ inicio, fim })) }),
        achados.length > 0 ? { selecoes: achados.map(({ inicio, fim }) => ({ inicio, fim })) } : null,
      )}>
      <div className="row between wrap g8">
        <h3 className="ts-pergunta">{fase.enunciado}</h3>
        {!retorno && (
          <span key={achados.length} className="ts-contador-marcados" aria-live="polite">
            {achados.length} de {fase.palavras.length}
          </span>
        )}
      </div>
      <div className="ts-caca">
        <div className="ts-caca-papel">
          <div className="ts-caca-grade" role="grid" aria-label="Grade de letras" style={{ "--lado": lado } as CSSProperties} onPointerLeave={() => setAlvo(null)}>
            {fase.grade.map((linha, l) => (
              <div key={l} role="row" className="ts-caca-linha">
                {[...linha].map((letra, c) => {
                  const k = `${l}:${c}`;
                  const marca = marcas.get(k);
                  return (
                    <button
                      key={c}
                      type="button"
                      role="gridcell"
                      className={cx("ts-caca-celula", marca && `ts-par-${marca.palavra % 5}`)}
                      data-achada={marca && !marca.faltou ? "" : undefined}
                      data-faltou={marca?.faltou || undefined}
                      data-inicio={inicio && chaveDaCelula(inicio) === k ? "" : undefined}
                      data-previa={!marca && previa.has(k) ? "" : undefined}
                      data-falha={falha.has(k) || undefined}
                      data-escolha
                      disabled={travado}
                      aria-label={`Linha ${l + 1}, coluna ${c + 1}: ${letra}`}
                      onPointerEnter={() => inicio && setAlvo([l, c])}
                      onClick={() => tocarCelula([l, c])}
                    >
                      {letra}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <ul className="ts-caca-lista" aria-label={fase.modo === "pistas" ? "Pistas" : "Palavras"}>
          {fase.palavras.map((p, k) => {
            const achado = palavraAchada(k);
            const doGabarito = retorno?.gabarito.palavras?.[k];
            const revelada = doGabarito?.palavra ?? (achado ? lidaNaGrade(achado) : p.palavra);
            const estado = doGabarito ? (doGabarito.achada ? "certa" : "faltou") : achado ? "certa" : undefined;
            return (
              <li key={k} className={`ts-par-${k % 5}`} data-estado={estado} style={atraso(k)}>
                <span className="ts-caca-marca" aria-hidden="true">
                  {estado === "certa" ? <Icon name="check" size={13} /> : estado === "faltou" ? <Icon name="x" size={13} /> : k + 1}
                </span>
                <span className="ts-caca-texto">
                  {revelada ? <strong className="ts-caca-palavra">{revelada}</strong> : <strong className="ts-caca-tracos" aria-label={`Palavra de ${p.letras} letras`}>{"_ ".repeat(p.letras).trim()}</strong>}
                  {p.pista && <span className="ts-caca-pista">{p.pista}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {!retorno && <p className="ts-caca-dica">{inicio ? "Agora toque na última letra da palavra, em linha reta: na linha, na coluna ou na diagonal." : "Toque na primeira letra de uma palavra. Elas podem estar na linha, na coluna ou na diagonal, e se cruzar."}</p>}
    </Corpo>
  );
}

// ---- Memória --------------------------------------------------------------------------------------------------------------------

function Memoria({ fase, retorno, ocupado, aoResponder, inicial, topo, rodape, corpoRef }: PropsDoTipo<Extract<FaseParaJogar, { tipo: "memoria" }>>) {
  const { tocar, vibrar } = useSom();
  const [viradas, setViradas] = useState<number[]>([]);
  const [jogadas, setJogadas] = useState<[number, number][]>(() => campo<[number, number][]>(inicial, "jogadas") ?? []);
  // Voltando à fase: os pares já formados nas jogadas guardadas continuam na mesa, virados para cima.
  const [formadas, setFormadas] = useState<Set<number>>(() => new Set(jogadas.flatMap(([a, b]) => (fase.cartas[a]?.grupo === fase.cartas[b]?.grupo ? [a, b] : []))));
  const [errando, setErrando] = useState(false);
  const erros = jogadas.filter(([a, b]) => fase.cartas[a]!.grupo !== fase.cartas[b]!.grupo).length;
  const completa = formadas.size === fase.cartas.length;
  const travado = Boolean(retorno) || ocupado;

  function virar(i: number) {
    if (travado || errando || formadas.has(i) || viradas.includes(i) || viradas.length >= 2) return;
    const agora = [...viradas, i];
    setViradas(agora);
    if (agora.length < 2) {
      tocar("pagina");
      return;
    }
    const [a, b] = agora as [number, number];
    setJogadas((atual) => [...atual, [a, b]]);
    if (fase.cartas[a]!.grupo === fase.cartas[b]!.grupo) {
      tocar("estrela");
      setFormadas((atual) => new Set([...atual, a, b]));
      setViradas([]);
      return;
    }
    // Errou o par: as duas ficam à mostra um instante e voltam.
    tocar("toque");
    vibrar(40);
    setErrando(true);
    window.setTimeout(() => {
      setViradas([]);
      setErrando(false);
    }, 950);
  }

  const passouDoLimite = erros > fase.limite_erros;
  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(completa, () => aoResponder({ jogadas }), jogadas.length > 0 ? { jogadas } : null)}>
      <div className="ts-memoria-placar" aria-live="polite">
        <span>
          <Icon name="cartas" size={13} />
          {formadas.size / 2} de {fase.cartas.length / 2} pares
        </span>
        <span data-alerta={passouDoLimite || undefined}>
          <Icon name="x" size={13} />
          {erros} {erros === 1 ? "erro" : "erros"} · vale até {fase.limite_erros}
        </span>
      </div>
      <div className="ts-memoria-mesa" data-cartas={fase.cartas.length}>
        {fase.cartas.map((carta, i) => {
          const aberta = Boolean(retorno) || formadas.has(i) || viradas.includes(i);
          const estado = formadas.has(i) ? "formada" : errando && viradas.includes(i) ? "errada" : viradas.includes(i) ? "virada" : undefined;
          return (
            <button
              key={i}
              type="button"
              className={cx("ts-memoria-carta", formadas.has(i) && `ts-par-${carta.grupo % 5}`)}
              data-aberta={aberta || undefined}
              data-estado={estado}
              data-lado={carta.lado}
              data-escolha
              style={atraso(i)}
              disabled={travado || formadas.has(i)}
              aria-label={aberta ? carta.texto : `Carta ${i + 1}, virada para baixo`}
              onClick={() => virar(i)}
            >
              <span className="ts-memoria-giro">
                <span className="ts-memoria-verso" aria-hidden="true">
                  <Icon name="cartas" size={22} />
                </span>
                <span className="ts-memoria-frente">{carta.texto}</span>
              </span>
            </button>
          );
        })}
      </div>
      {retorno && retorno.gabarito.erros !== undefined && (
        <p className="ts-memoria-nota">
          Você errou {retorno.gabarito.erros} {retorno.gabarito.erros === 1 ? "vez" : "vezes"}; esta fase vale com até {retorno.gabarito.limite_erros}.
        </p>
      )}
    </Corpo>
  );
}

// ---- Selecione ------------------------------------------------------------------------------------------------------------------

function Selecione({ fase, retorno, ocupado, aoResponder, inicial, topo, rodape, corpoRef }: PropsDoTipo<Extract<FaseParaJogar, { tipo: "selecione" }>>) {
  const { tocar } = useSom();
  const [marcadas, setMarcadas] = useState<Set<number>>(() => new Set(campo<number[]>(inicial, "marcadas") ?? []));
  const corretas = new Set(retorno?.gabarito.corretas ?? []);
  const travado = Boolean(retorno) || ocupado;

  function alternar(i: number) {
    if (travado || i >= fase.opcoes.length) return;
    tocar("toque");
    setMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(i)) nova.delete(i);
      else nova.add(i);
      return nova;
    });
  }
  const atalhos: Record<string, () => void> = {};
  fase.opcoes.slice(0, 9).forEach((_, i) => (atalhos[String(i + 1)] = () => alternar(i)));
  useTecla(atalhos, !travado);

  function estadoDa(i: number): Estado {
    const marcada = marcadas.has(i);
    if (!retorno) return marcada ? "marcada" : undefined;
    if (corretas.has(i)) return marcada ? "certa" : "faltou";
    return marcada ? "errada" : "apagada";
  }

  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(marcadas.size > 0, () => aoResponder({ marcadas: [...marcadas] }), marcadas.size > 0 ? { marcadas: [...marcadas] } : null)}>
      <div className="ts-sel-prancheta">
        <div className="ts-sel-presilha" aria-hidden="true" />
        <div className="row between wrap g8">
          <h3 className="ts-pergunta">{fase.enunciado}</h3>
          {!retorno && (
            <span key={marcadas.size} className="ts-contador-marcados" aria-live="polite">
              {marcadas.size} {marcadas.size === 1 ? "marcada" : "marcadas"}
            </span>
          )}
        </div>
        <div className="ts-sel-opcoes" role="group" aria-label="Opções">
          {fase.opcoes.map((texto, i) => {
            const estado = estadoDa(i);
            return (
              <button
                key={i}
                type="button"
                role="checkbox"
                aria-checked={marcadas.has(i)}
                className="ts-sel-opcao"
                data-estado={estado}
                data-escolha
                style={atraso(i)}
                disabled={travado}
                onClick={() => alternar(i)}
              >
                <span className="ts-sel-caixa" aria-hidden="true">
                  {estado === "errada" ? <Icon name="x" size={16} /> : estado && estado !== "apagada" ? <Icon name="check" size={16} /> : null}
                </span>
                <span className="ts-sel-texto">{texto}</span>
              </button>
            );
          })}
        </div>
        {retorno && (
          <div className="ts-legenda">
            <span data-estado="certa">Certa e marcada</span>
            <span data-estado="errada">Não era</span>
            <span data-estado="faltou">Faltou marcar</span>
          </div>
        )}
      </div>
    </Corpo>
  );
}

// ---- Desembaralhe ---------------------------------------------------------------------------------------------------------------

/** A letra sem acento e em minúscula, para o teclado achar a peça ("c" pega o "Ç"). */
const teclaDaLetra = (letra: string) => letra.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Desembaralhe({ fase, retorno, ocupado, aoResponder, inicial, topo, rodape, corpoRef }: PropsDoTipo<Extract<FaseParaJogar, { tipo: "desembaralhe" }>>) {
  const { tocar } = useSom();
  const recomecar = useRecomecarFase();
  const [sequencia, setSequencia] = useState<number[]>(() => campo<number[]>(inicial, "letras") ?? []);
  const usadas = new Set(sequencia);
  const travado = Boolean(retorno) || ocupado;
  const certa = retorno?.gabarito.palavra ? letrasDaPalavra(retorno.gabarito.palavra) : null;

  function por(i: number) {
    if (travado || usadas.has(i)) return;
    tocar("toque");
    setSequencia((atual) => [...atual, i]);
  }
  function tirar(posicao: number) {
    if (travado) return;
    tocar("toque");
    setSequencia((atual) => atual.filter((_, k) => k !== posicao));
  }

  // Digitar a letra põe a primeira peça livre com ela; Backspace tira a última.
  const atalhos: Record<string, () => void> = { Backspace: () => sequencia.length > 0 && tirar(sequencia.length - 1) };
  for (const tecla of new Set(fase.letras.map(teclaDaLetra))) {
    atalhos[tecla] = () => {
      const livre = fase.letras.findIndex((l, i) => !usadas.has(i) && teclaDaLetra(l) === tecla);
      if (livre >= 0) por(livre);
    };
  }
  useTecla(atalhos, !travado);

  const montada = sequencia.map((i) => fase.letras[i]).join("");
  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(sequencia.length === fase.letras.length, () => aoResponder({ letras: sequencia }), sequencia.length > 0 ? { letras: sequencia } : null)}>
      <p className="ts-des-dica">
        <span className="ts-des-dica-rotulo">
          <Icon name="info" size={13} />
          Dica
        </span>
        {fase.enunciado}
      </p>
      <ol className="ts-des-vagas" aria-label={`Sua palavra: ${montada || "vazia"}`} style={{ "--letras": fase.letras.length } as CSSProperties}>
        {fase.letras.map((_, posicao) => {
          const escolhida = sequencia[posicao];
          const letra = escolhida === undefined ? null : fase.letras[escolhida]!;
          const estado: Estado = certa ? (letra === certa[posicao] ? "certa" : "errada") : letra ? "marcada" : undefined;
          return (
            <li key={posicao} data-estado={estado} data-proxima={!retorno && posicao === sequencia.length ? "" : undefined}>
              {letra ? (
                <button key={`${posicao}-${escolhida}`} type="button" className="ts-des-peca ts-des-peca-posta" data-escolha disabled={travado} onClick={() => tirar(posicao)} aria-label={`${letra}. Toque para tirar.`}>
                  {letra}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
      {retorno && !retorno.certa && retorno.gabarito.palavra && (
        <p className="ts-des-certa">
          A palavra era <strong>{retorno.gabarito.palavra}</strong>
        </p>
      )}
      {!retorno && (
        <div className="ts-des-monte" role="group" aria-label="Letras embaralhadas">
          {/* A letra já posta fica no lugar, em cinza, para ver o que ainda falta usar. */}
          {fase.letras.map((letra, i) => (
            <button key={i} type="button" className="ts-des-peca" data-usada={usadas.has(i) || undefined} data-escolha style={atraso(i)} disabled={travado || usadas.has(i)} onClick={() => por(i)} aria-label={usadas.has(i) ? `${letra}, já usada` : letra}>
              {letra}
            </button>
          ))}
        </div>
      )}
      {!retorno && sequencia.length > 0 && (
        <div className="row g8 wrap ts-des-acoes">
          <Button variant="ghost" sm onClick={() => tirar(sequencia.length - 1)} disabled={ocupado}>
            Apagar a última
          </Button>
          <Button variant="ghost" sm onClick={() => recomecar(() => setSequencia([]))} disabled={ocupado}>
            Recomeçar
          </Button>
        </div>
      )}
    </Corpo>
  );
}

// ---- Termo ----------------------------------------------------------------------------------------------------------------------

const TECLADO_DO_TERMO = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const PESO_DA_COR: Record<CorDoTermo, number> = { ausente: 1, presente: 2, certa: 3 };

/**
 * O Termo: a linha da vez tem uma casa escolhida (o cursor). A letra digitada entra nela e o cursor pula para a próxima
 * casa vazia; tocar numa casa (ou as setas) escolhe onde escrever, para montar a palavra fora de ordem.
 */
function Termo({ fase, retorno, ocupado, aoResponder, inicial, topo, rodape, corpoRef }: PropsDoTipo<Extract<FaseParaJogar, { tipo: "termo" }>>) {
  const { tocar, vibrar } = useSom();
  const segredo = decodificarTermo(fase.codigo);
  const [palpites, setPalpites] = useState<string[]>(() => campo<string[]>(inicial, "palpites") ?? []);
  const vazia = () => Array<string>(fase.letras).fill("");
  const [atual, setAtual] = useState<string[]>(vazia);
  const [cursor, setCursor] = useState(0);
  const [curto, setCurto] = useState(false);
  const acertou = palpites.includes(segredo);
  const acabou = acertou || palpites.length >= fase.tentativas;
  const travado = Boolean(retorno) || ocupado || acabou;

  function digitar(letra: string) {
    if (travado) return;
    tocar("toque");
    const nova = atual.map((x, k) => (k === cursor ? letra : x));
    setAtual(nova);
    // A próxima casa vazia à direita; sem nenhuma, a primeira vazia antes; tudo cheio, a casa seguinte.
    const depois = nova.findIndex((x, k) => k > cursor && !x);
    const antes = nova.findIndex((x) => !x);
    setCursor(depois >= 0 ? depois : antes >= 0 ? antes : Math.min(cursor + 1, fase.letras - 1));
  }
  function apagar() {
    if (travado) return;
    // Apaga a letra da casa escolhida; se ela já está vazia, a da casa anterior.
    const alvo = atual[cursor] ? cursor : Math.max(0, cursor - 1);
    setAtual((a) => a.map((x, k) => (k === alvo ? "" : x)));
    setCursor(alvo);
  }
  function mover(passo: number) {
    if (travado) return;
    setCursor((c) => Math.min(fase.letras - 1, Math.max(0, c + passo)));
  }
  function escolherCasa(k: number) {
    if (travado) return;
    tocar("toque");
    setCursor(k);
  }
  function enviar() {
    if (travado) return;
    if (atual.some((x) => !x)) {
      vibrar(40);
      setCurto(true);
      window.setTimeout(() => setCurto(false), 450);
      setCursor(atual.findIndex((x) => !x));
      return;
    }
    const palpite = atual.join("");
    tocar(palpite === segredo ? "estrela" : "pagina");
    setPalpites((p) => [...p, palpite]);
    setAtual(vazia());
    setCursor(0);
  }

  // Teclado físico: letras (com acento vira a letra sem acento), setas mudam a casa, Backspace apaga e Enter tenta a palavra.
  const atalhos: Record<string, () => void> = { Backspace: apagar, Enter: enviar, ArrowLeft: () => mover(-1), ArrowRight: () => mover(1) };
  for (const letra of "abcdefghijklmnopqrstuvwxyzáàâãéêíóôõúüç") atalhos[letra] = () => digitar(letrasDaGrade(letra));
  useTecla(atalhos, !travado);

  // A melhor cor que cada letra já teve, para pintar o teclado.
  const corDaTecla = new Map<string, CorDoTermo>();
  for (const p of palpites) {
    coresDoPalpite(p, segredo).forEach((cor, i) => {
      const letra = p[i]!;
      const antes = corDaTecla.get(letra);
      if (!antes || PESO_DA_COR[cor] > PESO_DA_COR[antes]) corDaTecla.set(letra, cor);
    });
  }

  const linhas = Array.from({ length: fase.tentativas }, (_, i) => {
    if (i < palpites.length) return { letras: [...palpites[i]!], cores: coresDoPalpite(palpites[i]!, segredo), atual: false };
    if (i === palpites.length && !acabou) return { letras: atual, cores: null, atual: true };
    return { letras: [] as string[], cores: null, atual: false };
  });
  const restantes = fase.tentativas - palpites.length;

  return (
    <Corpo corpoRef={corpoRef} topo={topo} rodape={rodape(acabou, () => aoResponder({ palpites }), palpites.length > 0 ? { palpites } : null)}>
      {fase.dica && (
        <p className="ts-des-dica ts-termo-dica">
          <span className="ts-des-dica-rotulo">
            <Icon name="info" size={13} />
            Dica
          </span>
          {fase.dica}
        </p>
      )}
      <div className="ts-termo-placar" aria-live="polite">
        {retorno ? (
          retorno.certa ? (
            <span data-estado="certa">Acertou na {retorno.gabarito.tentativa_do_acerto}ª tentativa!</span>
          ) : (
            <span data-estado="errada">
              A palavra era <strong>{retorno.gabarito.palavra}</strong>
            </span>
          )
        ) : acertou ? (
          <span data-estado="certa">Acertou! Confirme para seguir.</span>
        ) : acabou ? (
          <span data-estado="errada">As tentativas acabaram. Confirme para ver a palavra.</span>
        ) : (
          <span>
            {fase.letras} letras · {restantes} {restantes === 1 ? "tentativa" : "tentativas"}
          </span>
        )}
      </div>
      <div className="ts-termo-tabuleiro" role="grid" aria-label="Tentativas" style={{ "--letras": fase.letras } as CSSProperties}>
        {linhas.map((linha, i) => (
          <div key={i} role="row" className="ts-termo-linha" data-atual={linha.atual || undefined} data-curto={(linha.atual && curto) || undefined}>
            {Array.from({ length: fase.letras }, (_, k) => {
              const letra = linha.letras[k] ?? "";
              const cor = linha.cores?.[k];
              if (linha.atual && !travado) {
                return (
                  <button
                    key={k}
                    type="button"
                    role="gridcell"
                    className="ts-termo-casa"
                    data-cheia={letra ? "" : undefined}
                    data-cursor={k === cursor ? "" : undefined}
                    data-escolha
                    aria-selected={k === cursor}
                    aria-label={`Casa ${k + 1}: ${letra || "vazia"}${k === cursor ? ", escolhida" : ""}`}
                    onClick={() => escolherCasa(k)}
                  >
                    {letra}
                  </button>
                );
              }
              return (
                <span
                  key={k}
                  role="gridcell"
                  className="ts-termo-casa"
                  data-cor={cor}
                  data-cheia={letra ? "" : undefined}
                  style={{ "--k": k } as CSSProperties}
                  aria-label={letra ? `${letra}${cor ? `, ${cor === "certa" ? "no lugar certo" : cor === "presente" ? "em outro lugar" : "não tem"}` : ""}` : "vazia"}
                >
                  {letra}
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {!travado && <p className="ts-termo-ajuda">Toque numa casa para escrever nela, em qualquer ordem.</p>}
      {!retorno && (
        <div className="ts-termo-teclado" aria-label="Teclado">
          {TECLADO_DO_TERMO.map((fileira, f) => (
            <div key={f} className="ts-termo-fileira">
              {f === 2 && (
                <button type="button" className="ts-termo-tecla ts-termo-tecla-larga" data-escolha disabled={travado} onClick={enviar}>
                  Enter
                </button>
              )}
              {[...fileira].map((letra) => (
                <button key={letra} type="button" className="ts-termo-tecla" data-cor={corDaTecla.get(letra)} data-escolha disabled={travado} onClick={() => digitar(letra)}>
                  {letra}
                </button>
              ))}
              {f === 2 && (
                <button type="button" className="ts-termo-tecla ts-termo-tecla-larga" data-escolha disabled={travado} onClick={apagar} aria-label="Apagar">
                  <Icon name="left" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Corpo>
  );
}
