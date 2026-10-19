"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, idDoErro, MensagemDeErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { caminhoDoServico, rotuloDaCategoria, type ListaDeMateriais, type Material, type MaterialDoServico, type ServicoDoCatalogo } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

type MaterialDoItem = Pick<MaterialDoServico, "material_id" | "codigo" | "descricao" | "unidade" | "categoria" | "ativo">;

/** "3,6" → 3.6; vazio → nulo (conforme a necessidade); o que não é número positivo → `NaN`. */
function lerQuantidade(texto: string): number | null {
  const limpo = texto.trim().replace(",", ".");
  if (limpo === "") return null;
  const n = Number(limpo);
  return Number.isFinite(n) && n > 0 ? n : Number.NaN;
}

/** A lista em edição: o material e o que o admin digitou em cada item (a quantidade como texto, para aceitar "3,6"). */
const esquema = z.object({
  itens: z.array(
    z.object({
      material: z.custom<MaterialDoItem>(),
      quantidade: z.string().refine((v) => !Number.isNaN(lerQuantidade(v)), "A quantidade precisa ser um número maior que zero, ou ficar vazia."),
      observacao: z.string().max(200, "A observação pode ter até 200 caracteres."),
    }),
  ),
});

const RESULTADOS_DA_BUSCA = 8;

const paraEdicao = (m: MaterialDoServico) => ({
  material: m as MaterialDoItem,
  quantidade: m.quantidade === null ? "" : String(m.quantidade).replace(".", ","),
  observacao: m.observacao ?? "",
});

/**
 * Editor da lista de materiais de um serviço (só o admin): busca no cadastro de materiais (só os ativos), quantidade
 * por execução, observação e ordem. Salvar troca a lista inteira (`PUT /catalogo/servicos/{codigo}`).
 */
export function EditorDoServico({ servico, aoFechar }: { servico: ServicoDoCatalogo; aoFechar: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { form, ref, enviar, enviando: ocupado, erroEnvio } = useFormulario(esquema, { itens: servico.materiais.map(paraEdicao) });
  const { register, formState, control } = form;
  const { fields, append, move, remove } = useFieldArray({ control, name: "itens" });
  const erros = formState.errors;
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Material[] | null>(null);

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

  const jaNaLista = new Set(fields.map((i) => i.material.material_id));

  function adicionar(m: Material) {
    append({ material: { material_id: m.id, codigo: m.codigo, descricao: m.descricao, unidade: m.unidade, categoria: m.categoria, ativo: m.ativo }, quantidade: "", observacao: "" });
    setBusca("");
  }

  return (
    <form
      ref={ref}
      noValidate
      className="stack g12"
      onSubmit={enviar(async (v) => {
        await chamar("PUT", caminhoDoServico(servico.codigo), {
          materiais: v.itens.map((i) => ({ material_id: i.material.material_id, quantidade: lerQuantidade(i.quantidade), observacao: i.observacao.trim() || null })),
        });
        exibirAviso(`Materiais do serviço ${servico.codigo} salvos.`);
        aoFechar();
        router.refresh();
      })}
    >
      {fields.length === 0 ? (
        <p className="muted" style={{ fontSize: 13.5 }}>
          Nenhum material na lista. Busque abaixo para adicionar.
        </p>
      ) : (
        <div role="list" aria-label={`Materiais do serviço ${servico.codigo}`}>
          {fields.map((item, k) => {
            const erroDaQuantidade = erros.itens?.[k]?.quantidade?.message;
            const erroDaObservacao = erros.itens?.[k]?.observacao?.message;
            const idDaQuantidade = `material-${servico.codigo}-${item.material.material_id}-quantidade`;
            return (
              <div key={item.id} role="listitem" className="editor-material">
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
                  id={idDaQuantidade}
                  aria-label={`Quantidade de ${item.material.descricao}, em ${item.material.unidade}`}
                  aria-invalid={erroDaQuantidade ? true : undefined}
                  aria-describedby={erroDaQuantidade ? idDoErro(idDaQuantidade) : undefined}
                  placeholder="Qtd."
                  title="Quantidade por execução; vazio = conforme a necessidade"
                  {...register(`itens.${k}.quantidade`)}
                />
                <input
                  className="input em-obs"
                  aria-label={`Observação de ${item.material.descricao}`}
                  aria-invalid={erroDaObservacao ? true : undefined}
                  placeholder="Observação (opcional)"
                  maxLength={200}
                  {...register(`itens.${k}.observacao`)}
                />
                <span className="row g4 em-acoes" style={{ justifyContent: "flex-end" }}>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label="Subir" disabled={k === 0} onClick={() => move(k, k - 1)}>
                    <Icon name="left" size={13} style={{ transform: "rotate(90deg)" }} />
                  </Button>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label="Descer" disabled={k === fields.length - 1} onClick={() => move(k, k + 1)}>
                    <Icon name="down" size={13} />
                  </Button>
                  <Button variant="line" sm style={{ height: 32, padding: "0 8px" }} aria-label={`Tirar ${item.material.descricao} da lista`} onClick={() => remove(k)}>
                    <Icon name="x" size={13} />
                  </Button>
                </span>
                {(erroDaQuantidade ?? erroDaObservacao) && (
                  <div className="em-erro" data-erro tabIndex={-1}>
                    <MensagemDeErro id={erroDaQuantidade ? idDoErro(idDaQuantidade) : undefined}>
                      <strong>{item.material.descricao}:</strong> {erroDaQuantidade ?? erroDaObservacao}
                    </MensagemDeErro>
                  </div>
                )}
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
          onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
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

      <ErroDeEnvio mensagem={erroEnvio} />
      <div className="row g8">
        <Button variant="p" sm type="submit" aria-busy={ocupado} disabled={ocupado}>
          {ocupado ? "Salvando…" : "Salvar lista"}
        </Button>
        <Button variant="line" sm onClick={aoFechar} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
