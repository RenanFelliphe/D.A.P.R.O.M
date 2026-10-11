"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { chamar } from "@/lib/cliente-api";
import type { Local, LocalEscolhido } from "./tipos";

const rotulo = { fontSize: 12 } as const;
const MAXIMO_NA_BUSCA = 15;

interface SeletorLocalProps {
  prefixo: string;
  valor: LocalEscolhido | null;
  onChange: (valor: LocalEscolhido | null) => void;
  /** Permite cadastrar um local novo ali mesmo (`POST /locais`, feito pelo formulário ao enviar). */
  permitirCadastrar?: boolean;
}

/** Escolhe o local de instalação: busca pelo código entre os cadastrados ou, se permitido, informa um novo. */
export function SeletorLocal({ prefixo, valor, onChange, permitirCadastrar = false }: SeletorLocalProps) {
  const [cadastrando, setCadastrando] = useState(valor?.tipo === "novo");
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Local[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const escolhido = valor?.tipo === "existente" ? valor : null;
  const buscando = !cadastrando && !escolhido;

  useEffect(() => {
    if (!buscando) return;
    let ativo = true;
    const espera = setTimeout(async () => {
      try {
        const consulta = new URLSearchParams({ tamanho: String(MAXIMO_NA_BUSCA) });
        if (busca.trim()) consulta.set("codigo", busca.trim());
        const r = await chamar<{ locais: Local[] }>("GET", `/locais?${consulta}`);
        if (ativo) {
          setResultados(r.locais);
          setFalha(null);
        }
      } catch (erro) {
        if (ativo) setFalha(erro instanceof Error ? erro.message : "Não foi possível buscar os locais");
      }
    }, 250);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [busca, buscando]);

  if (cadastrando) {
    const novo = valor?.tipo === "novo" ? valor : { tipo: "novo" as const, codigo: "", endereco: "", plus_code: "", cliente: "" };
    const mudar = (parte: Partial<typeof novo>) => onChange({ ...novo, ...parte });
    return (
      <div className="stack g8" style={{ padding: 12, borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line2)" }}>
        <Field label="Código do local (como no SAP)" htmlFor={`${prefixo}-lc`} labelStyle={rotulo}>
          <input className="input" id={`${prefixo}-lc`} value={novo.codigo} onChange={(e) => mudar({ codigo: e.target.value })} placeholder="Ex.: VILA VELHA/REDE VILA VELHA" />
        </Field>
        <Field label="Endereço" htmlFor={`${prefixo}-le`} labelStyle={rotulo}>
          <input className="input" id={`${prefixo}-le`} value={novo.endereco} onChange={(e) => mudar({ endereco: e.target.value })} />
        </Field>
        <div className="row g8 wrap">
          <Field label="Plus code" htmlFor={`${prefixo}-lp`} labelStyle={rotulo} className="grow">
            <input className="input" id={`${prefixo}-lp`} value={novo.plus_code} onChange={(e) => mudar({ plus_code: e.target.value })} />
          </Field>
          <Field label="Cliente" htmlFor={`${prefixo}-ll`} labelStyle={rotulo} className="grow">
            <input className="input" id={`${prefixo}-ll`} value={novo.cliente} onChange={(e) => mudar({ cliente: e.target.value })} />
          </Field>
        </div>
        <div>
          <Button
            variant="ghost"
            sm
            onClick={() => {
              setCadastrando(false);
              onChange(null);
            }}
          >
            Escolher um local já cadastrado
          </Button>
        </div>
      </div>
    );
  }

  if (escolhido) {
    return (
      <div className="row between g8" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line2)" }}>
        <span className="stack" style={{ lineHeight: 1.3, minWidth: 0 }}>
          <strong style={{ fontSize: 14 }}>{escolhido.codigo}</strong>
          {escolhido.endereco && <span className="small">{escolhido.endereco}</span>}
        </span>
        <Button variant="ghost" sm onClick={() => onChange(null)}>
          Trocar
        </Button>
      </div>
    );
  }

  return (
    <div className="stack g8">
      <Field label="Local de instalação" htmlFor={`${prefixo}-lb`} labelStyle={rotulo}>
        <input className="input" id={`${prefixo}-lb`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Digite parte do código do local" autoComplete="off" />
      </Field>
      {falha && (
        <span className="small" role="alert" style={{ color: "var(--blq)" }}>
          {falha}
        </span>
      )}
      {resultados && resultados.length === 0 && !falha && <span className="small">Nenhum local encontrado.</span>}
      {resultados && resultados.length > 0 && (
        <ul style={{ margin: 0, padding: 0, listStyle: "none", border: "1px solid var(--line2)", borderRadius: 10, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
          {resultados.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                className="aitem"
                style={{ padding: "8px 12px", flexDirection: "column", gap: 0 }}
                onClick={() => onChange({ tipo: "existente", id: l.id, codigo: l.codigo, endereco: l.endereco })}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{l.codigo}</span>
                {l.endereco && <span className="small">{l.endereco}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {permitirCadastrar && (
        <div>
          <Button
            variant="ghost"
            sm
            onClick={() => {
              setCadastrando(true);
              onChange({ tipo: "novo", codigo: busca.trim(), endereco: "", plus_code: "", cliente: "" });
            }}
          >
            O local não está na lista: cadastrar um novo
          </Button>
        </div>
      )}
    </div>
  );
}
