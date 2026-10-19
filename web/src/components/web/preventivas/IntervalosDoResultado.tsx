"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { CampoDeCelula } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { Panel } from "@/components/web/Panel";
import { chamar } from "@/lib/cliente-api";
import { descreverIntervalo, type Intervalo } from "@/lib/preventivas";
import { rotas } from "@/lib/rotas";
import { CampoIntervalo } from "./CampoIntervalo";

/** Plano de preventiva que a importação tocou e que segue sem intervalo (`planos_sem_intervalo` da resposta). */
export interface PlanoSemIntervalo {
  plano_id: string;
  plano_manutencao: string;
  item_manutencao: string | null;
  titulo: string;
  numero_ordem: string;
}

const esquema = z.object({
  intervalo: z.custom<Intervalo | null>().refine((v): boolean => v !== null, "Informe o intervalo entre ciclos, como 3 meses."),
});

function Linha({ plano }: { plano: PlanoSemIntervalo }) {
  const id = useId();
  const [salvo, setSalvo] = useState<Intervalo | null>(null);
  const { form, enviar, enviando: salvando, erroEnvio } = useFormulario(esquema, { intervalo: null });
  const [intervalo, setIntervalo] = useValorDoForm(form, "intervalo");
  const erroDoIntervalo = form.formState.errors.intervalo?.message;

  // o item de uma lista não pode ser um <form> dentro de outro <li>: o botão Salvar dispara o envio
  const salvar = enviar(async (v) => {
    await chamar("PUT", `/preventivas/${plano.plano_id}`, { intervalo: v.intervalo });
    setSalvo(v.intervalo);
  });

  return (
    <li className="prev-pendente">
      <div className="stack" style={{ gap: 2, minWidth: 0, flex: "1 1 260px" }}>
        <strong style={{ fontSize: 14.5, overflowWrap: "anywhere" }}>{plano.titulo}</strong>
        <span className="small mono">
          OS {plano.numero_ordem} · Plano {plano.plano_manutencao}
          {plano.item_manutencao ? ` · Item ${plano.item_manutencao}` : ""}
        </span>
      </div>
      {salvo ? (
        <span className="row g6" style={{ color: "var(--enc)", fontWeight: 600, fontSize: 14, alignItems: "center" }}>
          <Icon name="check" size={16} />
          {descreverIntervalo(salvo)[0]!.toUpperCase() + descreverIntervalo(salvo).slice(1)}
        </span>
      ) : (
        <div className="row g8 wrap" style={{ alignItems: "center" }}>
          <label htmlFor={id} className="small">
            Intervalo
          </label>
          <CampoDeCelula id={id} erro={erroDoIntervalo}>
            <CampoIntervalo id={id} valor={intervalo} aoMudar={setIntervalo} desabilitado={salvando} />
          </CampoDeCelula>
          <Button variant="p" sm onClick={salvar} aria-busy={salvando} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      )}
      {erroEnvio && (
        <span className="entrada-retorno erro" role="alert" style={{ flexBasis: "100%" }}>
          {erroEnvio}
        </span>
      )}
    </li>
  );
}

/**
 * No resultado da importação: as preventivas que entraram com plano de manutenção mas sem intervalo entre ciclos, cada uma
 * com o campo para defini-lo ali mesmo. Sem o intervalo, o plano não tem contagem nem alertas do próximo ciclo.
 */
export function IntervalosDoResultado({ planos }: { planos: PlanoSemIntervalo[] }) {
  if (planos.length === 0) return null;
  return (
    <Panel>
      <div className="row between wrap g8" style={{ alignItems: "baseline" }}>
        <h2>Preventivas sem intervalo · {planos.length}</h2>
        <Link href={rotas.app.preventivas} style={{ fontSize: 14, fontWeight: 600 }}>
          Ver todas as preventivas
        </Link>
      </div>
      <p className="muted">
        Estas OS preventivas entraram com o plano de manutenção, mas o plano ainda não tem o intervalo entre ciclos. Defina agora para o sistema contar o tempo até o
        próximo ciclo e avisar quando ele se aproximar ou vencer (nenhuma OS é criada).
      </p>
      <ul className="prev-pendentes">
        {planos.map((p) => (
          <Linha key={p.plano_id} plano={p} />
        ))}
      </ul>
    </Panel>
  );
}
