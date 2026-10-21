"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Button, LinkButton } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { Notice } from "@/components/ui/Notice";
import { JanelaModal } from "@/components/web/JanelaModal";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { REACOES_DO_PASSO, infoDoTipo, reacaoNormal, termoDePublicacao, type ExpressaoVitoria } from "@/lib/treinamento-servico";
import { motivoDeNaoDecidir, type RespostaDaAprovacao, type RespostaDaRecusa, type ValidacaoDoTreinamento } from "@/lib/treinamento-validacao";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { AndamentoDaValidacao } from "./AndamentoDaValidacao";
import { BotaoTestar } from "./BotaoTestar";
import { GabaritoDaFase } from "./GabaritoDaFase";

interface ValidarTreinamentoProps {
  codigo: string;
  descricao: string;
  /** `null` quando a pessoa não participa de nenhuma validação deste treinamento (ou ela já terminou). */
  validacao: ValidacaoDoTreinamento | null;
  /** O nome de cada material (os do serviço e os do catálogo), para as fases do Selecione com os materiais do serviço. */
  nomes: Record<string, string>;
  assinaturaPath: string | null;
}

const MINIMO_DO_MOTIVO = 10;

const rotuloDaReacao = (expressao: ExpressaoVitoria) => (reacaoNormal(expressao) ? "Normal" : (REACOES_DO_PASSO.find((r) => r.expressao === expressao)?.rotulo ?? "Normal"));

/**
 * A tela de quem valida o treinamento (`validacao-de-treinamento.md`): o treinamento inteiro como o técnico vai ver, com a resposta
 * certa de cada fase, o andamento da rodada e as duas decisões. Aprovar usa a assinatura do perfil e, se completar as assinaturas
 * necessárias, publica; recusar pede o motivo e devolve o treinamento a quem o criou. Só leitura: corrigir é com o autor.
 */
export function ValidarTreinamento({ codigo, descricao, validacao, nomes, assinaturaPath }: ValidarTreinamentoProps) {
  const roteador = useRouter();
  const [assinando, setAssinando] = useState(false);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [faltaMotivo, setFaltaMotivo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** O que aconteceu com a decisão que a pessoa acabou de dar: a página recarrega sem o treinamento em validação, então a tela guarda o desfecho. */
  const [desfecho, setDesfecho] = useState<{ tipo: "publicada"; versao: number } | { tipo: "aprovou" } | { tipo: "devolvido" } | null>(null);
  const termo = termoDePublicacao(codigo, descricao);

  if (desfecho?.tipo === "publicada") {
    return (
      <section className="panel ts-publicado" role="status">
        <div className="ts-confetes" aria-hidden="true">
          {Array.from({ length: 22 }, (_, i) => (
            <i key={i} style={{ "--i": i } as React.CSSProperties} />
          ))}
        </div>
        <VitoriaNaCena chave="validado" reacao="comemorando" tamanho={150} empilhada>
          <strong className="ts-balao-titulo">Foi a sua assinatura que faltava!</strong>
          <p>A versão {desfecho.versao} do treinamento está no ar para os técnicos. Obrigada por validar.</p>
        </VitoriaNaCena>
        <div className="row g8 wrap ts-centro">
          <LinkButton variant="p" href={rotas.app.treinamentosParaValidar}>
            Voltar aos treinamentos para validar
          </LinkButton>
          <LinkButton variant="line" href={rotas.app.catalogo}>
            Ir ao catálogo
          </LinkButton>
        </div>
      </section>
    );
  }

  if (desfecho) {
    const devolvido = desfecho.tipo === "devolvido";
    return (
      <section className="panel ts-sem-rascunho" role="status">
        <VitoriaNaCena chave={`desfecho-${desfecho.tipo}`} reacao={devolvido ? "atencao" : "certo"} tamanho={96}>
          <strong className="ts-balao-titulo">{devolvido ? "Devolvido ao autor" : "Assinatura registrada"}</strong>
          <p>
            {devolvido
              ? "O treinamento voltou para quem o criou, com o seu motivo. Ele ajusta e envia de novo, e os validadores são escolhidos outra vez."
              : "A sua aprovação foi registrada. O treinamento publica quando as assinaturas necessárias se completarem."}
          </p>
        </VitoriaNaCena>
        <div className="row g8 wrap">
          <LinkButton variant="p" href={rotas.app.treinamentosParaValidar}>
            Voltar aos treinamentos para validar
          </LinkButton>
        </div>
      </section>
    );
  }

  if (!validacao) {
    return (
      <section className="panel ts-sem-rascunho">
        <VitoriaNaCena chave="sem-validacao" tamanho={84}>
          <strong className="ts-balao-titulo">Não há validação para você aqui</strong>
          <p>Este treinamento não está esperando a sua decisão. Pode ser que já tenha sido publicado ou devolvido.</p>
        </VitoriaNaCena>
        <div className="row g8 wrap">
          <LinkButton variant="p" href={rotas.app.treinamentosParaValidar}>
            Treinamentos para validar
          </LinkButton>
        </div>
      </section>
    );
  }

  const { rascunho } = validacao;
  const nomeDoMaterial = (id: string) => nomes[id] ?? "Material fora da lista";
  const semDecisao = motivoDeNaoDecidir(validacao);

  async function aprovar() {
    const r = await chamar<RespostaDaAprovacao>("POST", `/treinamentos/${encodeURIComponent(codigo)}/validacao/aprovar`);
    setDesfecho(r.publicada ? { tipo: "publicada", versao: r.versao } : { tipo: "aprovou" });
  }

  async function recusar() {
    if (motivo.trim().length < MINIMO_DO_MOTIVO) {
      setFaltaMotivo(true);
      return;
    }
    setFaltaMotivo(false);
    setEnviando(true);
    setErro(null);
    try {
      await chamar<RespostaDaRecusa>("POST", `/treinamentos/${encodeURIComponent(codigo)}/validacao/recusar`, { motivo: motivo.trim() });
      setRecusando(false);
      setDesfecho({ tipo: "devolvido" });
      roteador.refresh();
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="ts-editor">
      <section className="panel ts-revisao-topo">
        <VitoriaNaCena chave="validar" reacao={semDecisao ? null : "atencao"} tamanho={92}>
          <strong className="ts-balao-titulo">{semDecisao ? "Treinamento em validação" : "Confira o treinamento antes de assinar"}</strong>
          <p>
            {semDecisao ?? "Leia a explicação e as respostas certas de cada fase e jogue o teste. Você responde por ele ao aprovar: se algo estiver errado, recuse e diga o que corrigir."}
          </p>
        </VitoriaNaCena>
        <dl className="ts-numeros">
          <div>
            <dt>Versão</dt>
            <dd>{validacao.versao}</dd>
          </div>
          <div>
            <dt>Passos</dt>
            <dd>{rascunho.explicacao.length}</dd>
          </div>
          <div>
            <dt>Fases</dt>
            <dd>{rascunho.fases.length}</dd>
          </div>
        </dl>
      </section>

      <div className="ts-editor-grade">
        <div className="ts-editor-principal">
          <section className="ts-secao-lista">
            <div className="ts-secao-cab">
              <h2>Parte 1 · Explicação</h2>
            </div>
            <ol className="ts-lista-itens">
              {rascunho.explicacao.map((passo, i) => (
                <li key={i} className="ts-item-editor ts-revisao-item">
                  <div className="ts-item-cab">
                    <span className="ts-item-num">{i + 1}</span>
                    <strong className="ts-item-titulo">Passo {i + 1}</strong>
                  </div>
                  <div className="ts-revisao-passo">
                    <span className="ts-chip">Reação: {rotuloDaReacao(passo.expressao)}</span>
                    <p>{passo.texto}</p>
                    {passo.imagem_path && (
                      <span className="ts-revisao-imagem">
                        <ImagemArquivo id={passo.imagem_path} alt={`Imagem do passo ${i + 1}`} />
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="ts-secao-lista">
            <div className="ts-secao-cab">
              <h2>Parte 2 · Jogo</h2>
            </div>
            <ol className="ts-lista-itens">
              {rascunho.fases.map((fase, i) => (
                <li key={i} className="ts-item-editor ts-revisao-item">
                  <div className="ts-item-cab">
                    <span className="ts-item-num">{i + 1}</span>
                    <strong className="ts-item-titulo">
                      Fase {i + 1} · {infoDoTipo(fase.tipo).rotulo}
                    </strong>
                  </div>
                  <GabaritoDaFase fase={fase} nomeDoMaterial={nomeDoMaterial} />
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="ts-editor-lado" aria-label="Andamento e decisão">
          <section className="panel ts-proximos" aria-labelledby="titulo-validacao-andamento">
            <h3 id="titulo-validacao-andamento">Andamento da validação</h3>
            <AndamentoDaValidacao validacao={validacao} />
          </section>

          <section className="panel ts-proximos ts-validar-acoes" aria-labelledby="titulo-validacao-decisao">
            <h3 id="titulo-validacao-decisao">A sua decisão</h3>
            <div className="stack g8">
              <BotaoTestar codigo={codigo} descricao={descricao} conteudo={rascunho} block />
              {semDecisao ? (
                <Notice tone="info" icon="info">
                  {semDecisao}
                </Notice>
              ) : (
                <>
                  <Button variant="p" block onClick={() => setAssinando(true)}>
                    <Icon name="shield" size={16} />
                    Aprovar e assinar
                  </Button>
                  <Button variant="od" block onClick={() => setRecusando(true)}>
                    <Icon name="x" size={16} />
                    Recusar e devolver
                  </Button>
                  <span className="small muted">Uma recusa devolve o treinamento ao autor e encerra esta rodada, mesmo que outros já tenham aprovado.</span>
                </>
              )}
            </div>
          </section>
        </aside>
      </div>

      {assinando && (
        <JanelaDeAssinatura
          titulo="Aprovar o treinamento"
          resumo={termo}
          rotuloConfirmar="Assinar e aprovar"
          assinaturaPath={assinaturaPath}
          aoConfirmar={aprovar}
          aoFechar={() => setAssinando(false)}
        >
          <p className="small">
            Ao assinar você responde pelo conteúdo desta versão. Com {validacao.necessarias} {validacao.necessarias === 1 ? "assinatura" : "assinaturas"}, ele vai ao ar sozinho
            {validacao.aprovacoes + 1 >= validacao.necessarias ? ": a sua é a que completa." : "."}
          </p>
        </JanelaDeAssinatura>
      )}

      {recusando && (
        <JanelaModal titulo="Recusar e devolver ao autor" aoFechar={() => setRecusando(false)}>
          <div className="stack g8">
            <p>Diga o que precisa ser corrigido: o autor lê o seu motivo e envia de novo depois de ajustar.</p>
            <Field label="Motivo da recusa (obrigatório)" htmlFor="motivo-recusa" erro={faltaMotivo ? `Explique o que corrigir (ao menos ${MINIMO_DO_MOTIVO} caracteres).` : undefined}>
              <textarea
                id="motivo-recusa"
                className="textarea"
                rows={4}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: na fase 3 a resposta certa deveria ser a segunda opção, pelo procedimento"
              />
            </Field>
            {erro && (
              <Notice tone="blq" icon="alert" role="alert">
                {erro}
              </Notice>
            )}
            <div className="row g8 wrap">
              <Button variant="d" onClick={() => void recusar()} disabled={enviando} aria-busy={enviando}>
                {enviando ? "Devolvendo…" : "Recusar e devolver"}
              </Button>
              <Button variant="ghost" onClick={() => setRecusando(false)} disabled={enviando}>
                Voltar
              </Button>
            </div>
          </div>
        </JanelaModal>
      )}
    </div>
  );
}
