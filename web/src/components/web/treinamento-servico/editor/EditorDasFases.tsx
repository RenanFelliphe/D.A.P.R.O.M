"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { MensagemDeErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { cx } from "@/lib/cx";
import { rotas } from "@/lib/rotas";
import { LIMITES, TIPOS_DE_FASE, faseEmBranco, infoDoTipo, tituloDaFase, umDeCada, type Fase, type RascunhoDoEditor, type TipoDeFase } from "@/lib/treinamento-servico";
import { AvisoDeVersaoNova } from "./AvisoDeVersaoNova";
import { BarraDoRascunho } from "./BarraDoRascunho";
import { BotoesDoItem } from "./BotoesDoItem";
import { EditorFase, type MaterialDaFase } from "./EditorFase";
import { OrigemDaVitoria, SeloDoItem } from "./OrigemDaVitoria";
import { mover, useRascunho, type Rascunho } from "./useRascunho";

interface EditorDasFasesProps {
  codigo: string;
  descricao: string;
  rascunho: RascunhoDoEditor;
  materiaisDoServico: MaterialDaFase[];
  /** Todos os materiais ativos conhecidos (os do serviço e os do catálogo), pelo id. */
  nomes: Record<string, string>;
}

/**
 * Parte 2 do treinamento (aba Fases do jogo): ao menos 3 fases para publicar (sem máximo), cada uma de um dos 11 minijogos. Uma fase aberta
 * por vez, para a lista não virar um paredão de campos; o tipo da fase nova é escolhido num cartão com a explicação de cada um.
 */
export function EditorDasFases({ codigo, descricao, rascunho: inicial, materiaisDoServico, nomes }: EditorDasFasesProps) {
  const r = useRascunho(codigo, inicial);
  const fases = r.conteudo.fases;
  const [aberta, setAberta] = useState<number | null>(null);
  const [escolhendoTipo, setEscolhendoTipo] = useState(fases.length === 0);
  const nomeDoMaterial = (id: string) => nomes[id] ?? "Material fora da lista";

  // "Editar" na revisão leva a `#fase-3`: abre a fase e rola até ela.
  useEffect(() => {
    const m = /^#fase-(\d+)$/.exec(window.location.hash);
    if (!m) return;
    const indice = Number(m[1]) - 1;
    const id = window.setTimeout(() => {
      setAberta(indice);
      document.getElementById(`fase-${indice + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  // Depois de tentar salvar com campos vazios, abre a primeira fase incompleta.
  const primeiraComProblema = r.mostrarProblemas ? r.problemas.find((p) => p.parte === "fase")?.indice : undefined;
  useEffect(() => {
    if (primeiraComProblema === undefined) return;
    const id = window.setTimeout(() => {
      setAberta(primeiraComProblema);
      document.getElementById(`fase-${primeiraComProblema + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
    return () => window.clearTimeout(id);
  }, [primeiraComProblema]);

  function adicionar(tipo: TipoDeFase) {
    r.mudarFases((atual) => [...atual, faseEmBranco(tipo)]);
    setAberta(fases.length);
    setEscolhendoTipo(false);
    window.setTimeout(() => document.getElementById(`fase-${fases.length + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  /** "1 de cada": acrescenta uma fase em branco de cada minijogo, em ordem aleatória, e abre a primeira delas. */
  function adicionarUmDeCada() {
    r.mudarFases((atual) => [...atual, ...umDeCada().map(faseEmBranco)]);
    setAberta(fases.length);
    setEscolhendoTipo(false);
    window.setTimeout(() => document.getElementById(`fase-${fases.length + 1}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const contagemPorTipo = (tipo: TipoDeFase) => fases.filter((f) => f.tipo === tipo).length;
  const faltam = Math.max(0, LIMITES.fasesParaPublicar - fases.length);

  return (
    <div className="ts-editor">
      <AvisoDeVersaoNova rascunho={inicial} />
      <div className="ts-editor-grade">
        <div className="ts-editor-principal">
          <section className="ts-secao-lista" aria-labelledby="titulo-fases">
            <div className="ts-secao-cab">
              <div>
                <h2 id="titulo-fases">Fases do jogo</h2>
                <p className="muted">
                  As fases aparecem nesta ordem. {faltam > 0 ? `Faltam ${faltam} para poder publicar (mínimo de ${LIMITES.fasesParaPublicar}).` : "Cada fase vale tudo ou nada."}
                </p>
              </div>
              <span className="ts-contagem">{fases.length === 1 ? "1 fase" : `${fases.length} fases`}</span>
            </div>

            {fases.length === 0 && !escolhendoTipo && (
              <div className="ts-vazio">
                <Icon name="play" size={24} />
                <strong>Nenhuma fase ainda</strong>
                <span className="small">Monte ao menos 3 fases sobre o que a explicação ensinou, ou comece com “1 de cada”.</span>
              </div>
            )}

            {fases.length > 0 && (
              <ol className="ts-lista-itens">
                {fases.map((fase, i) => (
                  <FaseEditavel
                    key={i}
                    r={r}
                    fase={fase}
                    indice={i}
                    total={fases.length}
                    aberta={aberta === i}
                    aoAlternar={() => setAberta(aberta === i ? null : i)}
                    aoMover={(sentido) => {
                      r.mudarFases((a) => mover(a, i, sentido));
                      if (aberta === i) setAberta(i + sentido);
                    }}
                    aoTirar={() => {
                      r.mudarFases((a) => a.filter((_, k) => k !== i));
                      setAberta(null);
                    }}
                    materiaisDoServico={materiaisDoServico}
                    nomeDoMaterial={nomeDoMaterial}
                  />
                ))}
              </ol>
            )}

            {escolhendoTipo ? (
              <SeletorDeTipo aoEscolher={adicionar} aoUmDeCada={adicionarUmDeCada} aoCancelar={fases.length > 0 ? () => setEscolhendoTipo(false) : undefined} />
            ) : (
              <button type="button" className="ts-adicionar" onClick={() => setEscolhendoTipo(true)} disabled={fases.length >= LIMITES.fases}>
                <Icon name="plus" size={16} />
                Adicionar fase
              </button>
            )}
          </section>
        </div>

        <aside className="ts-editor-lado" aria-label="Tipos de fase">
          <section className="panel ts-dicas">
            <h3>Os tipos de fase</h3>
            <ul className="ts-tipos-resumo">
              {TIPOS_DE_FASE.map((t) => (
                <li key={t.tipo}>
                  <span className="ts-tipo-icone" data-jogo={t.tipo}>
                    <Icon name={t.icone} size={16} />
                  </span>
                  <span className="stack g4">
                    <strong>
                      {t.rotulo}
                      {contagemPorTipo(t.tipo) > 0 && <span className="ts-tipo-qtd">{contagemPorTipo(t.tipo)}</span>}
                    </strong>
                    <span className="ts-tipo-frase" data-jogo={t.tipo}>
                      {t.frase}
                    </span>
                    <span className="small">{t.descricao}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="small">Misturar minijogos deixa o jogo mais interessante. Tudo é por toque, sem arrastar, para funcionar no celular.</p>
          </section>
        </aside>
      </div>

      <BarraDoRascunho codigo={codigo} descricao={descricao} rascunho={r} proximo={{ rotulo: "Revisão", href: rotas.app.treinamentoServico(codigo, "revisao") }} />
    </div>
  );
}

function FaseEditavel({
  r,
  fase,
  indice,
  total,
  aberta,
  aoAlternar,
  aoMover,
  aoTirar,
  materiaisDoServico,
  nomeDoMaterial,
}: {
  r: Rascunho;
  fase: Fase;
  indice: number;
  total: number;
  aberta: boolean;
  aoAlternar: () => void;
  aoMover: (sentido: -1 | 1) => void;
  aoTirar: () => void;
  materiaisDoServico: MaterialDaFase[];
  nomeDoMaterial: (id: string) => string;
}) {
  const info = infoDoTipo(fase.tipo);
  const problemas = r.problemasDo("fase", indice);
  const titulo = tituloDaFase(fase).trim();
  const idCorpo = `fase-${indice + 1}-corpo`;

  return (
    <li id={`fase-${indice + 1}`} className={cx("ts-item-editor ts-fase-editor", aberta && "ts-item-foco", problemas.length > 0 && "ts-item-problema")}>
      <div className="ts-fase-linha">
        <button type="button" className="ts-fase-resumo" onClick={aoAlternar} aria-expanded={aberta} aria-controls={idCorpo}>
          <span className="ts-item-num">{indice + 1}</span>
          <span className="ts-tipo-icone" data-jogo={fase.tipo}>
            <Icon name={info.icone} size={16} />
          </span>
          <span className="ts-fase-resumo-texto">
            <span className="ts-fase-resumo-tipo">{info.rotulo}</span>
            <span className={cx("ts-fase-resumo-titulo", !titulo && "ts-sem-texto")}>{titulo || "Ainda sem enunciado"}</span>
          </span>
          <Icon name="down" size={16} className="ts-seta" />
        </button>
        <span className="ts-fase-selos">
          {problemas.length > 0 && <Badge tone="blq">Incompleta</Badge>}
          <SeloDoItem item={fase} />
        </span>
      </div>
      {aberta && (
        <div id={idCorpo} className="ts-fase-corpo">
          <EditorFase fase={fase} aoMudar={(nova) => r.mudarFase(indice, nova)} materiaisDoServico={materiaisDoServico} nomeDoMaterial={nomeDoMaterial} />
          <OrigemDaVitoria item={fase} aoConfirmar={() => fase.ia && r.mudarFase(indice, { ...fase, ia: { ...fase.ia, conferido: true } })} />
          {problemas.map((m) => (
            <MensagemDeErro key={m}>{m}</MensagemDeErro>
          ))}
          <div className="ts-fase-rodape">
            <BotoesDoItem nome={`fase ${indice + 1}`} primeiro={indice === 0} ultimo={indice === total - 1} aoSubir={() => aoMover(-1)} aoDescer={() => aoMover(1)} aoTirar={aoTirar} />
            <Button variant="ghost" sm onClick={aoAlternar}>
              Fechar a fase
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** A escolha do tipo da fase nova: um cartão por tipo, com o que ele pede de quem joga, nas cores de cada tipo. */
function SeletorDeTipo({ aoEscolher, aoUmDeCada, aoCancelar }: { aoEscolher: (tipo: TipoDeFase) => void; aoUmDeCada: () => void; aoCancelar?: () => void }) {
  return (
    <div className="ts-seletor-tipo panel">
      <div className="row between wrap g8">
        <h3>Que minijogo?</h3>
        <span className="row g8 wrap">
          <Button variant="line" sm onClick={aoUmDeCada} title={`Acrescenta ${TIPOS_DE_FASE.length} fases, uma de cada minijogo, em ordem aleatória`}>
            <Icon name="embaralhar" size={13} />1 de cada
          </Button>
          {aoCancelar && (
            <Button variant="ghost" sm onClick={aoCancelar}>
              Cancelar
            </Button>
          )}
        </span>
      </div>
      <div className="ts-seletor-grade">
        {TIPOS_DE_FASE.map((t, i) => (
          <button key={t.tipo} type="button" className="ts-tipo-cartao" data-jogo={t.tipo} style={{ "--i": i } as React.CSSProperties} onClick={() => aoEscolher(t.tipo)}>
            <span className="ts-tipo-icone ts-tipo-icone-grande" data-jogo={t.tipo}>
              <Icon name={t.icone} size={22} />
            </span>
            <strong>{t.rotulo}</strong>
            <span className="ts-tipo-frase" data-jogo={t.tipo}>
              {t.frase}
            </span>
            <span className="small">{t.descricao}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
