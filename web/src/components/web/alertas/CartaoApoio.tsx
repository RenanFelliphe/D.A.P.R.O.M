"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/state/toast";

const rotulo = { fontSize: 12 } as const;

/** Cartão de decisão "Abrir OS de apoio" (destaque principal). */
export function CartaoApoio({ apoio }: { apoio: string }) {
  const exibirAviso = useToast();
  const [equipe, setEquipe] = useState("Manutenção Civil");
  const [data, setData] = useState("14/10/2026");
  const [descricao, setDescricao] = useState(apoio);

  return (
    <div className="dcard main">
      <div className="hd">
        <span className="ic">
          <Icon name="users" size={16} />
        </span>
        <h4>Abrir OS de apoio</h4>
      </div>
      <p className="muted">
        Outra equipe resolve antes. A OS original continua pendente e você recebe um aviso quando o apoio terminar.
      </p>
      <Field label="Equipe de apoio" htmlFor="ap-eq" labelStyle={rotulo}>
        <select className="select" id="ap-eq" value={equipe} onChange={(evento) => setEquipe(evento.target.value)}>
          <option>Manutenção Civil</option>
          <option>Instrumentação</option>
        </select>
      </Field>
      <Field label="Data programada" htmlFor="ap-dt" labelStyle={rotulo}>
        <input className="select" id="ap-dt" value={data} onChange={(evento) => setData(evento.target.value)} />
      </Field>
      <Field label="O que a equipe de apoio deve fazer" htmlFor="ap-ds" labelStyle={rotulo}>
        <textarea
          className="textarea"
          id="ap-ds"
          rows={2}
          style={{ fontSize: 14 }}
          value={descricao}
          onChange={(evento) => setDescricao(evento.target.value)}
        />
      </Field>
      <Button
        variant="p"
        sm
        style={{ height: 44 }}
        onClick={() => exibirAviso(`OS de apoio criada para ${equipe}. A original continua pendente.`)}
      >
        Criar OS de apoio
      </Button>
    </div>
  );
}
