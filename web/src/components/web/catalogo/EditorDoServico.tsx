"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { caminhoDoServico, rotuloDaCategoria, type ListaDeMateriais, type Material, type MaterialDoServico, type ServicoDoCatalogo } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** Um item da lista em edição: o material e o que o admin digitou (a quantidade como texto, para aceitar "3,6"). */
interface ItemEmEdicao {
  material: Pick<MaterialDoServico, "material_id" | "codigo" | "descricao" | "unidade" | "categoria" | "ativo">;
  quantidade: string;
  observacao: string;
}

const RESULTADOS_DA_BUSCA = 8;

const paraEdicao = (m: MaterialDoServico): ItemEmEdicao => ({
  material: m,
  quantidade: m.quantidade === null ? "" : String(m.quantidade).replace(".", ","),
  observacao: m.observacao ?? "",
});

/** "3,6" → 3.6; vazio → nulo (conforme a necessidade); o que não é número positivo → `NaN`. */
function lerQuantidade(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

/**
 * Editor da lista de materiais de um serviço (só o admin): busca no cadastro de materiais (só os ativos), quantidade
 * por execução, observação e ordem. Salvar troca a lista inteira (`PUT /catalogo/servicos/{codigo}`).
 */
export function EditorDoServico({ servico, aoFechar }: { servico: ServicoDoCatalogo; aoFechar: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [itens, setItens] = useState<ItemEmEdicao[]>(() => servico.materiais.map(paraEdicao));
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Material[] | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Busca no cadastro enquanto digita (com uma pequena espera), só entre os materiais ativos.
  useEffect(() => {
    const termo = busca.trim();
    let ativo = true;
    const espera = setTimeout(
      () => {
        if (!termo) return setResultados(null);
        const consulta = new URLSearchParams({ busca: termo, ativo: "true", tamanho: String(RESULTADOS_DA_BUSCA) });
        chamar<ListaDeMateriais>("GET", `/catalogo/materiais?${consulta}`)
          .then((r) => ativo && setResultados(r.materiais))
          .catch(() => ativo && setResultados([]));
      },
      termo ? 250 : 0,
    );
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [busca]);

  const jaNaLista = new Set(itens.map((i) => i.material.material_id));
  const quantidadesInvalidas = itens.filter((i) => Number.isNaN(lerQuantidade(i.quantidade)));

  function adicionar(m: Material) {
    setItens((atual) => [...atual, { material: { material_id: m.id, codigo: m.codigo, descricao: m.descricao, unidade: m.unidade, categoria: m.categoria, ativo: m.ativo }, quantidade: "", observacao: "" }]);
    setBusca("");
  }
  const mudar = (indice: number, parcial: Partial<ItemEmEdicao>) => setItens((atual) => atual.map((i, k) => (k === indice ? { ...i, ...parcial } : i)));
  const mover = (indice: number, passo: -1 | 1) =>
    setItens((atual) => {
      const destino = indice + passo;
      if (destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
      return copia;
    });
  const remover = (indice: number) => setItens((atual) => atual.filter((_, k) => k !== indice));

  async function salvar() {
    setOcupado(true);
    setErro(null);
    try {
      await chamar("PUT", caminhoDoServico(servico.codigo), {
        materiais: itens.map((i) => ({ material_id: i.material.material_id, quantidade: lerQuantidade(i.quantidade), observacao: i.observacao.trim() || null })),
      });
      exibirAviso(`Materiais do serviço ${servico.codigo} salvos.`);
      aoFechar();
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a lista");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="stack g12">
      {itens.length === 0 ? (
        <p className="muted" style={{ fontSize: 13.5 }}>
          Nenhum material na lista. Busque abaixo para adicionar.
        </p>
      ) : (
        <div role="list" aria-label={`Materiais do serviço ${servico.codigo}`}>
          {itens.map((item, k) => {
            const invalida = Number.isNaN(lerQuantidade(item.quantidade));
            return (
              <div key={item.material.material_id} role="listitem" className="editor-material">
                <span style={{ fontSize: 13.5, minWidth: 0 }}>
                  <strong>{item.material.descricao}</strong>
                  <span className="small" style={{ display: "block", color: "var(--ink4)" }}>
                    {rotuloDaCategoria[item.material.categoria]} · {item.material.unidade}
                    {item.material.codigo ? ` · ${item.material.codigo}` : ""}
                    {!item.material.ativo && " · desativado"}
                  </span>
                </span>
                <input
                  className="input"
                  inputMode="decimal"
                  aria-label={`Quantidade de ${item.material.descricao}, em ${item.material.unidade}`}
                  aria-invalid={invalida || undefined}
                  placeholder="Qtd."
                  title="Quantidade por execução; vazio = conforme a necessidade"
                  value={item.quantidade}
                  onChange={(e) => mudar(k, { quantidade: e.target.value })}
                  style={invalida ? { borderColor: "var(--blq)" } : undefined}
                />
                <input
                  className="input em-obs"
                  aria-label={`Observação de ${item.material.descricao}`}
                  placeholder="Observação (opcional)"
                  maxLength={200}
                  value={item.observacao}
                  onChange={(e) => mudar(k, { observacao: e.target.value })}
                />
                <span className="row g4 em-acoes" style={{ justifyContent: "flex-end" }}>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label="Subir" disabled={k === 0} onClick={() => mover(k, -1)}>
                    <Icon name="left" size={13} style={{ transform: "rotate(90deg)" }} />
                  </Button>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label="Descer" disabled={k === itens.length - 1} onClick={() => mover(k, 1)}>
                    <Icon name="down" size={13} />
                  </Button>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label={`Tirar ${item.material.descricao} da lista`} onClick={() => remover(k)}>
                    <Icon name="x" size={13} />
                  </Button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <Field label="Adicionar material, ferramenta ou EPI" htmlFor={`busca-material-${servico.codigo}`}>
        <input
          id={`busca-material-${servico.codigo}`}
          className="input"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Busque pela descrição ou pelo código do SAP"
          autoComplete="off"
        />
      </Field>
      {resultados !== null &&
        (resultados.length === 0 ? (
          <span className="small muted">Nenhum material ativo encontrado. Cadastre-o na aba Materiais.</span>
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

      {quantidadesInvalidas.length > 0 && <span className="small" style={{ color: "var(--blq)" }}>A quantidade precisa ser um número maior que zero, ou ficar vazia.</span>}
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8">
        <Button variant="p" sm onClick={salvar} disabled={ocupado || quantidadesInvalidas.length > 0}>
          {ocupado ? "Salvando…" : "Salvar lista"}
        </Button>
        <Button variant="line" sm onClick={aoFechar} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
