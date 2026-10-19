import { Redirect, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { dataHora, hora } from "@shared/api/formatar";
import { rotuloDaOs, type ItemReprovadoDaApr } from "@shared/api/os-app";
import { mensagemDoErro } from "@/api/erros";
import { ImagemDeArquivo } from "@/campo/ImagemDeArquivo";
import { useDetalheDaOs } from "@/os/consultas";
import { rotas } from "@/os/rotas";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Carregando, Vazio } from "@/ui/Estados";
import { Icone } from "@/ui/Icone";
import { Tela } from "@/ui/Tela";

/** "observação, 2 fotos e 1 PDF": o que a evidência do item reprovado reuniu. */
function resumoDaEvidencia(fotos: number, pdfs: number) {
  const partes = ["observação"];
  if (fotos > 0) partes.push(`${fotos} foto${fotos > 1 ? "s" : ""}`);
  if (pdfs > 0) partes.push(`${pdfs} PDF${pdfs > 1 ? "s" : ""}`);
  return partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(", ")} e ${partes.at(-1)}`;
}

const rotuloDaResposta = { sim: "Sim", nao: "Não", na: "NA" } as const;

/** Um item reprovado com a resposta, a observação, as fotos e os PDFs da evidência. */
function ItemReprovado({ item, numero }: { item: ItemReprovadoDaApr; numero: number }) {
  const documentos = item.documentos ?? [];
  return (
    <View style={estilos.item}>
      <Text style={estilos.numero}>{`Item reprovado ${numero}`}</Text>
      <Text style={estilos.texto}>{item.texto}</Text>
      <View style={estilos.linha}>
        <View style={estilos.resposta}>
          <Text style={estilos.respostaTexto}>{`Resposta: ${rotuloDaResposta[item.resposta]}`}</Text>
        </View>
        <Text style={estilos.suave}>{`Evidência: ${resumoDaEvidencia(item.fotos.length, documentos.length)}`}</Text>
      </View>
      {item.observacao ? <Text style={estilos.observacao}>{`“${item.observacao}”`}</Text> : null}
      {item.fotos.length > 0 ? (
        <View style={estilos.fotos}>
          {item.fotos.map((foto, i) => (
            <View key={foto.id} style={estilos.foto}>
              <ImagemDeArquivo id={foto.foto_path} alt={`Foto ${i + 1} do item reprovado`} altura={120} />
              <Text style={estilos.legenda}>{`Foto ${i + 1} · ${hora(foto.capturada_em)}${foto.latitude !== null ? " · GPS ok" : ""}`}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {documentos.map((d) => (
        <View key={d.id} style={estilos.documento}>
          <Icone nome="document-text-outline" tamanho={18} cor={cores.marca} />
          <Text numberOfLines={1} style={estilos.documentoNome}>
            {d.nome ?? "documento.pdf"}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * A APR bloqueada, só leitura, lida da `api` (a APR registrada com todos os itens reprovados, observações e fotos). Sem `apr`, mostra
 * a APR mais recente da OS, se ela estiver bloqueada.
 */
export default function Bloqueio() {
  const { id, apr: aprPedida } = useLocalSearchParams<{ id: string; apr?: string }>();
  const router = useRouter();
  const detalhe = useDetalheDaOs(id);

  if (detalhe.isPending) return <Carregando texto="Abrindo a APR…" />;
  if (detalhe.isError) return <Vazio icone="cloud-offline-outline" titulo="Não foi possível abrir a OS" texto={mensagemDoErro(detalhe.error)} acao={{ titulo: "Tentar de novo", aoPressionar: () => void detalhe.refetch() }} />;
  const { os, aprs } = detalhe.data;
  const apr = aprPedida ? aprs.find((a) => a.id === aprPedida) : aprs[aprs.length - 1];
  if (!apr || apr.resultado !== "bloqueada") return <Redirect href={rotas.os(id)} />;

  const itens = apr.itens_reprovados;
  const motivos = `${itens.length} ${itens.length > 1 ? "itens reprovaram" : "item reprovou"}`;
  return (
    <Tela bordas={["bottom"]}>
      <Stack.Screen options={{ title: "Impedimento" }} />
      <Text style={estilos.etapa}>{`${rotuloDaOs(os)} · ${apr.modelo.codigo} v${apr.modelo.versao} · ${dataHora(apr.concluida_em)}`}</Text>
      <Aviso tom="blq" icone="stop-circle-outline" titulo="Atividade impedida.">
        {`Supervisor será avisado. ${motivos}. ${
          os.status === "pendente" ? "A OS fica pendente e a execução não pode começar. Uma nova APR, de qualquer pessoa da equipe, pode liberá-la." : "Uma nova APR, de qualquer pessoa da equipe, é necessária para executar."
        }`}
      </Aviso>
      {itens.map((item, i) => (
        <ItemReprovado key={item.item_id} item={item} numero={i + 1} />
      ))}
      {apr.observacao_geral ? (
        <View style={estilos.item}>
          <Text style={estilos.numero}>Observações</Text>
          <Text style={estilos.texto}>{apr.observacao_geral}</Text>
        </View>
      ) : null}
      <View style={estilos.notas}>
        <Text style={estilos.suave}>O supervisor da equipe recebe o aviso no painel e por e-mail, com o motivo e as fotos das evidências.</Text>
        <Text style={estilos.suave}>Depois de registrada, esta APR não pode ser alterada. A OS continua pendente: quem voltar ao local faz uma APR nova, sem esperar reprogramação.</Text>
      </View>
      <Botao titulo="Voltar à lista de OS" aoPressionar={() => router.dismissTo("/lista")} />
      <Botao titulo="Ver a OS" variante="secundario" aoPressionar={() => router.replace(rotas.os(id))} />
    </Tela>
  );
}

const estilos = StyleSheet.create({
  etapa: { fontSize: 13, fontWeight: "600", color: cores.perigo },
  item: { gap: espaco.s, padding: espaco.l, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  numero: { fontSize: 12, fontWeight: "700", color: cores.tinta3, textTransform: "uppercase" },
  texto: { fontSize: 15, fontWeight: "600", lineHeight: 21, color: cores.tinta },
  linha: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: espaco.m },
  resposta: { backgroundColor: cores.perigo, borderRadius: raio.pilula, paddingHorizontal: 10, paddingVertical: 3 },
  respostaTexto: { fontSize: 12, fontWeight: "700", color: cores.branco },
  suave: { fontSize: 13, lineHeight: 19, color: cores.tinta3 },
  observacao: { fontSize: 14, lineHeight: 20, fontStyle: "italic", color: cores.tinta2 },
  fotos: { flexDirection: "row", flexWrap: "wrap", gap: espaco.s },
  foto: { width: 150, gap: 4 },
  legenda: { fontSize: 11, color: cores.tinta4 },
  documento: { flexDirection: "row", alignItems: "center", gap: espaco.s },
  documentoNome: { flex: 1, fontSize: 14, color: cores.tinta },
  notas: { gap: espaco.s },
});
