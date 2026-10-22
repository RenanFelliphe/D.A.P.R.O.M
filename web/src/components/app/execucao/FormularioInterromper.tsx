"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { AvisoDeLocalizacao } from "@/components/app/execucao/AvisoDeLocalizacao";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { FotosExecucao, PdfsExecucao, comoEvidencia, pdfComoEvidencia, type FotoDaExecucao, type PdfDaExecucao } from "@/components/app/execucao/FotosExecucao";
import { Button } from "@/components/ui/Button";
import { Field, Req, ligarAoErro } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { useFormulario, useValorDoForm } from "@/components/ui/useFormulario";
import { enviarEvento } from "@/lib/cliente-api";
import { textoDosPontosGanhos } from "@/lib/gamificacao";
import { comPosicao, obterPosicao } from "@/lib/geolocalizacao";
import { rotas } from "@/lib/rotas";
import { useMinhaAssinatura } from "@/state/minha-assinatura";
import { useToast } from "@/state/toast";

interface ValoresDaInterrupcao {
  motivo: string;
  fotos: FotoDaExecucao[];
  pdfs: PdfDaExecucao[];
}

const esquema: z.ZodType<ValoresDaInterrupcao> = z.object({
  motivo: z.string().trim().min(1, "Diga qual risco apareceu: o motivo da interrupção é obrigatório."),
  fotos: z.array(z.custom<FotoDaExecucao>()).min(1, "Anexe ao menos 1 foto do risco: ela é a prova da interrupção."),
  pdfs: z.array(z.custom<PdfDaExecucao>()),
});

/**
 * Interrupção por risco: motivo e ao menos 1 foto (PDFs opcionais) e a assinatura de quem interrompe; a OS fica pendente e o
 * supervisor é avisado pela `api`. A foto continua obrigatória (é a prova do risco). Grava a localização, sem bloquear se não houver.
 * Faltando motivo ou foto, as mensagens aparecem junto dos campos; a assinatura só é pedida com tudo preenchido.
 */
export function FormularioInterromper({ osId, execucaoId, onCancelar }: { osId: string; execucaoId: string; onCancelar: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const assinaturaPath = useMinhaAssinatura();
  const [assinando, setAssinando] = useState(false);
  const { form, ref, enviar } = useFormulario(esquema, { motivo: "", fotos: [], pdfs: [] });
  const [fotos, setFotos] = useValorDoForm(form, "fotos");
  const [pdfs, setPdfs] = useValorDoForm(form, "pdfs");
  const erros = form.formState.errors;

  async function interromper() {
    const { motivo } = form.getValues();
    const posicao = await obterPosicao();
    const resposta = await enviarEvento({
      tipo: "execucao_interrompida",
      os_id: osId,
      payload: {
        execucao_id: execucaoId,
        fim: new Date().toISOString(),
        motivo: motivo.trim(),
        evidencias: [...fotos.map(comoEvidencia), ...pdfs.map(pdfComoEvidencia)],
        ...comPosicao(posicao),
      },
    });
    // Interromper por risco vale o mesmo que encerrar: a segurança não custa pontos.
    const pontos = textoDosPontosGanhos(resposta);
    exibirAviso(pontos ? `Atividade interrompida — supervisor será avisado · ${pontos}` : "Atividade interrompida — supervisor será avisado");
    router.push(rotas.app.lista);
  }

  return (
    <>
      <Notice tone="blq" icon="octagon">
        <strong>Interromper por risco</strong> para a atividade: a OS fica pendente e o supervisor é avisado. Para retomar, faça uma APR nova.
      </Notice>
      <form ref={ref} noValidate onSubmit={enviar(() => setAssinando(true))} className="stack g12">
        <div className="panel">
          <Field
            label={
              <>
                Motivo da interrupção <Req style={{ color: "var(--blq)" }}>· obrigatório</Req>
              </>
            }
            htmlFor="motivo"
            erro={erros.motivo?.message}
          >
            <textarea className="textarea" rows={4} placeholder="Qual risco apareceu?" {...form.register("motivo")} {...ligarAoErro("motivo", erros.motivo?.message)} />
          </Field>
        </div>
        <div className="panel">
          <FotosExecucao fotos={fotos} onChange={setFotos} erro={erros.fotos?.message} />
          <PdfsExecucao documentos={pdfs} onChange={setPdfs} />
        </div>
        <div className="panel stack g8">
          <AvisoDeLocalizacao />
          <div className="row g8">
            <Button type="submit" variant="od">
              Assinar e interromper a atividade
            </Button>
            <Button variant="line" onClick={onCancelar}>
              Voltar à execução
            </Button>
          </div>
        </div>
      </form>
      {assinando && (
        <JanelaDeAssinatura
          titulo="Interromper por risco"
          tom="d"
          resumo="A atividade para, a OS fica pendente e o supervisor é avisado. Para retomar, faça uma APR nova."
          rotuloConfirmar="Assinar e interromper"
          assinaturaPath={assinaturaPath}
          osId={osId}
          aoConfirmar={interromper}
          aoFechar={() => setAssinando(false)}
        >
          <p className="small">
            <strong>Motivo:</strong> {form.getValues("motivo").trim()}
          </p>
        </JanelaDeAssinatura>
      )}
    </>
  );
}
