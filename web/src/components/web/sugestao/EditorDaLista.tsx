"use client";

import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, MensagemDeErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { CATEGORIAS, UNIDADES_SUGERIDAS, rotuloDaCategoria, type CategoriaMaterial, type Material } from "@/lib/catalogo";
import { itemDigitado, itemDoCatalogo, lerQuantidade, type ItemEmEdicao } from "@/lib/sugestao-materiais";
import { useBuscaDeMateriais } from "./useBuscaDeMateriais";

interface EditorDaListaProps {
  itens: ItemEmEdicao[];
  aoMudar: (itens: ItemEmEdicao[]) => void;
  /** Quem escreve a sugestão pode digitar o que não achou; quem avalia liga o item a um material do catálogo (ou o cadastra). */
  permitirDigitar?: boolean;
  /** Prefixo dos ids dos campos (a tela pode ter mais de um editor). */
  idBase: string;
  /** A mensagem do formulário para a lista como um todo ("inclua ao menos um item"). */
  erro?: string;
  /** Quem avalia: o item digitado é cadastrado no catálogo ao aceitar (o autor o deixa para o supervisor ligar). */
  avaliando?: boolean;
}

/**
 * Editor da lista de materiais de uma sugestão: busca no catálogo (só os ativos), item digitado ("Não achei"), quantidade por
 * execução, observação e ordem. É controlado: quem usa guarda a lista (no formulário) e recebe cada mudança. Diferente do
 * editor do admin (`EditorDoServico`), não grava nada: a lista só vira a do serviço quando o supervisor aceita.
 */
export function EditorDaLista({ itens, aoMudar, permitirDigitar = true, idBase, erro, avaliando = false }: EditorDaListaProps) {
  const idBusca = `${idBase}-busca`;
  const idDigitado = useId();
  const [busca, setBusca] = useState("");
  const resultados = useBuscaDeMateriais(busca);
  const [digitando, setDigitando] = useState(false);
  const [novo, setNovo] = useState<{ descricao: string; unidade: string; categoria: CategoriaMaterial }>({ descricao: "", unidade: "un", categoria: "material" });
  const [erroDoNovo, setErroDoNovo] = useState<string | null>(null);

  const jaNaLista = new Set(itens.map((i) => i.material_id).filter((id): id is string => !!id));

  const mudar = (chave: string, campos: Partial<ItemEmEdicao>) => aoMudar(itens.map((i) => (i.chave === chave ? { ...i, ...campos } : i)));
  const mover = (k: number, para: number) => {
    const copia = [...itens];
    const [tirado] = copia.splice(k, 1);
    copia.splice(para, 0, tirado!);
    aoMudar(copia);
  };

  function adicionar(m: Material) {
    aoMudar([...itens, itemDoCatalogo(m)]);
    setBusca("");
  }

  function adicionarDigitado() {
    const descricao = novo.descricao.trim();
    const unidade = novo.unidade.trim();
    if (!descricao) return setErroDoNovo("Descreva o item.");
    if (!unidade) return setErroDoNovo("Informe a unidade (un, m, kg…).");
    aoMudar([...itens, itemDigitado({ descricao, unidade, categoria: novo.categoria })]);
    setNovo({ descricao: "", unidade: novo.unidade, categoria: novo.categoria });
    setErroDoNovo(null);
    setDigitando(false);
  }

  return (
    <div className="stack g12">
      {itens.length === 0 ? (
        <p className="muted" style={{ fontSize: 13.5 }}>
          Nenhum item na lista. Busque no catálogo abaixo{permitirDigitar ? " ou digite o que não achar" : ""}.
        </p>
      ) : (
        <div role="list" aria-label="Itens da lista">
          {itens.map((item, k) => {
            const quantidadeInvalida = Number.isNaN(lerQuantidade(item.quantidade));
            const idQuantidade = `${idBase}-${item.chave}-quantidade`;
            return (
              <div key={item.chave} role="listitem" className="editor-material">
                <span style={{ fontSize: 13.5, minWidth: 0 }}>
                  <strong>{item.descricao}</strong>
                  <span className="small" style={{ display: "block", color: "var(--ink4)" }}>
                    {rotuloDaCategoria[item.categoria]} · {item.unidade}
                    {item.codigo ? ` · ${item.codigo}` : ""}
                    {!item.ativo && " · desativado"}
                    {item.material_id === null && (avaliando ? " · novo: será cadastrado no catálogo ao aceitar" : " · digitado por você, ainda fora do catálogo")}
                  </span>
                </span>
                <input
                  className="input"
                  inputMode="decimal"
                  id={idQuantidade}
                  aria-label={`Quantidade de ${item.descricao}, em ${item.unidade}`}
                  aria-invalid={quantidadeInvalida ? true : undefined}
                  placeholder="Qtd."
                  title="Quantidade por execução; vazio = conforme a necessidade"
                  value={item.quantidade}
                  onChange={(e) => mudar(item.chave, { quantidade: e.target.value })}
                />
                <input
                  className="input em-obs"
                  aria-label={`Observação de ${item.descricao}`}
                  placeholder="Observação (opcional)"
                  maxLength={200}
                  value={item.observacao}
                  onChange={(e) => mudar(item.chave, { observacao: e.target.value })}
                />
                <span className="row g4 em-acoes" style={{ justifyContent: "flex-end" }}>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label={`Subir ${item.descricao}`} disabled={k === 0} onClick={() => mover(k, k - 1)}>
                    <Icon name="left" size={13} style={{ transform: "rotate(90deg)" }} />
                  </Button>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label={`Descer ${item.descricao}`} disabled={k === itens.length - 1} onClick={() => mover(k, k + 1)}>
                    <Icon name="down" size={13} />
                  </Button>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label={`Tirar ${item.descricao} da lista`} onClick={() => aoMudar(itens.filter((i) => i.chave !== item.chave))}>
                    <Icon name="x" size={13} />
                  </Button>
                </span>
                {quantidadeInvalida && (
                  <div className="em-erro">
                    <MensagemDeErro>
                      <strong>{item.descricao}:</strong> a quantidade precisa ser um número maior que zero, ou ficar vazia.
                    </MensagemDeErro>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {erro && <MensagemDeErro>{erro}</MensagemDeErro>}

      <Field label="Adicionar do catálogo" htmlFor={idBusca}>
        <input
          id={idBusca}
          className="input"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
          placeholder="Busque pela descrição ou pelo código do SAP"
          autoComplete="off"
        />
      </Field>
      {resultados !== null &&
        (resultados.length === 0 ? (
          <span className="small muted">Nenhum material ativo encontrado{permitirDigitar ? ". Se não existir, digite o item logo abaixo." : "."}</span>
        ) : (
          <ul className="busca-material">
            {resultados.map((m) => (
              <li key={m.id}>
                <button type="button" disabled={jaNaLista.has(m.id)} onClick={() => adicionar(m)}>
                  <span>
                    {m.descricao}
                    {m.codigo && <span className="small mono"> · {m.codigo}</span>}
                  </span>
                  <span className="row g6">
                    <Badge tone="neu" style={{ padding: "0 7px", fontSize: 11 }}>
                      {rotuloDaCategoria[m.categoria]}
                    </Badge>
                    <span className="small">{jaNaLista.has(m.id) ? "na lista" : m.unidade}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {permitirDigitar &&
        (digitando ? (
          <fieldset className="sg-digitado" aria-labelledby={idDigitado}>
            <legend id={idDigitado}>Não achei no catálogo</legend>
            <p className="small muted">{avaliando ? "Descreva o item. Ele é cadastrado no catálogo quando você aceitar." : "Descreva o item. O supervisor liga a um material do catálogo ou o cadastra ao aceitar."}</p>
            <div className="sg-digitado-campos">
              <Field label="Descrição" htmlFor={`${idBase}-novo-descricao`}>
                <input id={`${idBase}-novo-descricao`} className="input" maxLength={200} value={novo.descricao} onChange={(e) => setNovo({ ...novo, descricao: e.target.value })} />
              </Field>
              <Field label="Unidade" htmlFor={`${idBase}-novo-unidade`}>
                <input id={`${idBase}-novo-unidade`} className="input" list={`${idBase}-unidades`} maxLength={20} value={novo.unidade} onChange={(e) => setNovo({ ...novo, unidade: e.target.value })} />
                <datalist id={`${idBase}-unidades`}>
                  {UNIDADES_SUGERIDAS.map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </Field>
              <Field label="Categoria" htmlFor={`${idBase}-novo-categoria`}>
                <select id={`${idBase}-novo-categoria`} className="select" value={novo.categoria} onChange={(e) => setNovo({ ...novo, categoria: e.target.value as CategoriaMaterial })}>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {rotuloDaCategoria[c]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {erroDoNovo && <MensagemDeErro>{erroDoNovo}</MensagemDeErro>}
            <div className="row g8">
              <Button variant="p" sm onClick={adicionarDigitado}>
                Incluir na lista
              </Button>
              <Button
                variant="line"
                sm
                onClick={() => {
                  setDigitando(false);
                  setErroDoNovo(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </fieldset>
        ) : (
          <div>
            <Button variant="ghost" sm onClick={() => setDigitando(true)}>
              <Icon name="plus" size={13} />
              Não achei no catálogo
            </Button>
          </div>
        ))}
    </div>
  );
}
