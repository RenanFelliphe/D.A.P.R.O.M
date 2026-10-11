"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Req } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { chamar } from "@/lib/cliente-api";
import { dataDoDia } from "@/lib/formatar";
import type { Equipe } from "@/lib/tipos";

const rotulo = { fontSize: 12 } as const;

interface CartaoReprogramarProps {
  osId: string;
  /** Data programada atual (`AAAA-MM-DD`). */
  dataAtual: string;
  equipeAtualId: string;
  equipes: Equipe[];
  /** Hoje (`AAAA-MM-DD`): a nova data sugerida quando a atual já passou. */
  hoje: string;
}

/** Cartão de decisão "Reprogramar" (opcional): nova data e, se fizer sentido, nova equipe; a justificativa é obrigatória. */
export function CartaoReprogramar({ osId, dataAtual, equipeAtualId, equipes, hoje }: CartaoReprogramarProps) {
  const roteador = useRouter();
  const campoJustificativa = useRef<HTMLTextAreaElement>(null);
  const [data, setData] = useState(dataAtual >= hoje ? dataAtual : hoje);
  const [equipeId, setEquipeId] = useState(equipeAtualId);
  const [justificativa, setJustificativa] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState<string | null>(null);

  async function reprogramar() {
    if (!justificativa.trim()) {
      setErro("Justificativa obrigatória");
      campoJustificativa.current?.focus();
      return;
    }
    if (!data) {
      setErro("Informe a nova data.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await chamar("POST", `/os/${osId}/reprogramar`, {
        data_inicio_prog: data,
        equipe_id: equipeId !== equipeAtualId ? equipeId : undefined,
        justificativa: justificativa.trim(),
      });
      const nova = equipes.find((e) => e.id === equipeId);
      setFeito(`OS reprogramada para ${dataDoDia(data)}${equipeId !== equipeAtualId && nova ? `, equipe ${nova.nome}` : ""}. A equipe segue podendo fazer uma APR nova.`);
      setJustificativa("");
      roteador.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível reprogramar.");
    } finally {
      setEnviando(false);
    }
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
        <input className="select" type="date" id="rp-dt" value={data} onChange={(evento) => setData(evento.target.value)} />
      </Field>
      <Field label="Equipe" htmlFor="rp-eq" labelStyle={rotulo}>
        <select className="select" id="rp-eq" value={equipeId} onChange={(evento) => setEquipeId(evento.target.value)}>
          {equipes.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
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
      {erro && (
        <span className="small" role="alert" style={{ color: "var(--blq)" }}>
          {erro}
        </span>
      )}
      {feito && (
        <Notice tone="ok" icon="check" style={{ fontSize: 13.5 }}>
          {feito}
        </Notice>
      )}
      <Button variant="line" sm style={{ height: 44, borderColor: "var(--ink)" }} onClick={reprogramar} disabled={enviando}>
        {enviando ? "Reprogramando…" : "Reprogramar OS"}
      </Button>
    </div>
  );
}
