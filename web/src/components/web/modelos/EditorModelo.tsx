"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { ajudaParticipantesComAssinatura, rotuloParticipantesComAssinatura, type EvidenciaItem, type ModeloCompleto, type Pae, type RespostaBloqueante, type TipoItem } from "@/data/modelos";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";
import { PaeGrade } from "./PaeGrade";

// ---- Estado do editor -------------------------------------------------------------------------------------------

interface ItemEd {
  /** Só para a lista do React; a `ordem` que a `api` grava vem da posição. */
  chave: number;
  texto: string;
  resposta_bloqueante: RespostaBloqueante | "";
  tipo: TipoItem;
  evidencia: EvidenciaItem;
  permite_na: boolean;
  /** A pergunta mostra a previsão do tempo (a pergunta de clima): a tela do técnico consulta a previsão e avisa se houver risco. */
  mostrar_clima: boolean;
}

interface RiscoEd {
  chave: number;
  classificacao: string;
  nome: string;
  medidas: ItemEd[];
}

interface Estado {
  titulo: string;
  dataDocumento: string;
  /** A folha tem a coluna Assinatura na tabela de participantes (muda o PDF da OS e o relatório da execução). */
  participantesComAssinatura: boolean;
  /** PAE como JSON em texto; é mantido como veio, a menos que a pessoa o edite. */
  paeTexto: string;
  verificacoes: ItemEd[];
  riscos: RiscoEd[];
}

let proximaChave = 1;
const novaChave = () => proximaChave++;

function paraEstado(modelo: ModeloCompleto): Estado {
  const itens = [...modelo.itens].sort((a, b) => a.ordem - b.ordem);
  const deItem = (i: ModeloCompleto["itens"][number]): ItemEd => ({
    chave: novaChave(),
    texto: i.texto,
    resposta_bloqueante: i.resposta_bloqueante ?? "",
    tipo: i.tipo,
    evidencia: i.evidencia,
    permite_na: i.permite_na,
    mostrar_clima: i.mostrar_clima ?? false,
  });
  return {
    titulo: modelo.titulo,
    dataDocumento: modelo.data_documento ?? "",
    participantesComAssinatura: modelo.participantes_com_assinatura ?? true,
    paeTexto: modelo.pae ? JSON.stringify(modelo.pae, null, 2) : "",
    verificacoes: itens.filter((i) => i.secao === "verificacao").map(deItem),
    riscos: [...modelo.riscos]
      .sort((a, b) => a.ordem - b.ordem)
      .map((r) => ({
        chave: novaChave(),
        classificacao: r.classificacao,
        nome: r.nome,
        medidas: itens.filter((i) => i.secao === "medida_preventiva" && i.risco_ordem === r.ordem).map(deItem),
      })),
  };
}

const itemNovo = (): ItemEd => ({ chave: novaChave(), texto: "", resposta_bloqueante: "", tipo: "alerta", evidencia: "foto", permite_na: false, mostrar_clima: false });

class ErroDeEdicao extends Error {}

/** Corpo do `PUT /modelos-apr/{codigo}/versoes/{versao}`: a posição na tela vira a `ordem`. */
function paraCorpo(estado: Estado) {
  const titulo = estado.titulo.trim();
  if (!titulo) throw new ErroDeEdicao("Informe o título do modelo");

  let pae: Pae | null = null;
  if (estado.paeTexto.trim()) {
    try {
      const lido: unknown = JSON.parse(estado.paeTexto);
      if (!lido || typeof lido !== "object" || Array.isArray(lido)) throw new Error();
      pae = lido as Pae;
    } catch {
      throw new ErroDeEdicao("O PAE precisa ser um JSON válido (um objeto com titulo, subtitulo, fluxo e linhas)");
    }
  }

  let ordem = 0;
  const item = (i: ItemEd, secao: "verificacao" | "medida_preventiva", riscoOrdem: number | null) => {
    if (!i.texto.trim()) throw new ErroDeEdicao("Há um item sem texto; preencha ou remova");
    return {
      secao,
      risco_ordem: riscoOrdem,
      ordem: ++ordem,
      texto: i.texto.trim(),
      resposta_bloqueante: i.resposta_bloqueante || null,
      tipo: i.tipo,
      evidencia: i.evidencia,
      permite_na: i.permite_na,
      mostrar_clima: i.mostrar_clima,
    };
  };
  const itens = [
    ...estado.verificacoes.map((i) => item(i, "verificacao", null)),
    ...estado.riscos.flatMap((r, indice) => r.medidas.map((m) => item(m, "medida_preventiva", indice + 1))),
  ];
  const riscos = estado.riscos.map((r, indice) => {
    if (!r.nome.trim() || !r.classificacao.trim()) throw new ErroDeEdicao("Todo risco precisa de classificação e nome");
    return { classificacao: r.classificacao.trim(), nome: r.nome.trim(), ordem: indice + 1 };
  });
  return { titulo, pae, data_documento: estado.dataDocumento || null, participantes_com_assinatura: estado.participantesComAssinatura, riscos, itens };
}

/** Assinatura do que seria gravado agora; igual à salva = nada a salvar. Erro de preenchimento conta como alteração. */
function assinatura(estado: Estado): string {
  try {
    return JSON.stringify(paraCorpo(estado));
  } catch {
    return `invalido:${JSON.stringify(estado)}`;
  }
}

function mover<T>(lista: T[], de: number, para: number): T[] {
  if (para < 0 || para >= lista.length) return lista;
  const copia = [...lista];
  const [tirado] = copia.splice(de, 1);
  copia.splice(para, 0, tirado!);
  return copia;
}

// ---- Linha de item ----------------------------------------------------------------------------------------------

interface LinhaItemProps {
  item: ItemEd;
  numero: number;
  total: number;
  /** Item de verificação: a resposta bloqueante é obrigatória para publicar. */
  verificacao: boolean;
  aoMudar: (novo: ItemEd) => void;
  aoMover: (delta: number) => void;
  aoRemover: () => void;
}

function LinhaItem({ item, numero, total, verificacao, aoMudar, aoMover, aoRemover }: LinhaItemProps) {
  const semResposta = verificacao && !item.resposta_bloqueante;
  return (
    <div className={`ied${semResposta ? " sem" : ""}`}>
      <span className="n">{numero}</span>
      <div>
        <textarea
          className="textarea"
          rows={2}
          aria-label={`Texto do item ${numero}`}
          value={item.texto}
          onChange={(e) => aoMudar({ ...item, texto: e.target.value })}
          style={{ minHeight: 56 }}
        />
        <div className="ctl">
          <div className="field">
            <label>
              Tipo
              <select className="select" value={item.tipo} onChange={(e) => aoMudar({ ...item, tipo: e.target.value as TipoItem })}>
                <option value="eliminatorio">Eliminatório</option>
                <option value="alerta">Alerta</option>
              </select>
            </label>
          </div>
          <div className="field">
            <label>
              {verificacao ? "Resposta que bloqueia" : "Resposta que avisa"}
              <select
                className="select"
                value={item.resposta_bloqueante}
                onChange={(e) => aoMudar({ ...item, resposta_bloqueante: e.target.value as RespostaBloqueante | "" })}
              >
                <option value="">{verificacao ? "Escolha…" : "Nenhuma"}</option>
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </label>
          </div>
          <div className="field">
            <label>
              Evidência
              <select className="select" value={item.evidencia} onChange={(e) => aoMudar({ ...item, evidencia: e.target.value as EvidenciaItem })}>
                <option value="foto">Foto</option>
                <option value="pdf">PDF (documento)</option>
                <option value="texto">Texto</option>
              </select>
            </label>
          </div>
          <label className="chk">
            <input type="checkbox" checked={item.permite_na} onChange={(e) => aoMudar({ ...item, permite_na: e.target.checked })} />
            Permite NA
          </label>
          <label className="chk">
            <input type="checkbox" checked={item.mostrar_clima} onChange={(ev) => aoMudar({ ...item, mostrar_clima: ev.target.checked })} />
            Mostrar a previsão do tempo nesta pergunta
          </label>
          <span className="acoes">
            <button type="button" className="ibtn" aria-label="Subir item" disabled={numero === 1} onClick={() => aoMover(-1)}>
              <Icon name="down" size={16} style={{ transform: "rotate(180deg)" }} />
            </button>
            <button type="button" className="ibtn" aria-label="Descer item" disabled={numero === total} onClick={() => aoMover(1)}>
              <Icon name="down" size={16} />
            </button>
            <button type="button" className="ibtn del" aria-label="Remover item" onClick={aoRemover}>
              <Icon name="x" size={16} />
            </button>
          </span>
        </div>
        {semResposta && <span className="small" style={{ color: "var(--blq)" }}>Defina a resposta que bloqueia para poder publicar.</span>}
      </div>
    </div>
  );
}

// ---- Editor -----------------------------------------------------------------------------------------------------

/**
 * Editor do rascunho de uma versão do modelo (só o administrador chega aqui). Edita título,
 * itens (texto, tipo, resposta bloqueante, evidência, NA), riscos e medidas; o PAE fica como está, com um campo JSON
 * para quem precisar ajustá-lo. "Salvar" faz o `PUT` que substitui o conteúdo do rascunho; "Publicar" salva o que falta
 * e publica. `temPublicada` diz se o modelo já tem uma versão publicada: sem ela, descartar o rascunho apaga o modelo.
 */
export function EditorModelo({ modelo, temPublicada }: { modelo: ModeloCompleto; temPublicada: boolean }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [estado, setEstado] = useState<Estado>(() => paraEstado(modelo));
  const [salvo, setSalvo] = useState<string>(() => assinatura(estado));
  const [ocupado, setOcupado] = useState<"salvar" | "publicar" | "descartar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarPae, setMostrarPae] = useState(false);

  const alterado = assinatura(estado) !== salvo;
  const todos = [...estado.verificacoes, ...estado.riscos.flatMap((r) => r.medidas)];
  const eliminatorios = todos.filter((i) => i.tipo === "eliminatorio").length;
  const semResposta = estado.verificacoes.filter((i) => !i.resposta_bloqueante).length;
  const caminho = `/modelos-apr/${encodeURIComponent(modelo.codigo)}/versoes/${modelo.versao}`;

  const mudar = (parcial: Partial<Estado>) => setEstado((e) => ({ ...e, ...parcial }));
  const mudarRisco = (indice: number, parcial: Partial<RiscoEd>) =>
    mudar({ riscos: estado.riscos.map((r, i) => (i === indice ? { ...r, ...parcial } : r)) });

  async function gravar() {
    const corpo = paraCorpo(estado);
    await chamar("PUT", caminho, corpo);
    setSalvo(assinatura(estado));
  }

  async function executar(acao: "salvar" | "publicar" | "descartar", fazer: () => Promise<void>) {
    setOcupado(acao);
    setErro(null);
    try {
      await fazer();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir a ação");
    } finally {
      setOcupado(null);
    }
  }

  const salvar = () =>
    executar("salvar", async () => {
      await gravar();
      exibirAviso("Rascunho salvo.");
      router.refresh();
    });

  const publicar = () =>
    executar("publicar", async () => {
      if (alterado) await gravar();
      await chamar("POST", `${caminho}/publicar`);
      exibirAviso(`${modelo.codigo} v${modelo.versao} publicada. Vale para as APRs novas.`);
      router.refresh();
    });

  const descartar = () => {
    const pergunta = temPublicada
      ? `Descartar o rascunho v${modelo.versao} da ${modelo.codigo}? As alterações serão perdidas.`
      : `Descartar o rascunho v${modelo.versao} da ${modelo.codigo}? Como ele nunca foi publicado, o modelo deixa de existir.`;
    if (!window.confirm(pergunta)) return;
    void executar("descartar", async () => {
      await chamar("DELETE", caminho);
      exibirAviso(temPublicada ? "Rascunho descartado." : `${modelo.codigo} descartado.`);
      router.push(temPublicada ? rotas.web.modelo(modelo.codigo) : rotas.web.modelos);
      router.refresh();
    });
  };

  return (
    <Panel style={{ padding: "20px 22px", gap: 16 }}>
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack g4 grow">
          <span className="mono" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>
            {`${modelo.codigo} · v${modelo.versao} · rascunho`}
          </span>
          <input
            className="input"
            aria-label="Título do modelo"
            value={estado.titulo}
            onChange={(e) => mudar({ titulo: e.target.value })}
            style={{ fontSize: 18, fontWeight: 600 }}
          />
        </div>
        <div className="field campo-data">
          <label>
            Data do documento
            <input className="input" type="date" value={estado.dataDocumento} onChange={(e) => mudar({ dataDocumento: e.target.value })} style={{ height: 44 }} />
          </label>
        </div>
      </div>

      <Notice tone="info" icon="info">
        {temPublicada
          ? `Você está editando o rascunho da v${modelo.versao}. A versão em uso continua valendo para as APRs novas até a publicação; as APRs já preenchidas ficam ligadas à versão que usaram.`
          : "Modelo novo, ainda em rascunho: o técnico só o vê depois da publicação. Escreva a orientação acima para o sistema recomendá-lo nas OS que combinam com ele."}
      </Notice>

      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}

      <section className="stack g4" aria-label="Folha do modelo">
        <label className="row g8" style={{ alignItems: "center" }}>
          <input type="checkbox" checked={estado.participantesComAssinatura} onChange={(ev) => mudar({ participantesComAssinatura: ev.target.checked })} />
          {rotuloParticipantesComAssinatura}
        </label>
        <span className="small">{ajudaParticipantesComAssinatura}</span>
      </section>

      <section className="stack g8" aria-label="Itens de verificação">
        <h3 style={{ fontSize: 15 }}>{`Verificação (${estado.verificacoes.length})`}</h3>
        {estado.verificacoes.map((item, i) => (
          <LinhaItem
            key={item.chave}
            item={item}
            numero={i + 1}
            total={estado.verificacoes.length}
            verificacao
            aoMudar={(novo) => mudar({ verificacoes: estado.verificacoes.map((x, j) => (j === i ? novo : x)) })}
            aoMover={(delta) => mudar({ verificacoes: mover(estado.verificacoes, i, i + delta) })}
            aoRemover={() => mudar({ verificacoes: estado.verificacoes.filter((_, j) => j !== i) })}
          />
        ))}
        <div>
          <Button
            sm
            onClick={() => mudar({ verificacoes: [...estado.verificacoes, itemNovo()] })}
            style={{ border: "1px dashed var(--dash)", background: "#fff", color: "var(--brand)" }}
          >
            <Icon name="plus" size={16} />
            Adicionar item de verificação
          </Button>
        </div>
      </section>

      <section className="stack g8" aria-label="Riscos e medidas preventivas">
        <h3 style={{ fontSize: 15 }}>{`Riscos e medidas preventivas (${estado.riscos.length} riscos)`}</h3>
        {estado.riscos.map((risco, ri) => (
          <div key={risco.chave} className="grupo-risco">
            <div className="row wrap" style={{ alignItems: "flex-end" }}>
              <div className="field campo-class">
                <label>
                  Classificação
                  <input className="input" style={{ height: 38 }} value={risco.classificacao} onChange={(e) => mudarRisco(ri, { classificacao: e.target.value })} />
                </label>
              </div>
              <div className="field grow campo-risco">
                <label>
                  Risco
                  <input className="input" style={{ height: 38 }} value={risco.nome} onChange={(e) => mudarRisco(ri, { nome: e.target.value })} />
                </label>
              </div>
              <span className="acoes row g4">
                <button type="button" className="ibtn" aria-label="Subir risco" disabled={ri === 0} onClick={() => mudar({ riscos: mover(estado.riscos, ri, ri - 1) })}>
                  <Icon name="down" size={16} style={{ transform: "rotate(180deg)" }} />
                </button>
                <button
                  type="button"
                  className="ibtn"
                  aria-label="Descer risco"
                  disabled={ri === estado.riscos.length - 1}
                  onClick={() => mudar({ riscos: mover(estado.riscos, ri, ri + 1) })}
                >
                  <Icon name="down" size={16} />
                </button>
                <button
                  type="button"
                  className="ibtn del"
                  aria-label="Remover risco"
                  onClick={() => {
                    if (risco.medidas.length > 0 && !window.confirm(`Remover o risco "${risco.nome}" e as ${risco.medidas.length} medidas dele?`)) return;
                    mudar({ riscos: estado.riscos.filter((_, j) => j !== ri) });
                  }}
                >
                  <Icon name="x" size={16} />
                </button>
              </span>
            </div>
            {risco.medidas.map((medida, mi) => (
              <LinhaItem
                key={medida.chave}
                item={medida}
                numero={mi + 1}
                total={risco.medidas.length}
                verificacao={false}
                aoMudar={(novo) => mudarRisco(ri, { medidas: risco.medidas.map((x, j) => (j === mi ? novo : x)) })}
                aoMover={(delta) => mudarRisco(ri, { medidas: mover(risco.medidas, mi, mi + delta) })}
                aoRemover={() => mudarRisco(ri, { medidas: risco.medidas.filter((_, j) => j !== mi) })}
              />
            ))}
            <div>
              <Button sm variant="line" onClick={() => mudarRisco(ri, { medidas: [...risco.medidas, itemNovo()] })}>
                <Icon name="plus" size={16} />
                Adicionar medida preventiva
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button
            sm
            onClick={() => mudar({ riscos: [...estado.riscos, { chave: novaChave(), classificacao: estado.riscos.at(-1)?.classificacao ?? "", nome: "", medidas: [] }] })}
            style={{ border: "1px dashed var(--dash)", background: "#fff", color: "var(--brand)" }}
          >
            <Icon name="plus" size={16} />
            Adicionar risco
          </Button>
        </div>
      </section>

      <section className="stack g8" aria-label="Plano de atendimento a emergências">
        <div className="row between">
          <h3 style={{ fontSize: 15 }}>Plano de atendimento a emergências (PAE)</h3>
          <Button variant="ghost" sm onClick={() => setMostrarPae((v) => !v)}>
            {mostrarPae ? "Ocultar JSON" : "Editar como JSON"}
          </Button>
        </div>
        {mostrarPae ? (
          <>
            <textarea
              className="textarea mono"
              rows={14}
              aria-label="PAE em JSON"
              value={estado.paeTexto}
              onChange={(e) => mudar({ paeTexto: e.target.value })}
              style={{ fontSize: 12.5 }}
              spellCheck={false}
            />
            <span className="small">Objeto com titulo, subtitulo, fluxo e linhas (rotulo e celulas com coluna e texto). Vazio remove o PAE.</span>
          </>
        ) : (
          <PaeVisao texto={estado.paeTexto} />
        )}
      </section>

      <div className="checks">
        <span style={{ color: eliminatorios > 0 ? undefined : "var(--blq)" }}>
          <Icon name={eliminatorios > 0 ? "check" : "alert"} size={16} />
          {`${eliminatorios} ${eliminatorios === 1 ? "item eliminatório" : "itens eliminatórios"} (mínimo 1)`}
        </span>
        <span style={{ color: semResposta === 0 ? undefined : "var(--blq)" }}>
          <Icon name={semResposta === 0 ? "check" : "alert"} size={16} />
          {semResposta === 0 ? "Toda verificação tem resposta bloqueante" : `${semResposta} verificação(ões) sem resposta bloqueante`}
        </span>
        <span style={{ color: alterado ? "var(--al)" : undefined }}>
          <Icon name={alterado ? "clock" : "check"} size={16} />
          {alterado ? "Alterações não salvas" : "Tudo salvo"}
        </span>
      </div>

      <div className="row g8 wrap" style={{ justifyContent: "flex-end" }}>
        <Button variant="ghost" sm onClick={descartar} disabled={ocupado !== null} style={{ color: "var(--blq)" }}>
          Descartar rascunho
        </Button>
        <Button variant="line" sm onClick={salvar} disabled={ocupado !== null || !alterado}>
          {ocupado === "salvar" ? "Salvando…" : "Salvar rascunho"}
        </Button>
        <Button variant="p" sm onClick={publicar} disabled={ocupado !== null}>
          {ocupado === "publicar" ? "Publicando…" : `Publicar v${modelo.versao}`}
        </Button>
      </div>
    </Panel>
  );
}

/** Mostra o PAE do texto do editor em grade; JSON inválido vira um aviso. */
function PaeVisao({ texto }: { texto: string }) {
  let pae: Pae | null = null;
  let invalido = false;
  if (texto.trim()) {
    try {
      pae = JSON.parse(texto) as Pae;
    } catch {
      invalido = true;
    }
  }
  if (invalido) return <p className="small" style={{ color: "var(--blq)" }}>O JSON do PAE está inválido.</p>;
  return <PaeGrade pae={pae} />;
}
