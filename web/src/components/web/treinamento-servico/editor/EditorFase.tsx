"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { chamar } from "@/lib/cliente-api";
import { cx } from "@/lib/cx";
import { LIMITES, letrasDaGrade, tentativasDoTermo, type Fase, type MateriaisDoSelecione } from "@/lib/treinamento-servico";

/** Um material que pode entrar no Selecione montado com os materiais do serviço: os do serviço primeiro, os outros pela busca. */
export interface MaterialDaFase {
  id: string;
  descricao: string;
  categoria: string;
}

interface EditorFaseProps {
  fase: Fase;
  aoMudar: (fase: Fase) => void;
  /** Os materiais da lista do serviço (o que o Selecione com os materiais do serviço costuma pedir). */
  materiaisDoServico: MaterialDaFase[];
  /** Nome de todo material conhecido pela tela, para mostrar o nome em vez do id. */
  nomeDoMaterial: (id: string) => string;
}

/** O editor de uma fase, pelo tipo: cada um edita o gabarito, que o jogador nunca vê antes de responder. */
export function EditorFase({ fase, aoMudar, materiaisDoServico, nomeDoMaterial }: EditorFaseProps) {
  const explicacao = (
    <CampoDeTexto
      rotulo="Explicação depois da resposta"
      ajuda="A Vitória mostra este texto acertando ou errando: diga por que a resposta certa é a certa."
      valor={fase.explicacao}
      limite={LIMITES.explicacao}
      linhas={2}
      aoMudar={(explicacao) => aoMudar({ ...fase, explicacao })}
    />
  );
  switch (fase.tipo) {
    case "quiz":
      return <EditorQuiz fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
    case "decisao":
      return <EditorDecisao fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
    case "ligar":
      return <EditorLigar fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
    case "ordem":
      return <EditorOrdem fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
    case "verdadeiro_falso":
      return <EditorVerdadeiroFalso fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
    case "caca_palavras":
      return <EditorCacaPalavras fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
    case "memoria":
      return <EditorMemoria fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
    case "selecione":
      return <EditorSelecione fase={fase} aoMudar={aoMudar} explicacao={explicacao} materiaisDoServico={materiaisDoServico} nomeDoMaterial={nomeDoMaterial} />;
    case "desembaralhe":
      return <EditorBancoDePalavras fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
    case "termo":
      return <EditorBancoDePalavras fase={fase} aoMudar={aoMudar} explicacao={explicacao} />;
  }
}

function CampoDeTexto({ rotulo, ajuda, valor, limite, linhas = 1, placeholder, aoMudar }: { rotulo: string; ajuda?: string; valor: string; limite: number; linhas?: number; placeholder?: string; aoMudar: (v: string) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{rotulo}</label>
      {ajuda && <span className="small">{ajuda}</span>}
      {linhas > 1 ? (
        <textarea id={id} className="textarea" rows={linhas} maxLength={limite} value={valor} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} />
      ) : (
        <input id={id} className="input" maxLength={limite} value={valor} placeholder={placeholder} onChange={(e) => aoMudar(e.target.value)} />
      )}
      {valor.length > limite * 0.8 && (
        <span className="ts-contador small">
          {valor.length}/{limite}
        </span>
      )}
    </div>
  );
}

/** O grupo de linhas editáveis (opções, pares, etapas) com o título, a dica e o botão de acrescentar. */
function Lista({ titulo, dica, children, rotuloAdicionar, podeAdicionar, aoAdicionar }: { titulo: string; dica: string; children: ReactNode; rotuloAdicionar: string; podeAdicionar: boolean; aoAdicionar: () => void }) {
  return (
    <fieldset className="ts-lista-campos">
      <legend>{titulo}</legend>
      <span className="small">{dica}</span>
      {children}
      {podeAdicionar && (
        <button type="button" className="ts-adicionar ts-adicionar-pequeno" onClick={aoAdicionar}>
          <Icon name="plus" size={13} />
          {rotuloAdicionar}
        </button>
      )}
    </fieldset>
  );
}

function BotaoTirar({ rotulo, aoTirar, visivel }: { rotulo: string; aoTirar: () => void; visivel: boolean }) {
  if (!visivel) return <span className="ts-tirar-espaco" aria-hidden="true" />;
  return (
    <button type="button" className="ibtn ts-ibtn-perigo" onClick={aoTirar} aria-label={rotulo} title={rotulo}>
      <Icon name="x" size={16} />
    </button>
  );
}

/** "Certa": marca qual opção é a resposta (uma só). */
function MarcaCerta({ nome, marcada, aoMarcar, rotulo }: { nome: string; marcada: boolean; aoMarcar: () => void; rotulo: string }) {
  return (
    <label className={cx("ts-certa", marcada && "ts-certa-marcada")} title={marcada ? "Esta é a resposta certa" : "Marcar como a resposta certa"}>
      <input type="radio" className="sr" name={nome} checked={marcada} onChange={aoMarcar} aria-label={rotulo} />
      <Icon name="check" size={13} />
      <span>{marcada ? "Certa" : "Marcar"}</span>
    </label>
  );
}

const tirarOpcao = (correta: number, i: number) => (correta > i ? correta - 1 : correta === i ? 0 : correta);

function EditorQuiz({ fase, aoMudar, explicacao }: { fase: Extract<Fase, { tipo: "quiz" }>; aoMudar: (f: Fase) => void; explicacao: ReactNode }) {
  const grupo = useId();
  return (
    <div className="ts-fase-campos">
      <CampoDeTexto rotulo="Pergunta" valor={fase.enunciado} limite={LIMITES.enunciado} linhas={2} placeholder="Ex.: Qual deve ser a pressão de saída do regulador?" aoMudar={(enunciado) => aoMudar({ ...fase, enunciado })} />
      <Lista
        titulo="Opções"
        dica="De 3 a 4 opções. Marque a certa; o jogo embaralha a ordem."
        rotuloAdicionar="Adicionar opção"
        podeAdicionar={fase.opcoes.length < LIMITES.opcoesMax}
        aoAdicionar={() => aoMudar({ ...fase, opcoes: [...fase.opcoes, ""] })}
      >
        {fase.opcoes.map((o, i) => (
          <div key={i} className={cx("ts-linha-opcao", fase.correta === i && "ts-linha-certa")}>
            <MarcaCerta nome={grupo} marcada={fase.correta === i} aoMarcar={() => aoMudar({ ...fase, correta: i })} rotulo={`Opção ${i + 1} é a certa`} />
            <input
              className="input"
              maxLength={LIMITES.opcao}
              value={o}
              placeholder={`Opção ${i + 1}`}
              aria-label={`Opção ${i + 1}`}
              onChange={(e) => aoMudar({ ...fase, opcoes: fase.opcoes.map((x, k) => (k === i ? e.target.value : x)) })}
            />
            <BotaoTirar
              rotulo={`Tirar a opção ${i + 1}`}
              visivel={fase.opcoes.length > LIMITES.opcoesMin}
              aoTirar={() => aoMudar({ ...fase, opcoes: fase.opcoes.filter((_, k) => k !== i), correta: tirarOpcao(fase.correta, i) })}
            />
          </div>
        ))}
      </Lista>
      {explicacao}
    </div>
  );
}

function EditorDecisao({ fase, aoMudar, explicacao }: { fase: Extract<Fase, { tipo: "decisao" }>; aoMudar: (f: Fase) => void; explicacao: ReactNode }) {
  const grupo = useId();
  const mudarOpcao = (i: number, parcial: Partial<{ texto: string; consequencia: string }>) => aoMudar({ ...fase, opcoes: fase.opcoes.map((x, k) => (k === i ? { ...x, ...parcial } : x)) });
  return (
    <div className="ts-fase-campos">
      <CampoDeTexto
        rotulo="Situação"
        valor={fase.situacao}
        limite={LIMITES.enunciado}
        linhas={2}
        placeholder="Ex.: Ao abrir a válvula, o detector apita perto da conexão nova."
        aoMudar={(situacao) => aoMudar({ ...fase, situacao })}
      />
      <Lista
        titulo="Atitudes e consequências"
        dica="De 3 a 4 atitudes. Marque a segura; a consequência aparece depois da resposta."
        rotuloAdicionar="Adicionar atitude"
        podeAdicionar={fase.opcoes.length < LIMITES.opcoesMax}
        aoAdicionar={() => aoMudar({ ...fase, opcoes: [...fase.opcoes, { texto: "", consequencia: "" }] })}
      >
        {fase.opcoes.map((o, i) => (
          <div key={i} className={cx("ts-cartao-opcao", fase.correta === i && "ts-linha-certa")}>
            <div className="ts-linha-opcao">
              <MarcaCerta nome={grupo} marcada={fase.correta === i} aoMarcar={() => aoMudar({ ...fase, correta: i })} rotulo={`Atitude ${i + 1} é a segura`} />
              <input className="input" maxLength={LIMITES.opcao} value={o.texto} placeholder={`Atitude ${i + 1}`} aria-label={`Atitude ${i + 1}`} onChange={(e) => mudarOpcao(i, { texto: e.target.value })} />
              <BotaoTirar
                rotulo={`Tirar a atitude ${i + 1}`}
                visivel={fase.opcoes.length > LIMITES.opcoesMin}
                aoTirar={() => aoMudar({ ...fase, opcoes: fase.opcoes.filter((_, k) => k !== i), correta: tirarOpcao(fase.correta, i) })}
              />
            </div>
            <input
              className="input ts-consequencia-campo"
              maxLength={LIMITES.consequencia}
              value={o.consequencia}
              placeholder="O que acontece se o técnico fizer isso"
              aria-label={`Consequência da atitude ${i + 1}`}
              onChange={(e) => mudarOpcao(i, { consequencia: e.target.value })}
            />
          </div>
        ))}
      </Lista>
      {explicacao}
    </div>
  );
}

function EditorLigar({ fase, aoMudar, explicacao }: { fase: Extract<Fase, { tipo: "ligar" }>; aoMudar: (f: Fase) => void; explicacao: ReactNode }) {
  const mudarPar = (i: number, parcial: Partial<{ esquerda: string; direita: string }>) => aoMudar({ ...fase, pares: fase.pares.map((x, k) => (k === i ? { ...x, ...parcial } : x)) });
  return (
    <div className="ts-fase-campos">
      <Lista
        titulo="Pares"
        dica="De 2 a 5 pares, cada item com o seu par certo. O jogo embaralha os dois lados."
        rotuloAdicionar="Adicionar par"
        podeAdicionar={fase.pares.length < LIMITES.paresMax}
        aoAdicionar={() => aoMudar({ ...fase, pares: [...fase.pares, { esquerda: "", direita: "" }] })}
      >
        {fase.pares.map((par, i) => (
          <div key={i} className="ts-linha-par">
            <input className="input" maxLength={LIMITES.opcao} value={par.esquerda} placeholder="Item (ex.: Detector de gás)" aria-label={`Par ${i + 1}, esquerda`} onChange={(e) => mudarPar(i, { esquerda: e.target.value })} />
            <span className="ts-par-elo" aria-hidden="true">
              <Icon name="link" size={13} />
            </span>
            <input className="input" maxLength={LIMITES.opcao} value={par.direita} placeholder="Par (ex.: Testar as conexões)" aria-label={`Par ${i + 1}, direita`} onChange={(e) => mudarPar(i, { direita: e.target.value })} />
            <BotaoTirar rotulo={`Tirar o par ${i + 1}`} visivel={fase.pares.length > LIMITES.paresMin} aoTirar={() => aoMudar({ ...fase, pares: fase.pares.filter((_, k) => k !== i) })} />
          </div>
        ))}
      </Lista>
      {explicacao}
    </div>
  );
}

function EditorOrdem({ fase, aoMudar, explicacao }: { fase: Extract<Fase, { tipo: "ordem" }>; aoMudar: (f: Fase) => void; explicacao: ReactNode }) {
  function moverEtapa(i: number, sentido: -1 | 1) {
    const destino = i + sentido;
    if (destino < 0 || destino >= fase.etapas.length) return;
    const etapas = [...fase.etapas];
    [etapas[i], etapas[destino]] = [etapas[destino]!, etapas[i]!];
    aoMudar({ ...fase, etapas });
  }
  return (
    <div className="ts-fase-campos">
      <CampoDeTexto
        rotulo="Enunciado"
        valor={fase.enunciado}
        limite={LIMITES.enunciado}
        placeholder="Ex.: Ponha em ordem a troca do regulador."
        aoMudar={(enunciado) => aoMudar({ ...fase, enunciado })}
      />
      <Lista
        titulo="Etapas, na ordem certa"
        dica="De 2 a 6 etapas, escritas já na sequência correta. O jogo embaralha."
        rotuloAdicionar="Adicionar etapa"
        podeAdicionar={fase.etapas.length < LIMITES.etapasMax}
        aoAdicionar={() => aoMudar({ ...fase, etapas: [...fase.etapas, ""] })}
      >
        {fase.etapas.map((etapa, i) => (
          <div key={i} className="ts-linha-etapa">
            <span className="ts-etapa-num">{i + 1}</span>
            <input
              className="input"
              maxLength={LIMITES.opcao}
              value={etapa}
              placeholder={`Etapa ${i + 1}`}
              aria-label={`Etapa ${i + 1}`}
              onChange={(e) => aoMudar({ ...fase, etapas: fase.etapas.map((x, k) => (k === i ? e.target.value : x)) })}
            />
            <span className="ts-etapa-mover">
              <button type="button" className="ibtn" onClick={() => moverEtapa(i, -1)} disabled={i === 0} aria-label={`Subir a etapa ${i + 1}`}>
                <Icon name="up" size={16} />
              </button>
              <button type="button" className="ibtn" onClick={() => moverEtapa(i, 1)} disabled={i === fase.etapas.length - 1} aria-label={`Descer a etapa ${i + 1}`}>
                <Icon name="down" size={16} />
              </button>
            </span>
            <BotaoTirar rotulo={`Tirar a etapa ${i + 1}`} visivel={fase.etapas.length > LIMITES.etapasMin} aoTirar={() => aoMudar({ ...fase, etapas: fase.etapas.filter((_, k) => k !== i) })} />
          </div>
        ))}
      </Lista>
      {explicacao}
    </div>
  );
}

// ---- Minijogos ------------------------------------------------------------------------------------------------------------

/** Duas escolhas lado a lado (o gabarito do verdadeiro ou falso, o modo do caça-palavras). */
function Escolhas<T extends string | boolean>({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: T;
  opcoes: { valor: T; rotulo: string; icone: IconName; dica?: string }[];
  aoMudar: (v: T) => void;
}) {
  const grupo = useId();
  return (
    <fieldset className="ts-lista-campos">
      <legend>{rotulo}</legend>
      <div className="ts-ed-escolhas" role="radiogroup">
        {opcoes.map((o) => (
          <label key={String(o.valor)} className="ts-ed-escolha" data-marcada={valor === o.valor || undefined} data-valor={String(o.valor)}>
            <input type="radio" className="sr" name={grupo} checked={valor === o.valor} onChange={() => aoMudar(o.valor)} />
            <span className="ts-ed-escolha-icone" aria-hidden="true">
              <Icon name={o.icone} size={16} />
            </span>
            <span className="ts-ed-escolha-texto">
              <strong>{o.rotulo}</strong>
              {o.dica && <span className="small">{o.dica}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function EditorVerdadeiroFalso({ fase, aoMudar, explicacao }: { fase: Extract<Fase, { tipo: "verdadeiro_falso" }>; aoMudar: (f: Fase) => void; explicacao: ReactNode }) {
  return (
    <div className="ts-fase-campos">
      <CampoDeTexto
        rotulo="Afirmação"
        ajuda="Uma frase sobre o serviço. Para a falsa, use um engano comum em campo, não uma pegadinha de palavra."
        valor={fase.afirmacao}
        limite={LIMITES.enunciado}
        linhas={2}
        placeholder="Ex.: Antes de iniciar a manutenção, é preciso verificar se o equipamento está desligado e bloqueado."
        aoMudar={(afirmacao) => aoMudar({ ...fase, afirmacao })}
      />
      <Escolhas
        rotulo="A afirmação é"
        valor={fase.verdadeira}
        opcoes={[
          { valor: true, rotulo: "Verdadeira", icone: "check" },
          { valor: false, rotulo: "Falsa", icone: "x" },
        ]}
        aoMudar={(verdadeira) => aoMudar({ ...fase, verdadeira })}
      />
      {explicacao}
    </div>
  );
}

function EditorCacaPalavras({ fase, aoMudar, explicacao }: { fase: Extract<Fase, { tipo: "caca_palavras" }>; aoMudar: (f: Fase) => void; explicacao: ReactNode }) {
  const mudarPalavra = (i: number, parcial: Partial<{ palavra: string; pista: string }>) => aoMudar({ ...fase, palavras: fase.palavras.map((x, k) => (k === i ? { ...x, ...parcial } : x)) });
  const pistas = fase.modo === "pistas";
  return (
    <div className="ts-fase-campos">
      <CampoDeTexto rotulo="Enunciado" valor={fase.enunciado} limite={LIMITES.enunciado} placeholder="Ex.: Encontre os termos da manutenção." aoMudar={(enunciado) => aoMudar({ ...fase, enunciado })} />
      <Escolhas
        rotulo="O que quem joga vê"
        valor={fase.modo}
        opcoes={[
          { valor: "palavras", rotulo: "As palavras", icone: "list", dica: "A lista mostra cada palavra; a pista, se houver, vai embaixo." },
          { valor: "pistas", rotulo: "Só as pistas", icone: "eye", dica: "Mais difícil: a palavra fica escondida até ser achada." },
        ]}
        aoMudar={(modo) => aoMudar({ ...fase, modo })}
      />
      <Lista
        titulo="Palavras"
        dica={`De ${LIMITES.palavrasMin} a ${LIMITES.palavrasMax} palavras de ${LIMITES.palavraDaGradeMin} a ${LIMITES.palavraDaGradeMax} letras, uma palavra só cada. Na grade, ficam na linha, na coluna ou na diagonal, podendo se cruzar, sem acento.`}
        rotuloAdicionar="Adicionar palavra"
        podeAdicionar={fase.palavras.length < LIMITES.palavrasMax}
        aoAdicionar={() => aoMudar({ ...fase, palavras: [...fase.palavras, { palavra: "", pista: "" }] })}
      >
        {fase.palavras.map((p, i) => {
          const naGrade = letrasDaGrade(p.palavra);
          return (
            <div key={i} className="ts-cartao-opcao">
              <div className="ts-linha-opcao">
                <input
                  className="input ts-ed-palavra-campo"
                  maxLength={20}
                  value={p.palavra}
                  placeholder={`Palavra ${i + 1} (ex.: Bloqueio)`}
                  aria-label={`Palavra ${i + 1}`}
                  onChange={(e) => mudarPalavra(i, { palavra: e.target.value.replace(/\s/g, "") })}
                />
                {naGrade && (
                  <span className="ts-ed-na-grade" title="Como fica na grade">
                    {naGrade} · {naGrade.length}
                  </span>
                )}
                <BotaoTirar rotulo={`Tirar a palavra ${i + 1}`} visivel={fase.palavras.length > LIMITES.palavrasMin} aoTirar={() => aoMudar({ ...fase, palavras: fase.palavras.filter((_, k) => k !== i) })} />
              </div>
              <input
                className="input ts-consequencia-campo"
                maxLength={LIMITES.pista}
                value={p.pista ?? ""}
                placeholder={pistas ? "Pista (obrigatória neste modo)" : "Pista ou definição (opcional)"}
                aria-label={`Pista da palavra ${i + 1}`}
                onChange={(e) => mudarPalavra(i, { pista: e.target.value })}
              />
            </div>
          );
        })}
      </Lista>
      {explicacao}
    </div>
  );
}

function EditorMemoria({ fase, aoMudar, explicacao }: { fase: Extract<Fase, { tipo: "memoria" }>; aoMudar: (f: Fase) => void; explicacao: ReactNode }) {
  const mudarPar = (i: number, parcial: Partial<{ termo: string; correspondente: string }>) => aoMudar({ ...fase, pares: fase.pares.map((x, k) => (k === i ? { ...x, ...parcial } : x)) });
  return (
    <div className="ts-fase-campos">
      <Lista
        titulo="Pares de cartas"
        dica={`De ${LIMITES.paresMin} a ${LIMITES.paresMax} pares. Cada par vira duas cartas viradas para baixo: o termo e o que corresponde a ele (a função, a definição, a medida). Não há limite de tentativas: cada par encontrado vale 10 ÷ o número de pares.`}
        rotuloAdicionar="Adicionar par"
        podeAdicionar={fase.pares.length < LIMITES.paresMax}
        aoAdicionar={() => aoMudar({ ...fase, pares: [...fase.pares, { termo: "", correspondente: "" }] })}
      >
        {fase.pares.map((par, i) => (
          <div key={i} className="ts-linha-par">
            <input className="input" maxLength={LIMITES.carta} value={par.termo} placeholder="Carta (ex.: Capacete)" aria-label={`Par ${i + 1}, termo`} onChange={(e) => mudarPar(i, { termo: e.target.value })} />
            <span className="ts-par-elo" aria-hidden="true">
              <Icon name="cartas" size={13} />
            </span>
            <input
              className="input"
              maxLength={LIMITES.carta}
              value={par.correspondente}
              placeholder="Par (ex.: Protege a cabeça)"
              aria-label={`Par ${i + 1}, correspondente`}
              onChange={(e) => mudarPar(i, { correspondente: e.target.value })}
            />
            <BotaoTirar rotulo={`Tirar o par ${i + 1}`} visivel={fase.pares.length > LIMITES.paresMin} aoTirar={() => aoMudar({ ...fase, pares: fase.pares.filter((_, k) => k !== i) })} />
          </div>
        ))}
      </Lista>
      {explicacao}
    </div>
  );
}

/** As opções em branco do Selecione escrito: 2 certas e 2 erradas, como a fase nova. */
const opcoesEmBranco = () => [
  { texto: "", correta: true },
  { texto: "", correta: true },
  { texto: "", correta: false },
  { texto: "", correta: false },
];

function EditorSelecione({
  fase,
  aoMudar,
  explicacao,
  materiaisDoServico,
  nomeDoMaterial,
}: {
  fase: Extract<Fase, { tipo: "selecione" }>;
  aoMudar: (f: Fase) => void;
  explicacao: ReactNode;
  materiaisDoServico: MaterialDaFase[];
  nomeDoMaterial: (id: string) => string;
}) {
  const idMateriais = useId();
  // Desmarcar e marcar de novo "com os materiais" não perde as opções escritas nem os materiais escolhidos.
  const guardado = useRef<{ opcoes: Extract<Fase, { tipo: "selecione" }>["opcoes"]; materiais: MateriaisDoSelecione | null }>({ opcoes: [], materiais: null });
  const comMateriais = Boolean(fase.materiais);
  const certas = fase.opcoes.filter((o) => o.correta).length;
  const mudarOpcao = (i: number, parcial: Partial<{ texto: string; correta: boolean }>) => aoMudar({ ...fase, opcoes: fase.opcoes.map((x, k) => (k === i ? { ...x, ...parcial } : x)) });

  function alternarMateriais(ligar: boolean) {
    if (ligar) {
      guardado.current.opcoes = fase.opcoes;
      const materiais = guardado.current.materiais ?? { material_ids: materiaisDoServico.slice(0, LIMITES.materiaisMax).map((m) => m.id), quantidade_errados: 6 };
      aoMudar({ ...fase, opcoes: [], materiais });
    } else {
      guardado.current.materiais = fase.materiais ?? null;
      aoMudar({ ...fase, materiais: null, opcoes: guardado.current.opcoes.length > 0 ? guardado.current.opcoes : opcoesEmBranco() });
    }
  }

  return (
    <div className="ts-fase-campos">
      <CampoDeTexto
        rotulo="Pedido"
        valor={fase.enunciado}
        limite={LIMITES.enunciado}
        linhas={2}
        placeholder={comMateriais ? "Ex.: Toque em tudo o que você leva para trocar o regulador." : "Ex.: Selecione todos os EPIs necessários para esta atividade."}
        aoMudar={(enunciado) => aoMudar({ ...fase, enunciado })}
      />
      <label className="ts-ed-caixa" htmlFor={idMateriais} data-marcada={comMateriais || undefined}>
        <input id={idMateriais} type="checkbox" checked={comMateriais} onChange={(e) => alternarMateriais(e.target.checked)} />
        <span className="ts-ed-caixa-texto">
          <strong>Montar com os materiais do serviço</strong>
          <span className="small">As opções vêm do catálogo: você marca os materiais certos, e o sistema mistura itens de outros serviços, sorteados a cada partida.</span>
        </span>
      </label>
      {fase.materiais ? (
        <MateriaisDoServico
          materiais={fase.materiais}
          aoMudar={(materiais) => aoMudar({ ...fase, materiais })}
          materiaisDoServico={materiaisDoServico}
          nomeDoMaterial={nomeDoMaterial}
        />
      ) : (
        <Lista
          titulo={`Opções · ${certas} ${certas === 1 ? "certa" : "certas"}`}
          dica={`De ${LIMITES.selecioneMin} a ${LIMITES.selecioneMax} opções. Marque todas as certas (de 1 a ${LIMITES.selecioneCertasMax}) e deixe ao menos uma errada; o jogo embaralha.`}
          rotuloAdicionar="Adicionar opção"
          podeAdicionar={fase.opcoes.length < LIMITES.selecioneMax}
          aoAdicionar={() => aoMudar({ ...fase, opcoes: [...fase.opcoes, { texto: "", correta: false }] })}
        >
          {fase.opcoes.map((o, i) => (
            <div key={i} className={cx("ts-linha-opcao", o.correta && "ts-linha-certa")}>
              <label className={cx("ts-certa", o.correta && "ts-certa-marcada")} title={o.correta ? "Tocar para marcar como errada" : "Tocar para marcar como certa"}>
                <input
                  type="checkbox"
                  className="sr"
                  checked={o.correta}
                  disabled={!o.correta && certas >= LIMITES.selecioneCertasMax}
                  onChange={() => mudarOpcao(i, { correta: !o.correta })}
                  aria-label={`Opção ${i + 1} é certa`}
                />
                <Icon name={o.correta ? "check" : "x"} size={13} />
                <span>{o.correta ? "Certa" : "Errada"}</span>
              </label>
              <input className="input" maxLength={LIMITES.opcao} value={o.texto} placeholder={`Opção ${i + 1}`} aria-label={`Opção ${i + 1}`} onChange={(e) => mudarOpcao(i, { texto: e.target.value })} />
              <BotaoTirar rotulo={`Tirar a opção ${i + 1}`} visivel={fase.opcoes.length > LIMITES.selecioneMin} aoTirar={() => aoMudar({ ...fase, opcoes: fase.opcoes.filter((_, k) => k !== i) })} />
            </div>
          ))}
        </Lista>
      )}
      {explicacao}
    </div>
  );
}

/** Os materiais certos do Selecione montado com os materiais do serviço: os do serviço primeiro, outros pela busca no catálogo. */
function MateriaisDoServico({
  materiais,
  aoMudar,
  materiaisDoServico,
  nomeDoMaterial,
}: {
  materiais: MateriaisDoSelecione;
  aoMudar: (m: MateriaisDoSelecione) => void;
  materiaisDoServico: MaterialDaFase[];
  nomeDoMaterial: (id: string) => string;
}) {
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<MaterialDaFase[] | null>(null);
  const { material_ids, quantidade_errados } = materiais;
  const escolhidos = new Set(material_ids);
  const cheio = material_ids.length >= LIMITES.materiaisMax;
  const doServico = new Set(materiaisDoServico.map((m) => m.id));
  const deFora = material_ids.filter((id) => !doServico.has(id));

  useEffect(() => {
    const termo = busca.trim();
    let ativo = true;
    const espera = window.setTimeout(
      () => {
        if (!termo) return setAchados(null);
        chamar<{ materiais: MaterialDaFase[] }>("GET", `/catalogo/materiais?busca=${encodeURIComponent(termo)}&ativo=true&tamanho=8`)
          .then((r) => ativo && setAchados(r.materiais))
          .catch(() => ativo && setAchados([]));
      },
      termo ? 250 : 0,
    );
    return () => {
      ativo = false;
      window.clearTimeout(espera);
    };
  }, [busca]);

  function alternar(id: string) {
    if (escolhidos.has(id)) aoMudar({ ...materiais, material_ids: material_ids.filter((x) => x !== id) });
    else if (!cheio) aoMudar({ ...materiais, material_ids: [...material_ids, id] });
  }

  return (
    <>
      <fieldset className="ts-lista-campos">
        <legend>Materiais certos</legend>
        <span className="small">
          De {LIMITES.materiaisMin} a {LIMITES.materiaisMax} materiais. Toque para marcar: {material_ids.length} marcado{material_ids.length === 1 ? "" : "s"}.
        </span>
        {materiaisDoServico.length > 0 ? (
          <div className="ts-fichas">
            {materiaisDoServico.map((m) => (
              <button key={m.id} type="button" className="ts-ficha" aria-pressed={escolhidos.has(m.id)} disabled={!escolhidos.has(m.id) && cheio} onClick={() => alternar(m.id)}>
                {escolhidos.has(m.id) && <Icon name="check" size={13} />}
                {m.descricao}
              </button>
            ))}
          </div>
        ) : (
          <span className="small">Este serviço ainda não tem materiais no catálogo. Busque abaixo.</span>
        )}
        {deFora.length > 0 && (
          <div className="ts-fichas">
            {deFora.map((id) => (
              <button key={id} type="button" className="ts-ficha" aria-pressed onClick={() => alternar(id)} title="Tocar para tirar">
                <Icon name="check" size={13} />
                {nomeDoMaterial(id)}
              </button>
            ))}
          </div>
        )}
        <div className="ts-busca-material">
          <Icon name="search" size={16} />
          <input className="input" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar outro material do catálogo" aria-label="Buscar outro material do catálogo" />
        </div>
        {achados && (
          <div className="ts-fichas">
            {achados.length === 0 && <span className="small">Nada encontrado.</span>}
            {achados.map((m) => (
              <button
                key={m.id}
                type="button"
                className="ts-ficha ts-ficha-busca"
                aria-pressed={escolhidos.has(m.id)}
                disabled={!escolhidos.has(m.id) && cheio}
                onClick={() => {
                  alternar(m.id);
                  setBusca("");
                }}
              >
                <Icon name={escolhidos.has(m.id) ? "check" : "plus"} size={13} />
                {m.descricao}
              </button>
            ))}
          </div>
        )}
      </fieldset>
      <div className="field">
        <span className="ts-rotulo-campo">Itens errados misturados</span>
        <span className="small">O sistema sorteia esta quantidade de itens de outros serviços a cada partida.</span>
        <div className="ts-contador-passo">
          <Button variant="line" sm onClick={() => aoMudar({ ...materiais, quantidade_errados: Math.max(1, quantidade_errados - 1) })} disabled={quantidade_errados <= 1} aria-label="Menos um">
            −
          </Button>
          <output aria-live="polite">{quantidade_errados}</output>
          <Button
            variant="line"
            sm
            onClick={() => aoMudar({ ...materiais, quantidade_errados: Math.min(LIMITES.erradosMax, quantidade_errados + 1) })}
            disabled={quantidade_errados >= LIMITES.erradosMax}
            aria-label="Mais um"
          >
            +
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * O banco de palavras do Desembaralhe e do Termo: até 10 palavras, cada uma com a sua dica, e cada partida sorteia uma
 * (quem joga de novo não pega sempre a mesma). Dá para salvar com menos; publicar exige as 10.
 */
function EditorBancoDePalavras({ fase, aoMudar, explicacao }: { fase: Extract<Fase, { tipo: "desembaralhe" | "termo" }>; aoMudar: (f: Fase) => void; explicacao: ReactNode }) {
  const termo = fase.tipo === "termo";
  const total = fase.palavras.length;
  const mudar = (i: number, parcial: Partial<{ palavra: string; dica: string }>) =>
    aoMudar({ ...fase, palavras: fase.palavras.map((x, k) => (k === i ? { ...x, ...parcial } : x)) } as Fase);
  const tirar = (i: number) => aoMudar({ ...fase, palavras: fase.palavras.filter((_, k) => k !== i) } as Fase);
  const acrescentar = () => aoMudar({ ...fase, palavras: [...fase.palavras, { palavra: "", dica: "" }] } as Fase);

  return (
    <div className="ts-fase-campos">
      <Lista
        titulo={`Banco de palavras · ${total} de ${LIMITES.palavrasDoBanco}`}
        dica={
          termo
            ? `Cada partida sorteia uma destas palavras. De ${LIMITES.termoMin} a ${LIMITES.termoMax} letras cada; o acento não conta (quem joga digita sem acento). A dica é opcional. Para publicar, cadastre as ${LIMITES.palavrasDoBanco}.`
            : `Cada partida sorteia uma destas palavras e mostra a dica dela. De ${LIMITES.palavraMin} a ${LIMITES.palavraMax} letras cada, com o acento. Para publicar, cadastre as ${LIMITES.palavrasDoBanco}.`
        }
        rotuloAdicionar="Adicionar palavra"
        podeAdicionar={total < LIMITES.palavrasDoBanco}
        aoAdicionar={acrescentar}
      >
        <span className="ts-ed-banco-progresso" aria-hidden="true">
          <i style={{ width: `${(total / LIMITES.palavrasDoBanco) * 100}%` }} />
        </span>
        {fase.palavras.map((p, i) => {
          const letras = termo ? letrasDaGrade(p.palavra) : "";
          return (
            <div key={i} className="ts-cartao-opcao">
              <div className="ts-linha-opcao">
                <span className="ts-etapa-num">{i + 1}</span>
                <input
                  className="input ts-ed-palavra-campo"
                  maxLength={termo ? 12 : LIMITES.palavraMax}
                  value={p.palavra}
                  placeholder={termo ? "Ex.: Risco" : "Ex.: Inspeção"}
                  aria-label={`Palavra ${i + 1}`}
                  onChange={(e) => mudar(i, { palavra: e.target.value.replace(/\s/g, "") })}
                />
                {termo && letras && (
                  <span className="ts-ed-na-grade" title="Letras e tentativas">
                    {letras.length} letras · {tentativasDoTermo(letras.length)} tentativas
                  </span>
                )}
                <BotaoTirar rotulo={`Tirar a palavra ${i + 1}`} visivel={total > 1} aoTirar={() => tirar(i)} />
              </div>
              <input
                className="input ts-consequencia-campo"
                maxLength={termo ? LIMITES.pista : LIMITES.enunciado}
                value={p.dica ?? ""}
                placeholder={termo ? "Dica (opcional): o assunto, sem a palavra" : "Dica: o que a palavra é, sem escrevê-la"}
                aria-label={`Dica da palavra ${i + 1}`}
                onChange={(e) => mudar(i, { dica: e.target.value })}
              />
            </div>
          );
        })}
      </Lista>
      {explicacao}
    </div>
  );
}
