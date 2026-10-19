"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/vitoria/Avatar";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { cx } from "@/lib/cx";
import { movimentoReduzido } from "@/lib/reacao-vitoria";
import { guardarSomLigado, somLigadoSalvo, tocarSom, vibrar, type SomDoJogo } from "@/lib/sons-do-jogo";
import type { PassoExplicacao, RankingDoTreinamento, ResultadoDaConclusao, ResultadoDaResposta, TentativaAberta } from "@/lib/treinamento-servico";
import { CapaDoJogo } from "./CapaDoJogo";
import { ContagemRegressiva, DURACAO_DA_CONTAGEM_MS, ProvedorDoSom } from "./efeitos";
import { ExplicacaoDoJogo } from "./ExplicacaoDoJogo";
import { FaseDoJogo } from "./FaseDoJogo";
import { HoraDoJogo } from "./HoraDoJogo";
import { ReportarProblema } from "./ReportarProblema";
import { ResultadoDoJogo } from "./ResultadoDoJogo";

type Etapa = "capa" | "explicacao" | "intervalo" | "fase" | "resultado";

export interface JanelaDoJogoProps {
  atividadeCodigo: string;
  descricao: string;
  explicacao: PassoExplicacao[];
  totalFases: number;
  cenarioPath?: string | null;
  /** "Revisado e assinado por Fulano em DD/MM/AAAA" (só na versão publicada; o teste do admin não tem). */
  assinadoPor?: string | null;
  assinadoEm?: string | null;
  /** Quem já concluiu pode ir direto para o jogo, sem passar pela explicação de novo. */
  jaConcluiu?: boolean;
  /** `true` no jogo de verdade (pontua e deixa reportar); `false` no teste do admin, que nunca pontua. */
  pontua: boolean;
  /** Abre a tentativa: a rota de verdade (`POST /treinamentos/{codigo}/tentativas`) ou a do teste do rascunho. */
  abrirTentativa: () => Promise<TentativaAberta>;
  /** Lê o ranking do treinamento para o resultado (`GET /treinamentos/{codigo}/ranking`); o teste do admin não tem. */
  carregarRanking?: () => Promise<RankingDoTreinamento>;
  /** Fecha a janela; `concluiu` avisa se alguma tentativa terminou (a tela de trás atualiza o selo de concluído). */
  aoFechar: (concluiu: boolean) => void;
}

const mensagem = (e: unknown, padrao: string) => (e instanceof ErroCliente ? e.message : padrao);
const esperar = (ms: number) => new Promise<void>((ok) => window.setTimeout(ok, ms));

/** Quantas fases seguidas, terminando na última respondida, a pessoa acertou de primeira. */
function sequenciaAte(retornos: (ResultadoDaResposta | null)[], ultima: number) {
  let n = 0;
  for (let i = ultima; i >= 0 && retornos[i]?.certa; i--) n++;
  return n;
}

/**
 * O treinamento de serviço numa janela por cima da tela (seção 3 do `vitoria.md`): capa, Parte 1 (a Vitória explicando),
 * a passagem para o jogo com a contagem, Parte 2 (as fases) e o resultado. O topo é o placar: a trilha das duas partes, os
 * pontos, os acertos e a sequência de acertos. Dá para voltar e avançar entre as fases sem responder; finalizar com fase
 * pendente pede confirmação (seção 12 do `treinamentos-de-servico.md`). Tem som (desligável) e vibração no celular. Ocupa a
 * tela inteira no celular e no celular deitado. Sair no meio pede confirmação.
 */
export function JanelaDoJogo(p: JanelaDoJogoProps) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const [etapa, setEtapa] = useState<Etapa>("capa");
  const [passo, setPasso] = useState(0);
  const [vistos, setVistos] = useState(0);
  const [tentativa, setTentativa] = useState<TentativaAberta | null>(null);
  const [faseAtual, setFaseAtual] = useState(0);
  const [retornos, setRetornos] = useState<(ResultadoDaResposta | null)[]>([]);
  /** A resposta de cada fase: a confirmada ou a que estava em andamento (para voltar a ela como estava). */
  const [respostas, setRespostas] = useState<unknown[]>([]);
  /** O tempo já gasto em cada fase, como o servidor contou na última entrada nela (o cronômetro continua daí). */
  const [tempos, setTempos] = useState<number[]>([]);
  /** As fases já vistas nesta rodada: a abertura "Fase N" passa só na primeira vez em cada uma. */
  const vistas = useRef<Set<number>>(new Set());
  const [abertura, setAbertura] = useState(false);
  /** "Finalizar" com fases sem resposta: pede confirmação antes. */
  const [confirmandoFim, setConfirmandoFim] = useState(false);
  /** As chamadas da tentativa saem em fila, na ordem (entrar, progresso, responder, concluir): o cronômetro depende dela. */
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  /** O progresso ainda não enviado (espera a pessoa parar de mexer um instante). */
  const pendente = useRef<{ fase: number; resposta: unknown; timer: number } | null>(null);
  const [resultado, setResultado] = useState<ResultadoDaConclusao | null>(null);
  /** O ranking lido depois de concluir: `carregando` enquanto vem, `erro` se não veio (o resultado aparece mesmo assim). */
  const [ranking, setRanking] = useState<RankingDoTreinamento | "carregando" | "erro" | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [contando, setContando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [saindo, setSaindo] = useState(false);
  const [somLigado, setSomLigado] = useState(somLigadoSalvo);
  /** Quantas tentativas terminaram nesta janela: da segunda em diante, jogar de novo não pontua. */
  const [conclusoes, setConclusoes] = useState(0);
  const temExplicacao = p.explicacao.length > 0;
  const noMeio = etapa === "explicacao" || etapa === "intervalo" || etapa === "fase";
  const acertos = retornos.filter((r) => r?.certa).length;
  const respondidas = retornos.filter(Boolean).length;
  const pontosAteAqui = retornos.reduce((s, r) => s + (r?.pontos ?? 0), 0);
  const sequencia = respondidas > 0 ? sequenciaAte(retornos, retornos.findLastIndex(Boolean)) : 0;

  const tocar = useCallback((som: SomDoJogo) => somLigado && tocarSom(som), [somLigado]);
  const sacudir = useCallback((padrao: number | number[]) => somLigado && vibrar(padrao), [somLigado]);
  const som = useMemo(() => ({ tocar, vibrar: sacudir }), [tocar, sacudir]);

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = rolagem;
    };
  }, []);

  // A cada tela nova, o foco vai para o título dela: o botão que levou até ali some, e o leitor de tela anuncia onde está.
  useEffect(() => {
    dialogo.current?.querySelector<HTMLElement>("[data-foco]")?.focus({ preventScroll: true });
  }, [etapa, passo, faseAtual]);

  function alternarSom() {
    const ligado = !somLigado;
    setSomLigado(ligado);
    guardarSomLigado(ligado);
    if (ligado) tocarSom("toque");
  }

  function fechar() {
    p.aoFechar(conclusoes > 0);
  }

  function pedirParaFechar() {
    if (noMeio && !saindo) setSaindo(true);
    else fechar();
  }

  function irParaPasso(n: number) {
    if (etapa === "explicacao" && n !== passo) tocar("pagina");
    setPasso(n);
    setVistos((v) => Math.max(v, n));
    setEtapa("explicacao");
  }

  /** Depois do resultado, uma rodada nova: a trilha e o placar voltam a zero e a tentativa nova só abre em "Começar o jogo". */
  function novaRodada(volta: () => void) {
    setTentativa(null);
    setRetornos([]);
    setRespostas([]);
    setTempos([]);
    vistas.current = new Set();
    setResultado(null);
    setRanking(null);
    volta();
  }

  /** Põe uma chamada da tentativa na fila; as de apoio (entrar, progresso) não interrompem o jogo se falharem. */
  function enfileirar<T>(chamada: () => Promise<T>): Promise<T> {
    const vez = fila.current.then(chamada, chamada);
    fila.current = vez.catch(() => undefined);
    return vez;
  }

  /** Envia já o progresso que estava esperando (antes de trocar de fase, responder ou finalizar). */
  function descarregarProgresso(aberta: TentativaAberta) {
    const p0 = pendente.current;
    if (!p0) return;
    window.clearTimeout(p0.timer);
    pendente.current = null;
    void enfileirar(() => chamar("PUT", `/treinamentos/tentativas/${aberta.tentativa_id}/fases/${p0.fase}/progresso`, { resposta: p0.resposta })).catch(() => undefined);
  }

  /** A resposta em andamento mudou: guarda na tela na hora e no servidor depois de um instante sem mexer. */
  function progredir(resposta: unknown) {
    if (!tentativa) return;
    const fase = faseAtual;
    setRespostas((atual) => atual.map((r, i) => (i === fase ? resposta : r)));
    if (pendente.current) window.clearTimeout(pendente.current.timer);
    const aberta = tentativa;
    pendente.current = { fase, resposta, timer: window.setTimeout(() => descarregarProgresso(aberta), 700) };
  }

  /** Mostra uma fase (ao começar, voltar ou avançar): o cronômetro da anterior pausa no servidor e o desta continua. */
  function irParaFase(aberta: TentativaAberta, n: number) {
    descarregarProgresso(aberta);
    setFaseAtual(n);
    setAbertura(n > 0 && !vistas.current.has(n));
    vistas.current.add(n);
    void enfileirar(() => chamar<{ tempo_ms: number }>("POST", `/treinamentos/tentativas/${aberta.tentativa_id}/fases/${n}/entrar`))
      .then((r) => setTempos((t) => t.map((x, i) => (i === n ? r.tempo_ms : x))))
      .catch(() => undefined);
  }

  function comecarExplicacao() {
    setErro(null);
    tocar("pagina");
    if (temExplicacao) irParaPasso(0);
    else setEtapa("intervalo");
  }

  async function comecarJogo() {
    setErro(null);
    setOcupado(true);
    // A contagem "3, 2, 1" cobre o tempo de o servidor embaralhar as fases; com "reduzir movimento", vai direto.
    const comContagem = !movimentoReduzido();
    setContando(comContagem);
    try {
      const [aberta] = await Promise.all([p.abrirTentativa(), esperar(comContagem ? DURACAO_DA_CONTAGEM_MS : 0)]);
      setTentativa(aberta);
      setRetornos(aberta.fases.map(() => null));
      setRespostas(aberta.fases.map(() => null));
      setTempos(aberta.fases.map(() => 0));
      vistas.current = new Set();
      setResultado(null);
      setEtapa("fase");
      irParaFase(aberta, 0);
    } catch (e) {
      setErro(mensagem(e, "Não foi possível abrir o jogo agora. Tente de novo."));
    } finally {
      setOcupado(false);
      setContando(false);
    }
  }

  async function responder(resposta: unknown) {
    if (!tentativa) return;
    setErro(null);
    setOcupado(true);
    // A resposta confirmada substitui o progresso que ainda não tinha ido.
    if (pendente.current?.fase === faseAtual) {
      window.clearTimeout(pendente.current.timer);
      pendente.current = null;
    }
    const fase = faseAtual;
    try {
      const r = await enfileirar(() => chamar<ResultadoDaResposta>("POST", `/treinamentos/tentativas/${tentativa.tentativa_id}/fases/${fase}`, resposta));
      const novos = retornos.map((x, i) => (i === fase ? r : x));
      setRetornos(novos);
      setRespostas((atual) => atual.map((x, i) => (i === fase ? resposta : x)));
      if (r.certa) {
        tocar(sequenciaAte(novos, faseAtual) >= 3 ? "sequencia" : "acerto");
        sacudir(30);
      } else {
        tocar("erro");
        sacudir([40, 60, 40]);
      }
    } catch (e) {
      setErro(mensagem(e, "Não foi possível registrar a resposta. Tente de novo."));
    } finally {
      setOcupado(false);
    }
  }

  function voltar() {
    if (!tentativa || faseAtual === 0) return;
    setErro(null);
    tocar("pagina");
    irParaFase(tentativa, faseAtual - 1);
  }

  /** Avançar (mesmo sem responder) ou, na última fase, finalizar; com fases sem resposta, pede confirmação antes. */
  function avancar() {
    if (!tentativa) return;
    setErro(null);
    if (faseAtual + 1 < tentativa.fases.length) {
      tocar("pagina");
      irParaFase(tentativa, faseAtual + 1);
      return;
    }
    if (retornos.some((r) => !r)) setConfirmandoFim(true);
    else void finalizar();
  }

  async function finalizar() {
    if (!tentativa) return;
    setConfirmandoFim(false);
    setErro(null);
    descarregarProgresso(tentativa);
    setOcupado(true);
    try {
      const r = await enfileirar(() => chamar<ResultadoDaConclusao>("POST", `/treinamentos/tentativas/${tentativa.tentativa_id}/concluir`));
      setResultado(r);
      setConclusoes((n) => n + 1);
      setEtapa("resultado");
      tocar("vitoria");
      if (p.carregarRanking) {
        // Depois de concluir, para a primeira conclusão já entrar na conta; o resultado não espera por ele.
        setRanking("carregando");
        p.carregarRanking().then(setRanking, () => setRanking("erro"));
      }
    } catch (e) {
      setErro(mensagem(e, "Não foi possível concluir o treinamento. Tente de novo."));
    } finally {
      setOcupado(false);
    }
  }

  const fase = tentativa?.fases[faseAtual];
  const totalFases = tentativa?.fases.length ?? p.totalFases;
  const comPlacar = (etapa === "fase" || etapa === "resultado") && tentativa;

  return (
    <dialog
      ref={dialogo}
      className="ts-jogo"
      data-etapa={etapa}
      aria-labelledby={idTitulo}
      onCancel={(e) => {
        // Esc: no meio do treinamento, pergunta antes de sair (o `cancel` fecharia a janela sozinho).
        e.preventDefault();
        pedirParaFechar();
      }}
    >
      <ProvedorDoSom value={som}>
        <div className="ts-jogo-topo">
          <header className="ts-jogo-cab">
            <span className="ts-jogo-avatar" aria-hidden="true">
              <Avatar tamanho={40} />
            </span>
            <div className="ts-jogo-cab-texto">
              <span className="ts-jogo-cab-rotulo">{p.pontua ? "Treinamento de serviço" : "Teste · não pontua"}</span>
              <h2 id={idTitulo}>{p.descricao}</h2>
            </div>
            {comPlacar && (
              <div className="ts-placar" aria-label="Placar">
                <span className="ts-placar-item" title="Pontos das fases respondidas (antes do multiplicador final)">
                  <Icon name="trophy" size={13} />
                  <span key={pontosAteAqui} className="ts-placar-valor">
                    {pontosAteAqui.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </span>
                  <span className="ts-so-largo"> pts</span>
                </span>
                <span className="ts-placar-item" title="Fases certas">
                  <Icon name="star" size={13} fill />
                  <span key={acertos} className="ts-placar-valor">
                    {acertos}
                  </span>
                  <span className="ts-so-largo">/{totalFases}</span>
                </span>
                {sequencia >= 2 && (
                  <span key={sequencia} className="ts-placar-item ts-placar-fogo" title="Acertos seguidos">
                    <Icon name="fogo" size={13} fill />
                    {sequencia}
                    <span className="ts-so-largo"> seguidas</span>
                  </span>
                )}
              </div>
            )}
            <button type="button" className="ts-jogo-botao" aria-pressed={somLigado} aria-label={somLigado ? "Desligar o som" : "Ligar o som"} title={somLigado ? "Som ligado" : "Som desligado"} onClick={alternarSom}>
              <Icon name={somLigado ? "som" : "mudo"} size={18} />
            </button>
            <button type="button" className="ts-jogo-botao" aria-label="Fechar o treinamento" onClick={pedirParaFechar}>
              <Icon name="x" size={18} />
            </button>
          </header>

          <Trilha etapa={etapa} passo={passo} passos={p.explicacao.length} faseAtual={faseAtual} totalFases={totalFases} retornos={retornos} respostas={respostas} />
        </div>

        {etapa === "capa" && (
          <CapaDoJogo
            descricao={p.descricao}
            passos={p.explicacao.length}
            fases={p.totalFases}
            cenarioPath={p.cenarioPath}
            assinadoPor={p.assinadoPor}
            assinadoEm={p.assinadoEm}
            jaConcluiu={p.jaConcluiu}
            pontua={p.pontua}
            erro={erro}
            aoComecar={comecarExplicacao}
            aoIrDiretoParaOJogo={() => setEtapa("intervalo")}
          />
        )}

        {etapa === "explicacao" && temExplicacao && (
          <ExplicacaoDoJogo passos={p.explicacao} atual={passo} vistos={vistos} aoIrPara={irParaPasso} aoTerminar={() => setEtapa("intervalo")} />
        )}

        {etapa === "intervalo" && (
          <HoraDoJogo fases={totalFases} temExplicacao={temExplicacao} ocupado={ocupado} erro={erro} aoComecar={comecarJogo} aoReverExplicacao={() => irParaPasso(0)} />
        )}

        {etapa === "fase" && tentativa && fase && (
          <FaseDoJogo
            key={`${tentativa.tentativa_id}-${faseAtual}`}
            fase={fase}
            numero={faseAtual + 1}
            total={tentativa.fases.length}
            retorno={retornos[faseAtual] ?? null}
            sequencia={retornos[faseAtual]?.certa ? sequenciaAte(retornos, faseAtual) : 0}
            abertura={abertura}
            ocupado={ocupado}
            erro={erro}
            aoResponder={responder}
            inicial={respostas[faseAtual] ?? null}
            aoProgredir={progredir}
            aoVoltar={faseAtual > 0 ? voltar : null}
            aoAvancar={avancar}
            tempoInicialMs={tempos[faseAtual] ?? 0}
            ultima={faseAtual + 1 === tentativa.fases.length}
            reportar={p.pontua ? <ReportarProblema key={faseAtual} atividadeCodigo={p.atividadeCodigo} fase={fase.indice} /> : undefined}
          />
        )}

        {etapa === "resultado" && resultado && tentativa && (
          <ResultadoDoJogo
            resultado={resultado}
            fases={tentativa.fases}
            pontua={p.pontua}
            ranking={ranking}
            jaConcluiu={Boolean(p.jaConcluiu) || conclusoes > 1}
            aoJogarDeNovo={() => novaRodada(() => setEtapa("intervalo"))}
            aoReverExplicacao={temExplicacao ? () => novaRodada(() => irParaPasso(0)) : null}
            aoFechar={fechar}
          />
        )}

        {contando && <ContagemRegressiva />}

        {confirmandoFim && tentativa && (
          <div className="ts-sair" role="alertdialog" aria-modal="true" aria-labelledby={`${idTitulo}-fim`}>
            <div className="ts-sair-caixa">
              <h3 id={`${idTitulo}-fim`}>Finalizar o treinamento?</h3>
              <p className="muted">
                {(() => {
                  const faltam = retornos.filter((r) => !r).length;
                  return `${faltam === 1 ? "Falta 1 fase" : `Faltam ${faltam} fases`} sem confirmar. O que você já fez nelas conta; o resto vale zero.`;
                })()}
              </p>
              <div className="row g8 wrap">
                <Button variant="p" onClick={() => setConfirmandoFim(false)} autoFocus>
                  Voltar ao jogo
                </Button>
                <Button variant="line" onClick={() => void finalizar()} disabled={ocupado}>
                  Finalizar mesmo assim
                </Button>
              </div>
            </div>
          </div>
        )}

        {saindo && (
          <div className="ts-sair" role="alertdialog" aria-modal="true" aria-labelledby={`${idTitulo}-sair`}>
            <div className="ts-sair-caixa">
              <h3 id={`${idTitulo}-sair`}>Sair do treinamento?</h3>
              <p className="muted">
                {etapa === "fase" ? "As respostas que você já deu continuam valendo. Ao voltar, o jogo recomeça do início." : "Você pode voltar quando quiser; o treinamento recomeça pela capa."}
              </p>
              <div className="row g8 wrap">
                <Button variant="p" onClick={() => setSaindo(false)} autoFocus>
                  Continuar treinando
                </Button>
                <Button variant="line" onClick={fechar}>
                  Sair
                </Button>
              </div>
            </div>
          </div>
        )}
      </ProvedorDoSom>
    </dialog>
  );
}

/**
 * A trilha do topo: a Parte 1 com um segmento por passo (como nos stories) e a Parte 2 com um ponto por fase, verde ou
 * vermelho depois de respondida.
 */
function Trilha({
  etapa,
  passo,
  passos,
  faseAtual,
  totalFases,
  retornos,
  respostas,
}: {
  etapa: Etapa;
  passo: number;
  passos: number;
  faseAtual: number;
  totalFases: number;
  retornos: (ResultadoDaResposta | null)[];
  respostas: unknown[];
}) {
  const explicacaoFeita = etapa === "intervalo" || etapa === "fase" || etapa === "resultado";

  return (
    <nav className="ts-trilha" aria-label="Progresso do treinamento">
      <div className={cx("ts-trilha-parte", etapa === "explicacao" && "ts-trilha-ativa")}>
        <span className="ts-trilha-rotulo">
          {explicacaoFeita ? <Icon name="check" size={13} /> : <span className="ts-trilha-num">1</span>}
          Explicação
        </span>
        <span className="ts-trilha-passos" aria-hidden="true">
          {Array.from({ length: Math.max(passos, 1) }, (_, i) => (
            <i key={i} data-estado={explicacaoFeita || (etapa === "explicacao" && i < passo) ? "feito" : etapa === "explicacao" && i === passo ? "atual" : undefined} />
          ))}
        </span>
      </div>
      <div className={cx("ts-trilha-parte", (etapa === "fase" || etapa === "intervalo") && "ts-trilha-ativa")}>
        <span className="ts-trilha-rotulo">
          {etapa === "resultado" ? <Icon name="check" size={13} /> : <span className="ts-trilha-num">2</span>}
          Jogo
        </span>
        <span className="ts-trilha-fases" aria-hidden="true">
          {Array.from({ length: totalFases }, (_, i) => {
            const r = retornos[i];
            const estado = etapa === "fase" && i === faseAtual ? "atual" : r ? (r.certa ? "certa" : r.acertos > 0 ? "parcial" : "errada") : respostas[i] ? "andamento" : undefined;
            return <i key={i} data-estado={estado} />;
          })}
        </span>
      </div>
    </nav>
  );
}
