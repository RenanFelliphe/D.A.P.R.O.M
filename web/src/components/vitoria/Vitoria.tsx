"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { chamar, chamarEmStream } from "@/lib/cliente-api";
import { cx } from "@/lib/cx";
import type { ExpressaoVitoria } from "@/lib/treinamento-servico";
import { movimentoReduzido } from "@/lib/reacao-vitoria";
import { rotas } from "@/lib/rotas";
import { novoUuid } from "@/lib/uuid";
import {
  HISTORICO_MAXIMO,
  reacaoDaExpressao,
  resolverAcao,
  respostaLocalDaVitoria,
  sugestoesDaTela,
  telaAtualDe,
  type AcaoResolvida,
  type FigurinhaDaMensagem,
  type MensagemVitoria,
  type Reacao,
  type RespostaLocal,
  type SugestaoFixa,
} from "@/lib/vitoria";
import { Avatar } from "./Avatar";
import { DestaqueVitoria } from "./DestaqueVitoria";
import { Figurinha } from "./Figurinha";
import { IndicadorPensando } from "./IndicadorPensando";

/** A pausa antes de uma resposta que não precisou pensar: um mínimo, um pouco de acaso e um pouco mais para textos longos (`letras`). */
const PENSAR_MIN_MS = 1100;
const PENSAR_VARIACAO_MS = 900;
const PENSAR_POR_LETRA_MS = 4;
const PENSAR_TETO_MS = 900;
const iniciarPausa = (letras = 0) =>
  new Promise<void>((ok) => window.setTimeout(ok, PENSAR_MIN_MS + Math.random() * PENSAR_VARIACAO_MS + Math.min(letras * PENSAR_POR_LETRA_MS, PENSAR_TETO_MS)));

interface RespostaFinalDaVitoria {
  acao: AcaoResolvida | null;
  expressao?: ExpressaoVitoria;
  motivo?: "limite_conversa" | "limite_conta" | "limite_global" | "sem_ia";
  sugestoes?: SugestaoFixa[];
}

/**
 * O botão flutuante e o painel de conversa da Vitória (`vitoria.md`, seção 2): presente em toda tela do portal e da
 * gestão, inclusive o Campo de treino (ela só consulta o manual e o manifesto de destinos, nunca lê nem grava dado de
 * OS). Monta sozinha: a `api` decide o manual pelo perfil de quem está logado.
 */
export function Vitoria() {
  const pathname = usePathname();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<MensagemVitoria[]>([]);
  const [digitando, setDigitando] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<{ alvo: string | null; pedido: number }>({ alvo: null, pedido: 0 });
  /** A mensagem da Vitória que ainda está chegando: vazia, mostra o balão de "pensando"; com texto, o cursor piscando. */
  const [respondendo, setRespondendo] = useState<string | null>(null);
  /** Resposta que chegou com o painel fechado: o botão flutuante ganha um selo até a pessoa abrir. */
  const [naoLida, setNaoLida] = useState(false);
  /** O aceno da tela de boas-vindas, que toca uma vez por visita, na primeira vez que o painel abre. */
  const [saudando, setSaudando] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);
  const abertoRef = useRef(aberto);
  const saudouRef = useRef(false);

  useEffect(() => {
    abertoRef.current = aberto;
  }, [aberto]);

  const { tela, contexto } = telaAtualDe(pathname);
  const sugestoes = sugestoesDaTela(tela);

  useEffect(() => {
    if (aberto) listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, aberto]);

  const textoChegando = mensagens.find((m) => m.id === respondendo)?.texto ?? "";
  const situacao = !carregando ? "Pronta para ajudar" : textoChegando ? "Escrevendo" : "Pensando";

  /**
   * A reação como figurinha na mensagem (`vitoria.md`, seção 2.8). Só toca com o painel aberto e sem "reduzir movimento"; do
   * contrário a figurinha fica no quadro parado, esperando a pessoa abrir.
   */
  function figurinhaDe(qual: Reacao, completa: boolean): FigurinhaDaMensagem {
    return { reacao: qual, completa, tocar: abertoRef.current && !movimentoReduzido() };
  }

  const mudarFigurinha = (quais: (m: MensagemVitoria) => boolean) =>
    setMensagens((atual) => (atual.some(quais) ? atual.map((m) => (quais(m) && m.figurinha ? { ...m, figurinha: { ...m.figurinha, tocar: false } } : m)) : atual));

  /** A figurinha que ainda toca vira quadro parado: chegou outra mensagem, o painel fechou ou a animação acabou. */
  const pararFigurinhas = () => mudarFigurinha((m) => !!m.figurinha?.tocar);
  const aoTerminarFigurinha = (id: string) => mudarFigurinha((m) => m.id === id);

  function fechar() {
    setAberto(false);
    setSaudando(false);
    pararFigurinhas();
  }

  /** Os números do perfil dela (seção 2.8.7) contam também o que a web resolve sozinha. Só soma; uma falha não aparece para ninguém. */
  function avisarEvento(tipo: "ida_a_tela" | "sugestao") {
    chamar("POST", "/vitoria/eventos", { tipo }).catch(() => {});
  }

  /** Dupla checagem (vitoria.md, 2.4): refaz a validação contra o manifesto com o contexto que a web tem agora, antes de navegar. */
  function irPara(acao: AcaoResolvida) {
    setErro(null);
    const { resolvida } = resolverAcao({ tipo: acao.tipo, destino: acao.destino, filtro: acao.valor }, contexto);
    if (!resolvida) {
      setErro("Não consegui confirmar esse link com segurança. Tente perguntar de novo.");
      return;
    }
    router.push(resolvida.url);
    avisarEvento("ida_a_tela");
    if (resolvida.tipo === "destacar" && resolvida.alvo) setDestaque((d) => ({ alvo: resolvida.alvo!, pedido: d.pedido + 1 }));
    if (window.matchMedia("(max-width: 640px)").matches) fechar();
  }

  /**
   * Resposta pronta (sugestão fixa, saudação ou o manual sem IA) chega na hora e denuncia o script. Então a mensagem nasce
   * vazia, com o mesmo balão de "pensando" da IA, e só se completa depois de uma pausa curta, que cresce um pouco com o texto.
     */
  async function pensarAntesDe(idResposta: string, letras: number, preencher: () => void) {
    await iniciarPausa(letras);
    preencher();
    setCarregando(false);
    setRespondendo((atual) => (atual === idResposta ? null : atual));
    if (!abertoRef.current) setNaoLida(true);
  }

  /** As sugestões fixas nunca chamam a IA: a pergunta e a resposta já vêm prontas de `shared/vitoria/sugestoes.ts`. */
  async function responderComSugestao(s: SugestaoFixa) {
    if (carregando) return;
    pararFigurinhas();
    avisarEvento("sugestao");
    const { resolvida } = s.acao ? resolverAcao(s.acao, contexto) : { resolvida: null };
    const idResposta = novoUuid();
    setMensagens((atual) => [...atual, { id: novoUuid(), papel: "usuario", texto: s.pergunta }, { id: idResposta, papel: "assistente", texto: "" }]);
    setCarregando(true);
    setRespondendo(idResposta);
    await pensarAntesDe(idResposta, s.resposta.length, () =>
      setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, texto: s.resposta, expressao: "padrao", acao: resolvida } : m))),
    );
  }

  /**
   * Saudação, agradecimento e pedido para a Vitória imitar uma emoção ("fique triste"): ela responde na hora e reage, sem
   * chamar a `api`. Essas mensagens não vão no histórico da IA, não contam no limite da conversa e não viram "pergunta
   * sem resposta" (`shared/vitoria/reacoes.ts`).
   */
  async function responderLocalmente(pergunta: string, resposta: RespostaLocal) {
    const idResposta = novoUuid();
    setMensagens((atual) => [...atual, { id: novoUuid(), papel: "usuario", texto: pergunta, local: true }, { id: idResposta, papel: "assistente", texto: "", local: true }]);
    setCarregando(true);
    setRespondendo(idResposta);
    await pensarAntesDe(idResposta, resposta.texto.length, () =>
      setMensagens((atual) =>
        atual.map((m) => (m.id === idResposta ? { ...m, texto: resposta.texto, expressao: "padrao", figurinha: figurinhaDe(resposta.reacao, resposta.completa) } : m)),
      ),
    );
  }

  async function enviar() {
    const texto = digitando.trim();
    if (!texto || carregando) return;
    setDigitando("");
    setErro(null);
    pararFigurinhas();
    const local = respostaLocalDaVitoria(texto);
    if (local) {
      void responderLocalmente(texto, local);
      return;
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
      // A api manda a resposta inteira de uma vez, tanto a da IA (que já demorou) quanto a do manual sem IA (que não demora nada):
      // junta os eventos e solta tudo depois da pausa mínima, para as duas parecerem a mesma Vitória pensando.
      const eventos: { event: string; data: string }[] = [];
      await chamarEmStream("/vitoria/mensagens", { mensagem: texto, tela, contexto, historico, numero_mensagem: numeroMensagem }, (evento) => eventos.push(evento));
      await pausa;
      for (const evento of eventos) {
        if (evento.event === "texto") {
          setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, texto: m.texto + evento.data } : m)));
        } else if (evento.event === "final") {
          const final: RespostaFinalDaVitoria = JSON.parse(evento.data);
          const reacaoDaResposta = reacaoDaExpressao(final.expressao);
          const figurinha = reacaoDaResposta ? figurinhaDe(reacaoDaResposta, false) : undefined;
          setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, expressao: final.expressao ?? "padrao", acao: final.acao, figurinha } : m)));
        }
      }
    } catch {
      const figurinha = figurinhaDe("errada", false);
      setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, texto: "Não consegui falar com o servidor agora. Tente de novo em instantes.", expressao: "ops", figurinha } : m)));
    } finally {
      setCarregando(false);
      setRespondendo(null);
      if (!abertoRef.current) setNaoLida(true);
    }
  }

  function alternarPainel() {
    if (aberto) {
      fechar();
      return;
    }
    setAberto(true);
    setNaoLida(false);
    if (mensagens.length === 0 && !saudouRef.current) {
      saudouRef.current = true;
      setSaudando(!movimentoReduzido());
    }
  }

  return (
    <>
      <DestaqueVitoria alvo={destaque.alvo} pedido={destaque.pedido} />
      <button
        type="button"
        className={cx("vt-botao", aberto && "vt-botao-aberto", carregando && !aberto && "vt-botao-ocupado")}
        onClick={alternarPainel}
        aria-expanded={aberto}
        aria-label={aberto ? "Fechar a Vitória" : naoLida ? "Abrir a Vitória: tem resposta nova" : "Abrir a Vitória, o assistente de ajuda"}
      >
        <Avatar tamanho={52} />
        {naoLida && !aberto && <span className="vt-selo" aria-hidden="true" />}
      </button>
      {aberto && (
        <div className="vt-painel" role="dialog" aria-label="Vitória, assistente de ajuda">
          <div className="vt-cab">
            {/* O avatar e o nome levam ao perfil dela (seção 2.8.7); no celular o painel fecha para a página aparecer. */}
            <Link
              href={rotas.app.perfilDaVitoria}
              className="vt-cab-perfil"
              title="Ver o perfil da Vitória"
              onClick={() => {
                if (window.matchMedia("(max-width: 640px)").matches) fechar();
              }}
            >
              <span className={cx("vt-avatar-cab", carregando && "vt-avatar-ativo")}>
                <Avatar tamanho={40} />
                <span className={cx("vt-luz", carregando && "vt-luz-ativa")} aria-hidden="true" />
              </span>
              <span className="vt-cab-texto">
                <strong>Vitória</strong>
                <span key={situacao} className="vt-situacao" aria-live="polite">
                  {situacao}
                  {carregando && (
                    <span className="vt-reticencias" aria-hidden="true">
                      <i>.</i>
                      <i>.</i>
                      <i>.</i>
                    </span>
                  )}
                </span>
              </span>
            </Link>
            <button type="button" className="vt-fechar" onClick={fechar} aria-label="Fechar o painel da Vitória">
              <Icon name="x" size={16} />
            </button>
            {carregando && <span className="vt-progresso" aria-hidden="true" />}
          </div>
          <div className="vt-lista" ref={listaRef}>
            {mensagens.length === 0 && (
              <div className="vt-boas-vindas">
                <span className="vt-boas-vindas-avatar">
                  {saudando ? <Figurinha reacao="ola" tocar tamanho={88} aoTerminar={() => setSaudando(false)} /> : <Avatar tamanho={64} />}
                </span>
                <strong>Oi, eu sou a Vitória!</strong>
                <p>Tiro dúvidas de uso do sistema. Toque numa pergunta abaixo ou escreva a sua.</p>
              </div>
            )}
            {mensagens.length === 0 && sugestoes.length > 0 && (
              <div className="vt-sugestoes">
                <span className="vt-sugestoes-titulo">Perguntas comuns nesta tela</span>
                {sugestoes.map((s, i) => (
                  <button key={s.pergunta} type="button" className="vt-sugestao" style={{ animationDelay: `${0.12 + i * 0.06}s` }} onClick={() => responderComSugestao(s)}>
                    <span>{s.pergunta}</span>
                    <Icon name="right" size={13} />
                  </button>
                ))}
              </div>
            )}
            {mensagens.map((m) => {
              const chegando = m.id === respondendo;
              const pensando = chegando && !m.texto;
              return (
                <div key={m.id} className={cx("vt-msg", m.papel === "usuario" ? "vt-msg-usuario" : "vt-msg-vitoria", m.figurinha && !chegando && "vt-msg-com-figurinha")}>
                  {m.papel === "assistente" && (
                    <span className={cx("vt-avatar-msg", pensando && "vt-avatar-pensando")}>
                      <Avatar tamanho={30} />
                    </span>
                  )}
                  <div className="vt-corpo">
                    <div className={cx("vt-bolha", pensando && "vt-bolha-pensando")}>
                      {pensando ? (
                        <IndicadorPensando />
                      ) : (
                        <p>
                          {m.texto}
                          {chegando && <span className="vt-cursor" aria-hidden="true" />}
                        </p>
                      )}
                      {m.acao && !chegando && (
                        <button type="button" className="vt-acao" onClick={() => irPara(m.acao!)}>
                          {m.acao.tipo === "destacar" ? "Mostrar na tela" : "Me leve lá"}
                          <Icon name="right" size={13} />
                        </button>
                      )}
                    </div>
                    {m.figurinha && !chegando && (
                      <Figurinha reacao={m.figurinha.reacao} completa={m.figurinha.completa} tocar={m.figurinha.tocar} aoTerminar={() => aoTerminarFigurinha(m.id)} />
                    )}
                  </div>
                </div>
              );
            })}
            {erro && (
              <p className="vt-erro" role="alert">
                <Icon name="alert" size={13} />
                {erro}
              </p>
            )}
          </div>
          <form
            className="vt-form"
            onSubmit={(e) => {
              e.preventDefault();
              void enviar();
            }}
          >
            <div className={cx("vt-campo", carregando && "vt-campo-ocupado")}>
              <input
                value={digitando}
                onChange={(e) => setDigitando(e.target.value)}
                placeholder={carregando ? "A Vitória está respondendo…" : "Digite sua dúvida…"}
                disabled={carregando}
                maxLength={1000}
                aria-label="Sua pergunta para a Vitória"
              />
              <button type="submit" className="vt-enviar" disabled={carregando || !digitando.trim()} aria-label={carregando ? "Aguardando a resposta" : "Enviar pergunta"}>
                {carregando ? <span className="vt-giro" aria-hidden="true" /> : <Icon name="right" size={18} />}
              </button>
            </div>
            <span className="vt-rodape">A Vitória responde dúvidas de uso do sistema com base no manual.</span>
          </form>
        </div>
      )}
    </>
  );
}
