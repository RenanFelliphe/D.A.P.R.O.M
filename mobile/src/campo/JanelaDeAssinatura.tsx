import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CadastrarAssinatura } from "@/assinatura/CadastrarAssinatura";
import { useSessao } from "@/sessao/SessaoProvider";
import { cores, espaco } from "@/tema/tema";
import { Aviso } from "@/ui/Aviso";
import { Botao } from "@/ui/Botao";
import { JanelaDeFormulario } from "@/ui/JanelaDeFormulario";
import { Opcao } from "@/ui/Opcao";
import { ImagemDeArquivo } from "./ImagemDeArquivo";
import { falhaDe } from "./useAcao";

interface JanelaDeAssinaturaProps {
  titulo: string;
  /** O que a pessoa está assinando, em uma frase. */
  resumo?: string;
  rotuloConfirmar: string;
  /** `perigo` para o que desfaz algo (recusar, cancelar, interromper). */
  tom?: "primario" | "perigo";
  /** Os campos da ação, mostrados antes da assinatura. */
  children?: React.ReactNode;
  /** O pedido inicial da ausência não é assinado (a pessoa assina ao confirmar o que o supervisor aprovar): sem a caixa da assinatura. */
  semAssinatura?: boolean;
  /** O que falta nos campos acima, em uma frase, ou `null`. O botão não fica desativado: ao tocar, a janela mostra a frase e não envia. */
  faltaNosCampos?: string | null;
  /**
   * Faz a chamada à `api`; uma falha vira a mensagem da janela. Devolver um texto mantém a janela aberta com ele, como aviso de que
   * deu certo, em vez de fechá-la.
   */
  aoConfirmar: () => Promise<string | void>;
  aoFechar: () => void;
}

/**
 * A janela das ações assinadas (a APR, o encerramento, a interrupção, o cancelamento): os campos da ação e a confirmação com a
 * assinatura do perfil, a mesma imagem que a APR usa. O botão só fica parado enquanto envia: o que falta (a confirmação) vem como
 * mensagem junto da caixa, e a falha devolvida pela `api` aparece acima do botão.
 */
export function JanelaDeAssinatura({ titulo, resumo, rotuloConfirmar, tom = "primario", children, semAssinatura = false, faltaNosCampos = null, aoConfirmar, aoFechar }: JanelaDeAssinaturaProps) {
  const { eu } = useSessao();
  const assinaturaPath = eu?.usuario.assinatura_path ?? null;
  const [assino, setAssino] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falta, setFalta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function confirmar() {
    setErro(null);
    setFalta(null);
    if (faltaNosCampos) return setFalta(faltaNosCampos);
    if (!semAssinatura && !assinaturaPath) return setFalta("Cadastre a sua assinatura para poder assinar.");
    if (!semAssinatura && !assino) return setFalta("Marque a confirmação para assinar com a sua assinatura do perfil.");
    setOcupado(true);
    try {
      const texto = await aoConfirmar();
      if (texto) setAviso(texto);
      else aoFechar();
    } catch (e) {
      setErro(falhaDe(e).mensagem);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <JanelaDeFormulario titulo={titulo} aoFechar={ocupado ? () => undefined : aoFechar}>
      {aviso ? (
        <>
          <Aviso tom="al">{aviso}</Aviso>
          <Botao titulo="Entendi" aoPressionar={aoFechar} />
        </>
      ) : (
        <>
          {resumo ? <Text style={estilos.resumo}>{resumo}</Text> : null}
          {children}
          {semAssinatura ? null : assinaturaPath ? (
            <View style={estilos.assinatura}>
              <Text style={estilos.rotulo}>Sua assinatura</Text>
              <ImagemDeArquivo id={assinaturaPath} alt="Sua assinatura" altura={72} />
              <Opcao rotulo="Confirmo esta ação e a assino com a minha assinatura do perfil." marcada={assino} aoPressionar={() => { setAssino((a) => !a); setFalta(null); }} />
            </View>
          ) : (
            <>
              <Aviso tom="al">Você ainda não cadastrou a assinatura. Desenhe-a abaixo para continuar: ela fica no seu perfil.</Aviso>
              <CadastrarAssinatura />
            </>
          )}
          {falta ? (
            <Text accessibilityRole="alert" style={estilos.falta}>
              {falta}
            </Text>
          ) : null}
          {erro ? <Aviso tom="blq">{erro}</Aviso> : null}
          <Botao titulo={rotuloConfirmar} variante={tom} enviando={ocupado} aoPressionar={() => void confirmar()} />
          <Botao titulo="Voltar" variante="texto" aoPressionar={ocupado ? () => undefined : aoFechar} />
        </>
      )}
    </JanelaDeFormulario>
  );
}

const estilos = StyleSheet.create({
  resumo: { fontSize: 15, lineHeight: 22, color: cores.tinta2 },
  assinatura: { gap: espaco.s },
  rotulo: { fontSize: 14, fontWeight: "600", color: cores.tinta2 },
  falta: { fontSize: 13, color: cores.perigo },
});
