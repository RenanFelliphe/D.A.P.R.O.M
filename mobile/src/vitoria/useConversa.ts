import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { novoUuid } from "@shared/api/uuid";
import { resolverAcao, type AcaoResolvida } from "@shared/vitoria/destinos";
import { reacaoDaExpressao, respostaLocalDaVitoria, type Reacao, type RespostaLocal } from "@shared/vitoria/reacoes";
import type { SugestaoFixa } from "@shared/vitoria/sugestoes";
import { cliente } from "@/api/api";
import { lerEventosSse } from "./sse";
import { destinoDaAcaoNoApp, type DestinoNoApp, type TelaAtual } from "./telas";
import { HISTORICO_MAXIMO, type FigurinhaDaMensagem, type MensagemVitoria, type RespostaFinalDaVitoria } from "./tipos";

/** A pausa antes de uma resposta que não precisou pensar: um mínimo, um pouco de acaso e um pouco mais para textos longos (`letras`). */
const PENSAR_MIN_MS = 1100;
const PENSAR_VARIACAO_MS = 900;
const PENSAR_POR_LETRA_MS = 4;
const PENSAR_TETO_MS = 900;
const iniciarPausa = (letras = 0) => new Promise<void>((ok) => setTimeout(ok, PENSAR_MIN_MS + Math.random() * PENSAR_VARIACAO_MS + Math.min(letras * PENSAR_POR_LETRA_MS, PENSAR_TETO_MS)));

/**
 * A conversa com a Vitória (`docs/ia-e-vitoria.md`, seção 4). Três caminhos: a **sugestão fixa** (pergunta e resposta prontas, nunca chama a `api`),
 * a **resposta local** (saudação, agradecimento, "fique triste": o app responde e reage sozinho) e a **mensagem** para a `api`
 * (`POST /vitoria/mensagens`, que responde pelo manual do técnico, com a IA ou sem ela). A conversa vive enquanto o app está aberto.
 */
export function useConversa({ aberto, tela }: { aberto: boolean; tela: TelaAtual }) {
  const [mensagens, setMensagens] = useState<MensagemVitoria[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  /** A mensagem da Vitória que ainda está chegando: vazia, mostra o "pensando". */
  const [respondendo, setRespondendo] = useState<string | null>(null);
  /** Resposta que chegou com o painel fechado: o botão flutuante ganha um selo até a pessoa abrir. */
  const [naoLida, setNaoLida] = useState(false);
  const [movimentoReduzido, setMovimentoReduzido] = useState(false);
  const abertoRef = useRef(aberto);

  useEffect(() => {
    abertoRef.current = aberto;
  }, [aberto]);

  useEffect(() => {
    let ativo = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => ativo && setMovimentoReduzido(v));
    const assinatura = AccessibilityInfo.addEventListener("reduceMotionChanged", setMovimentoReduzido);
    return () => {
      ativo = false;
      assinatura.remove();
    };
  }, []);

  /** A reação como figurinha na mensagem: só toca com o painel aberto e sem "reduzir movimento"; do contrário fica o quadro parado. */
  const figurinhaDe = (reacao: Reacao, completa: boolean): FigurinhaDaMensagem => ({ reacao, completa, tocar: abertoRef.current && !movimentoReduzido });

  const mudarFigurinha = (quais: (m: MensagemVitoria) => boolean) =>
    setMensagens((atual) => (atual.some(quais) ? atual.map((m) => (quais(m) && m.figurinha ? { ...m, figurinha: { ...m.figurinha, tocar: false } } : m)) : atual));

  /** A figurinha que ainda toca vira quadro parado: chegou outra mensagem, o painel fechou ou a animação acabou. */
  const pararFigurinhas = useCallback(() => mudarFigurinha((m) => !!m.figurinha?.tocar), []);
  const aoTerminarFigurinha = (id: string) => mudarFigurinha((m) => m.id === id);

  /** Os números do perfil dela contam também o que o app resolve sozinho. Só soma; uma falha não aparece para ninguém. */
  const avisarEvento = (tipo: "ida_a_tela" | "sugestao") => {
    cliente.chamar("/vitoria/eventos", { metodo: "POST", corpo: { tipo } }).catch(() => undefined);
  };

  /**
   * Dupla checagem (`docs/ia-e-vitoria.md`, seção 4.6): refaz a validação contra o manifesto com o contexto que o app tem agora, antes de navegar. Devolve
   * para onde ir, ou `null` (com a mensagem de erro) se não deu para confirmar.
   */
  const confirmarAcao = (acao: AcaoResolvida): DestinoNoApp | null => {
    setErro(null);
    const { resolvida } = resolverAcao({ tipo: acao.tipo, destino: acao.destino, filtro: acao.valor }, tela.contexto);
    if (!resolvida) {
      setErro("Não consegui confirmar esse link com segurança. Tente perguntar de novo.");
      return null;
    }
    avisarEvento("ida_a_tela");
    return destinoDaAcaoNoApp(resolvida);
  };

  /**
   * Resposta pronta chega na hora e denuncia o script. Então a mensagem nasce vazia, com o mesmo "pensando" da IA, e só se completa
   * depois de uma pausa curta, que cresce um pouco com o texto.
   */
  async function pensarAntesDe(idResposta: string, letras: number, preencher: () => void) {
    await iniciarPausa(letras);
    preencher();
    setCarregando(false);
    setRespondendo((atual) => (atual === idResposta ? null : atual));
    if (!abertoRef.current) setNaoLida(true);
  }

  async function responderComSugestao(s: SugestaoFixa) {
    if (carregando) return;
    pararFigurinhas();
    avisarEvento("sugestao");
    const { resolvida } = s.acao ? resolverAcao(s.acao, tela.contexto) : { resolvida: null };
    const idResposta = novoUuid();
    setMensagens((atual) => [...atual, { id: novoUuid(), papel: "usuario", texto: s.pergunta }, { id: idResposta, papel: "assistente", texto: "" }]);
    setCarregando(true);
    setRespondendo(idResposta);
    await pensarAntesDe(idResposta, s.resposta.length, () => setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, texto: s.resposta, expressao: "padrao", acao: resolvida } : m))));
  }

  async function responderLocalmente(pergunta: string, resposta: RespostaLocal) {
    const idResposta = novoUuid();
    setMensagens((atual) => [...atual, { id: novoUuid(), papel: "usuario", texto: pergunta, local: true }, { id: idResposta, papel: "assistente", texto: "", local: true }]);
    setCarregando(true);
    setRespondendo(idResposta);
    await pensarAntesDe(idResposta, resposta.texto.length, () =>
      setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, texto: resposta.texto, expressao: "padrao", figurinha: figurinhaDe(resposta.reacao, resposta.completa) } : m))),
    );
  }

  /** Envia a pergunta digitada. Devolve `false` se não enviou (vazia ou já respondendo), para a tela manter o texto. */
  async function enviar(digitado: string): Promise<boolean> {
    const texto = digitado.trim();
    if (!texto || carregando) return false;
    setErro(null);
    pararFigurinhas();
    const local = respostaLocalDaVitoria(texto);
    if (local) {
      void responderLocalmente(texto, local);
      return true;
    }
    const daConversa = mensagens.filter((m) => !m.local);
    const historico = daConversa.slice(-HISTORICO_MAXIMO).map((m) => ({ papel: m.papel, texto: m.texto }));
    const numeroMensagem = daConversa.filter((m) => m.papel === "usuario").length + 1;
    const idResposta = novoUuid();
    setMensagens((atual) => [...atual, { id: novoUuid(), papel: "usuario", texto }, { id: idResposta, papel: "assistente", texto: "" }]);
    setCarregando(true);
    setRespondendo(idResposta);
    // A pausa já corre durante a ida à api: a da IA (que demorou) não espera de novo, a do manual sem IA (instantânea) espera o resto.
    const pausa = iniciarPausa(300);
    try {
      // A api manda a resposta inteira de uma vez e o React Native só entrega o corpo no fim: lê tudo e solta depois da pausa mínima.
      const resposta = await cliente.chamarBruto("/vitoria/mensagens", { metodo: "POST", corpo: { mensagem: texto, tela: tela.tela, contexto: tela.contexto, historico, numero_mensagem: numeroMensagem } });
      const corpo = await resposta.text();
      if (!resposta.ok) throw new Error("A Vitória não respondeu.");
      await pausa;
      for (const evento of lerEventosSse(corpo)) {
        if (evento.event === "texto") {
          setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, texto: m.texto + evento.data } : m)));
        } else if (evento.event === "final") {
          const final: RespostaFinalDaVitoria = JSON.parse(evento.data);
          const reacao = reacaoDaExpressao(final.expressao);
          setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, expressao: final.expressao ?? "padrao", acao: final.acao, fonte: final.fonte, figurinha: reacao ? figurinhaDe(reacao, false) : undefined } : m)));
        }
      }
    } catch {
      setMensagens((atual) =>
        atual.map((m) => (m.id === idResposta ? { ...m, texto: "Não consegui falar com o servidor agora. Tente de novo em instantes.", expressao: "ops", figurinha: figurinhaDe("errada", false) } : m)),
      );
    } finally {
      setCarregando(false);
      setRespondendo(null);
      if (!abertoRef.current) setNaoLida(true);
    }
    return true;
  }

  return { mensagens, carregando, respondendo, erro, definirErro: setErro, naoLida, marcarComoLida: () => setNaoLida(false), enviar, responderComSugestao, confirmarAcao, pararFigurinhas, aoTerminarFigurinha };
}
