"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CampoDeCelula, ligarAoErro, MensagemDeErro } from "@/components/ui/Field";
import { useFormulario } from "@/components/ui/useFormulario";
import { BotaoExcluir } from "@/components/web/BotaoExcluir";
import { CATEGORIAS, rotuloDaCategoria, type Material } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";

/** Os limites são os da `api` (`PUT /catalogo/materiais/{id}`); o código do SAP é opcional. */
const esquema = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição do material.").max(200, "A descrição pode ter até 200 caracteres."),
  categoria: z.enum(["material", "ferramenta", "epi"], "Escolha a categoria."),
  unidade: z.string().trim().min(1, "Informe a unidade (un, m, kg…).").max(20, "A unidade pode ter até 20 caracteres."),
  codigo: z.string().trim().max(40, "O código do SAP pode ter até 40 caracteres."),
});

/** Quantos serviços usam o material, com o link para eles na aba Serviços. */
function ServicosDoMaterial({ material }: { material: Material }) {
  if (material.servicos_total === 0) return <span className="muted">nenhum</span>;
  return <Link href={`${rotas.app.catalogo}?material_id=${material.id}`}>{material.servicos_total === 1 ? "1 serviço" : `${material.servicos_total} serviços`}</Link>;
}

/**
 * Linha do cadastro de materiais. O admin edita no lugar (descrição, unidade, categoria, código do SAP), desativa o que
 * não deve entrar em novos serviços e exclui o que nenhum serviço usa (a `api` recusa excluir o que está em uso).
 */
export function LinhaMaterial({ material, podeEditar }: { material: Material; podeEditar: boolean }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [editando, setEditando] = useState(false);
  const valoresDoMaterial = { descricao: material.descricao, categoria: material.categoria, unidade: material.unidade, codigo: material.codigo ?? "" };
  const { form, enviar, enviando, erroEnvio, limparErroEnvio } = useFormulario(esquema, valoresDoMaterial);
  const { register, formState } = form;
  const erros = formState.errors;
  // Desativar e reativar não passam pelo formulário: têm o próprio estado e o próprio erro.
  const [alternando, setAlternando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ocupado = alternando || enviando;

  function cancelar() {
    setEditando(false);
    setErro(null);
    limparErroEnvio();
    form.reset(valoresDoMaterial);
  }

  async function alternarAtivo(ativo: boolean) {
    setAlternando(true);
    setErro(null);
    try {
      await chamar("PUT", `/catalogo/materiais/${material.id}`, { codigo: material.codigo, descricao: material.descricao, unidade: material.unidade, categoria: material.categoria, ativo });
      exibirAviso(ativo ? `"${material.descricao}" reativado.` : `"${material.descricao}" desativado.`);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o material");
    } finally {
      setAlternando(false);
    }
  }

  // a linha de uma tabela não pode ser um <form>: o botão Salvar dispara o envio
  const salvar = enviar(async (v) => {
    const descricao = v.descricao.trim();
    await chamar("PUT", `/catalogo/materiais/${material.id}`, { codigo: v.codigo.trim() || null, descricao, unidade: v.unidade.trim(), categoria: v.categoria });
    exibirAviso(`"${descricao}" salvo.`);
    setEditando(false);
    router.refresh();
  });

  async function excluir() {
    await chamar("DELETE", `/catalogo/materiais/${material.id}`);
    exibirAviso(`"${material.descricao}" excluído.`);
    router.refresh();
  }

  if (!editando) {
    return (
      <tr style={material.ativo ? undefined : { opacity: 0.7 }}>
        <td>
          {material.descricao}
          {!material.ativo && (
            <>
              {" "}
              <Badge tone="neu" style={{ padding: "0 7px", fontSize: 11 }}>
                Desativado
              </Badge>
            </>
          )}
          {erro && (
            <div role="alert" className="small" style={{ color: "var(--blq)", marginTop: 4 }}>
              {erro}
            </div>
          )}
        </td>
        <td>{rotuloDaCategoria[material.categoria]}</td>
        <td className="mono">{material.unidade}</td>
        <td className="mono">{material.codigo ?? "—"}</td>
        <td>
          <ServicosDoMaterial material={material} />
        </td>
        {podeEditar && (
          <td className="acoes-linha">
            <span className="row g6" style={{ justifyContent: "flex-end" }}>
              <Button variant="line" sm style={{ height: 32 }} onClick={() => void alternarAtivo(!material.ativo)} disabled={ocupado}>
                {material.ativo ? "Desativar" : "Reativar"}
              </Button>
              <Button variant="line" sm style={{ height: 32 }} onClick={() => setEditando(true)} disabled={ocupado}>
                Editar
              </Button>
            </span>
          </td>
        )}
      </tr>
    );
  }

  return (
    <tr className="nw">
      <td>
        <CampoDeCelula id={`material-${material.id}-descricao`} erro={erros.descricao?.message}>
          <input className="input" style={{ height: 36, fontSize: 13.5 }} aria-label="Descrição" maxLength={200} {...register("descricao")} {...ligarAoErro(`material-${material.id}-descricao`, erros.descricao?.message)} />
        </CampoDeCelula>
        {erroEnvio && <MensagemDeErro>{erroEnvio}</MensagemDeErro>}
      </td>
      <td>
        <select className="select" aria-label="Categoria" {...register("categoria")}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {rotuloDaCategoria[c]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <CampoDeCelula id={`material-${material.id}-unidade`} erro={erros.unidade?.message}>
          <input className="input mono" style={{ height: 36, fontSize: 13.5 }} aria-label="Unidade" list="unidades-material" maxLength={20} {...register("unidade")} {...ligarAoErro(`material-${material.id}-unidade`, erros.unidade?.message)} />
        </CampoDeCelula>
      </td>
      <td>
        <CampoDeCelula id={`material-${material.id}-codigo`} erro={erros.codigo?.message}>
          <input className="input mono" style={{ height: 36, fontSize: 13.5 }} aria-label="Código no SAP" maxLength={40} {...register("codigo")} {...ligarAoErro(`material-${material.id}-codigo`, erros.codigo?.message)} />
        </CampoDeCelula>
      </td>
      <td>
        <ServicosDoMaterial material={material} />
      </td>
      <td className="acoes-linha">
        <span className="row g6" style={{ justifyContent: "flex-end", alignItems: "flex-start" }}>
          {material.servicos_total === 0 && <BotaoExcluir rotulo="Excluir" pergunta={`Excluir "${material.descricao}"?`} aoExcluir={excluir} desabilitado={ocupado} />}
          <Button variant="p" sm style={{ height: 32 }} onClick={salvar} aria-busy={enviando} disabled={ocupado}>
            {enviando ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="line" sm style={{ height: 32 }} onClick={cancelar} disabled={ocupado}>
            Cancelar
          </Button>
        </span>
      </td>
    </tr>
  );
}
