"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { FaseParaJogar } from "@/lib/treinamento-servico";

interface FaseJogavelProps {
  fase: FaseParaJogar;
  /** Envia a resposta no formato que o tipo da fase exige (ver `treinamento-servico.ts` da api). */
  aoResponder: (resposta: unknown) => void;
  desabilitado: boolean;
}

/**
 * Renderiza a fase certa pelo tipo. Tudo por toque, sem arrastar (regra da seção 3.3 do `vitoria.md`): tocar para
 * marcar/desmarcar, tocar par a par, tocar na ordem.
 */
export function FaseJogavel({ fase, aoResponder, desabilitado }: FaseJogavelProps) {
  if (fase.tipo === "quiz") return <Escolha titulo={fase.enunciado} opcoes={fase.opcoes} aoEscolher={(escolha) => aoResponder({ escolha })} desabilitado={desabilitado} />;
  if (fase.tipo === "decisao") return <Escolha titulo={fase.situacao} opcoes={fase.opcoes} aoEscolher={(escolha) => aoResponder({ escolha })} desabilitado={desabilitado} />;
  if (fase.tipo === "separar_itens") return <SepararItens fase={fase} aoResponder={aoResponder} desabilitado={desabilitado} />;
  if (fase.tipo === "ligar") return <Ligar fase={fase} aoResponder={aoResponder} desabilitado={desabilitado} />;
  return <PorEmOrdem fase={fase} aoResponder={aoResponder} desabilitado={desabilitado} />;
}

/** Quiz e decisão têm a mesma forma: um enunciado (ou a situação) e opções; tocar numa já responde. */
function Escolha({ titulo, opcoes, aoEscolher, desabilitado }: { titulo: string; opcoes: string[]; aoEscolher: (indice: number) => void; desabilitado: boolean }) {
  return (
    <div className="stack g10">
      <p style={{ fontSize: 15, fontWeight: 500 }}>{titulo}</p>
      <div className="stack g8">
        {opcoes.map((o, i) => (
          <button key={i} type="button" className="btn btn-line" disabled={desabilitado} onClick={() => aoEscolher(i)} style={{ justifyContent: "flex-start", textAlign: "left", height: "auto", padding: "10px 14px" }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function SepararItens({ fase, aoResponder, desabilitado }: { fase: Extract<FaseParaJogar, { tipo: "separar_itens" }>; aoResponder: (r: unknown) => void; desabilitado: boolean }) {
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const alternar = (id: string) =>
    setSelecionados((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  return (
    <div className="stack g10">
      <p style={{ fontSize: 15, fontWeight: 500 }}>{fase.enunciado}</p>
      <div className="row g8 wrap">
        {fase.itens.map((item) => {
          const marcado = selecionados.has(item.material_id);
          return (
            <button
              key={item.material_id}
              type="button"
              disabled={desabilitado}
              aria-pressed={marcado}
              className={`btn btn-sm ${marcado ? "btn-p" : "btn-line"}`}
              onClick={() => alternar(item.material_id)}
            >
              {item.descricao}
            </button>
          );
        })}
      </div>
      <Button variant="p" disabled={desabilitado || selecionados.size === 0} onClick={() => aoResponder({ selecionados: [...selecionados] })}>
        Confirmar
      </Button>
    </div>
  );
}

function Ligar({ fase, aoResponder, desabilitado }: { fase: Extract<FaseParaJogar, { tipo: "ligar" }>; aoResponder: (r: unknown) => void; desabilitado: boolean }) {
  const [pares, setPares] = useState<{ esquerda: number; direita: number }[]>([]);
  const [esquerdaEscolhida, setEsquerdaEscolhida] = useState<number | null>(null);
  const usadosEsquerda = new Set(pares.map((p) => p.esquerda));
  const usadosDireita = new Set(pares.map((p) => p.direita));

  function tocarEsquerda(i: number) {
    if (usadosEsquerda.has(i) || desabilitado) return;
    setEsquerdaEscolhida(i === esquerdaEscolhida ? null : i);
  }
  function tocarDireita(i: number) {
    if (usadosDireita.has(i) || desabilitado || esquerdaEscolhida === null) return;
    setPares((atual) => [...atual, { esquerda: esquerdaEscolhida, direita: i }]);
    setEsquerdaEscolhida(null);
  }
  function desfazer() {
    setPares((atual) => atual.slice(0, -1));
  }

  return (
    <div className="stack g10">
      <p style={{ fontSize: 15, fontWeight: 500 }}>Toque num item da esquerda e depois no par dele à direita.</p>
      <div className="two" style={{ gap: 10 }}>
        <div className="stack g6">
          {fase.esquerda.map((texto, i) => (
            <button
              key={i}
              type="button"
              disabled={desabilitado || usadosEsquerda.has(i)}
              aria-pressed={esquerdaEscolhida === i}
              className={`btn btn-sm ${esquerdaEscolhida === i ? "btn-p" : usadosEsquerda.has(i) ? "btn-ghost" : "btn-line"}`}
              style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => tocarEsquerda(i)}
            >
              {usadosEsquerda.has(i) ? `✓ ${texto}` : texto}
            </button>
          ))}
        </div>
        <div className="stack g6">
          {fase.direita.map((texto, i) => (
            <button
              key={i}
              type="button"
              disabled={desabilitado || usadosDireita.has(i) || esquerdaEscolhida === null}
              className={`btn btn-sm ${usadosDireita.has(i) ? "btn-ghost" : "btn-line"}`}
              style={{ width: "100%", justifyContent: "flex-start" }}
              onClick={() => tocarDireita(i)}
            >
              {usadosDireita.has(i) ? `✓ ${texto}` : texto}
            </button>
          ))}
        </div>
      </div>
      <div className="row g8">
        <Button variant="line" sm disabled={desabilitado || pares.length === 0} onClick={desfazer}>
          Desfazer último
        </Button>
        <Button variant="p" disabled={desabilitado || pares.length !== fase.esquerda.length} onClick={() => aoResponder({ pares })}>
          Confirmar
        </Button>
      </div>
    </div>
  );
}

function PorEmOrdem({ fase, aoResponder, desabilitado }: { fase: Extract<FaseParaJogar, { tipo: "ordem" }>; aoResponder: (r: unknown) => void; desabilitado: boolean }) {
  const [sequencia, setSequencia] = useState<number[]>([]);
  const usados = new Set(sequencia);

  return (
    <div className="stack g10">
      <p style={{ fontSize: 15, fontWeight: 500 }}>{fase.enunciado}</p>
      {sequencia.length > 0 && (
        <ol className="stack g4" style={{ margin: 0, paddingLeft: 18, fontSize: 13.5 }}>
          {sequencia.map((pos, ordem) => (
            <li key={ordem}>{fase.etapas[pos]}</li>
          ))}
        </ol>
      )}
      <div className="stack g6">
        {fase.etapas.map((texto, i) =>
          usados.has(i) ? null : (
            <button key={i} type="button" disabled={desabilitado} className="btn btn-line" style={{ justifyContent: "flex-start" }} onClick={() => setSequencia((atual) => [...atual, i])}>
              {texto}
            </button>
          ),
        )}
      </div>
      <div className="row g8">
        <Button variant="line" sm disabled={desabilitado || sequencia.length === 0} onClick={() => setSequencia((atual) => atual.slice(0, -1))}>
          Desfazer último
        </Button>
        <Button variant="p" disabled={desabilitado || sequencia.length !== fase.etapas.length} onClick={() => aoResponder({ sequencia })}>
          Confirmar
        </Button>
      </div>
    </div>
  );
}
