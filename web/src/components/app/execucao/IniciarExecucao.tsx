"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PainelAcoes } from "@/components/app/AppChrome";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { enviarEvento, novoId } from "@/lib/cliente-api";
import { hora } from "@/lib/formatar";
import type { Situacao } from "./situacao";
import { useAcao } from "./useAcao";

/** Início da execução, amparada pela APR aprovada do dia: informa o número de pessoas (padrão: os participantes da APR). */
export function IniciarExecucao({ osId, apr }: { osId: string; apr: Extract<Situacao, { tipo: "iniciar" }>["apr"] }) {
  const router = useRouter();
  const { ocupado, erro, executar } = useAcao();
  const [pessoas, setPessoas] = useState(String(apr.participantes.length));
  const quantas = Number(pessoas);
  const valido = Number.isInteger(quantas) && quantas >= 1;

  const iniciar = () =>
    executar(async () => {
      await enviarEvento({
        tipo: "execucao_iniciada",
        os_id: osId,
        payload: { id: novoId(), apr_id: apr.id, numero_pessoas: quantas, inicio: new Date().toISOString() },
      });
      router.refresh();
    });

  return (
    <div className="panel stack g12" style={{ maxWidth: 560 }}>
      <h2>Iniciar execução</h2>
      <Notice tone="ok" icon="check">
        <strong>APR aprovada às {hora(apr.concluida_em)}.</strong> Ela ampara esta execução, só hoje.
      </Notice>
      <div className="small">
        Participantes da APR: {apr.participantes.map((p) => p.nome).join(", ")}.
      </div>
      <Field label="Número de pessoas" htmlFor="pessoas">
        <input className="input" id="pessoas" type="number" min={1} step={1} inputMode="numeric" value={pessoas} onChange={(e) => setPessoas(e.target.value)} style={{ maxWidth: 140 }} />
      </Field>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro.mensagem}
        </Notice>
      )}
      <PainelAcoes>
        <Button variant="p" block onClick={iniciar} disabled={!valido || ocupado} data-treino="exec-iniciar">
          <Icon name="play" size={18} />
          {ocupado ? "Iniciando…" : "Iniciar execução"}
        </Button>
      </PainelAcoes>
    </div>
  );
}
