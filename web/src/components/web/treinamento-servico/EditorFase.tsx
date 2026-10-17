"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { chamar } from "@/lib/cliente-api";
import type { Fase } from "@/lib/treinamento-servico";

interface EditorFaseProps {
  fase: Fase;
  aoMudar: (fase: Fase) => void;
}

const campo = { className: "input", style: { width: "100%" } };

/** O editor de uma fase, pelo tipo; cada um edita o gabarito (nunca visto pelo jogador antes de responder). */
export function EditorFase({ fase, aoMudar }: EditorFaseProps) {
  if (fase.tipo === "quiz") return <EditorQuiz fase={fase} aoMudar={aoMudar} />;
  if (fase.tipo === "decisao") return <EditorDecisao fase={fase} aoMudar={aoMudar} />;
  if (fase.tipo === "separar_itens") return <EditorSepararItens fase={fase} aoMudar={aoMudar} />;
  if (fase.tipo === "ligar") return <EditorLigar fase={fase} aoMudar={aoMudar} />;
  return <EditorOrdem fase={fase} aoMudar={aoMudar} />;
}

function EditorQuiz({ fase, aoMudar }: { fase: Extract<Fase, { tipo: "quiz" }>; aoMudar: (f: Fase) => void }) {
  return (
    <div className="stack g8">
      <Field label="Enunciado">
        <input {...campo} value={fase.enunciado} onChange={(e) => aoMudar({ ...fase, enunciado: e.target.value })} />
      </Field>
      <span className="small muted">Opções (marque a certa)</span>
      {fase.opcoes.map((o, i) => (
        <div key={i} className="row g8" style={{ alignItems: "center" }}>
          <input type="radio" name={`certa-${fase.enunciado}-${i}`} checked={fase.correta === i} onChange={() => aoMudar({ ...fase, correta: i })} />
          <input {...campo} value={o} onChange={(e) => aoMudar({ ...fase, opcoes: fase.opcoes.map((x, k) => (k === i ? e.target.value : x)) })} />
          {fase.opcoes.length > 3 && (
            <Button variant="line" sm onClick={() => aoMudar({ ...fase, opcoes: fase.opcoes.filter((_, k) => k !== i), correta: fase.correta > i ? fase.correta - 1 : fase.correta === i ? 0 : fase.correta })}>
              Tirar
            </Button>
          )}
        </div>
      ))}
      {fase.opcoes.length < 4 && (
        <Button variant="line" sm onClick={() => aoMudar({ ...fase, opcoes: [...fase.opcoes, ""] })}>
          Adicionar opção
        </Button>
      )}
      <Field label="Explicação (mostrada depois da resposta)">
        <textarea {...campo} rows={2} value={fase.explicacao} onChange={(e) => aoMudar({ ...fase, explicacao: e.target.value })} />
      </Field>
    </div>
  );
}

function EditorDecisao({ fase, aoMudar }: { fase: Extract<Fase, { tipo: "decisao" }>; aoMudar: (f: Fase) => void }) {
  return (
    <div className="stack g8">
      <Field label="Situação">
        <textarea {...campo} rows={2} value={fase.situacao} onChange={(e) => aoMudar({ ...fase, situacao: e.target.value })} />
      </Field>
      <span className="small muted">Opções e a consequência de cada uma (marque a atitude segura)</span>
      {fase.opcoes.map((o, i) => (
        <div key={i} className="stack g4" style={{ border: "1px solid var(--linha)", borderRadius: 8, padding: 8 }}>
          <div className="row g8" style={{ alignItems: "center" }}>
            <input type="radio" name={`decisao-certa-${i}`} checked={fase.correta === i} onChange={() => aoMudar({ ...fase, correta: i })} />
            <input {...campo} placeholder="Opção" value={o.texto} onChange={(e) => aoMudar({ ...fase, opcoes: fase.opcoes.map((x, k) => (k === i ? { ...x, texto: e.target.value } : x)) })} />
            {fase.opcoes.length > 3 && (
              <Button variant="line" sm onClick={() => aoMudar({ ...fase, opcoes: fase.opcoes.filter((_, k) => k !== i), correta: fase.correta > i ? fase.correta - 1 : fase.correta === i ? 0 : fase.correta })}>
                Tirar
              </Button>
            )}
          </div>
          <input {...campo} placeholder="Consequência" value={o.consequencia} onChange={(e) => aoMudar({ ...fase, opcoes: fase.opcoes.map((x, k) => (k === i ? { ...x, consequencia: e.target.value } : x)) })} />
        </div>
      ))}
      {fase.opcoes.length < 4 && (
        <Button variant="line" sm onClick={() => aoMudar({ ...fase, opcoes: [...fase.opcoes, { texto: "", consequencia: "" }] })}>
          Adicionar opção
        </Button>
      )}
      <Field label="Explicação geral (mostrada depois da resposta)">
        <textarea {...campo} rows={2} value={fase.explicacao} onChange={(e) => aoMudar({ ...fase, explicacao: e.target.value })} />
      </Field>
    </div>
  );
}

interface MaterialAchado {
  id: string;
  descricao: string;
}

function EditorSepararItens({ fase, aoMudar }: { fase: Extract<Fase, { tipo: "separar_itens" }>; aoMudar: (f: Fase) => void }) {
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<MaterialAchado[] | null>(null);

  useEffect(() => {
    const termo = busca.trim();
    let ativo = true;
    const espera = setTimeout(
      () => {
        if (!termo) return setAchados(null);
        chamar<{ materiais: MaterialAchado[] }>("GET", `/catalogo/materiais?busca=${encodeURIComponent(termo)}&ativo=true&tamanho=8`)
          .then((r) => ativo && setAchados(r.materiais))
          .catch(() => ativo && setAchados([]));
      },
      termo ? 250 : 0,
    );
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [busca]);

  return (
    <div className="stack g8">
      <Field label="Enunciado">
        <input {...campo} value={fase.enunciado} onChange={(e) => aoMudar({ ...fase, enunciado: e.target.value })} />
      </Field>
      <span className="small muted">Materiais certos (do catálogo): {fase.material_ids.length}</span>
      <div className="row g6 wrap">
        {fase.material_ids.map((id) => (
          <span key={id} className="badge b-neu" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            {id}
            <button type="button" className="btn btn-ghost btn-sm" style={{ padding: "0 4px" }} onClick={() => aoMudar({ ...fase, material_ids: fase.material_ids.filter((x) => x !== id) })}>
              x
            </button>
          </span>
        ))}
      </div>
      <Field label="Buscar material para adicionar">
        <input {...campo} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição ou código do SAP" />
      </Field>
      {achados && (
        <ul className="stack g4" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {achados.map((m) => (
            <li key={m.id}>
              <Button variant="line" sm disabled={fase.material_ids.includes(m.id)} onClick={() => { aoMudar({ ...fase, material_ids: [...fase.material_ids, m.id] }); setBusca(""); setAchados(null); }}>
                {m.descricao}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Field label="Quantos itens errados misturar (de outros serviços)">
        <input {...campo} type="number" min={1} max={10} value={fase.quantidade_errados} onChange={(e) => aoMudar({ ...fase, quantidade_errados: Number(e.target.value) || 1 })} />
      </Field>
      <Field label="Explicação (mostrada depois da resposta)">
        <textarea {...campo} rows={2} value={fase.explicacao} onChange={(e) => aoMudar({ ...fase, explicacao: e.target.value })} />
      </Field>
    </div>
  );
}

function EditorLigar({ fase, aoMudar }: { fase: Extract<Fase, { tipo: "ligar" }>; aoMudar: (f: Fase) => void }) {
  return (
    <div className="stack g8">
      <span className="small muted">Pares (até 5)</span>
      {fase.pares.map((par, i) => (
        <div key={i} className="row g8">
          <input {...campo} placeholder="Esquerda" value={par.esquerda} onChange={(e) => aoMudar({ ...fase, pares: fase.pares.map((x, k) => (k === i ? { ...x, esquerda: e.target.value } : x)) })} />
          <input {...campo} placeholder="Direita" value={par.direita} onChange={(e) => aoMudar({ ...fase, pares: fase.pares.map((x, k) => (k === i ? { ...x, direita: e.target.value } : x)) })} />
          {fase.pares.length > 2 && (
            <Button variant="line" sm onClick={() => aoMudar({ ...fase, pares: fase.pares.filter((_, k) => k !== i) })}>
              Tirar
            </Button>
          )}
        </div>
      ))}
      {fase.pares.length < 5 && (
        <Button variant="line" sm onClick={() => aoMudar({ ...fase, pares: [...fase.pares, { esquerda: "", direita: "" }] })}>
          Adicionar par
        </Button>
      )}
      <Field label="Explicação (mostrada depois da resposta)">
        <textarea {...campo} rows={2} value={fase.explicacao} onChange={(e) => aoMudar({ ...fase, explicacao: e.target.value })} />
      </Field>
    </div>
  );
}

function EditorOrdem({ fase, aoMudar }: { fase: Extract<Fase, { tipo: "ordem" }>; aoMudar: (f: Fase) => void }) {
  return (
    <div className="stack g8">
      <Field label="Enunciado">
        <input {...campo} value={fase.enunciado} onChange={(e) => aoMudar({ ...fase, enunciado: e.target.value })} />
      </Field>
      <span className="small muted">Etapas, na ordem certa (até 6)</span>
      {fase.etapas.map((etapa, i) => (
        <div key={i} className="row g8">
          <span className="small muted" style={{ width: 20 }}>
            {i + 1}.
          </span>
          <input {...campo} value={etapa} onChange={(e) => aoMudar({ ...fase, etapas: fase.etapas.map((x, k) => (k === i ? e.target.value : x)) })} />
          {fase.etapas.length > 2 && (
            <Button variant="line" sm onClick={() => aoMudar({ ...fase, etapas: fase.etapas.filter((_, k) => k !== i) })}>
              Tirar
            </Button>
          )}
        </div>
      ))}
      {fase.etapas.length < 6 && (
        <Button variant="line" sm onClick={() => aoMudar({ ...fase, etapas: [...fase.etapas, ""] })}>
          Adicionar etapa
        </Button>
      )}
      <Field label="Explicação (mostrada depois da resposta)">
        <textarea {...campo} rows={2} value={fase.explicacao} onChange={(e) => aoMudar({ ...fase, explicacao: e.target.value })} />
      </Field>
    </div>
  );
}
