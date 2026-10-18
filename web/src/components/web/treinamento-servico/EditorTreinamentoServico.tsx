"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AssinaturaCanvas } from "@/components/ui/AssinaturaCanvas";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Panel } from "@/components/web/Panel";
import { EditorFase } from "@/components/web/treinamento-servico/EditorFase";
import { ImagemDoTreinamento } from "@/components/web/treinamento-servico/ImagemDoTreinamento";
import { JogoTreinamentoServico } from "@/components/web/treinamento-servico/JogoTreinamentoServico";
import { MetaIADoItem } from "@/components/web/treinamento-servico/MetaIADoItem";
import { PainelRascunhoIA } from "@/components/web/treinamento-servico/PainelRascunhoIA";
import { useRascunhoIA } from "@/components/web/treinamento-servico/useRascunhoIA";
import { chamar, enviarArquivo, ErroCliente } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import { useToast } from "@/state/toast";
import {
  EXPRESSOES_VITORIA,
  TIPOS_DE_FASE,
  faseEmBranco,
  pendenciasAbertas,
  type Fase,
  type PassoExplicacao,
  type RascunhoDoEditor,
  type ReporteDeTreinamento,
  type ResultadoDaIA,
  type SituacaoIA,
  type TentativaAberta,
  type TipoDeFase,
  type VersaoAnterior,
} from "@/lib/treinamento-servico";

interface EditorTreinamentoServicoProps {
  codigo: string;
  descricao: string;
  rascunhoInicial: RascunhoDoEditor;
  versoesIniciais: VersaoAnterior[];
  reportesIniciais: ReporteDeTreinamento[];
  /** O que dá para fazer com a IA agora (`ia` do `GET` do rascunho). */
  situacaoIA: SituacaoIA;
}

/** O que cada expressão faz quando o passo aparece: as três primeiras só mostram a foto da Vitória, as outras tocam a animação (`shared/vitoria/reacoes.ts`). */
const ROTULO_DA_EXPRESSAO: Record<PassoExplicacao["expressao"], string> = {
  padrao: "Nenhuma (normal)",
  feliz: "Nenhuma (feliz)",
  explicando: "Nenhuma (explicando)",
  pensando: "Pensando",
  alerta: "Atenção, com o dedo levantado",
  comemorando: "Comemorando",
  ops: "Ops, sem graça",
};

const novoPasso = (ordem: number): PassoExplicacao => ({ ordem, texto: "", expressao: "explicando", imagem_path: null });

/**
 * Editor do treinamento de serviço (admin), seção 3.5 do `vitoria.md`: o rascunho com a Vitória (IA) e os ajustes pelo chat,
 * explicação, fases (com o trecho de origem e as pendências do que veio da IA), cenário, pré-visualizar, publicar (termo +
 * assinatura), versões anteriores e reportes. Uma página própria, como o editor de modelo de APR.
 */
export function EditorTreinamentoServico({ codigo, descricao, rascunhoInicial, versoesIniciais, reportesIniciais, situacaoIA }: EditorTreinamentoServicoProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [explicacao, setExplicacao] = useState<PassoExplicacao[]>(rascunhoInicial.explicacao);
  const [fases, setFases] = useState<Fase[]>(rascunhoInicial.fases);
  const [cenarioPath, setCenarioPath] = useState<string | null>(rascunhoInicial.cenario_path);
  const [versoes] = useState(versoesIniciais);
  const [reportes] = useState(reportesIniciais);
  const [novoTipo, setNovoTipo] = useState<TipoDeFase>("quiz");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarPreVisualizacao, setMostrarPreVisualizacao] = useState(false);
  const [mostrarPublicar, setMostrarPublicar] = useState(false);
  const [termoAceito, setTermoAceito] = useState(false);

  const termo = `Declaro que revisei este treinamento e que a explicação, as fases e as respostas estão de acordo com as normas da empresa e com o fluxo correto do serviço ${codigo} — ${descricao}.`;
  // As pendências da IA são recalculadas a cada edição (`shared/treinamento-servico/ia.ts`), as mesmas que a `api` confere ao publicar.
  const pendencias = pendenciasAbertas({ explicacao, fases });
  const publicavel = explicacao.length >= 1 && fases.length >= 3 && pendencias.length === 0;
  const ia = useRascunhoIA(codigo, situacaoIA, salvar, aplicarRascunhoDaIA);
  const travado = ocupado || ia.trabalhando;

  function aplicarRascunhoDaIA({ rascunho }: ResultadoDaIA) {
    setExplicacao(rascunho.explicacao);
    setFases(rascunho.fases);
    exibirAviso(rascunho.pendencias.length > 0 ? "A Vitória atualizou o rascunho. Revise as pendências antes de publicar." : "A Vitória atualizou o rascunho.");
    router.refresh();
  }

  /** Devolve se salvou: a pré-visualização só abre depois, porque lê o rascunho salvo no servidor, não o estado local. */
  async function salvar(): Promise<boolean> {
    setErro(null);
    setOcupado(true);
    try {
      await chamar<RascunhoDoEditor>("PUT", `/treinamentos/${encodeURIComponent(codigo)}/rascunho`, { explicacao, fases, cenario_path: cenarioPath });
      exibirAviso("Rascunho salvo.");
      router.refresh();
      return true;
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível salvar o rascunho.");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function enviarCenario(arquivo: File) {
    setOcupado(true);
    try {
      const id = await enviarArquivo(arquivo, "treinamento_imagem");
      setCenarioPath(id);
    } catch {
      setErro("Não foi possível enviar a imagem do cenário.");
    } finally {
      setOcupado(false);
    }
  }

  async function publicarComAssinatura(imagem: Blob) {
    setErro(null);
    setOcupado(true);
    try {
      const arquivoId = await enviarArquivo(imagem, "assinatura");
      await chamar("POST", `/treinamentos/${encodeURIComponent(codigo)}/publicar`, { arquivo_id: arquivoId });
      exibirAviso(`Treinamento de ${codigo} publicado.`);
      setMostrarPublicar(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof ErroCliente ? e.message : "Não foi possível publicar.");
    } finally {
      setOcupado(false);
    }
  }

  function mudarPasso(indice: number, parcial: Partial<PassoExplicacao>) {
    setExplicacao((atual) => atual.map((p, k) => (k === indice ? { ...p, ...parcial } : p)));
  }
  function moverPasso(indice: number, passoDaVez: -1 | 1) {
    setExplicacao((atual) => {
      const destino = indice + passoDaVez;
      if (destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
      return copia.map((p, i) => ({ ...p, ordem: i }));
    });
  }

  function moverFase(indice: number, passoDaVez: -1 | 1) {
    setFases((atual) => {
      const destino = indice + passoDaVez;
      if (destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
      return copia;
    });
  }

  return (
    <div className="stack g20">
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}

      <PainelRascunhoIA ia={ia} textoOrigem={rascunhoInicial.texto_origem} temConteudo={explicacao.length + fases.length > 0} desabilitado={ocupado} />

      <Panel style={{ gap: 14 }}>
        <div className="row between" style={{ alignItems: "center" }}>
          <h2 style={{ fontSize: 15.5 }}>Explicação (Parte 1, até 12 passos)</h2>
          {explicacao.length < 12 && (
            <Button variant="line" sm onClick={() => setExplicacao((atual) => [...atual, novoPasso(atual.length)])}>
              Adicionar passo
            </Button>
          )}
        </div>
        {explicacao.length === 0 && <p className="muted">Nenhum passo ainda.</p>}
        {explicacao.map((passo, i) => (
          <div key={i} className="stack g8" style={{ border: "1px solid var(--linha)", borderRadius: 8, padding: 10 }}>
            <div className="row between" style={{ alignItems: "center" }}>
              <span className="small muted">Passo {i + 1}</span>
              <div className="row g6">
                <Button variant="line" sm disabled={i === 0} onClick={() => moverPasso(i, -1)}>
                  <Icon name="left" size={13} style={{ transform: "rotate(90deg)" }} />
                </Button>
                <Button variant="line" sm disabled={i === explicacao.length - 1} onClick={() => moverPasso(i, 1)}>
                  <Icon name="down" size={13} />
                </Button>
                <Button variant="line" sm onClick={() => setExplicacao((atual) => atual.filter((_, k) => k !== i).map((p, k) => ({ ...p, ordem: k })))}>
                  Tirar
                </Button>
              </div>
            </div>
            <Field label="Texto">
              <textarea className="input" rows={2} value={passo.texto} onChange={(e) => mudarPasso(i, { texto: e.target.value })} />
            </Field>
            <Field label="Reação da Vitória ao mostrar o passo">
              <select className="input" value={passo.expressao} onChange={(e) => mudarPasso(i, { expressao: e.target.value as PassoExplicacao["expressao"] })}>
                {EXPRESSOES_VITORIA.map((ex) => (
                  <option key={ex} value={ex}>
                    {ROTULO_DA_EXPRESSAO[ex]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="row g8" style={{ alignItems: "center" }}>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const arquivo = e.target.files?.[0];
                  if (!arquivo) return;
                  setOcupado(true);
                  try {
                    const id = await enviarArquivo(arquivo, "treinamento_imagem");
                    mudarPasso(i, { imagem_path: id });
                  } finally {
                    setOcupado(false);
                  }
                }}
              />
              {passo.imagem_path && <ImagemDoTreinamento arquivoId={passo.imagem_path} alt={`Imagem do passo ${i + 1}`} style={{ maxWidth: 160 }} />}
            </div>
            <MetaIADoItem item={passo} aoConfirmar={() => passo.ia && mudarPasso(i, { ia: { ...passo.ia, conferido: true } })} />
          </div>
        ))}
      </Panel>

      <Panel style={{ gap: 14 }}>
        <h2 style={{ fontSize: 15.5 }}>Cenário (opcional)</h2>
        <div className="row g8" style={{ alignItems: "center" }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) enviarCenario(arquivo);
            }}
          />
          {cenarioPath && <ImagemDoTreinamento arquivoId={cenarioPath} alt="Cenário" style={{ maxWidth: 200 }} />}
        </div>
      </Panel>

      <Panel style={{ gap: 14 }}>
        <div className="row between" style={{ alignItems: "center" }}>
          <h2 style={{ fontSize: 15.5 }}>Fases do jogo (3 a 10 para publicar)</h2>
          <div className="row g6">
            <select className="input" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoDeFase)}>
              {TIPOS_DE_FASE.map((t) => (
                <option key={t.tipo} value={t.tipo}>
                  {t.rotulo}
                </option>
              ))}
            </select>
            {fases.length < 10 && (
              <Button variant="line" sm onClick={() => setFases((atual) => [...atual, faseEmBranco(novoTipo)])}>
                Adicionar fase
              </Button>
            )}
          </div>
        </div>
        {fases.length === 0 && <p className="muted">Nenhuma fase ainda.</p>}
        {fases.map((fase, i) => (
          <div key={i} className="stack g8" style={{ border: "1px solid var(--linha)", borderRadius: 8, padding: 10 }}>
            <div className="row between" style={{ alignItems: "center" }}>
              <span className="small muted">
                Fase {i + 1} · {TIPOS_DE_FASE.find((t) => t.tipo === fase.tipo)?.rotulo}
              </span>
              <div className="row g6">
                <Button variant="line" sm disabled={i === 0} onClick={() => moverFase(i, -1)}>
                  <Icon name="left" size={13} style={{ transform: "rotate(90deg)" }} />
                </Button>
                <Button variant="line" sm disabled={i === fases.length - 1} onClick={() => moverFase(i, 1)}>
                  <Icon name="down" size={13} />
                </Button>
                <Button variant="line" sm onClick={() => setFases((atual) => atual.filter((_, k) => k !== i))}>
                  Tirar
                </Button>
              </div>
            </div>
            <EditorFase fase={fase} aoMudar={(nova) => setFases((atual) => atual.map((f, k) => (k === i ? nova : f)))} />
            <MetaIADoItem
              item={fase}
              aoConfirmar={() => setFases((atual) => atual.map((f, k) => (k === i && f.ia ? { ...f, ia: { ...f.ia, conferido: true } } : f)))}
              acoes={
                ia.situacao.pode_ajustar && (
                  <Button variant="line" sm disabled={travado} onClick={() => ia.regerarFase(i)}>
                    Regerar esta fase com a Vitória
                  </Button>
                )
              }
            />
          </div>
        ))}
      </Panel>

      {pendencias.length > 0 && (
        <Notice tone="al" icon="alert">
          <span className="stack g4">
            <span>
              {pendencias.length === 1 ? "Há 1 pendência" : `Há ${pendencias.length} pendências`} do rascunho da Vitória. Edite o item ou confirme-o como está para publicar:
            </span>
            {pendencias.map((p, k) => (
              <span key={k} className="small">
                {p.parte === "passo" ? "Passo" : "Fase"} {p.indice + 1}: {p.mensagem}
              </span>
            ))}
          </span>
        </Notice>
      )}

      <div className="row g8 wrap">
        <Button variant="p" disabled={travado} onClick={salvar}>
          {ocupado ? "Salvando…" : "Salvar rascunho"}
        </Button>
        <Button
          variant="line"
          disabled={fases.length === 0 || travado}
          onClick={async () => {
            // Salva antes: a pré-visualização abre a tentativa pela rota da api, que lê o rascunho gravado, não o estado local.
            if (await salvar()) setMostrarPreVisualizacao(true);
          }}
        >
          Salvar e pré-visualizar
        </Button>
        <Button
          variant="d"
          disabled={!publicavel || travado}
          aria-disabled={!publicavel}
          onClick={async () => {
            // Publicar lê o rascunho gravado no servidor: salva primeiro, para não publicar uma versão sem as últimas edições.
            if (await salvar()) setMostrarPublicar(true);
          }}
        >
          Publicar
        </Button>
      </div>
      {(explicacao.length < 1 || fases.length < 3) && <span className="small muted">Para publicar: ao menos 1 passo de explicação e 3 fases.</span>}

      {mostrarPreVisualizacao && (
        <Panel style={{ gap: 14 }}>
          <div className="row between" style={{ alignItems: "center" }}>
            <h2 style={{ fontSize: 15.5 }}>Pré-visualização (não pontua)</h2>
          </div>
          <JogoTreinamentoServico
            atividadeCodigo={codigo}
            descricao={descricao}
            explicacao={explicacao}
            cenarioPath={cenarioPath}
            pontua={false}
            abrirTentativa={() => chamar<TentativaAberta>("POST", `/treinamentos/${encodeURIComponent(codigo)}/rascunho/pre-visualizar/tentativas`)}
            aoFechar={() => setMostrarPreVisualizacao(false)}
          />
        </Panel>
      )}

      {mostrarPublicar && (
        <Panel style={{ gap: 14 }}>
          <h2 style={{ fontSize: 15.5 }}>Publicar</h2>
          <p style={{ fontSize: 14 }}>{termo}</p>
          <label className="row g8" style={{ alignItems: "center" }}>
            <input type="checkbox" checked={termoAceito} onChange={(e) => setTermoAceito(e.target.checked)} />
            Declaro que revisei e estou de acordo.
          </label>
          {termoAceito && <AssinaturaCanvas onSalvar={publicarComAssinatura} rotuloSalvar="Assinar e publicar" desabilitado={ocupado} />}
          <Button variant="line" sm onClick={() => setMostrarPublicar(false)}>
            Cancelar
          </Button>
        </Panel>
      )}

      <Panel style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15.5 }}>Versões</h2>
        {versoes.length === 0 ? (
          <p className="muted">Nenhuma versão ainda.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {versoes.map((v) => (
              <li key={v.versao_id} className="row between" style={{ fontSize: 13.5 }}>
                <span>
                  {`v${v.versao}`}{" "}
                  {v.estado === "rascunho" ? <Badge tone="al">Rascunho</Badge> : v.estado === "publicada" ? <Badge tone="enc">Publicada</Badge> : <Badge tone="neu">Substituída</Badge>}
                </span>
                <span className="small muted">
                  {v.estado === "rascunho" ? `${v.total_passos} passos, ${v.total_fases} fases` : `Publicada em ${dataHora(v.publicada_em)} por ${v.publicada_por_nome ?? "—"}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel style={{ gap: 10 }}>
        <h2 style={{ fontSize: 15.5 }}>Problemas reportados</h2>
        {reportes.length === 0 ? (
          <p className="muted">Nenhum reporte.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {reportes.map((r) => (
              <li key={r.id} className="stack g4" style={{ fontSize: 13.5 }}>
                <span>
                  {r.fase !== null ? `Fase ${r.fase + 1}` : "Geral"} · {r.usuario_nome} · {dataHora(r.criado_em)}
                  {r.tratado_em && (
                    <>
                      {" "}
                      <Badge tone="enc">Tratado</Badge>
                    </>
                  )}
                </span>
                <span className="muted">{r.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
