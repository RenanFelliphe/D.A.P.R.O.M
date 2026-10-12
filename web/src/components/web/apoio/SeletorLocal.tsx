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
}

/** Escolhe o local de instalação: busca pelo código entre os que vieram do SAP. */
export function SeletorLocal({ prefixo, valor, onChange }: SeletorLocalProps) {
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState<Local[] | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const buscando = !valor;

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

  if (valor) {
    return (
      <div className="row between g8" style={{ padding: "10px 12px", borderRadius: 10, background: "var(--surface2)", border: "1px solid var(--line2)" }}>
        <span className="stack" style={{ lineHeight: 1.3, minWidth: 0 }}>
          <strong style={{ fontSize: 14 }}>{valor.codigo}</strong>
          {valor.endereco && <span className="small">{valor.endereco}</span>}
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
                onClick={() => onChange({ id: l.id, codigo: l.codigo, endereco: l.endereco })}
              >
                <span style={{ fontSize: 14, fontWeight: 600 }}>{l.codigo}</span>
                {l.endereco && <span className="small">{l.endereco}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
