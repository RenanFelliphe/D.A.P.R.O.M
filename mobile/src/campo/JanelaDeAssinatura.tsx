import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AssinaturaJuridica } from "@shared/api/assinatura-juridica";
import { consultarAssinaturaJuridica, criarAssinaturaJuridica } from "@/assinatura/api-juridica";
import { EsperaDaAssinatura } from "@/assinatura/EsperaDaAssinatura";
import { AssinaturaCancelada, aindaServeAoAto, definirAssinaturaJuridica } from "@/assinatura/juridica";
import { useAssinaturaNoProvedor } from "@/assinatura/useAssinaturaNoProvedor";
import { CadastrarAssinatura } from "@/assinatura/CadastrarAssinatura";
import { useConexao } from "@/estado/conexao";
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
  /** A OS de que o ato trata, quando é óbvia: o termo assinado no provedor mostra o número e o serviço dela. */
  osId?: string;
  /**
   * Faz a chamada à `api`; uma falha vira a mensagem da janela. Devolver um texto mantém a janela aberta com ele, como aviso de que
   * deu certo, em vez de fechá-la.
   */
  aoConfirmar: () => Promise<string | void>;
  aoFechar: () => void;
}

/**
 * A janela das ações assinadas (a APR, o encerramento, a interrupção, o cancelamento): os campos da ação e a assinatura.
 *
 * Com a assinatura com validade jurídica ligada (`GET /me`) e com sinal, a confirmação leva à página do provedor: a janela cria o documento,
 * abre a página, espera a assinatura e só então faz a ação, que leva o código da assinatura (`assinatura/juridica.ts`). Sem sinal, ou com o
 * provedor desligado, vale a assinatura desenhada do perfil (a mesma imagem que a APR usa): sem sinal o ato fica registrado e, quando o
 * sinal voltar, o app pede a assinatura com validade jurídica. O botão só fica parado enquanto envia: o que falta vem como mensagem, e a
 * falha devolvida pela `api` aparece acima do botão.
 */
export function JanelaDeAssinatura({ titulo, resumo, rotuloConfirmar, tom = "primario", children, semAssinatura = false, faltaNosCampos = null, osId, aoConfirmar, aoFechar }: JanelaDeAssinaturaProps) {
  const { eu, entrouSemSinal } = useSessao();
  const semSinal = useConexao() === "offline" || entrouSemSinal;
  const assinaturaPath = eu?.usuario.assinatura_path ?? null;
  const config = eu?.assinatura_juridica;
  const comProvedor = Boolean(config?.ligada) && !semAssinatura && !semSinal;
  const provedorSemSinal = Boolean(config?.ligada) && !semAssinatura && semSinal;
  const provedor = useAssinaturaNoProvedor();
  /** A última assinatura no provedor desta janela: se a ação falhar depois de assinada, a nova tentativa a reaproveita (vale 30 min e serve a um ato). */
  const ultima = useRef<AssinaturaJuridica | null>(null);
  const [assino, setAssino] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [falta, setFalta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  /** Cria a assinatura no provedor, ou retoma a da tentativa anterior (assinada e ainda válida, ou ainda aguardando na página aberta). */
  async function iniciarAssinatura(): Promise<AssinaturaJuridica> {
    const anterior = ultima.current;
    if (anterior) {
      if (aindaServeAoAto(anterior)) return anterior;
      if (anterior.situacao === "aguardando") {
        try {
          const a = await consultarAssinaturaJuridica(anterior.id);
          if (a.situacao === "aguardando" || aindaServeAoAto(a)) return (ultima.current = a);
        } catch {
          /* a consulta falhou: segue para criar outra */
        }
      }
    }
    const nova = await criarAssinaturaJuridica({ titulo, ...(resumo ? { resumo } : {}), ...(osId ? { os_id: osId } : {}) });
    return (ultima.current = nova);
  }

  /** Assina no provedor e só então faz a ação, que leva o código da assinatura (cabeçalho nas rotas, `payload` nos eventos). */
  async function assinarEFazer(): Promise<string | void> {
    const assinada = await provedor.assinar(iniciarAssinatura);
    ultima.current = assinada;
    definirAssinaturaJuridica(assinada.id);
    try {
      const texto = await aoConfirmar();
      ultima.current = null;
      return texto;
    } catch (e) {
      // A `api` recusou o código (já usado, vencido): a próxima tentativa assina de novo em vez de reaproveitá-lo.
      if (falhaDe(e).codigo?.startsWith("assinatura_juridica")) ultima.current = null;
      throw e;
    } finally {
      definirAssinaturaJuridica(null);
    }
  }

  async function confirmar() {
    setErro(null);
    setFalta(null);
    if (faltaNosCampos) return setFalta(faltaNosCampos);
    if (!comProvedor) {
      if (!semAssinatura && !assinaturaPath) return setFalta("Cadastre a sua assinatura para poder assinar.");
      if (!semAssinatura && !assino) return setFalta("Marque a confirmação para assinar com a sua assinatura do perfil.");
    }
    setOcupado(true);
    try {
      const texto = await (comProvedor ? assinarEFazer() : aoConfirmar());
      if (texto) setAviso(texto);
      else aoFechar();
    } catch (e) {
      // Desistir da espera não é falha: a janela só volta ao começo.
      if (!(e instanceof AssinaturaCancelada)) setErro(falhaDe(e).mensagem);
    } finally {
      setOcupado(false);
    }
  }

  /** Fechar no meio da espera desiste dela; durante o envio da ação, a janela não fecha. */
  function fechar() {
    if (provedor.espera) {
      provedor.cancelar();
      aoFechar();
    } else if (!ocupado) aoFechar();
  }

  return (
    <JanelaDeFormulario titulo={titulo} aoFechar={fechar}>
      {aviso ? (
        <>
          <Aviso tom="al">{aviso}</Aviso>
          <Botao titulo="Entendi" aoPressionar={aoFechar} />
        </>
      ) : provedor.espera ? (
        <EsperaDaAssinatura simulada={config?.simulada} aoAbrirDeNovo={provedor.abrirDeNovo} aoCancelar={provedor.cancelar} />
      ) : (
        <>
          {resumo ? <Text style={estilos.resumo}>{resumo}</Text> : null}
          {children}
          {semAssinatura ? null : comProvedor ? (
            <View style={estilos.assinatura}>
              <Text style={estilos.rotulo}>Assinatura com validade jurídica</Text>
              <Aviso tom="info" icone="shield-checkmark-outline">
                Ao confirmar, abrimos a página do provedor de assinatura eletrônica. Você assina lá e volta para o app, que continua sozinho.
              </Aviso>
              {config?.simulada ? <Aviso tom="al">Assinatura simulada: a página é de demonstração e não tem validade jurídica.</Aviso> : null}
            </View>
          ) : assinaturaPath ? (
            <View style={estilos.assinatura}>
              <Text style={estilos.rotulo}>Sua assinatura</Text>
              <ImagemDeArquivo id={assinaturaPath} alt="Sua assinatura" altura={72} />
              <Opcao rotulo="Confirmo esta ação e a assino com a minha assinatura do perfil." marcada={assino} aoPressionar={() => { setAssino((a) => !a); setFalta(null); }} />
              {provedorSemSinal ? <Text style={estilos.dica}>Sem sinal, vale a sua assinatura do perfil agora. Quando o sinal voltar, o app pede para assinar também com validade jurídica.</Text> : null}
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
  dica: { fontSize: 12, lineHeight: 17, color: cores.tinta4 },
  falta: { fontSize: 13, color: cores.perigo },
});
