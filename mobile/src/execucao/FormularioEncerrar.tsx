import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { dadosDaInspecao, faltaObservacao, type PerguntaDoChecklist, type RespostaDoItem } from "@shared/api/checklist-inspecao";
import { comoEvidencia, MAX_FOTOS_DA_EXECUCAO, MAX_PDFS_DA_EXECUCAO, pdfComoEvidencia, type FotoDaExecucao, type PdfDaExecucao } from "@shared/api/evidencias";
import { calcularTempo, horasMinutos, type ExecucaoDaApi } from "@shared/api/execucao-tempo";
import { hora } from "@shared/api/formatar";
import type { RespostaComPontos } from "@shared/api/gamificacao";
import { enviarEvento } from "@/offline/app";
import { apagarArquivosLocais } from "@/campo/arquivos";
import { CampoDeFotos, CampoDePdfs } from "@/campo/Evidencias";
import { JanelaDeAssinatura } from "@/campo/JanelaDeAssinatura";
import { useAtualizarDepoisDoEvento } from "@/campo/useAcao";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { useFormulario, useValorDoForm } from "@/ui/useFormulario";
import { ChecklistDeInspecao } from "./ChecklistDeInspecao";

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
  aoConcluir: (resposta: RespostaComPontos) => void;
}

/** O resumo das perguntas do checklist que faltam, para a mensagem de erro dizer quais são. */
function resumoDasPerguntas(perguntas: PerguntaDoChecklist[]) {
  const curtas = perguntas.slice(0, 3).map((p) => `“${p.texto.length > 50 ? `${p.texto.slice(0, 50)}…` : p.texto}”`);
  return perguntas.length > 3 ? `${curtas.join(", ")} e mais ${perguntas.length - 3}` : curtas.join(", ");
}

/**
 * O segundo passo do encerramento (o primeiro é o toque em "Encerrar OS", que já parou o tempo): o checklist de inspeção (preventiva cujo
 * plano o tem; segue obrigatório responder), a descrição, as fotos e os PDFs (todos OPCIONAIS: só são necessários quando aconteceu algo)
 * e a assinatura do RESPONSÁVEL, com a assinatura do perfil. Os demais já assinaram a APR no começo. Esse preenchimento não entra no
 * tempo; se a pessoa sair, a OS fica `encerrando` e a tela volta aqui.
 */
export function FormularioEncerrar({ execucao, osId, checklist, aoConcluir }: FormularioEncerrarProps) {
  const atualizarDepois = useAtualizarDepoisDoEvento();
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
  const { form, enviar } = useFormulario<ValoresDoEncerramento>(esquema, { descricao: "", fotos: [], pdfs: [], respostas: {} });
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
    apagarArquivosLocais(fotos.map((f) => f.previa));
    void atualizarDepois();
    aoConcluir(resposta);
  }

  return (
    <View style={estilos.tela}>
      <Aviso tom="ok" icone="checkmark-circle-outline" titulo={`O tempo parou${execucao.fim ? ` às ${hora(execucao.fim)}` : ""}${tempo ? ` (tempo líquido ${horasMinutos(tempo.liquidoMs)})` : ""}.`}>
        {`Falta ${checklist.length > 0 ? "responder o checklist, " : ""}a descrição e as fotos (opcionais) e a sua assinatura, como responsável. Esse preenchimento não conta no tempo.`}
      </Aviso>
      {checklist.length > 0 ? (
        <View style={estilos.bloco}>
          <ChecklistDeInspecao perguntas={checklist} respostas={respostas} onChange={setRespostas} />
          {erroDoChecklist ? (
            <Text accessibilityRole="alert" style={estilos.erro}>
              {erroDoChecklist}
            </Text>
          ) : null}
        </View>
      ) : null}
      <CampoDeFormulario
        control={form.control}
        nome="descricao"
        rotulo="Descrição da atividade · opcional"
        placeholder="Só se algo aconteceu: o que foi encontrado e o que ficou pendente. Em branco, o relatório traz “Executado conforme a OS, sem ocorrências”."
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        style={estilos.areaDeTexto}
      />
      <CampoDeFotos
        exigencia={`opcional, até ${MAX_FOTOS_DA_EXECUCAO}`}
        maximo={MAX_FOTOS_DA_EXECUCAO}
        fotos={fotos.map((f) => ({ id: f.id, uri: f.previa, capturadaEm: f.capturadaEm, comGps: f.latitude !== undefined }))}
        aoEnviada={(f) => setFotos((anteriores) => [...anteriores, { id: f.id, arquivoId: f.arquivoId, previa: f.uri, capturadaEm: f.capturadaEm, latitude: f.latitude, longitude: f.longitude }])}
        aoRemover={(id) => setFotos((anteriores) => anteriores.filter((f) => f.id !== id))}
      />
      <CampoDePdfs
        exigencia={`opcional, até ${MAX_PDFS_DA_EXECUCAO}`}
        maximo={MAX_PDFS_DA_EXECUCAO}
        documentos={pdfs.map((d) => ({ id: d.id, nome: d.nome }))}
        aoEnviado={(d) => setPdfs((anteriores) => [...anteriores, { id: d.id, arquivoId: d.arquivoId, nome: d.nome, capturadaEm: d.capturadaEm }])}
        aoRemover={(id) => setPdfs((anteriores) => anteriores.filter((d) => d.id !== id))}
      />
      <Text style={estilos.suave}>Só você, como responsável pela execução, assina o encerramento. Depois, a OS segue para o supervisor ler o relatório e assinar por último.</Text>
      <Botao titulo="Assinar e concluir o encerramento" icone="checkmark" aoPressionar={() => void enviar(() => setAssinando(true))()} />
      {assinando ? (
        <JanelaDeAssinatura
          titulo="Assinar o encerramento"
          resumo="Você assina como responsável pela execução. Depois da sua assinatura, a OS aguarda o supervisor."
          rotuloConfirmar="Assinar e concluir"
          aoConfirmar={assinar}
          aoFechar={() => setAssinando(false)}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { gap: espaco.m },
  bloco: { gap: espaco.s },
  erro: { fontSize: 13, lineHeight: 19, color: cores.perigo },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta4 },
  areaDeTexto: { minHeight: 96, paddingTop: espaco.m },
});
