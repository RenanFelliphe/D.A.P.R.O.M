"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CampoDeCelula, ligarAoErro, MensagemDeErro } from "@/components/ui/Field";
import { useFormulario } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { numero, type RegraDePontuacao } from "@/lib/gamificacao";
import { inteiroEntre } from "@/lib/validacao";
import { useToast } from "@/state/toast";

/** Os pontos de uma tarefa: inteiros de 0 a 1000 (a `api` recusa mais). A tarefa sem valor próprio só liga ou desliga. */
const esquema = z.object({
  pontos: inteiroEntre(0, 1000, "Informe os pontos, um número inteiro de 0 a 1000."),
  ativa: z.boolean(),
});

/**
 * O valor de uma tarefa e, para o admin, o editor no lugar: muda os pontos e liga ou desliga a tarefa (`PATCH
 * /gamificacao/regras/{codigo}`). A mudança vale dali em diante; o extrato antigo não muda. "Conquista obtida" não tem valor
 * próprio (os pontos vêm de cada conquista): só liga ou desliga.
 */
export function EditarRegra({ regra, podeEditar }: { regra: RegraDePontuacao; podeEditar: boolean }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [editando, setEditando] = useState(false);
  const valoresDaRegra = { pontos: String(regra.pontos), ativa: regra.ativa };
  // O esquema do que não tem valor próprio ignora os pontos (o campo nem aparece).
  const { form, enviar, enviando: ocupado, erroEnvio, limparErroEnvio } = useFormulario(regra.valor_proprio ? esquema : esquema.extend({ pontos: z.string() }), valoresDaRegra);
  const { register, formState } = form;
  const erros = formState.errors;
  const idDosPontos = `regra-${regra.codigo}-pontos`;

  // a regra aparece numa linha de tabela, que não pode ser um <form>: o botão Salvar dispara o envio
  const salvar = enviar(async (v) => {
    await chamar("PATCH", `/gamificacao/regras/${regra.codigo}`, regra.valor_proprio ? { pontos: Number(v.pontos), ativa: v.ativa } : { ativa: v.ativa });
    exibirAviso(`"${regra.nome}" salva. O novo valor vale dali em diante.`);
    setEditando(false);
    router.refresh();
  });

  function cancelar() {
    setEditando(false);
    limparErroEnvio();
    form.reset(valoresDaRegra);
  }

  const resumo = regra.valor_proprio ? (
    <strong>{numero(regra.pontos)}</strong>
  ) : (
    <span className="muted" title="Os pontos vêm de cada conquista">
      da conquista
    </span>
  );

  if (!editando) {
    return (
      <span className="row g8 wrap">
        {resumo}
        {!regra.ativa && <Badge tone="neu">Desativada</Badge>}
        {podeEditar && (
          <Button variant="line" sm style={{ height: 30 }} onClick={() => setEditando(true)}>
            Editar
          </Button>
        )}
      </span>
    );
  }

  return (
    <span className="stack g6">
      <span className="regra-editar">
        {regra.valor_proprio && (
          <CampoDeCelula id={idDosPontos} erro={erros.pontos?.message}>
            <input className="input" aria-label={`Pontos de ${regra.nome}`} inputMode="numeric" {...register("pontos")} {...ligarAoErro(idDosPontos, erros.pontos?.message)} />
          </CampoDeCelula>
        )}
        <label className="row g6 small">
          <input type="checkbox" {...register("ativa")} />
          Ativa
        </label>
      </span>
      {erroEnvio && <MensagemDeErro>{erroEnvio}</MensagemDeErro>}
      <span className="row g6">
        <Button variant="p" sm style={{ height: 30 }} onClick={salvar} aria-busy={ocupado} disabled={ocupado}>
          {ocupado ? "Salvando…" : "Salvar"}
        </Button>
        <Button variant="line" sm style={{ height: 30 }} onClick={cancelar} disabled={ocupado}>
          Cancelar
        </Button>
      </span>
    </span>
  );
}
