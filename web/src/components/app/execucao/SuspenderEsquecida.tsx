"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Req } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { enviarEvento } from "@/lib/cliente-api";
import { dataHora } from "@/lib/formatar";
import type { Situacao } from "./situacao";
import { paraCampoDataHora } from "./tempo";
import { useAcao } from "./useAcao";
import { useAgora } from "./useAgora";

/**
 * Execução esquecida de outro dia: antes de qualquer coisa o técnico a suspende, informando a hora real do fim (a `api` recusa
 * iniciar outra enquanto isso). Nada é encerrado sozinho.
 */
export function SuspenderEsquecida({ execucao }: { execucao: Extract<Situacao, { tipo: "esquecida" }>["execucao"] }) {
  const router = useRouter();
  const { ocupado, erro, executar } = useAcao();
  const [fim, setFim] = useState("");
  const agora = useAgora();

  const instante = fim ? new Date(fim) : null;
  const invalido = !instante || Number.isNaN(instante.getTime()) || instante < new Date(execucao.inicio) || (agora !== null && instante.getTime() > agora + 60_000);

  const suspender = () =>
    executar(async () => {
      await enviarEvento({ tipo: "execucao_suspensa", os_id: execucao.os_id, payload: { execucao_id: execucao.id, fim: instante!.toISOString() } });
      router.refresh();
    });

  return (
    <div className="panel stack g12" style={{ maxWidth: 560 }}>
      <h2>Suspender a execução de ontem</h2>
      <Notice tone="al" icon="clock">
        A OS <strong>{execucao.numero_ordem ?? execucao.titulo}</strong> ficou em execução desde {dataHora(execucao.inicio)} e não foi suspensa. Informe a hora
        real em que você parou para poder seguir; a OS fica pendente e uma nova APR retoma o trabalho.
      </Notice>
      <Field
        label={
          <>
            Hora real do fim <Req style={{ color: "var(--exe)" }}>· obrigatória</Req>
          </>
        }
        htmlFor="fim"
      >
        <input
          className="input"
          id="fim"
          type="datetime-local"
          value={fim}
          min={paraCampoDataHora(new Date(execucao.inicio))}
          max={agora === null ? undefined : paraCampoDataHora(new Date(agora))}
          onChange={(e) => setFim(e.target.value)}
          style={{ maxWidth: 260 }}
        />
      </Field>
      {fim && invalido && (
        <span className="small" role="alert" style={{ color: "var(--blq)" }}>
          O fim precisa ser depois do início da execução e não pode estar no futuro.
        </span>
      )}
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro.mensagem}
        </Notice>
      )}
      <Button variant="p" onClick={suspender} disabled={invalido || ocupado}>
        {ocupado ? "Suspendendo…" : "Suspender a execução"}
      </Button>
    </div>
  );
}
