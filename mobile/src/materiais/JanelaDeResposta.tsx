import { StyleSheet, Text } from "react-native";
import { MAX_CARACTERES_DO_MOTIVO, MIN_CARACTERES_DO_MOTIVO } from "@shared/api/sugestao-materiais";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { CampoDeFormulario } from "@/ui/Campo";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { useFormulario } from "@/ui/useFormulario";
import { esquemaDaRecusa, esquemaDaRespostaOpcional, type ValoresDaRecusa } from "./lista";

interface JanelaDeRespostaProps {
  titulo: string;
  /** O que vai acontecer, antes do campo. */
  explicacao: string;
  /** A recusa exige o motivo (pelo menos 10 caracteres); o aceite deixa a resposta opcional. */
  obrigatoria: boolean;
  botao: string;
  perigo?: boolean;
  aoEnviar: (resposta: string) => Promise<void>;
  aoFechar: () => void;
}

/** A janela de quem avalia: a resposta ao autor, e o botão que conclui (aceitar ou recusar). */
export function JanelaDeResposta({ titulo, explicacao, obrigatoria, botao, perigo = false, aoEnviar, aoFechar }: JanelaDeRespostaProps) {
  const { form, enviar, enviando, erroEnvio } = useFormulario<ValoresDaRecusa>(obrigatoria ? esquemaDaRecusa : esquemaDaRespostaOpcional, { resposta: "" });
  return (
    <JanelaDeFormulario titulo={titulo} aoFechar={enviando ? () => undefined : aoFechar}>
      <Text style={estilos.texto}>{explicacao}</Text>
      <CampoDeFormulario
        control={form.control}
        nome="resposta"
        rotulo={obrigatoria ? "Motivo" : "Resposta ao autor (opcional)"}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        maxLength={MAX_CARACTERES_DO_MOTIVO}
        ajuda={obrigatoria ? `Pelo menos ${MIN_CARACTERES_DO_MOTIVO} caracteres. O autor recebe o motivo.` : "O autor recebe a resposta junto do aviso."}
        style={estilos.areaDeTexto}
      />
      {erroEnvio ? <Aviso tom="blq">{erroEnvio}</Aviso> : null}
      <Botao titulo={botao} variante={perigo ? "perigo" : "primario"} enviando={enviando} aoPressionar={enviar((v) => aoEnviar(v.resposta.trim()))} />
      <Botao titulo="Voltar" variante="texto" aoPressionar={enviando ? () => undefined : aoFechar} />
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  texto: { fontSize: 15, lineHeight: 22, color: cores.tinta2 },
  areaDeTexto: { minHeight: 110, paddingTop: espaco.m },
});
