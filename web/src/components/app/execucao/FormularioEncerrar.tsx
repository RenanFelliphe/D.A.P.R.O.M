"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { ChecklistDeInspecao } from "@/components/app/execucao/ChecklistDeInspecao";
import { FotosExecucao, PdfsExecucao, comoEvidencia, pdfComoEvidencia, type FotoDaExecucao, type PdfDaExecucao } from "@/components/app/execucao/FotosExecucao";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { Button } from "@/components/ui/Button";
import { Field, MensagemDeErro, ligarAoErro } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { dadosDaInspecao, faltaObservacao, type PerguntaDoChecklist, type RespostaDoItem } from "@/lib/checklist-inspecao";
import { enviarEvento } from "@/lib/cliente-api";
import { hora } from "@/lib/formatar";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { useMinhaAssinatura } from "@/state/minha-assinatura";
import { calcularTempo, horasMinutos, type ExecucaoDaApi } from "./tempo";

interface ValoresDoEncerramento {
  descricao: string;
  fotos: FotoDaExecucao[];
  pdfs: PdfDaExecucao[];
  respostas: Record<string, RespostaDoItem>;
}

interface FormularioEncerrarProps {
  /** A execução cujo tempo já parou ("Encerrar OS"): o preenchimento não entra no tempo. */
  execucao: ExecucaoDaApi;
  osId: string;
  /** O checklist de inspeção do plano da OS preventiva (vazio: a OS encerra sem ele). */
  checklist: PerguntaDoChecklist[];
  /** Recebe a resposta do encerramento (com os `pontos_ganhos`). */
  onConcluida: (resposta: RespostaComPontos) => void;
}

/** O resumo das perguntas do checklist que faltam, para a mensagem de erro dizer quais são. */
function resumoDasPerguntas(perguntas: PerguntaDoChecklist[]) {
  const curtas = perguntas.slice(0, 3).map((p) => `“${p.texto.length > 50 ? `${p.texto.slice(0, 50)}…` : p.texto}”`);
  return perguntas.length > 3 ? `${curtas.join(", ")} e mais ${perguntas.length - 3}` : curtas.join(", ");
}

/**
 * O segundo passo do encerramento (o primeiro é o clique em "Encerrar OS", que já parou o tempo): o checklist de inspeção (preventiva
 * cujo plano o tem; segue obrigatório responder), a descrição, as fotos e os PDFs (todos OPCIONAIS: só são necessários quando
 * aconteceu algo) e a assinatura do RESPONSÁVEL, com a assinatura do perfil. Os demais já assinaram a APR no começo. Esse preenchimento
 * não entra no tempo; se a pessoa sair, a OS fica `encerrando` e a tela volta aqui.
 */
export function FormularioEncerrar({ execucao, osId, checklist, onConcluida }: FormularioEncerrarProps) {
  const assinaturaPath = useMinhaAssinatura();
  const [assinando, setAssinando] = useState(false);

  const esquema = useMemo(
    () =>
      z
        .object({
          descricao: z.string(),
          fotos: z.array(z.custom<FotoDaExecucao>()),
          pdfs: z.array(z.custom<PdfDaExecucao>()),
          respostas: z.record(z.string(), z.object({ marcado: z.boolean(), observacao: z.string() })),
        })
        .superRefine((valores, ctx) => {
          const faltam = checklist.filter((p) => faltaObservacao(valores.respostas[p.id]));
          if (faltam.length > 0) {
            ctx.addIssue({
              code: "custom",
              path: ["respostas"],
              message: `Explique o que foi encontrado em ${faltam.length === 1 ? "1 item não marcado" : `${faltam.length} itens não marcados`} do checklist: ${resumoDasPerguntas(faltam)}.`,
            });
          }
        }),
    [checklist],
  );
  const { form, ref, enviar } = useFormulario<ValoresDoEncerramento>(esquema, { descricao: "", fotos: [], pdfs: [], respostas: {} });
  const [fotos, setFotos] = useValorDoForm(form, "fotos");
  const [pdfs, setPdfs] = useValorDoForm(form, "pdfs");
  const [respostas, setRespostas] = useValorDoForm(form, "respostas");
  const erros = form.formState.errors;
  const erroDoChecklist = typeof erros.respostas?.message === "string" ? erros.respostas.message : undefined;

  const tempo = execucao.fim ? calcularTempo(execucao.inicio, execucao.pausas, new Date(execucao.fim).getTime()) : null;

  async function assinar() {
    const { descricao } = form.getValues();
    const resposta = await enviarEvento({
      tipo: "encerramento_assinado",
      os_id: osId,
      payload: {
        execucao_id: execucao.id,
        ...(descricao.trim() ? { descricao_atividade: descricao.trim() } : {}),
        evidencias: [...fotos.map(comoEvidencia), ...pdfs.map(pdfComoEvidencia)],
        ...(checklist.length > 0 && { dados_inspecao: dadosDaInspecao(checklist, respostas) }),
      },
    });
    onConcluida(resposta);
  }

  return (
    <>
      <Notice tone="ok" icon="check">
        <strong>O tempo parou{execucao.fim ? ` às ${hora(execucao.fim)}` : ""}</strong>
        {tempo ? ` (tempo líquido ${horasMinutos(tempo.liquidoMs)})` : ""}. Falta {checklist.length > 0 ? "responder o checklist, " : ""}a descrição e as fotos (opcionais) e a sua assinatura, como
        responsável. Esse preenchimento não conta no tempo.
      </Notice>
      <form ref={ref} noValidate onSubmit={enviar(() => setAssinando(true))} className="stack g12">
        {checklist.length > 0 && (
          <div className="panel stack g8" data-erro={erroDoChecklist ? "" : undefined}>
            <ChecklistDeInspecao perguntas={checklist} respostas={respostas} onChange={setRespostas} />
            {erroDoChecklist && <MensagemDeErro>{erroDoChecklist}</MensagemDeErro>}
          </div>
        )}
        <div className="panel" data-treino="enc-descricao">
          <Field
            label={
              <>
                Descrição da atividade <span className="muted">· opcional</span>
              </>
            }
            htmlFor="descricao"
          >
            <textarea
              className="textarea"
              rows={4}
              placeholder="Só se algo aconteceu: o que foi encontrado e o que ficou pendente. Em branco, o relatório traz “Executado conforme a OS, sem ocorrências”."
              {...form.register("descricao")}
              {...ligarAoErro("descricao")}
            />
          </Field>
        </div>
        <div className="panel" data-treino="enc-fotos">
          <FotosExecucao fotos={fotos} onChange={setFotos} opcional />
          <PdfsExecucao documentos={pdfs} onChange={setPdfs} />
        </div>
        <div className="panel stack g8">
          <p className="small">Só você, como responsável pela execução, assina o encerramento. Depois, a OS segue para o supervisor ler o relatório e assinar por último.</p>
          <div className="row g8">
            <Button type="submit" variant="p" data-treino="enc-assinar">
              <Icon name="check" size={18} />
              Assinar e concluir o encerramento
            </Button>
          </div>
        </div>
      </form>
      {assinando && (
        <JanelaDeAssinatura
          titulo="Assinar o encerramento"
          resumo="Você assina como responsável pela execução. Depois da sua assinatura, a OS aguarda o supervisor."
          rotuloConfirmar="Assinar e concluir"
          assinaturaPath={assinaturaPath}
          aoConfirmar={assinar}
          aoFechar={() => setAssinando(false)}
        />
      )}
    </>
  );
}
