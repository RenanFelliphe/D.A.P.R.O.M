"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/state/toast";

const rotulo = { fontSize: 12 } as const;

/** Cartão de decisão "Reprogramar" (opcional); exige justificativa. */
export function CartaoReprogramar() {
  const exibirAviso = useToast();
  const campoJustificativa = useRef<HTMLTextAreaElement>(null);
  const [data, setData] = useState("16/10/2026");
  const [equipe, setEquipe] = useState("Serviços Especiais");
  const [justificativa, setJustificativa] = useState("");

  function reprogramar() {
    if (!justificativa.trim()) {
      exibirAviso("Justificativa obrigatória para reprogramar.");
      campoJustificativa.current?.focus();
      return;
    }
    exibirAviso(`OS reprogramada para ${data}. A equipe segue podendo fazer uma APR nova.`);
  }

  return (
    <div className="dcard">
      <div className="hd">
        <span className="ic">
          <Icon name="cal" size={16} />
        </span>
        <h4>Reprogramar</h4>
      </div>
      <p className="muted">
        Nova data ou nova equipe, quando fizer sentido. É opcional: a equipe não precisa esperar para fazer uma nova APR.
      </p>
      <Field label="Nova data" htmlFor="rp-dt" labelStyle={rotulo}>
        <input className="select" id="rp-dt" value={data} onChange={(evento) => setData(evento.target.value)} />
      </Field>
      <Field label="Equipe" htmlFor="rp-eq" labelStyle={rotulo}>
        <select className="select" id="rp-eq" value={equipe} onChange={(evento) => setEquipe(evento.target.value)}>
          <option>Serviços Especiais</option>
          <option>Instrumentação</option>
        </select>
      </Field>
      <Field
        label={
          <>
            Justificativa <Req>· obrigatória</Req>
          </>
        }
        htmlFor="rp-js"
        labelStyle={rotulo}
      >
        <textarea
          ref={campoJustificativa}
          className="textarea"
          id="rp-js"
          rows={2}
          style={{ fontSize: 14 }}
          placeholder="Ex.: aguardar a drenagem pela manutenção civil"
          value={justificativa}
          onChange={(evento) => setJustificativa(evento.target.value)}
        />
      </Field>
      <Button variant="line" sm style={{ height: 44, borderColor: "var(--ink)" }} onClick={reprogramar}>
        Reprogramar OS
      </Button>
    </div>
  );
}
