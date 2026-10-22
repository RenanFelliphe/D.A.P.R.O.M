import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { z } from "zod";
import { comoEvidencia, MAX_FOTOS_DA_EXECUCAO, MAX_PDFS_DA_EXECUCAO, pdfComoEvidencia, type FotoDaExecucao, type PdfDaExecucao } from "@shared/api/evidencias";
import { textoDosPontosGanhos } from "@shared/api/gamificacao";
import { comPosicao } from "@shared/api/localizacao";
import { enviarEvento } from "@/offline/app";
import { apagarArquivosLocais } from "@/campo/arquivos";
import { CampoDeFotos, CampoDePdfs } from "@/campo/Evidencias";
import { JanelaDeAssinatura } from "@/campo/JanelaDeAssinatura";
import { obterPosicao } from "@/campo/localizacao";
import { useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { mostrarAviso } from "@/ui/AvisoRapido";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { useFormulario, useValorDoForm } from "@/ui/useFormulario";
import { AvisoDeLocalizacao } from "./AvisoDeLocalizacao";

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
 * A interrupção por risco: motivo, ao menos 1 foto (PDFs opcionais) e a assinatura de quem interrompe; a OS fica pendente e o supervisor é
 * avisado pela `api`. A foto continua obrigatória (é a prova do risco). Grava a localização, sem bloquear se não houver. Faltando motivo
 * ou foto, as mensagens aparecem junto dos campos; a assinatura só é pedida com tudo preenchido.
 */
export function FormularioInterromper({ osId, execucaoId, aoVoltar }: { osId: string; execucaoId: string; aoVoltar: () => void }) {
  const router = useRouter();
  const atualizarDepois = useAtualizarDepoisDoEvento();
  const [assinando, setAssinando] = useState(false);
  const { form, enviar } = useFormulario(esquema, { motivo: "", fotos: [], pdfs: [] });
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
    apagarArquivosLocais(fotos.map((f) => f.previa));
    // Interromper por risco vale o mesmo que encerrar: a segurança não custa pontos.
    const pontos = textoDosPontosGanhos(resposta);
    mostrarAviso(pontos ? `Atividade interrompida — supervisor será avisado · ${pontos}` : "Atividade interrompida — supervisor será avisado");
    void atualizarDepois();
    router.dismissTo("/lista");
  }

  return (
    <View style={estilos.tela}>
      <Aviso tom="blq" icone="stop-circle-outline" titulo="Interromper por risco">
        para a atividade: a OS fica pendente e o supervisor é avisado. Para retomar, faça uma APR nova.
      </Aviso>
      <CampoDeFormulario control={form.control} nome="motivo" rotulo="Motivo da interrupção · obrigatório" placeholder="Qual risco apareceu?" multiline numberOfLines={4} textAlignVertical="top" style={estilos.areaDeTexto} />
      <CampoDeFotos
        exigencia={`de 1 a ${MAX_FOTOS_DA_EXECUCAO}`}
        obrigatoria
        maximo={MAX_FOTOS_DA_EXECUCAO}
        fotos={fotos.map((f) => ({ id: f.id, uri: f.previa, capturadaEm: f.capturadaEm, comGps: f.latitude !== undefined }))}
        erro={erros.fotos?.message}
        aoEnviada={(f) => setFotos((anteriores) => [...anteriores, { id: f.id, arquivoId: f.arquivoId, previa: f.uri, capturadaEm: f.capturadaEm, latitude: f.latitude, longitude: f.longitude }])}
        aoRemover={(id) => setFotos((anteriores) => anteriores.filter((f) => f.id !== id))}
      />
      <CampoDePdfs
        exigencia={`opcional, até ${MAX_PDFS_DA_EXECUCAO}`}
        documentos={pdfs.map((d) => ({ id: d.id, nome: d.nome }))}
        aoEnviado={(d) => setPdfs((anteriores) => [...anteriores, { id: d.id, arquivoId: d.arquivoId, nome: d.nome, capturadaEm: d.capturadaEm }])}
        aoRemover={(id) => setPdfs((anteriores) => anteriores.filter((d) => d.id !== id))}
      />
      <AvisoDeLocalizacao />
      <Botao titulo="Assinar e interromper a atividade" variante="perigo" aoPressionar={() => void enviar(() => setAssinando(true))()} />
      <Botao titulo="Voltar à execução" variante="secundario" aoPressionar={aoVoltar} />
      {assinando ? (
        <JanelaDeAssinatura
          titulo="Interromper por risco"
          osId={osId}
          tom="perigo"
          resumo={`A atividade para, a OS fica pendente e o supervisor é avisado. Para retomar, faça uma APR nova.\n\nMotivo: ${form.getValues("motivo").trim()}`}
          rotuloConfirmar="Assinar e interromper"
          aoConfirmar={interromper}
          aoFechar={() => setAssinando(false)}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { gap: espaco.m },
  areaDeTexto: { minHeight: 96, paddingTop: espaco.m },
});
