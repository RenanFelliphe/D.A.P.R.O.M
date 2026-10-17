"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { PontosGanhos } from "@/components/web/gamificacao/PontosGanhos";
import { AvatarVitoria } from "@/components/web/treinamento-servico/AvatarVitoria";
import { FaseJogavel } from "@/components/web/treinamento-servico/FaseJogavel";
import { ImagemDoTreinamento } from "@/components/web/treinamento-servico/ImagemDoTreinamento";
import { chamar, ErroCliente } from "@/lib/cliente-api";
import { data } from "@/lib/formatar";
import type { PassoExplicacao, ResultadoDaConclusao, ResultadoDaResposta, TentativaAberta } from "@/lib/treinamento-servico";

type Etapa = "abertura" | "explicacao" | "jogo" | "resultado";

export interface JogoTreinamentoServicoProps {
  atividadeCodigo: string;
  descricao: string;
  explicacao: PassoExplicacao[];
  cenarioPath?: string | null;
  /** "Revisado e assinado por Fulano em DD/MM/AAAA" (só quando há uma versão publicada e assinada: não na pré-visualização). */
  assinadoPor?: string | null;
  assinadoEm?: string | null;
  /** Quem já concluiu pode ir direto para o jogo, sem passar pela explicação de novo. */
  jaConcluiu?: boolean;
  /** `true` no jogo de verdade (mostra os pontos); `false` na pré-visualização do admin (nunca pontua). */
  pontua: boolean;
  /** Abre a tentativa: a rota de verdade (`POST /treinamentos/{codigo}/tentativas`) ou a de pré-visualização do rascunho. */
  abrirTentativa: () => Promise<TentativaAberta>;
  /** Chamado ao fechar a tela (a pré-visualização do admin é um painel que se fecha; o jogo de verdade não usa). */
  aoFechar?: () => void;
}

const duracaoEstimada = (passos: number, fases: number) => Math.max(2, Math.round(passos * 0.5 + fases * 0.75));

/**
 * O motor do jogo (seção 3 do `vitoria.md`): abertura, Parte 1 (explicação com a Vitória) e Parte 2 (as fases), e o
 * resultado. Usado tanto por `/app/catalogo/servicos/{codigo}/treinar` quanto pela pré-visualização do rascunho (o admin
 * não pontua: `pontua={false}`).
 */
export function JogoTreinamentoServico(p: JogoTreinamentoServicoProps) {
  const [etapa, setEtapa] = useState<Etapa>("abertura");
  const [passo, setPasso] = useState(0);
  const [tentativa, setTentativa] = useState<TentativaAberta | null>(null);
  const [faseAtual, setFaseAtual] = useState(0);
  const [feedback, setFeedback] = useState<ResultadoDaResposta | null>(null);
  const [resultado, setResultado] = useState<ResultadoDaConclusao | null>(null);
  const [reportando, setReportando] = useState(false);
  const [textoDoReporte, setTextoDoReporte] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function comecar() {
    setErro(null);
    setOcupado(true);
    try {
      const aberta = await p.abrirTentativa();
      setTentativa(aberta);
      setFaseAtual(0);
      setFeedback(null);
      setEtapa("jogo");
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível abrir o treinamento.");
    } finally {
      setOcupado(false);
    }
  }

  async function responderFase(resposta: unknown) {
    if (!tentativa) return;
    setErro(null);
    setOcupado(true);
    try {
      const r = await chamar<ResultadoDaResposta>("POST", `/treinamentos/tentativas/${tentativa.tentativa_id}/fases/${faseAtual}`, resposta);
      setFeedback(r);
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível registrar a resposta.");
    } finally {
      setOcupado(false);
    }
  }

  async function proximaFase() {
    if (!tentativa) return;
    setFeedback(null);
    if (faseAtual + 1 < tentativa.fases.length) {
      setFaseAtual((f) => f + 1);
      return;
    }
    setErro(null);
    setOcupado(true);
    try {
      const r = await chamar<ResultadoDaConclusao>("POST", `/treinamentos/tentativas/${tentativa.tentativa_id}/concluir`);
      setResultado(r);
      setEtapa("resultado");
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível concluir o treinamento.");
    } finally {
      setOcupado(false);
    }
  }

  async function enviarReporte() {
    const texto = textoDoReporte.trim();
    if (!texto) return;
    setOcupado(true);
    try {
      await chamar("POST", `/treinamentos/${p.atividadeCodigo}/reportes`, { fase: etapa === "jogo" ? faseAtual : null, texto });
      setReportando(false);
      setTextoDoReporte("");
    } catch {
      setErro("Não foi possível enviar o reporte.");
    } finally {
      setOcupado(false);
    }
  }

  function refazer() {
    setResultado(null);
    setTentativa(null);
    setPasso(0);
    setEtapa("abertura");
  }

  // ---- Abertura ---------------------------------------------------------------------------------------------------

  if (etapa === "abertura") {
    return (
      <div className="stack g14" style={{ maxWidth: 560 }}>
        {p.cenarioPath && <ImagemDoTreinamento arquivoId={p.cenarioPath} alt={`Cenário de ${p.descricao}`} />}
        <div className="row g12" style={{ alignItems: "flex-start" }}>
          <AvatarVitoria expressao="feliz" tamanho={56} />
          <div className="stack g6">
            <h2 style={{ fontSize: 17 }}>Treinamento: {p.descricao}</h2>
            <span className="small muted">Duração estimada: ~{duracaoEstimada(p.explicacao.length, 1)} min</span>
            {p.assinadoPor && (
              <span className="small muted">
                Revisado e assinado por {p.assinadoPor}
                {p.assinadoEm ? ` em ${data(p.assinadoEm)}` : ""}.
              </span>
            )}
          </div>
        </div>
        {erro && (
          <Notice tone="blq" icon="alert">
            {erro}
          </Notice>
        )}
        <div className="row g8 wrap">
          <Button variant="p" disabled={ocupado} onClick={() => (p.jaConcluiu ? comecar() : setEtapa("explicacao"))}>
            {ocupado ? "Abrindo…" : p.jaConcluiu ? "Jogar" : "Começar"}
          </Button>
          {p.jaConcluiu && (
            <Button variant="line" disabled={ocupado} onClick={() => setEtapa("explicacao")}>
              Rever a explicação
            </Button>
          )}
          {p.aoFechar && (
            <Button variant="line" onClick={p.aoFechar}>
              Fechar
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ---- Parte 1: a Vitória explicando --------------------------------------------------------------------------------

  if (etapa === "explicacao") {
    const atual = p.explicacao[passo];
    if (!atual) {
      return (
        <Notice tone="al" icon="alert">
          Este treinamento ainda não tem passos de explicação.
        </Notice>
      );
    }
    const ultimo = passo === p.explicacao.length - 1;
    return (
      <div className="stack g14" style={{ maxWidth: 560 }}>
        <div className="row g12" style={{ alignItems: "flex-start" }}>
          <AvatarVitoria expressao={atual.expressao} tamanho={64} />
          <p style={{ fontSize: 15.5, lineHeight: 1.5 }}>{atual.texto}</p>
        </div>
        {atual.imagem_path && <ImagemDoTreinamento arquivoId={atual.imagem_path} alt={`Passo ${passo + 1}`} />}
        <span className="small muted">
          Passo {passo + 1} de {p.explicacao.length}
        </span>
        {erro && (
          <Notice tone="blq" icon="alert">
            {erro}
          </Notice>
        )}
        <div className="row g8">
          <Button variant="line" disabled={passo === 0} onClick={() => setPasso((n) => n - 1)}>
            Voltar
          </Button>
          <Button variant="p" disabled={ocupado} onClick={() => (ultimo ? comecar() : setPasso((n) => n + 1))}>
            {ocupado ? "Abrindo…" : ultimo ? "Começar o jogo" : "Próximo"}
          </Button>
        </div>
      </div>
    );
  }

  // ---- Parte 2: o jogo -----------------------------------------------------------------------------------------------

  if (etapa === "jogo" && tentativa) {
    const fase = tentativa.fases[faseAtual];
    if (!fase) return null;
    return (
      <div className="stack g14" style={{ maxWidth: 560 }}>
        <div className="row between" style={{ alignItems: "center" }}>
          <span className="small muted">
            Fase {faseAtual + 1} de {tentativa.fases.length}
          </span>
          <Button variant="line" sm onClick={() => setReportando((r) => !r)}>
            Reportar problema
          </Button>
        </div>
        {reportando && (
          <div className="stack g8">
            <textarea className="input" rows={2} placeholder="O que parece errado nesta fase?" value={textoDoReporte} onChange={(e) => setTextoDoReporte(e.target.value)} />
            <div className="row g8">
              <Button variant="p" sm disabled={ocupado || !textoDoReporte.trim()} onClick={enviarReporte}>
                Enviar
              </Button>
              <Button variant="line" sm onClick={() => setReportando(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        )}
        {!feedback ? (
          <FaseJogavel fase={fase} aoResponder={responderFase} desabilitado={ocupado} />
        ) : (
          <div className="stack g12">
            <div className="row g10" style={{ alignItems: "flex-start" }}>
              <AvatarVitoria expressao={feedback.certa ? "feliz" : "ops"} tamanho={56} />
              <div className="stack g6">
                <strong>{feedback.certa ? "Isso mesmo!" : "Não foi dessa vez."}</strong>
                <p style={{ fontSize: 14 }}>{feedback.explicacao}</p>
                {feedback.gabarito.consequencia_correta && !feedback.certa && <p className="small muted">O certo era: {feedback.gabarito.consequencia_correta}</p>}
              </div>
            </div>
            <Button variant="p" disabled={ocupado} onClick={proximaFase}>
              {ocupado ? "Enviando…" : faseAtual + 1 < tentativa.fases.length ? "Próxima fase" : "Ver resultado"}
            </Button>
          </div>
        )}
        {erro && (
          <Notice tone="blq" icon="alert">
            {erro}
          </Notice>
        )}
      </div>
    );
  }

  // ---- Resultado ----------------------------------------------------------------------------------------------------

  if (etapa === "resultado" && resultado) {
    return (
      <div className="stack g14" style={{ maxWidth: 560 }}>
        <div className="row g12" style={{ alignItems: "flex-start" }}>
          <AvatarVitoria expressao="comemorando" tamanho={64} />
          <div className="stack g6">
            <h2 style={{ fontSize: 17 }}>Treinamento concluído!</h2>
            <p>
              Você acertou {resultado.fases_certas} de {resultado.total_fases} fases.
            </p>
            {p.pontua && <PontosGanhos resposta={resultado} />}
          </div>
        </div>
        <div className="row g8">
          <Button variant="p" onClick={refazer}>
            Refazer
          </Button>
          {p.aoFechar && (
            <Button variant="line" onClick={p.aoFechar}>
              Fechar
            </Button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
