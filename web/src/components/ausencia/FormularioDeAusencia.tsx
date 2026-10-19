"use client";

import { useId, useMemo } from "react";
import { z } from "zod";
import { Field, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { chamar } from "@/lib/cliente-api";
import { dataDoDia } from "@/lib/formatar";
import { CamposDePeriodo, conferirPeriodo, esquemaDoPeriodo, periodoParaApi, periodoVazio, retornoDoPeriodo } from "./CamposDePeriodo";
import { JanelaDeAssinatura } from "./JanelaDeAssinatura";

export const LIMITE_DO_MOTIVO = 500;

/** O motivo e o período (e, no registro do supervisor, a pessoa) são obrigatórios; cada mensagem aparece no campo dela. */
function esquemaDaAusencia(registrar: boolean) {
  return z
    .object({
      pessoa: z.string(),
      motivo: z.string().trim().min(1, "Informe o motivo da ausência.").max(LIMITE_DO_MOTIVO, `O motivo pode ter até ${LIMITE_DO_MOTIVO} caracteres.`),
      periodo: esquemaDoPeriodo,
    })
    .superRefine((v, ctx) => {
      if (registrar && !v.pessoa) ctx.addIssue({ code: "custom", path: ["pessoa"], message: "Escolha a pessoa." });
      conferirPeriodo(v.periodo, ctx, ["periodo"]);
    });
}

interface FormularioDeAusenciaProps {
  /** `pedir`: o técnico pede e o supervisor responde. `registrar`: o supervisor registra a de alguém ou a própria, assinando. */
  modo: "pedir" | "registrar";
  assinaturaPath: string | null;
  /** Em `registrar`: a quem o supervisor registra (a própria pessoa dele inclusive). Com uma pessoa só, ela já vem escolhida. */
  pessoas?: { id: string; nome: string; eu?: boolean }[];
  /** A pessoa que já vem escolhida (o botão "Registrar ausência" de um membro). */
  pessoaInicial?: string;
  aoFechar: () => void;
}

/** O pedido ou o registro da ausência: o motivo e o período (`POST /ausencias`). O pedido não é assinado; o registro do supervisor é. */
export function FormularioDeAusencia({ modo, assinaturaPath, pessoas = [], pessoaInicial, aoFechar }: FormularioDeAusenciaProps) {
  const id = useId();
  const registrar = modo === "registrar";
  const esquema = useMemo(() => esquemaDaAusencia(registrar), [registrar]);
  const { form, validar } = useFormulario(esquema, { pessoa: pessoaInicial ?? pessoas.find((p) => p.eu)?.id ?? pessoas[0]?.id ?? "", motivo: "", periodo: periodoVazio() });
  const { register, formState, getValues } = form;
  const erros = formState.errors;
  const [pessoa] = useValorDoForm(form, "pessoa");
  const [motivo] = useValorDoForm(form, "motivo");
  const [periodo, setPeriodo] = useValorDoForm(form, "periodo");

  const eu = pessoas.find((p) => p.id === pessoa)?.eu ?? false;
  const retorno = retornoDoPeriodo(periodo);

  async function enviar() {
    const { motivo, periodo } = getValues();
    const resposta = await chamar<{ execucao_aberta?: boolean }>("POST", "/ausencias", {
      motivo: motivo.trim(),
      ...periodoParaApi(periodo),
      ...(registrar ? { usuario_id: eu ? undefined : pessoa, assinar: true } : {}),
    });
    // O início da ausência suspende a execução aberta da pessoa: o supervisor fica sabendo agora.
    if (registrar && resposta.execucao_aberta) {
      return `${pessoas.find((p) => p.id === pessoa)?.nome ?? "A pessoa"} está com uma execução aberta. Quando a ausência começar, a execução é suspensa e a OS fica pendente: a equipe a retoma com uma APR nova.`;
    }
  }

  return (
    <JanelaDeAssinatura
      titulo={registrar ? "Registrar ausência" : "Pedir ausência"}
      resumo={
        registrar
          ? "A ausência registrada vale assim que você a assina; a pessoa é avisada. Quem está ausente só visualiza o sistema e não recebe reserva de OS."
          : "O supervisor da equipe aprova, ajusta as datas ou recusa. Se aprovar, você confirma, assinando, para a ausência valer."
      }
      rotuloConfirmar={registrar ? "Registrar e assinar" : "Enviar pedido"}
      assinaturaPath={assinaturaPath}
      semAssinatura={!registrar}
      validar={validar}
      aoConfirmar={enviar}
      aoFechar={aoFechar}
    >
      {registrar && pessoas.length > 1 && (
        <Field label="Pessoa" htmlFor={`${id}-pessoa`} erro={erros.pessoa?.message}>
          <select className="select" {...register("pessoa")} {...ligarAoErro(`${id}-pessoa`, erros.pessoa?.message)}>
            {pessoas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.eu ? `${p.nome} (eu)` : p.nome}
              </option>
            ))}
          </select>
        </Field>
      )}
      {registrar && pessoas.length === 1 && (
        <p>
          Pessoa: <strong>{pessoas[0]!.nome}</strong>
        </p>
      )}
      <Field label="Motivo" htmlFor={`${id}-motivo`} erro={erros.motivo?.message}>
        <textarea
          className="textarea"
          rows={3}
          maxLength={LIMITE_DO_MOTIVO}
          placeholder="Férias, atestado, viagem, treinamento…"
          {...register("motivo")}
          {...ligarAoErro(`${id}-motivo`, erros.motivo?.message)}
        />
        <span className="small muted">{`${motivo.length}/${LIMITE_DO_MOTIVO}`}</span>
      </Field>
      <CamposDePeriodo valor={periodo} aoMudar={setPeriodo} erros={{ inicio: erros.periodo?.inicio?.message, dias: erros.periodo?.dias?.message, retorno: erros.periodo?.retorno?.message }} />
      {registrar && retorno && periodo.inicio && (
        <Notice tone="info" icon="info">
          {`A ausência vai de ${dataDoDia(periodo.inicio)} até a véspera de ${dataDoDia(retorno)}. Ela não termina sozinha: depois do retorno fica vencida até a pessoa confirmar a volta ou você a encerrar.`}
        </Notice>
      )}
    </JanelaDeAssinatura>
  );
}
