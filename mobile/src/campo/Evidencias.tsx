import { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { hora } from "@shared/api/formatar";
import { novoUuid } from "@shared/api/uuid";
import { enviarArquivo } from "@/offline/app";
import { mensagemDoErro } from "@/api/erros";
import { useConexao } from "@/estado/conexao";
import { cores, espaco, raio } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { Icone } from "@/ui/Icone";
import { escolherFoto, escolherPdf, type FotoPronta, type OrigemDaFoto, type PdfPronto } from "./arquivos";
import { posicaoDaFoto } from "./localizacao";

/** Uma foto que subiu: o `arquivoId` é o que o evento referencia; o `id` é o da evidência; `uri` é a cópia local para mostrar. */
export interface FotoEnviada {
  id: string;
  arquivoId: string;
  uri: string;
  capturadaEm: string;
  latitude?: number;
  longitude?: number;
}

export interface PdfEnviado {
  id: string;
  arquivoId: string;
  nome: string;
  capturadaEm: string;
}

interface CabecalhoProps {
  texto: string;
  /** "ao menos 1", "opcional, até 10": o que a tela pede, ao lado do título. */
  exigencia?: string;
  contagem: string;
  obrigatoria?: boolean;
}

function Cabecalho({ texto, exigencia, contagem, obrigatoria }: CabecalhoProps) {
  return (
    <View style={estilos.cabecalho}>
      <Text style={estilos.rotulo}>
        {texto} {exigencia ? <Text style={[estilos.exigencia, obrigatoria && { color: cores.perigo, fontWeight: "700" }]}>{`· ${exigencia}`}</Text> : null}
      </Text>
      <Text style={estilos.contagem}>{contagem}</Text>
    </View>
  );
}

/** Sem sinal, a foto e o PDF não somem: ficam guardados no aparelho e sobem, antes do registro que os cita, quando o sinal voltar. */
function NotaSemSinal({ o }: { o: string }) {
  const semSinal = useConexao() === "offline";
  return semSinal ? <Text style={estilos.contagem}>{`Sem sinal: ${o} ficam guardados neste aparelho e sobem quando a conexão voltar.`}</Text> : null;
}

interface CampoDeFotosProps {
  rotulo?: string;
  /** "ao menos 1", "opcional, até 10". */
  exigencia?: string;
  obrigatoria?: boolean;
  fotos: { id: string; uri: string; capturadaEm: string; comGps?: boolean }[];
  maximo?: number;
  /** A mensagem de validação (foto exigida e não anexada), junto do campo. */
  erro?: string;
  desabilitado?: boolean;
  aoEnviada: (foto: FotoEnviada) => void;
  aoRemover: (id: string) => void;
}

/**
 * As fotos de uma evidência: "Tirar foto" abre a câmera e "Galeria", o seletor. A foto é comprimida (~1600 px, 70%), sobe por
 * `PUT /arquivos/{id}` e só então entra na lista; se o envio falhar, a foto fica guardada e "Enviar a foto de novo" repete o mesmo
 * envio (o id é o mesmo, então não duplica). A posição vai junto quando a permissão de localização já foi dada.
 */
export function CampoDeFotos({ rotulo = "Fotos", exigencia, obrigatoria, fotos, maximo = 10, erro, desabilitado, aoEnviada, aoRemover }: CampoDeFotosProps) {
  const [etapa, setEtapa] = useState<"livre" | "preparando" | "enviando">("livre");
  const [pendente, setPendente] = useState<FotoPronta | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const ocupado = etapa !== "livre";

  async function subir(foto: FotoPronta) {
    setEtapa("enviando");
    setFalha(null);
    try {
      const [arquivoId, posicao] = await Promise.all([enviarArquivo(foto, "foto", foto.id), posicaoDaFoto()]);
      setPendente(null);
      aoEnviada({ id: novoUuid(), arquivoId, uri: foto.uri, capturadaEm: foto.capturadaEm, ...(posicao ?? {}) });
    } catch (e) {
      setPendente(foto);
      setFalha(`${mensagemDoErro(e)} A foto ficou guardada neste aparelho.`);
    } finally {
      setEtapa("livre");
    }
  }

  async function adicionar(origem: OrigemDaFoto) {
    setFalha(null);
    setEtapa("preparando");
    let foto: FotoPronta | null;
    try {
      foto = await escolherFoto(origem);
    } catch (e) {
      setFalha(mensagemDoErro(e));
      setEtapa("livre");
      return;
    }
    if (!foto) {
      setEtapa("livre");
      return;
    }
    await subir(foto);
  }

  const cheio = fotos.length >= maximo;
  return (
    <View style={estilos.campo}>
      <Cabecalho texto={rotulo} exigencia={exigencia} obrigatoria={obrigatoria} contagem={`${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}`} />
      {fotos.length > 0 ? (
        <View style={estilos.grade}>
          {fotos.map((f, i) => (
            <View key={f.id} style={estilos.miniatura}>
              <Image accessibilityLabel={`Foto ${i + 1}, às ${hora(f.capturadaEm)}`} source={{ uri: f.uri }} style={estilos.imagem} />
              <Text style={estilos.hora}>{`${hora(f.capturadaEm)}${f.comGps ? " · GPS" : ""}`}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remover a foto ${i + 1}`} disabled={desabilitado || ocupado} onPress={() => aoRemover(f.id)} style={estilos.remover} hitSlop={8}>
                <Icone nome="close" tamanho={16} cor={cores.branco} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {erro ? (
        <Text accessibilityRole="alert" style={estilos.erro}>
          {erro}
        </Text>
      ) : null}
      {falha ? <Aviso tom="blq">{falha}</Aviso> : null}
      {pendente ? <Botao titulo="Enviar a foto de novo" icone="refresh" variante="secundario" enviando={etapa === "enviando"} aoPressionar={() => void subir(pendente)} /> : null}
      {!cheio && !pendente ? (
        <View style={estilos.botoes}>
          <Botao
            titulo={etapa === "enviando" ? "Enviando…" : etapa === "preparando" ? "Preparando…" : "Tirar foto"}
            icone="camera-outline"
            variante="secundario"
            bloco={false}
            estilo={estilos.botao}
            enviando={ocupado}
            aoPressionar={desabilitado ? () => undefined : () => void adicionar("camera")}
          />
          <Botao titulo="Galeria" icone="images-outline" variante="secundario" bloco={false} estilo={estilos.botao} aoPressionar={desabilitado || ocupado ? () => undefined : () => void adicionar("galeria")} />
        </View>
      ) : null}
      {cheio ? <Text style={estilos.contagem}>{`Limite de ${maximo} fotos por execução.`}</Text> : null}
      <NotaSemSinal o="as fotos" />
    </View>
  );
}

interface CampoDePdfsProps {
  rotulo?: string;
  exigencia?: string;
  obrigatoria?: boolean;
  documentos: { id: string; nome: string }[];
  maximo?: number;
  erro?: string;
  desabilitado?: boolean;
  aoEnviado: (pdf: PdfEnviado) => void;
  aoRemover: (id: string) => void;
}

/** Os documentos em PDF de uma evidência (um laudo, um certificado): escolhidos nos documentos do aparelho, de até 10 MB cada. */
export function CampoDePdfs({ rotulo = "Documentos em PDF", exigencia, obrigatoria, documentos, maximo = 5, erro, desabilitado, aoEnviado, aoRemover }: CampoDePdfsProps) {
  const [etapa, setEtapa] = useState<"livre" | "preparando" | "enviando">("livre");
  const [pendente, setPendente] = useState<PdfPronto | null>(null);
  const [falha, setFalha] = useState<string | null>(null);
  const ocupado = etapa !== "livre";

  async function subir(pdf: PdfPronto) {
    setEtapa("enviando");
    setFalha(null);
    try {
      const arquivoId = await enviarArquivo(pdf, "pdf", pdf.id);
      setPendente(null);
      aoEnviado({ id: novoUuid(), arquivoId, nome: pdf.nome, capturadaEm: pdf.capturadaEm });
    } catch (e) {
      setPendente(pdf);
      setFalha(mensagemDoErro(e));
    } finally {
      setEtapa("livre");
    }
  }

  async function adicionar() {
    setFalha(null);
    setEtapa("preparando");
    let pdf: PdfPronto | null;
    try {
      pdf = await escolherPdf();
    } catch (e) {
      setFalha(mensagemDoErro(e));
      setEtapa("livre");
      return;
    }
    if (!pdf) {
      setEtapa("livre");
      return;
    }
    await subir(pdf);
  }

  return (
    <View style={estilos.campo}>
      <Cabecalho texto={rotulo} exigencia={exigencia} obrigatoria={obrigatoria} contagem={documentos.length === 1 ? "1 documento" : `${documentos.length} documentos`} />
      {documentos.map((d) => (
        <View key={d.id} style={estilos.documento}>
          <Icone nome="document-text-outline" tamanho={20} cor={cores.marca} />
          <Text numberOfLines={1} style={estilos.documentoNome}>
            {d.nome}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remover o PDF ${d.nome}`} disabled={desabilitado || ocupado} onPress={() => aoRemover(d.id)} hitSlop={8}>
            <Icone nome="close-circle-outline" tamanho={22} cor={cores.tinta4} />
          </Pressable>
        </View>
      ))}
      {erro ? (
        <Text accessibilityRole="alert" style={estilos.erro}>
          {erro}
        </Text>
      ) : null}
      {falha ? <Aviso tom="blq">{falha}</Aviso> : null}
      {pendente ? (
        <Botao titulo="Enviar o PDF de novo" icone="refresh" variante="secundario" enviando={etapa === "enviando"} aoPressionar={() => void subir(pendente)} />
      ) : documentos.length < maximo ? (
        <Botao titulo={etapa === "enviando" ? "Enviando…" : documentos.length > 0 ? "Outro PDF" : "Anexar PDF"} icone="attach-outline" variante="secundario" enviando={ocupado} aoPressionar={desabilitado ? () => undefined : () => void adicionar()} />
      ) : null}
      <NotaSemSinal o="os PDFs" />
    </View>
  );
}

const estilos = StyleSheet.create({
  campo: { gap: espaco.s },
  cabecalho: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: espaco.m },
  rotulo: { flex: 1, fontSize: 14, fontWeight: "600", color: cores.tinta2 },
  exigencia: { fontWeight: "400", color: cores.tinta4 },
  contagem: { fontSize: 12, color: cores.tinta4 },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: espaco.s },
  miniatura: { width: 104, height: 104, borderRadius: raio.s, overflow: "hidden", backgroundColor: cores.chip },
  imagem: { width: "100%", height: "100%" },
  hora: { position: "absolute", left: 4, bottom: 4, backgroundColor: "rgba(0,0,0,0.55)", color: cores.branco, borderRadius: 4, paddingHorizontal: 5, fontSize: 11 },
  remover: { position: "absolute", right: 4, top: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },
  botoes: { flexDirection: "row", gap: espaco.s },
  botao: { flex: 1 },
  erro: { fontSize: 13, color: cores.perigo },
  documento: { flexDirection: "row", alignItems: "center", gap: espaco.s, minHeight: 44, paddingHorizontal: espaco.m, borderRadius: raio.m, borderWidth: 1, borderColor: cores.linha, backgroundColor: cores.superficie },
  documentoNome: { flex: 1, fontSize: 14, color: cores.tinta },
});
