"use client";

import { useRouter } from "next/navigation";
import { z } from "zod";
import { AvisoDeLocalizacao } from "@/components/app/execucao/AvisoDeLocalizacao";
import { PainelAcoes } from "@/components/app/AppChrome";
import { Button } from "@/components/ui/Button";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";
import { Notice } from "@/components/ui/Notice";
import { enviarEvento, novoId } from "@/lib/cliente-api";
import { hora } from "@/lib/formatar";
import { comPosicao, obterPosicao } from "@/lib/geolocalizacao";
import type { Situacao } from "./situacao";
import { participantesAtivos } from "./tempo";

const esquema = z.object({
  pessoas: z
    .string()
    .trim()
    .min(1, "Informe quantas pessoas vão executar o serviço.")
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1, "O número de pessoas precisa ser um número inteiro, de 1 em diante."),
});

/**
 * Início da execução, amparada pela APR aprovada e assinada por todos: informa o número de pessoas (padrão: os participantes que
 * ficaram na APR). A localização é registrada aqui (sem bloquear, se não houver).
 */
export function IniciarExecucao({ osId, apr }: { osId: string; apr: Extract<Situacao, { tipo: "iniciar" }>["apr"] }) {
  const router = useRouter();
  const ativos = participantesAtivos(apr.participantes);
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { pessoas: String(ativos.length) });
  const erros = form.formState.errors;

  const iniciar = enviar(async ({ pessoas }) => {
    const posicao = await obterPosicao();
    await enviarEvento({
      tipo: "execucao_iniciada",
      os_id: osId,
      payload: { id: novoId(), apr_id: apr.id, numero_pessoas: Number(pessoas), inicio: new Date().toISOString(), ...comPosicao(posicao) },
    });
    router.refresh();
  });

  return (
    <form ref={ref} noValidate onSubmit={iniciar} className="panel stack g12" style={{ maxWidth: 560 }}>
      <h2>Iniciar execução</h2>
      <Notice tone="ok" icon="check">
        <strong>APR aprovada às {hora(apr.concluida_em)} e assinada por todos.</strong> Ela ampara esta execução, só hoje.
      </Notice>
      <div className="small">Participantes da APR: {ativos.map((p) => p.nome).join(", ")}.</div>
      <Field label="Número de pessoas" htmlFor="pessoas" erro={erros.pessoas?.message}>
        <input className="input" type="text" inputMode="numeric" disabled={enviando} style={{ maxWidth: 140 }} {...form.register("pessoas")} {...ligarAoErro("pessoas", erros.pessoas?.message)} />
      </Field>
      <AvisoDeLocalizacao />
      <ErroDeEnvio mensagem={erroEnvio} />
      <PainelAcoes>
        <Button type="submit" variant="p" block disabled={enviando} aria-busy={enviando} data-treino="exec-iniciar">
          <Icon name="play" size={18} />
          {enviando ? "Iniciando…" : "Iniciar execução"}
        </Button>
      </PainelAcoes>
    </form>
  );
}
