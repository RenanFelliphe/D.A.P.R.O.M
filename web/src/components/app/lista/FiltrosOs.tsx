"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import { ordemDosStatus, statusDaOs } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import type { OsStatus } from "@/lib/tipos";

export interface FiltroAtivo {
  status?: OsStatus;
  tipo?: "preventiva" | "corretiva";
  critica: boolean;
  busca?: string;
}

interface FiltrosOsProps {
  ativo: FiltroAtivo;
  /** OS por status com os demais filtros aplicados (a `api` calcula). */
  contagem: Record<OsStatus, number>;
  total: number;
}

function enderecoDoFiltro(filtro: FiltroAtivo) {
  const consulta = new URLSearchParams();
  if (filtro.status) consulta.set("status", filtro.status);
  if (filtro.tipo) consulta.set("tipo", filtro.tipo);
  if (filtro.critica) consulta.set("critica", "true");
  if (filtro.busca) consulta.set("busca", filtro.busca);
  const texto = consulta.toString();
  return texto ? `${rotas.app.lista}?${texto}` : rotas.app.lista;
}

/** Filtros da lista (status, tipo, local crítico e busca); cada mudança troca a URL e a página é lida de novo na `api`. */
export function FiltrosOs({ ativo, contagem, total }: FiltrosOsProps) {
  const roteador = useRouter();
  const [busca, setBusca] = useState(ativo.busca ?? "");

  const aplicar = (mudanca: Partial<FiltroAtivo>) => roteador.replace(enderecoDoFiltro({ ...ativo, ...mudanca }));

  function aoBuscar(evento: FormEvent) {
    evento.preventDefault();
    aplicar({ busca: busca.trim() || undefined });
  }

  return (
    <div className="stack g12" data-treino="filtros">
      <div className="chips" role="group" aria-label="Filtrar por status">
        <button type="button" aria-pressed={!ativo.status} onClick={() => aplicar({ status: undefined })}>
          Todas · {total}
        </button>
        {ordemDosStatus
          .filter((s) => contagem[s] > 0 || ativo.status === s)
          .map((s) => (
            <button key={s} type="button" aria-pressed={ativo.status === s} onClick={() => aplicar({ status: ativo.status === s ? undefined : s })}>
              {statusDaOs[s].rotulo} · {contagem[s]}
            </button>
          ))}
      </div>
      <div className="row wrap g8">
        <div className="chips" role="group" aria-label="Filtrar por tipo e local">
          <button type="button" aria-pressed={ativo.tipo === "preventiva"} onClick={() => aplicar({ tipo: ativo.tipo === "preventiva" ? undefined : "preventiva" })}>
            Preventivas
          </button>
          <button type="button" aria-pressed={ativo.tipo === "corretiva"} onClick={() => aplicar({ tipo: ativo.tipo === "corretiva" ? undefined : "corretiva" })}>
            Corretivas
          </button>
          <button type="button" aria-pressed={ativo.critica} onClick={() => aplicar({ critica: !ativo.critica })}>
            Local crítico
          </button>
        </div>
        <form className="row g8" onSubmit={aoBuscar} role="search" style={{ marginLeft: "auto" }}>
          <input
            className="input"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar por número, título, local, nota ou cliente"
            aria-label="Buscar OS"
            style={{ minWidth: 280 }}
          />
          <button className="btn btn-line" type="submit">
            <Icon name="search" size={16} />
            Buscar
          </button>
        </form>
      </div>
    </div>
  );
}
