"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CampoDeCelula, ligarAoErro, MensagemDeErro } from "@/components/ui/Field";
import { useFormulario } from "@/components/ui/useFormulario";
import { BotaoExcluir } from "@/components/web/BotaoExcluir";
import type { Atividade } from "@/data/modelos";
import { chamar } from "@/lib/cliente-api";
import { useToast } from "@/state/toast";

/** `PUT /atividades/{codigo}`: o código do plano pode ter pontos, barras e espaços (`8.7.2/8.7.3`), então vai codificado. */
export const caminhoDaAtividade = (codigo: string) => `/atividades/${encodeURIComponent(codigo)}`;

const esquema = z.object({
  descricao: z.string().trim().min(1, "Informe a descrição do serviço."),
  provisorio: z.boolean(),
});

interface LinhaAtividadeProps {
  atividade: Atividade;
  podeEditar: boolean;
}

/** Linha da tabela de atividades; para quem edita (admin), edita a descrição e a marca de provisório no lugar. */
export function LinhaAtividade({ atividade, podeEditar }: LinhaAtividadeProps) {
  const router = useRouter();
  const exibirAviso = useToast();
  const [editando, setEditando] = useState(false);
  const { form, enviar, enviando: ocupado, erroEnvio, limparErroEnvio } = useFormulario(esquema, { descricao: atividade.descricao, provisorio: atividade.provisorio });
  const { register, formState } = form;
  const erros = formState.errors;
  const idDaDescricao = `atividade-${atividade.codigo}-descricao`;

  function cancelar() {
    setEditando(false);
    limparErroEnvio();
    form.reset({ descricao: atividade.descricao, provisorio: atividade.provisorio });
  }

  // a linha de uma tabela não pode ser um <form>: o botão Salvar dispara o envio
  const salvar = enviar(async (v) => {
    await chamar("PUT", caminhoDaAtividade(atividade.codigo), { descricao: v.descricao.trim(), provisorio: v.provisorio });
    exibirAviso(`Atividade ${atividade.codigo} salva.`);
    setEditando(false);
    router.refresh();
  });

  async function excluir() {
    await chamar("DELETE", caminhoDaAtividade(atividade.codigo));
    exibirAviso(`Atividade ${atividade.codigo} excluída.`);
    router.refresh();
  }

  if (!editando) {
    return (
      <tr>
        <td className="mono">
          {atividade.codigo}
          {atividade.provisorio && (
            <>
              {" "}
              <Badge tone="al" style={{ padding: "0 7px", fontSize: 11 }}>
                Provisório
              </Badge>
            </>
          )}
        </td>
        <td>{atividade.descricao}</td>
        {podeEditar && (
          <td className="acoes-linha">
            <Button variant="line" sm style={{ height: 32 }} onClick={() => setEditando(true)}>
              Editar
            </Button>
          </td>
        )}
      </tr>
    );
  }

  return (
    <tr className="nw">
      <td className="mono">
        {atividade.codigo}
        <label className="row g6 small" style={{ marginTop: 6 }}>
          <input type="checkbox" {...register("provisorio")} />
          Provisório
        </label>
      </td>
      <td>
        <CampoDeCelula id={idDaDescricao} erro={erros.descricao?.message}>
          <input className="input" style={{ height: 36, fontSize: 13.5 }} aria-label="Descrição" {...register("descricao")} {...ligarAoErro(idDaDescricao, erros.descricao?.message)} />
        </CampoDeCelula>
        {erroEnvio && <MensagemDeErro>{erroEnvio}</MensagemDeErro>}
      </td>
      <td className="acoes-linha">
        <span className="row g6" style={{ justifyContent: "flex-end", alignItems: "flex-start" }}>
          <BotaoExcluir rotulo="Excluir" pergunta={`Excluir a atividade ${atividade.codigo}?`} aoExcluir={excluir} desabilitado={ocupado} />
          <Button variant="p" sm style={{ height: 32 }} onClick={salvar} aria-busy={ocupado} disabled={ocupado}>
            {ocupado ? "Salvando…" : "Salvar"}
          </Button>
          <Button variant="line" sm style={{ height: 32 }} onClick={cancelar} disabled={ocupado}>
            Cancelar
          </Button>
        </span>
      </td>
    </tr>
  );
}
