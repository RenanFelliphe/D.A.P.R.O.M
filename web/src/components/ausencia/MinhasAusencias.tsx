"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { MOTIVO_DO_AUSENTE, type Ausencia } from "@/lib/ausencia";
import type { QuemAge } from "./AcoesDaAusencia";
import { CartaoDaAusencia } from "./CartaoDaAusencia";
import { FormularioDeAusencia } from "./FormularioDeAusencia";

interface MinhasAusenciasProps {
  ausencias: Ausencia[];
  eu: QuemAge & { nome: string };
  /** `registrar`: o supervisor registra a própria ausência (vale na hora, assinada). `pedir`: o técnico pede e o supervisor responde. */
  modo: "pedir" | "registrar";
  /** Por que o botão de pedir está desabilitado (equipe sem supervisor, sem equipe), ou `null` quando pode pedir. */
  motivoSemPedido: string | null;
}

/** "Minhas ausências" do perfil: o botão de pedir (ou de registrar a própria, no caso do supervisor) e a lista, com o que cabe a cada uma. */
export function MinhasAusencias({ ausencias, eu, modo, motivoSemPedido }: MinhasAusenciasProps) {
  const [aberto, setAberto] = useState(false);
  const desabilitado = eu.ausente || motivoSemPedido !== null;
  const motivo = eu.ausente ? (modo === "pedir" ? "Para estender a ausência, peça ao seu supervisor: ele altera a data de retorno." : MOTIVO_DO_AUSENTE) : motivoSemPedido;

  return (
    <section className="stack g8" id="ausencias" aria-labelledby="titulo-ausencias">
      <div className="row between wrap g8">
        <h2 id="titulo-ausencias">Minhas ausências</h2>
        <Button variant="line" sm onClick={() => setAberto(true)} disabled={desabilitado} title={desabilitado ? (motivo ?? undefined) : undefined}>
          {modo === "pedir" ? "Pedir ausência" : "Registrar minha ausência"}
        </Button>
      </div>
      {desabilitado && motivo && <span className="small muted">{motivo}</span>}
      {ausencias.length === 0 ? (
        <div className="card muted">Você não tem ausências registradas.</div>
      ) : (
        <div className="stack g8">
          {ausencias.some((a) => a.situacao === "aguardando_confirmacao") && (
            <Notice tone="al" icon="info">
              O supervisor aprovou um pedido seu: confirme, assinando, para a ausência valer.
            </Notice>
          )}
          {ausencias.map((a) => (
            <CartaoDaAusencia key={a.id} ausencia={a} eu={eu} supervisaEquipe={modo === "registrar"} />
          ))}
        </div>
      )}
      {aberto && (
        <FormularioDeAusencia
          modo={modo}
          assinaturaPath={eu.assinaturaPath}
          pessoas={modo === "registrar" ? [{ id: eu.id, nome: eu.nome, eu: true }] : undefined}
          aoFechar={() => setAberto(false)}
        />
      )}
    </section>
  );
}
