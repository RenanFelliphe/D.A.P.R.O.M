"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { MensagemDeErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ImagemArquivo } from "@/components/ui/ImagemArquivo";
import { cx } from "@/lib/cx";
import { urlDoQuadroDaReacao } from "@/lib/reacao-vitoria";
import { rotas } from "@/lib/rotas";
import { LIMITES, REACOES_DO_PASSO, novoPasso, reacaoNormal, type PassoExplicacao, type RascunhoDoEditor } from "@/lib/treinamento-servico";
import { reacaoDaExpressao } from "@/lib/vitoria";
import { VitoriaNaCena } from "../vitoria/VitoriaNaCena";
import { AvisoDeVersaoNova } from "./AvisoDeVersaoNova";
import { BarraDoRascunho } from "./BarraDoRascunho";
import { CampoDeImagem } from "./CampoDeImagem";
import { BotoesDoItem } from "./BotoesDoItem";
import { OrigemDaVitoria, SeloDoItem } from "./OrigemDaVitoria";
import { mover, useRascunho, type Rascunho } from "./useRascunho";

interface EditorDaExplicacaoProps {
  codigo: string;
  descricao: string;
  rascunho: RascunhoDoEditor;
}

/**
 * Parte 1 do treinamento (aba Explicação): a imagem do cenário e os passos que a Vitória fala, até 12. Ao lado, a prévia do
 * passo em que o admin está, do jeito que o técnico vai ver; embaixo, a barra para salvar, testar e seguir para as fases.
 */
export function EditorDaExplicacao({ codigo, descricao, rascunho: inicial }: EditorDaExplicacaoProps) {
  const r = useRascunho(codigo, inicial);
  const passos = r.conteudo.explicacao;
  const [foco, setFoco] = useState(0);
  const passoEmFoco = passos[Math.min(foco, passos.length - 1)];

  // "Editar" na revisão leva a `#passo-3`: rola até o passo e o deixa em foco na prévia.
  useEffect(() => {
    const m = /^#passo-(\d+)$/.exec(window.location.hash);
    if (!m) return;
    const alvo = document.getElementById(`passo-${m[1]}`);
    alvo?.scrollIntoView({ behavior: "smooth", block: "center" });
    alvo?.querySelector<HTMLElement>("textarea")?.focus({ preventScroll: true });
  }, []);

  function adicionar() {
    r.mudarExplicacao((atual) => [...atual, novoPasso(atual.length)]);
    setFoco(passos.length);
    // Leva ao passo novo depois de desenhado.
    window.setTimeout(() => {
      const alvo = document.getElementById(`passo-${passos.length + 1}`);
      alvo?.scrollIntoView({ behavior: "smooth", block: "center" });
      alvo?.querySelector<HTMLElement>("textarea")?.focus({ preventScroll: true });
    }, 50);
  }

  return (
    <div className="ts-editor">
      <AvisoDeVersaoNova rascunho={inicial} />
      <div className="ts-editor-grade">
        <div className="ts-editor-principal">
          <section className="panel ts-secao">
            <div className="ts-secao-cab">
              <div>
                <h2>Abertura</h2>
                <p className="muted">A imagem aparece no topo da capa do treinamento, antes da explicação.</p>
              </div>
            </div>
            <CampoDeImagem
              larga
              rotulo="Imagem do cenário (opcional)"
              ajuda="Uma foto do local ou do equipamento do serviço. Fica melhor na horizontal."
              arquivoId={r.conteudo.cenario_path}
              aoMudar={r.mudarCenario}
            />
          </section>

          <section className="ts-secao-lista" aria-labelledby="titulo-passos">
            <div className="ts-secao-cab">
              <div>
                <h2 id="titulo-passos">Passos da explicação</h2>
                <p className="muted">Cada passo é uma fala da Vitória. Frases curtas, uma ideia por passo, na ordem do serviço.</p>
              </div>
              <span className="ts-contagem">
                {passos.length} de {LIMITES.passos}
              </span>
            </div>

            {passos.length === 0 ? (
              <div className="ts-vazio">
                <Icon name="chat" size={24} />
                <strong>Nenhum passo ainda</strong>
                <span className="small">Comece pelo que o técnico precisa saber antes de chegar ao local.</span>
              </div>
            ) : (
              <ol className="ts-lista-itens">
                {passos.map((passo, i) => (
                  <PassoEditavel key={i} r={r} passo={passo} indice={i} total={passos.length} emFoco={foco === i} aoFocar={() => setFoco(i)} />
                ))}
              </ol>
            )}

            <button type="button" className="ts-adicionar" onClick={adicionar} disabled={passos.length >= LIMITES.passos}>
              <Icon name="plus" size={16} />
              {passos.length >= LIMITES.passos ? "Limite de 12 passos atingido" : "Adicionar passo"}
            </button>
          </section>
        </div>

        <aside className="ts-editor-lado" aria-label="Prévia e dicas">
          <section className="panel ts-previa">
            <span className="lbl">Prévia {passoEmFoco ? `do passo ${Math.min(foco, passos.length - 1) + 1}` : ""}</span>
            {passoEmFoco ? (
              <>
                <VitoriaNaCena
                  chave={`previa-${foco}-${passoEmFoco.expressao}`}
                  reacao={reacaoDaExpressao(passoEmFoco.expressao)}
                  tamanho={84}
                  tom={passoEmFoco.expressao === "alerta" ? "destaque" : undefined}
                >
                  <p className="ts-fala-previa">{passoEmFoco.texto.trim() || "O texto do passo aparece aqui."}</p>
                </VitoriaNaCena>
                {passoEmFoco.imagem_path && (
                  <figure className="ts-explicacao-imagem ts-previa-imagem">
                    <ImagemArquivo id={passoEmFoco.imagem_path} alt="Imagem do passo" />
                  </figure>
                )}
              </>
            ) : (
              <p className="small">Adicione um passo para ver como a Vitória vai falar.</p>
            )}
          </section>
          <section className="panel ts-dicas">
            <h3>Dicas</h3>
            <ul>
              <li>Use a reação <strong>Atenção</strong> nos cuidados de segurança: a Vitória levanta o dedo.</li>
              <li>Escreva o comportamento seguro (&ldquo;feche a válvula e afaste as pessoas&rdquo;), não os itens da APR.</li>
              <li>Uma imagem do equipamento ajuda no passo que fala dele.</li>
            </ul>
          </section>
        </aside>
      </div>

      <BarraDoRascunho codigo={codigo} descricao={descricao} rascunho={r} proximo={{ rotulo: "Fases do jogo", href: rotas.app.treinamentoServico(codigo, "fases") }} />
    </div>
  );
}

function PassoEditavel({ r, passo, indice, total, emFoco, aoFocar }: { r: Rascunho; passo: PassoExplicacao; indice: number; total: number; emFoco: boolean; aoFocar: () => void }) {
  const problemas = r.problemasDo("passo", indice);
  const idTexto = `passo-${indice + 1}-texto`;

  return (
    <li id={`passo-${indice + 1}`} className={cx("ts-item-editor", emFoco && "ts-item-foco", problemas.length > 0 && "ts-item-problema")} onFocusCapture={aoFocar} onClick={aoFocar}>
      <div className="ts-item-cab">
        <span className="ts-item-num">{indice + 1}</span>
        <strong className="ts-item-titulo">Passo {indice + 1}</strong>
        <SeloDoItem item={passo} />
        <BotoesDoItem
          nome={`passo ${indice + 1}`}
          primeiro={indice === 0}
          ultimo={indice === total - 1}
          aoSubir={() => r.mudarExplicacao((a) => mover(a, indice, -1))}
          aoDescer={() => r.mudarExplicacao((a) => mover(a, indice, 1))}
          aoTirar={() => r.mudarExplicacao((a) => a.filter((_, k) => k !== indice))}
        />
      </div>

      <div className="field">
        <label htmlFor={idTexto}>O que a Vitória diz</label>
        <textarea
          id={idTexto}
          className="textarea"
          rows={3}
          maxLength={LIMITES.textoDoPasso}
          value={passo.texto}
          placeholder="Ex.: Antes de abrir o abrigo, confira o endereço e o número do medidor com a OS."
          aria-invalid={problemas.length > 0 || undefined}
          onChange={(e) => r.mudarPasso(indice, { texto: e.target.value })}
        />
        <span className="ts-contador small">
          {passo.texto.length}/{LIMITES.textoDoPasso}
        </span>
      </div>

      <fieldset className="ts-reacoes">
        <legend>Reação da Vitória ao mostrar o passo</legend>
        <div className="ts-reacoes-opcoes">
          {REACOES_DO_PASSO.map((op) => {
            const marcada = op.expressao === "explicando" ? reacaoNormal(passo.expressao) : passo.expressao === op.expressao;
            const reacao = reacaoDaExpressao(op.expressao);
            return (
              <label key={op.expressao} className="ts-reacao" data-marcada={marcada || undefined} title={op.dica}>
                <input
                  type="radio"
                  className="sr"
                  name={`reacao-${indice}`}
                  checked={marcada}
                  // "Normal" com uma das expressões calmas já marcada não muda nada (e não marca o item da Vitória como editado).
                  onChange={() => !(op.expressao === "explicando" && reacaoNormal(passo.expressao)) && r.mudarPasso(indice, { expressao: op.expressao })}
                />
                <Image src={reacao ? urlDoQuadroDaReacao(reacao) : "/vitoria/icone.webp"} alt="" width={40} height={40} unoptimized />
                <span>{op.rotulo}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <CampoDeImagem
        rotulo="Imagem do passo (opcional)"
        ajuda="Aparece abaixo da fala da Vitória."
        arquivoId={passo.imagem_path}
        aoMudar={(id) => r.mudarPasso(indice, { imagem_path: id })}
      />

      <OrigemDaVitoria item={passo} aoConfirmar={() => passo.ia && r.mudarPasso(indice, { ia: { ...passo.ia, conferido: true } })} />

      {problemas.map((m) => (
        <MensagemDeErro key={m}>{m}</MensagemDeErro>
      ))}
    </li>
  );
}

