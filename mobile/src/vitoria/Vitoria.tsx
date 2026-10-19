import { useRouter, usePathname, type Href } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { sugestoesDaTela } from "@shared/vitoria/sugestoes";
import { URL_DA_WEB } from "@/config";
import { cores, espaco, raio } from "@/tema/tema";
import { Icone } from "@/ui/Icone";
import { Avatar } from "./Avatar";
import { Figurinha } from "./Figurinha";
import { IndicadorPensando } from "./IndicadorPensando";
import { telaAtualDe, type DestinoNoApp } from "./telas";
import type { MensagemVitoria } from "./tipos";
import { useConversa } from "./useConversa";

/**
 * O botão flutuante e o painel de conversa da Vitória (`vitoria.md`, seção 2), presentes em todas as telas de campo. Ela só consulta o
 * manual e o manifesto de destinos: nunca lê nem grava dado de OS. A `api` decide o manual pelo perfil de quem está logado.
 */
export function Vitoria() {
  const router = useRouter();
  const caminho = usePathname();
  const margens = useSafeAreaInsets();
  const [aberto, setAberto] = useState(false);
  const [digitando, setDigitando] = useState("");
  const lista = useRef<ScrollViewInstance>(null);
  const tela = telaAtualDe(caminho);
  const sugestoes = sugestoesDaTela(tela.tela);
  const conversa = useConversa({ aberto, tela });
  const { mensagens, carregando, respondendo, erro } = conversa;

  useEffect(() => {
    if (aberto) lista.current?.scrollToEnd({ animated: true });
  }, [mensagens, aberto, erro]);

  const textoChegando = mensagens.find((m) => m.id === respondendo)?.texto ?? "";
  const situacao = !carregando ? "Pronta para ajudar" : textoChegando ? "Escrevendo" : "Pensando";

  const fechar = () => {
    setAberto(false);
    conversa.pararFigurinhas();
  };

  const enviar = async () => {
    const texto = digitando;
    if (await conversa.enviar(texto)) setDigitando("");
  };

  const irPara = (m: MensagemVitoria) => {
    if (!m.acao) return;
    const destino: DestinoNoApp | null = conversa.confirmarAcao(m.acao);
    if (!destino) return;
    if (destino.tipo === "web") {
      if (!URL_DA_WEB) return conversa.definirErro("Essa tela só existe na versão web do SYNQ OS. Abra-a no navegador.");
      void Linking.openURL(`${URL_DA_WEB}${destino.caminho}`).catch(() => conversa.definirErro("Não consegui abrir a web neste aparelho."));
      return;
    }
    fechar();
    router.navigate((destino.params ? { pathname: destino.rota, params: destino.params } : destino.rota) as Href);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={conversa.naoLida ? "Abrir a Vitória: tem resposta nova" : "Abrir a Vitória, a assistente de ajuda"}
        onPress={() => {
          conversa.marcarComoLida();
          setAberto(true);
        }}
        style={[estilos.botao, { bottom: margens.bottom + 76 }]}
      >
        <Avatar tamanho={52} />
        {conversa.naoLida ? <View style={estilos.selo} /> : null}
      </Pressable>

      <Modal visible={aberto} animationType="slide" onRequestClose={fechar} statusBarTranslucent>
        <SafeAreaView style={estilos.painel} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={estilos.painel}>
            <View style={estilos.cabecalho}>
              <Avatar tamanho={40} />
              <View style={estilos.cabecalhoTexto}>
                <Text style={estilos.nome}>Vitória</Text>
                <Text style={estilos.situacao} accessibilityLiveRegion="polite">
                  {situacao}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Fechar a Vitória" onPress={fechar} hitSlop={12} style={estilos.fechar}>
                <Icone nome="close" tamanho={24} cor={cores.tinta3} />
              </Pressable>
            </View>

            <ScrollView ref={lista} contentContainerStyle={estilos.lista} keyboardShouldPersistTaps="handled">
              {mensagens.length === 0 ? (
                <>
                  <View style={estilos.boasVindas}>
                    <Figurinha reacao="ola" tocar tamanho={88} />
                    <Text style={estilos.titulo}>Oi, eu sou a Vitória!</Text>
                    <Text style={estilos.texto}>Tiro dúvidas de uso do sistema. Toque numa pergunta abaixo ou escreva a sua.</Text>
                  </View>
                  {sugestoes.length > 0 ? (
                    <View style={estilos.sugestoes}>
                      <Text style={estilos.sugestoesTitulo}>Perguntas comuns nesta tela</Text>
                      {sugestoes.map((s) => (
                        <Pressable key={s.pergunta} accessibilityRole="button" onPress={() => void conversa.responderComSugestao(s)} style={estilos.sugestao}>
                          <Text style={estilos.sugestaoTexto}>{s.pergunta}</Text>
                          <Icone nome="chevron-forward" tamanho={16} cor={cores.marca} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

              {mensagens.map((m) => {
                const chegando = m.id === respondendo;
                const pensando = chegando && !m.texto;
                const dela = m.papel === "assistente";
                return (
                  <View key={m.id} style={[estilos.mensagem, dela ? estilos.mensagemDela : estilos.mensagemMinha]}>
                    {dela ? <Avatar tamanho={30} /> : null}
                    <View style={estilos.corpo}>
                      <View style={[estilos.bolha, dela ? estilos.bolhaDela : estilos.bolhaMinha]}>
                        {pensando ? <IndicadorPensando /> : <Text style={[estilos.bolhaTexto, !dela && { color: cores.branco }]}>{m.texto}</Text>}
                        {m.fonte === "geral" && !chegando ? <Text style={estilos.fonte}>Informação geral, não é regra da empresa</Text> : null}
                        {m.acao && !chegando ? (
                          <Pressable accessibilityRole="button" onPress={() => irPara(m)} style={estilos.acao}>
                            <Text style={estilos.acaoTexto}>{m.acao.tipo === "destacar" ? "Mostrar na tela" : "Me leve lá"}</Text>
                            <Icone nome="chevron-forward" tamanho={14} cor={cores.marca} />
                          </Pressable>
                        ) : null}
                      </View>
                      {m.figurinha && !chegando ? <Figurinha reacao={m.figurinha.reacao} completa={m.figurinha.completa} tocar={m.figurinha.tocar} aoTerminar={() => conversa.aoTerminarFigurinha(m.id)} /> : null}
                    </View>
                  </View>
                );
              })}
              {erro ? (
                <Text accessibilityRole="alert" style={estilos.erro}>
                  {erro}
                </Text>
              ) : null}
            </ScrollView>

            <View style={estilos.formulario}>
              <View style={[estilos.campo, carregando && estilos.campoOcupado]}>
                <TextInput
                  accessibilityLabel="Sua pergunta para a Vitória"
                  value={digitando}
                  onChangeText={setDigitando}
                  placeholder={carregando ? "A Vitória está respondendo…" : "Digite sua dúvida…"}
                  placeholderTextColor={cores.tinta4}
                  editable={!carregando}
                  maxLength={1000}
                  multiline
                  returnKeyType="send"
                  onSubmitEditing={() => void enviar()}
                  style={estilos.entrada}
                />
                <Pressable accessibilityRole="button" accessibilityLabel={carregando ? "Aguardando a resposta" : "Enviar pergunta"} onPress={() => void enviar()} style={[estilos.enviar, (carregando || !digitando.trim()) && estilos.enviarParado]}>
                  <Icone nome="send" tamanho={18} cor={cores.branco} />
                </Pressable>
              </View>
              <Text style={estilos.rodape}>A Vitória responde dúvidas de uso do sistema com base no manual.</Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const estilos = StyleSheet.create({
  botao: { position: "absolute", right: espaco.l, width: 56, height: 56, borderRadius: raio.pilula, backgroundColor: cores.superficie, borderWidth: 2, borderColor: cores.marcaBorda, alignItems: "center", justifyContent: "center", elevation: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  selo: { position: "absolute", top: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: cores.perigo, borderWidth: 2, borderColor: cores.superficie },
  painel: { flex: 1, backgroundColor: cores.fundo },
  cabecalho: { flexDirection: "row", alignItems: "center", gap: espaco.m, paddingHorizontal: espaco.l, paddingVertical: espaco.m, backgroundColor: cores.superficie, borderBottomWidth: 1, borderBottomColor: cores.linha },
  cabecalhoTexto: { flex: 1 },
  nome: { fontSize: 17, fontWeight: "700", color: cores.tinta },
  situacao: { fontSize: 12, color: cores.ok },
  fechar: { padding: 4 },
  lista: { padding: espaco.l, gap: espaco.m, flexGrow: 1 },
  boasVindas: { alignItems: "center", gap: espaco.s, paddingVertical: espaco.l },
  titulo: { fontSize: 18, fontWeight: "700", color: cores.tinta },
  texto: { fontSize: 14, lineHeight: 20, color: cores.tinta3, textAlign: "center" },
  sugestoes: { gap: espaco.s },
  sugestoesTitulo: { fontSize: 12, fontWeight: "700", color: cores.tinta4, textTransform: "uppercase" },
  sugestao: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: espaco.s, paddingHorizontal: espaco.m, paddingVertical: espaco.s, borderRadius: raio.m, borderWidth: 1, borderColor: cores.marcaBorda, backgroundColor: cores.superficie },
  sugestaoTexto: { flex: 1, fontSize: 14, color: cores.tinta },
  mensagem: { flexDirection: "row", alignItems: "flex-end", gap: espaco.s },
  mensagemDela: { justifyContent: "flex-start", paddingRight: espaco.xl },
  mensagemMinha: { justifyContent: "flex-end", paddingLeft: espaco.xl },
  corpo: { flexShrink: 1, gap: espaco.xs },
  bolha: { paddingHorizontal: espaco.m, paddingVertical: espaco.s + 2, borderRadius: raio.m, gap: espaco.s },
  bolhaDela: { backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.linha, borderBottomLeftRadius: 4 },
  bolhaMinha: { backgroundColor: cores.marca, borderBottomRightRadius: 4 },
  bolhaTexto: { fontSize: 15, lineHeight: 21, color: cores.tinta },
  fonte: { fontSize: 12, lineHeight: 16, fontStyle: "italic", color: cores.tinta4 },
  acao: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36, alignSelf: "flex-start" },
  acaoTexto: { fontSize: 14, fontWeight: "700", color: cores.marca },
  erro: { fontSize: 13, color: cores.perigo },
  formulario: { gap: 4, padding: espaco.m, backgroundColor: cores.superficie, borderTopWidth: 1, borderTopColor: cores.linha },
  campo: { flexDirection: "row", alignItems: "flex-end", gap: espaco.s, borderWidth: 1, borderColor: cores.linha, borderRadius: raio.l, paddingLeft: espaco.m, paddingRight: 6, paddingVertical: 6, backgroundColor: cores.fundo },
  campoOcupado: { opacity: 0.7 },
  entrada: { flex: 1, maxHeight: 110, minHeight: 36, fontSize: 15, color: cores.tinta, paddingVertical: 6 },
  enviar: { width: 40, height: 40, borderRadius: raio.pilula, backgroundColor: cores.marca, alignItems: "center", justifyContent: "center" },
  enviarParado: { backgroundColor: cores.tinta4 },
  rodape: { fontSize: 11, color: cores.tinta4, textAlign: "center" },
});
