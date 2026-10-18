"use client";

import { useMemo, type ReactNode } from "react";
import { FormProvider } from "react-hook-form";
import { z } from "zod";
import { AvisoDeLocalizacao } from "@/components/app/execucao/AvisoDeLocalizacao";
import { CamposDoMotivo, complementoDoMotivo, regraDoMotivo } from "@/components/app/execucao/CamposDoMotivo";
import type { OpcaoDeMotivo } from "@/components/app/execucao/motivos";
import { Button } from "@/components/ui/Button";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { ErroDeEnvio, useFormulario } from "@/components/ui/useFormulario";

export interface MotivoEscolhido {
  motivo: string;
  complemento?: string;
}

interface JanelaDeMotivoProps {
  titulo: string;
  /** "da pausa", "da suspensão": entra na mensagem de erro quando nenhum motivo foi escolhido. */
  deQue: string;
  resumo?: ReactNode;
  opcoes: OpcaoDeMotivo[];
  rotuloConfirmar: string;
  /** Texto do botão enquanto envia. */
  rotuloEnviando: string;
  tom?: "p" | "d";
  /** Chave `data-treino` da janela. */
  dataTreino?: string;
  /** Faz a chamada à `api`; uma falha vira o aviso da janela, acima do botão. Ao terminar, quem chamou fecha a janela. */
  aoConfirmar: (escolha: MotivoEscolhido) => Promise<void>;
  aoFechar: () => void;
}

/**
 * A janela do motivo obrigatório da pausa e da suspensão: a lista de motivos como opções, o campo que alguns abrem e, para lesão e
 * enfermidade, o aviso de que o supervisor é avisado na hora. Sem motivo (ou sem o campo exigido), o botão não fica desativado: a
 * mensagem aparece junto do campo e o foco vai para ele. As duas ações gravam a localização, então a janela traz o aviso (LGPD).
 */
export function JanelaDeMotivo({ titulo, deQue, resumo, opcoes, rotuloConfirmar, rotuloEnviando, tom = "p", dataTreino, aoConfirmar, aoFechar }: JanelaDeMotivoProps) {
  const esquema = useMemo(() => z.object({ motivo: z.string(), complemento: z.string() }).superRefine(regraDoMotivo(opcoes, deQue)), [deQue, opcoes]);
  const { form, ref, enviar, enviando, erroEnvio } = useFormulario(esquema, { motivo: "", complemento: "" });

  return (
    <JanelaSobreposta titulo={titulo} aoFechar={enviando ? () => undefined : aoFechar} dataTreino={dataTreino}>
      <FormProvider {...form}>
        <form ref={ref} noValidate className="stack g12" onSubmit={enviar(async (valores) => aoConfirmar({ motivo: valores.motivo, ...complementoDoMotivo(opcoes, valores) }))}>
          {resumo && <p>{resumo}</p>}
          <CamposDoMotivo opcoes={opcoes} deQue={deQue} desabilitado={enviando} />
          <AvisoDeLocalizacao />
          <ErroDeEnvio mensagem={erroEnvio} />
          <div className="row g8 wrap">
            <Button type="submit" variant={tom} aria-busy={enviando} disabled={enviando}>
              {enviando ? rotuloEnviando : rotuloConfirmar}
            </Button>
            <Button variant="ghost" onClick={aoFechar} disabled={enviando}>
              Voltar
            </Button>
          </div>
        </form>
      </FormProvider>
    </JanelaSobreposta>
  );
}
