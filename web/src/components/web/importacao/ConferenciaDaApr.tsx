"use client";

import { useId } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { Campo, SeloDoEstado } from "./CampoDaConferencia";
import type { AprConferidaParaRegistro, AprLida, EstadoDoCampo, FuncaoNaApr, ItemDoModeloApr, ModeloDaAprParaConferencia, RespostaDaApr } from "./tipos-digitalizacao";

/** Uma pessoa da tabela de participantes, editável; `estado` e `aviso` são o que a conferência achou ao ler (somem quando a linha é nova). */
export interface PessoaDaApr {
  nome: string;
  matricula: string;
  funcao: FuncaoNaApr;
  estado: EstadoDoCampo | null;
  aviso: string | null;
}

/** O que o admin edita da APR em papel de uma OS: a APR lida, como o formulário a guarda. */
export interface EdicaoDaApr {
  /** Registrar a APR junto com a OS (senão, só a OS entra e a folha da APR fica nas imagens do PDF). */
  incluir: boolean;
  modeloId: string;
  dataHora: string;
  servico: string;
  participantes: PessoaDaApr[];
  /** Só os itens que a folha traz marcados: a resposta de cada um pelo id do item. */
  respostas: Record<string, RespostaDaApr>;
  /** Conferiu a APR com as folhas. */
  conferida: boolean;
}

const limpo = (v: string) => (v.trim() === "" ? null : v.trim());

/** A edição que sai da leitura; `null` quando a OS não trouxe folha de APR. */
export function aprInicial(apr: AprLida | null | undefined): EdicaoDaApr | null {
  if (!apr) return null;
  return {
    incluir: true,
    modeloId: apr.modelo?.id ?? "",
    dataHora: apr.data_hora ?? "",
    servico: apr.servico ?? "",
    participantes: apr.participantes.map((p) => ({ nome: p.nome ?? "", matricula: p.matricula ?? "", funcao: p.funcao, estado: p.estado, aviso: p.aviso })),
    respostas: Object.fromEntries(apr.respostas.map((r) => [r.item_id, r.resposta])),
    conferida: false,
  };
}

/** O que ainda impede a APR de ser registrada com a OS (vazio quando ela não vai junto). */
export function pendenciasDaApr(e: EdicaoDaApr | null, modelos: ModeloDaAprParaConferencia[] | null): string[] {
  if (!e?.incluir) return [];
  const lista: string[] = [];
  if (!modelos) lista.push("Aguarde os modelos de APR carregarem (ou desmarque “Registrar a APR com a OS”)");
  else if (!e.modeloId) lista.push("Escolha o modelo da APR (ou desmarque “Registrar a APR com a OS”)");
  if (e.participantes.some((p) => p.nome.trim() === "")) lista.push("Toda pessoa da APR precisa de nome (ou remova a linha)");
  if (e.participantes.filter((p) => p.funcao === "responsavel").length > 1) lista.push("A APR só tem um Supervisor da Atividade");
  if (!e.conferida) lista.push("Confirme que conferiu a APR com as folhas");
  return lista;
}

/** A APR como a `api` a recebe: só as respostas dos itens do modelo escolhido. */
export function aprParaRegistro(e: EdicaoDaApr, modelos: ModeloDaAprParaConferencia[]): AprConferidaParaRegistro {
  const itens = new Set(modelos.find((m) => m.id === e.modeloId)?.itens.map((i) => i.id));
  return {
    modelo_id: e.modeloId,
    data_hora: limpo(e.dataHora),
    servico: limpo(e.servico),
    participantes: e.participantes.map((p) => ({ nome: p.nome.trim(), matricula: limpo(p.matricula), funcao: p.funcao })),
    respostas: Object.entries(e.respostas)
      .filter(([item]) => itens.has(item))
      .map(([item_id, resposta]) => ({ item_id, resposta })),
  };
}

/** Os itens que o papel marcou com a resposta que bloquearia uma APR nova no sistema (só o admin vê isto). */
function bloqueantes(itens: ItemDoModeloApr[], respostas: Record<string, RespostaDaApr>) {
  return itens.filter((i) => i.resposta_bloqueante !== null && respostas[i.id] === i.resposta_bloqueante);
}

const OPCOES: { valor: RespostaDaApr | ""; rotulo: string }[] = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
  { valor: "na", rotulo: "N/A" },
  { valor: "", rotulo: "Em branco" },
];

interface ItemDaAprProps {
  grupo: string;
  item: ItemDoModeloApr;
  resposta: RespostaDaApr | undefined;
  desabilitado: boolean;
  aoEscolher: (resposta: RespostaDaApr | "") => void;
}

function ItemDaApr({ grupo, item, resposta, desabilitado, aoEscolher }: ItemDaAprProps) {
  const bloqueia = item.resposta_bloqueante !== null && resposta === item.resposta_bloqueante;
  return (
    <li className="apr-item" data-bloqueia={bloqueia || undefined}>
      <span className="apr-item-texto" id={`${grupo}-t`}>
        <span className="mono small">{item.ordem}.</span> {item.risco && <span className="small">{item.risco}: </span>}
        {item.texto}
        {bloqueia && (
          <>
            {" "}
            <Badge tone="blq">
              <Icon name="octagon" size={13} />
              Bloquearia uma APR nova
            </Badge>
          </>
        )}
      </span>
      <div className="apr-ops" role="radiogroup" aria-labelledby={`${grupo}-t`}>
        {OPCOES.filter((o) => o.valor !== "na" || item.permite_na || resposta === "na").map((o) => (
          <label key={o.valor || "branco"} className="apr-op" data-marcada={(resposta ?? "") === o.valor || undefined}>
            <input type="radio" name={grupo} checked={(resposta ?? "") === o.valor} disabled={desabilitado} onChange={() => aoEscolher(o.valor)} />
            {o.rotulo}
          </label>
        ))}
      </div>
    </li>
  );
}

interface ConferenciaDaAprProps {
  lida: AprLida;
  /** Os modelos com os itens; `null` enquanto carregam. */
  modelos: ModeloDaAprParaConferencia[] | null;
  erroDosModelos: string | null;
  edicao: EdicaoDaApr;
  /** A OS vai ser registrada (marcada e dentro das regras): fora disso a APR não se edita. */
  ativa: boolean;
  aoMudar: (edicao: EdicaoDaApr) => void;
}

/** `[2]` → `folha 2`; `[2, 3]` → `folhas 2 e 3`. */
const folhas = (paginas: number[]) => (paginas.length === 1 ? `folha ${paginas[0]}` : `folhas ${paginas.slice(0, -1).join(", ")} e ${paginas.at(-1)}`);

/**
 * A APR em papel de uma OS na conferência da Digitalização: o modelo, o que está escrito à mão (data e hora, serviço, quem
 * participou) e a marca de cada item. Não é uma APR do sistema: não vale como APR do dia, não pontua e não bloqueia nada, porque o
 * serviço já foi feito; as respostas que bloqueariam uma APR nova só aparecem aqui, para o admin, como aviso. As assinaturas e as
 * rubricas ficam só nas imagens das folhas.
 */
export function ConferenciaDaApr({ lida, modelos, erroDosModelos, edicao, ativa, aoMudar }: ConferenciaDaAprProps) {
  const base = useId();
  const id = (campo: string) => `${base}-${campo}`;
  const desabilitado = !ativa || !edicao.incluir;
  const modelo = modelos?.find((m) => m.id === edicao.modeloId) ?? null;
  const itens = modelo?.itens ?? [];
  const marcadas = itens.filter((i) => edicao.respostas[i.id] !== undefined).length;
  const avisaveis = bloqueantes(itens, edicao.respostas);
  const mudarPessoa = (i: number, nova: Partial<PessoaDaApr>) => aoMudar({ ...edicao, participantes: edicao.participantes.map((p, j) => (j === i ? { ...p, ...nova } : p)) });
  const marcar = (item: string, resposta: RespostaDaApr | "") => {
    const respostas = { ...edicao.respostas };
    if (resposta) respostas[item] = resposta;
    else delete respostas[item];
    aoMudar({ ...edicao, respostas });
  };

  return (
    <div className="manuscrito apr-papel">
      <div className="row between wrap" style={{ alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 2, minWidth: 0 }}>
          <h4 className="row g8 wrap" style={{ fontSize: 15 }}>
            <Icon name="file" size={16} />
            APR em papel
            <Badge tone="neu">{folhas(lida.paginas)}</Badge>
          </h4>
          <span className="small">
            {lida.lido_por === "ia"
              ? "Lida pela IA. Ela erra dígitos e linhas sem sinal de dúvida: confira com a folha ao lado."
              : "Preencha com a folha ao lado (a IA não leu esta APR)."}{" "}
            Não é uma APR do sistema: não vale como APR do dia, não pontua e não bloqueia nada.
          </span>
        </div>
        <label className="row g8" style={{ fontSize: 14, fontWeight: 600, cursor: ativa ? "pointer" : "default" }}>
          <input type="checkbox" checked={edicao.incluir} disabled={!ativa} onChange={(e) => aoMudar({ ...edicao, incluir: e.target.checked })} />
          Registrar a APR com a OS
        </label>
      </div>

      {edicao.incluir && (
        <>
          {lida.avisos.length > 0 && (
            <Notice tone="info" icon="info">
              <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}>
                {lida.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </Notice>
          )}
          {erroDosModelos && (
            <Notice tone="blq" icon="octagon" role="alert">
              Não foi possível carregar os modelos de APR: {erroDosModelos}
            </Notice>
          )}

          <div className="conferencia-campos">
            <Campo
              id={id("modelo")}
              rotulo="Modelo da APR"
              estado={lida.modelo ? "confere" : "faltando"}
              obrigatorio
              largo
              dica="Trocar o modelo limpa as respostas marcadas abaixo (os itens são de cada modelo)."
            >
              <select
                id={id("modelo")}
                className="select"
                value={edicao.modeloId}
                disabled={desabilitado || !modelos}
                onChange={(e) => aoMudar({ ...edicao, modeloId: e.target.value, respostas: e.target.value === edicao.modeloId ? edicao.respostas : {} })}
              >
                <option value="">{modelos ? "Escolha o modelo" : "Carregando os modelos…"}</option>
                {modelos?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.codigo} — {m.titulo} (versão {m.versao}){m.arquivado ? " · excluído" : ""}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id={id("data")} rotulo="Data e hora da APR" estado={lida.data_hora ? "duvidoso" : "faltando"}>
              <input id={id("data")} className="input" type="datetime-local" value={edicao.dataHora} disabled={desabilitado} onChange={(e) => aoMudar({ ...edicao, dataHora: e.target.value })} />
            </Campo>
            <Campo id={id("servico")} rotulo="Serviço" estado={lida.servico ? "duvidoso" : "faltando"}>
              <input id={id("servico")} className="input" value={edicao.servico} disabled={desabilitado} onChange={(e) => aoMudar({ ...edicao, servico: e.target.value })} />
            </Campo>
          </div>

          <div className="stack g8">
            <span className="lbl">Quem participou</span>
            {edicao.participantes.length === 0 && <span className="small">Nenhuma pessoa lida: adicione quem consta na tabela da APR, se quiser guardar.</span>}
            {edicao.participantes.map((p, i) => (
              <div key={i} className="apr-pessoa">
                <input
                  className="input"
                  aria-label={`Nome da pessoa ${i + 1}`}
                  placeholder="Nome"
                  value={p.nome}
                  disabled={desabilitado}
                  onChange={(e) => mudarPessoa(i, { nome: e.target.value, estado: null, aviso: null })}
                />
                <input
                  className="input mono"
                  aria-label={`Matrícula da pessoa ${i + 1}`}
                  placeholder="Matrícula"
                  value={p.matricula}
                  disabled={desabilitado}
                  onChange={(e) => mudarPessoa(i, { matricula: e.target.value.replace(/\s+/g, ""), estado: null, aviso: null })}
                />
                <select className="select" aria-label={`Função da pessoa ${i + 1}`} value={p.funcao} disabled={desabilitado} onChange={(e) => mudarPessoa(i, { funcao: e.target.value as FuncaoNaApr })}>
                  <option value="responsavel">Supervisor da Atividade</option>
                  <option value="executor">Executante</option>
                </select>
                <Button variant="line" sm aria-label={`Remover a pessoa ${i + 1}`} disabled={desabilitado} onClick={() => aoMudar({ ...edicao, participantes: edicao.participantes.filter((_, j) => j !== i) })}>
                  <Icon name="trash" size={16} />
                </Button>
                {(p.estado || p.aviso) && (
                  <span className="apr-pessoa-estado small">
                    {p.estado && <SeloDoEstado estado={p.estado} />} {p.aviso}
                  </span>
                )}
              </div>
            ))}
            <div>
              <Button
                variant="line"
                sm
                disabled={desabilitado || edicao.participantes.length >= 20}
                onClick={() => aoMudar({ ...edicao, participantes: [...edicao.participantes, { nome: "", matricula: "", funcao: "executor", estado: null, aviso: null }] })}
              >
                <Icon name="plus" size={16} />
                Adicionar pessoa
              </Button>
            </div>
          </div>

          <details className="conferencia-mais">
            <summary>
              Respostas dos itens{modelo ? ` · ${marcadas} de ${itens.length} marcados` : ""}
              {avisaveis.length > 0 && ` · ${avisaveis.length} com resposta que bloquearia`}
            </summary>
            {!modelo ? (
              <p className="small">Escolha o modelo da APR para marcar as respostas.</p>
            ) : (
              <div className="stack g8">
                <span className="small">Marque a coluna que está assinalada na folha. Item sem marca (como a medida de um risco que não foi marcado) fica “Em branco”.</span>
                <ol className="apr-itens">
                  {itens.map((item) => (
                    <ItemDaApr key={item.id} grupo={`${base}-${item.id}`} item={item} resposta={edicao.respostas[item.id]} desabilitado={desabilitado} aoEscolher={(r) => marcar(item.id, r)} />
                  ))}
                </ol>
              </div>
            )}
          </details>

          {avisaveis.length > 0 && (
            <Notice tone="al" icon="alert">
              {avisaveis.length === 1 ? "1 resposta do papel bloquearia" : `${avisaveis.length} respostas do papel bloqueariam`} uma APR nova no sistema. Como o serviço já foi feito, a APR é
              registrada como está no papel, sem bloquear nada. Confira se a marca foi bem lida.
            </Notice>
          )}

          <label className="row g8" style={{ fontSize: 14, fontWeight: 600, cursor: ativa ? "pointer" : "default" }}>
            <input type="checkbox" checked={edicao.conferida} disabled={desabilitado} onChange={(e) => aoMudar({ ...edicao, conferida: e.target.checked })} />
            Conferi a APR com as folhas
          </label>
        </>
      )}
    </div>
  );
}
