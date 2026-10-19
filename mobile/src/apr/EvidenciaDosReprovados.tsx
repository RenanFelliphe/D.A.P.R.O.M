import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { documentosDe, type EvidenciaDoItem, type ItemReprovado, type RascunhoApr } from "@shared/api/apr";
import { CampoDeFotos, CampoDePdfs, type FotoEnviada, type PdfEnviado } from "@/campo/Evidencias";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Campo } from "@/ui/Campo";
import { Icone } from "@/ui/Icone";
import { useFormulario, useRevalidarQuando } from "@/ui/useFormulario";

/** O que cada tipo de item pede, dito ao técnico depois da validação. */
const INSTRUCAO: Record<EvidenciaDoItem, string> = {
  foto: "Registre o motivo e anexe ao menos 1 foto. Se tiver um documento (laudo, certificado), anexe também o PDF.",
  pdf: "Registre o motivo e anexe ao menos 1 documento em PDF (laudo, certificado, relatório). Fotos são opcionais.",
  texto: "Justifique em texto. A foto e o PDF são opcionais: condição pessoal não se comprova com foto, e cada pessoa tem direito de recusa.",
};

interface EvidenciaDosReprovadosProps {
  rascunho: RascunhoApr;
  aoObservar: (itemId: string, texto: string) => void;
  aoFotoEnviada: (itemId: string, foto: FotoEnviada) => void;
  aoRemoverFoto: (itemId: string, fotoId: string) => void;
  aoPdfEnviado: (itemId: string, pdf: PdfEnviado) => void;
  aoRemoverPdf: (itemId: string, documentoId: string) => void;
  /** Envia a evidência; uma falha da `api` é lançada e aparece acima do botão. */
  aoRegistrar: () => Promise<void>;
}

function CartaoDeEvidencia({
  item,
  rascunho,
  erros,
  aoObservar,
  aoFotoEnviada,
  aoRemoverFoto,
  aoPdfEnviado,
  aoRemoverPdf,
}: { item: ItemReprovado; rascunho: RascunhoApr; erros: { observacao?: string; fotos?: string; documentos?: string } } & Omit<EvidenciaDosReprovadosProps, "aoRegistrar" | "rascunho">) {
  const id = item.itemId;
  const fotos = (rascunho.fotos[id] ?? []).map((f) => ({ id: f.id, uri: f.miniatura ?? "", capturadaEm: f.capturadaEm, comGps: f.latitude !== undefined }));
  return (
    <View style={estilos.cartao}>
      <View style={estilos.titulo}>
        <Icone nome="alert-circle" tamanho={20} cor={cores.perigo} />
        <Text style={estilos.tituloTexto}>Item reprovado · evidência obrigatória</Text>
      </View>
      <Text style={estilos.item}>{item.texto}</Text>
      <Text style={estilos.suave}>{INSTRUCAO[item.evidencia] ?? INSTRUCAO.foto}</Text>
      <Campo
        rotulo="Observação · obrigatória"
        placeholder="Descreva o motivo"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        style={estilos.areaDeTexto}
        value={rascunho.respostas[id]?.observacao ?? ""}
        onChangeText={(texto) => aoObservar(id, texto)}
        erro={erros.observacao}
      />
      <CampoDeFotos
        exigencia={item.evidencia === "foto" ? "ao menos 1" : "opcional"}
        obrigatoria={item.evidencia === "foto"}
        fotos={fotos}
        erro={erros.fotos}
        aoEnviada={(foto) => aoFotoEnviada(id, foto)}
        aoRemover={(fotoId) => aoRemoverFoto(id, fotoId)}
      />
      <CampoDePdfs
        exigencia={item.evidencia === "pdf" ? "ao menos 1" : "opcional"}
        obrigatoria={item.evidencia === "pdf"}
        documentos={documentosDe(rascunho, id).map((d) => ({ id: d.id, nome: d.nome }))}
        erro={erros.documentos}
        aoEnviado={(pdf) => aoPdfEnviado(id, pdf)}
        aoRemover={(documentoId) => aoRemoverPdf(id, documentoId)}
      />
    </View>
  );
}

/**
 * O passo seguinte à validação quando a `api` reprovou a APR: só agora o técnico fica sabendo quais itens reprovaram. A APR bloqueada já
 * está registrada (a OS ficou pendente e o supervisor foi avisado); cada item reprovado pede a sua evidência, que completa o registro.
 * As respostas não mudam mais. O botão não fica parado: sem a evidência, a mensagem aparece junto do campo que falta (observação, foto ou PDF).
 */
export function EvidenciaDosReprovados({ rascunho, aoRegistrar, ...acoes }: EvidenciaDosReprovadosProps) {
  const reprovados = useMemo(() => rascunho.avaliacao?.reprovados ?? [], [rascunho.avaliacao]);
  const varios = reprovados.length > 1;

  // O que cada item reprovado ainda pede, por campo: o esquema é refeito a cada mudança do rascunho (as evidências vivem nele).
  const esquema = useMemo(
    () =>
      z
        .object({ obs: z.record(z.string(), z.string()), fotos: z.record(z.string(), z.string()), docs: z.record(z.string(), z.string()) })
        .superRefine((_, ctx) => {
          for (const item of reprovados) {
            if (!rascunho.respostas[item.itemId]?.observacao?.trim()) ctx.addIssue({ code: "custom", path: ["obs", item.itemId], message: "Descreva o motivo: a observação deste item é obrigatória." });
            if (item.evidencia === "foto" && (rascunho.fotos[item.itemId]?.length ?? 0) === 0) ctx.addIssue({ code: "custom", path: ["fotos", item.itemId], message: "Anexe ao menos 1 foto deste item." });
            if (item.evidencia === "pdf" && documentosDe(rascunho, item.itemId).length === 0) ctx.addIssue({ code: "custom", path: ["docs", item.itemId], message: "Anexe ao menos 1 documento em PDF deste item." });
          }
        }),
    [rascunho, reprovados],
  );
  const { form, enviar, enviando, erroEnvio } = useFormulario(esquema, { obs: {}, fotos: {}, docs: {} });
  useRevalidarQuando(form, rascunho);
  const erros = form.formState.errors;

  return (
    <View style={estilos.tudo}>
      <Aviso tom="blq" icone="stop-circle-outline" titulo={varios ? `${reprovados.length} itens reprovaram.` : "Um item reprovou."}>
        {`A atividade está impedida: a APR ficou registrada como bloqueada, a OS está pendente e o supervisor foi avisado.${
          reprovados.length > 0
            ? ` Para cada item abaixo, registre o motivo${reprovados.some((x) => x.evidencia !== "texto") ? " e anexe o que ele pede (foto ou PDF)" : ""}. As respostas não podem mais ser alteradas.`
            : ""
        }`}
      </Aviso>
      {reprovados.map((item) => (
        <CartaoDeEvidencia
          key={item.itemId}
          item={item}
          rascunho={rascunho}
          erros={{ observacao: erros.obs?.[item.itemId]?.message, fotos: erros.fotos?.[item.itemId]?.message, documentos: erros.docs?.[item.itemId]?.message }}
          {...acoes}
        />
      ))}
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo={enviando ? "Enviando…" : reprovados.length > 0 ? "Registrar o impedimento" : "Concluir"} enviando={enviando} aoPressionar={() => void enviar(() => aoRegistrar())()} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tudo: { gap: espaco.m },
  cartao: { gap: espaco.m, padding: espaco.l, borderRadius: raio.m, borderWidth: 1, borderColor: cores.perigoBorda, backgroundColor: cores.superficie },
  titulo: { flexDirection: "row", alignItems: "center", gap: espaco.s },
  tituloTexto: { fontSize: 14, fontWeight: "700", color: cores.perigo },
  item: { fontSize: 16, fontWeight: "600", lineHeight: 22, color: cores.tinta },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta3 },
  areaDeTexto: { minHeight: 88, paddingTop: espaco.m },
});
