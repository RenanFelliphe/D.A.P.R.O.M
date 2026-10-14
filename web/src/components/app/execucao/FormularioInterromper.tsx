"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FotosExecucao, PdfsExecucao, comoEvidencia, pdfComoEvidencia, type FotoDaExecucao, type PdfDaExecucao } from "@/components/app/execucao/FotosExecucao";
import { Button } from "@/components/ui/Button";
import { Field, Req } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { enviarEvento } from "@/lib/cliente-api";
import { textoDosPontosGanhos } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";
import { useAcao } from "./useAcao";

/** Interrupção por risco: motivo e ao menos 1 foto (PDFs opcionais); a OS fica pendente e o supervisor é avisado pela `api`. */
export function FormularioInterromper({ osId, execucaoId, onCancelar }: { osId: string; execucaoId: string; onCancelar: () => void }) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { ocupado, erro, executar } = useAcao();
  const [motivo, setMotivo] = useState("");
  const [fotos, setFotos] = useState<FotoDaExecucao[]>([]);
  const [pdfs, setPdfs] = useState<PdfDaExecucao[]>([]);
  const pronto = motivo.trim() !== "" && fotos.length > 0;

  const interromper = () =>
    executar(async () => {
      const resposta = await enviarEvento({
        tipo: "execucao_interrompida",
        os_id: osId,
        payload: { execucao_id: execucaoId, fim: new Date().toISOString(), motivo: motivo.trim(), evidencias: [...fotos.map(comoEvidencia), ...pdfs.map(pdfComoEvidencia)] },
      });
      // Interromper por risco vale o mesmo que encerrar: a segurança não custa pontos.
      const pontos = textoDosPontosGanhos(resposta);
      exibirAviso(pontos ? `Atividade interrompida — supervisor será avisado · ${pontos}` : "Atividade interrompida — supervisor será avisado");
      router.push(rotas.app.lista);
    });

  return (
    <>
      <Notice tone="blq" icon="octagon">
        <strong>Interromper por risco</strong> para a atividade: a OS fica pendente e o supervisor é avisado. Para retomar, faça uma APR nova.
      </Notice>
      <div className="panel">
        <Field
          label={
            <>
              Motivo da interrupção <Req style={{ color: "var(--blq)" }}>· obrigatório</Req>
            </>
          }
          htmlFor="motivo"
        >
          <textarea className="textarea" id="motivo" rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Qual risco apareceu?" />
        </Field>
      </div>
      <div className="panel">
        <FotosExecucao fotos={fotos} onChange={setFotos} desabilitado={ocupado} />
        <PdfsExecucao documentos={pdfs} onChange={setPdfs} desabilitado={ocupado} />
      </div>
      {erro && (
        <Notice tone="blq" icon="alert">
          {erro.mensagem}
        </Notice>
      )}
      <div className="panel stack g8">
        {!pronto && <span className="small">Falta: {[motivo.trim() === "" && "o motivo", fotos.length === 0 && "ao menos 1 foto"].filter(Boolean).join(" e ")}.</span>}
        <div className="row g8">
          <Button variant="od" onClick={interromper} disabled={!pronto || ocupado}>
            {ocupado ? "Interrompendo…" : "Interromper a atividade"}
          </Button>
          <Button variant="line" onClick={onCancelar} disabled={ocupado}>
            Voltar à execução
          </Button>
        </div>
      </div>
    </>
  );
}
