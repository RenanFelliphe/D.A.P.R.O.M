"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BotaoExcluir } from "@/components/web/BotaoExcluir";
import { CATEGORIAS, rotuloDaCategoria, type CategoriaMaterial, type Material } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";

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
  const [descricao, setDescricao] = useState(material.descricao);
  const [unidade, setUnidade] = useState(material.unidade);
  const [categoria, setCategoria] = useState<CategoriaMaterial>(material.categoria);
  const [codigo, setCodigo] = useState(material.codigo ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function cancelar() {
    setEditando(false);
    setErro(null);
    setDescricao(material.descricao);
    setUnidade(material.unidade);
    setCategoria(material.categoria);
    setCodigo(material.codigo ?? "");
  }

  async function gravar(dados: { ativo?: boolean } = {}) {
    setOcupado(true);
    setErro(null);
    try {
      const corpo = editando
        ? { codigo: codigo.trim() || null, descricao: descricao.trim(), unidade: unidade.trim(), categoria, ...dados }
        : { codigo: material.codigo, descricao: material.descricao, unidade: material.unidade, categoria: material.categoria, ...dados };
      await chamar("PUT", `/catalogo/materiais/${material.id}`, corpo);
      exibirAviso(dados.ativo === undefined ? `"${corpo.descricao}" salvo.` : dados.ativo ? `"${material.descricao}" reativado.` : `"${material.descricao}" desativado.`);
      setEditando(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar o material");
    } finally {
      setOcupado(false);
    }
  }

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
              <Button variant="line" sm style={{ height: 32 }} onClick={() => gravar({ ativo: !material.ativo })} disabled={ocupado}>
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
        <input className="input" style={{ height: 36, fontSize: 13.5 }} aria-label="Descrição" maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        {erro && (
          <div role="alert" className="small" style={{ color: "var(--blq)", marginTop: 4 }}>
            {erro}
          </div>
        )}
      </td>
      <td>
        <select className="select" aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaMaterial)}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {rotuloDaCategoria[c]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <input className="input mono" style={{ height: 36, fontSize: 13.5 }} aria-label="Unidade" list="unidades-material" maxLength={20} value={unidade} onChange={(e) => setUnidade(e.target.value)} />
      </td>
      <td>
        <input className="input mono" style={{ height: 36, fontSize: 13.5 }} aria-label="Código no SAP" maxLength={40} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
      </td>
      <td>
        <ServicosDoMaterial material={material} />
      </td>
      <td className="acoes-linha">
        <span className="row g6" style={{ justifyContent: "flex-end", alignItems: "flex-start" }}>
          {material.servicos_total === 0 && <BotaoExcluir rotulo="Excluir" pergunta={`Excluir "${material.descricao}"?`} aoExcluir={excluir} desabilitado={ocupado} />}
          <Button variant="p" sm style={{ height: 32 }} onClick={() => gravar()} disabled={ocupado || !descricao.trim() || !unidade.trim()}>
            {ocupado ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="line" sm style={{ height: 32 }} onClick={cancelar} disabled={ocupado}>
            Cancelar
          </Button>
        </span>
      </td>
    </tr>
  );
}
