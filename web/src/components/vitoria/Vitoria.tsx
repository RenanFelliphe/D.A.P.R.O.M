"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { chamarEmStream } from "@/lib/cliente-api";
import { cx } from "@/lib/cx";
import type { ExpressaoVitoria } from "@/lib/treinamento-servico";
import { novoUuid } from "@/lib/uuid";
import { HISTORICO_MAXIMO, resolverAcao, sugestoesDaTela, telaAtualDe, type AcaoResolvida, type MensagemVitoria, type SugestaoFixa } from "@/lib/vitoria";
import { Avatar } from "./Avatar";
import { DestaqueVitoria } from "./DestaqueVitoria";
import { IndicadorPensando } from "./IndicadorPensando";

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
  const listaRef = useRef<HTMLDivElement>(null);
  const abertoRef = useRef(aberto);

  useEffect(() => {
    abertoRef.current = aberto;
  }, [aberto]);

  const { tela, contexto } = telaAtualDe(pathname);
  const sugestoes = sugestoesDaTela(tela);

  useEffect(() => {
    if (aberto) listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, aberto]);

  const ultimaDaVitoria = [...mensagens].reverse().find((m) => m.papel === "assistente");
  const expressaoDoCabecalho: ExpressaoVitoria = carregando ? "pensando" : (ultimaDaVitoria?.expressao ?? "feliz");
  const textoChegando = mensagens.find((m) => m.id === respondendo)?.texto ?? "";
  const situacao = !carregando ? "Pronta para ajudar" : textoChegando ? "Escrevendo" : "Pensando";

  /** Dupla checagem (vitoria.md, 2.4): refaz a validação contra o manifesto com o contexto que a web tem agora, antes de navegar. */
  function irPara(acao: AcaoResolvida) {
    setErro(null);
    const { resolvida } = resolverAcao({ tipo: acao.tipo, destino: acao.destino, filtro: acao.valor }, contexto);
    if (!resolvida) {
      setErro("Não consegui confirmar esse link com segurança. Tente perguntar de novo.");
      return;
    }
    router.push(resolvida.url);
    if (resolvida.tipo === "destacar" && resolvida.alvo) setDestaque((d) => ({ alvo: resolvida.alvo!, pedido: d.pedido + 1 }));
    if (window.matchMedia("(max-width: 640px)").matches) setAberto(false);
  }

  /** As sugestões fixas nunca chamam a IA: a pergunta e a resposta já vêm prontas de `shared/vitoria/sugestoes.ts`. */
  function responderComSugestao(s: SugestaoFixa) {
    const { resolvida } = s.acao ? resolverAcao(s.acao, contexto) : { resolvida: null };
    setMensagens((atual) => [
      ...atual,
      { id: novoUuid(), papel: "usuario", texto: s.pergunta },
      { id: novoUuid(), papel: "assistente", texto: s.resposta, expressao: "padrao", acao: resolvida },
    ]);
  }

  async function enviar() {
    const texto = digitando.trim();
    if (!texto || carregando) return;
    setDigitando("");
    setErro(null);
    const historico = mensagens.slice(-HISTORICO_MAXIMO).map((m) => ({ papel: m.papel, texto: m.texto }));
    const numeroMensagem = mensagens.filter((m) => m.papel === "usuario").length + 1;
    const idResposta = novoUuid();
    setMensagens((atual) => [...atual, { id: novoUuid(), papel: "usuario", texto }, { id: idResposta, papel: "assistente", texto: "" }]);
    setCarregando(true);
    setRespondendo(idResposta);
    try {
      await chamarEmStream("/vitoria/mensagens", { mensagem: texto, tela, contexto, historico, numero_mensagem: numeroMensagem }, (evento) => {
        if (evento.event === "texto") {
          setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, texto: m.texto + evento.data } : m)));
        } else if (evento.event === "final") {
          const final: RespostaFinalDaVitoria = JSON.parse(evento.data);
          setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, expressao: final.expressao ?? "padrao", acao: final.acao } : m)));
        }
      });
    } catch {
      setMensagens((atual) => atual.map((m) => (m.id === idResposta ? { ...m, texto: "Não consegui falar com o servidor agora. Tente de novo em instantes.", expressao: "ops" } : m)));
    } finally {
      setCarregando(false);
      setRespondendo(null);
      if (!abertoRef.current) setNaoLida(true);
    }
  }

  function alternarPainel() {
    setAberto((v) => !v);
    setNaoLida(false);
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
        <Avatar expressao="icone" tamanho={40} />
        {naoLida && !aberto && <span className="vt-selo" aria-hidden="true" />}
      </button>
      {aberto && (
        <div className="vt-painel" role="dialog" aria-label="Vitória, assistente de ajuda">
          <div className="vt-cab">
            <span className={cx("vt-avatar-cab", carregando && "vt-avatar-ativo")}>
              <Avatar key={expressaoDoCabecalho} expressao={expressaoDoCabecalho} tamanho={34} className="vt-avatar-troca" />
              <span className={cx("vt-luz", carregando && "vt-luz-ativa")} aria-hidden="true" />
            </span>
            <div className="vt-cab-texto">
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
            </div>
            <button type="button" className="vt-fechar" onClick={() => setAberto(false)} aria-label="Fechar o painel da Vitória">
              <Icon name="x" size={16} />
            </button>
            {carregando && <span className="vt-progresso" aria-hidden="true" />}
          </div>
          <div className="vt-lista" ref={listaRef}>
            {mensagens.length === 0 && (
              <div className="vt-boas-vindas">
                <span className="vt-boas-vindas-avatar">
                  <Avatar expressao="feliz" tamanho={64} />
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
              const expressao: ExpressaoVitoria = pensando ? "pensando" : (m.expressao ?? "padrao");
              return (
                <div key={m.id} className={cx("vt-msg", m.papel === "usuario" ? "vt-msg-usuario" : "vt-msg-vitoria")}>
                  {m.papel === "assistente" && (
                    <span className={cx("vt-avatar-msg", pensando && "vt-avatar-pensando")}>
                      <Avatar key={expressao} expressao={expressao} tamanho={28} className="vt-avatar-troca" />
                    </span>
                  )}
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
