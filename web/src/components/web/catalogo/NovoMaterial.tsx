"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { CATEGORIAS, rotuloDaCategoria, type CategoriaMaterial } from "@/lib/catalogo";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** Cadastra um material, ferramenta ou EPI no catálogo (`POST /catalogo/materiais`). A página monta o `datalist` das unidades. */
export function NovoMaterial() {
  const router = useRouter();
  const exibirAviso = useToast();
  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [unidade, setUnidade] = useState("un");
  const [categoria, setCategoria] = useState<CategoriaMaterial>("material");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      await chamar("POST", "/catalogo/materiais", { codigo: codigo.trim() || null, descricao: descricao.trim(), unidade: unidade.trim(), categoria });
      exibirAviso(`"${descricao.trim()}" cadastrado.`);
      setCodigo("");
      setDescricao("");
      setUnidade("un");
      setCategoria("material");
      setAberto(false);
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar o material");
    } finally {
      setOcupado(false);
    }
  }

  if (!aberto) {
    return (
      <Button variant="p" sm onClick={() => setAberto(true)}>
        <Icon name="plus" size={16} />
        Novo material
      </Button>
    );
  }

  return (
    <form onSubmit={enviar} className="panel" style={{ gap: 12, width: "100%" }}>
      <h3 style={{ fontSize: 15 }}>Novo material, ferramenta ou EPI</h3>
      <div className="grade2">
        <Field label="Descrição">
          <input className="input" required maxLength={200} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Luva de vaqueta" />
        </Field>
        <Field label="Categoria">
          <select className="select" value={categoria} onChange={(e) => setCategoria(e.target.value as CategoriaMaterial)}>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {rotuloDaCategoria[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unidade">
          <input className="input" required maxLength={20} list="unidades-material" value={unidade} onChange={(e) => setUnidade(e.target.value)} />
        </Field>
        <Field label="Código no SAP (opcional)">
          <input className="input mono" maxLength={40} value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="10002345" />
        </Field>
      </div>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro}
        </Notice>
      )}
      <div className="row g8">
        <Button variant="p" sm type="submit" disabled={ocupado || !descricao.trim() || !unidade.trim()}>
          {ocupado ? "Salvando…" : "Cadastrar"}
        </Button>
        <Button variant="line" sm onClick={() => setAberto(false)} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
