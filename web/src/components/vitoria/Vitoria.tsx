"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { chamarEmStream } from "@/lib/cliente-api";
import { cx } from "@/lib/cx";
import type { ExpressaoVitoria } from "@/lib/treinamento-servico";
import { novoUuid } from "@/lib/uuid";
import { HISTORICO_MAXIMO, resolverAcao, sugestoesDaTela, telaAtualDe, type AcaoResolvida, type MensagemVitoria, type SugestaoFixa } from "@/lib/vitoria";
import { Avatar } from "./Avatar";
import { DestaqueVitoria } from "./DestaqueVitoria";

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
  const listaRef = useRef<HTMLDivElement>(null);

  const { tela, contexto } = telaAtualDe(pathname);
  const sugestoes = sugestoesDaTela(tela);

  useEffect(() => {
    if (aberto) listaRef.current?.scrollTo({ top: listaRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, aberto]);

  const ultimaDaVitoria = [...mensagens].reverse().find((m) => m.papel === "assistente");
  const expressaoDoCabecalho: ExpressaoVitoria = carregando ? "pensando" : (ultimaDaVitoria?.expressao ?? "feliz");

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
    }
  }

  return (
    <>
      <DestaqueVitoria alvo={destaque.alvo} pedido={destaque.pedido} />
      <button type="button" className="vt-botao" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} aria-label={aberto ? "Fechar a Vitória" : "Abrir a Vitória, o assistente de ajuda"}>
        <Avatar expressao="icone" tamanho={40} />
      </button>
      {aberto && (
        <div className="vt-painel" role="dialog" aria-label="Vitória, assistente de ajuda">
          <div className="vt-cab">
            <Avatar expressao={expressaoDoCabecalho} tamanho={32} />
            <strong>Vitória</strong>
            <button type="button" className="vt-fechar" onClick={() => setAberto(false)} aria-label="Fechar o painel da Vitória">
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="vt-lista" ref={listaRef}>
            {mensagens.length === 0 && (
              <div className="vt-msg vt-msg-vitoria">
                <Avatar expressao="feliz" tamanho={28} />
                <div className="vt-bolha">
                  <p>Oi! Posso ajudar com dúvidas de uso do sistema. Toque numa pergunta ou escreva a sua.</p>
                </div>
              </div>
            )}
            {mensagens.length === 0 && (
              <div className="vt-sugestoes">
                {sugestoes.map((s) => (
                  <button key={s.pergunta} type="button" className="vt-sugestao" onClick={() => responderComSugestao(s)}>
                    {s.pergunta}
                  </button>
                ))}
              </div>
            )}
            {mensagens.map((m) => (
              <div key={m.id} className={cx("vt-msg", m.papel === "usuario" ? "vt-msg-usuario" : "vt-msg-vitoria")}>
                {m.papel === "assistente" && <Avatar expressao={m.expressao ?? "padrao"} tamanho={28} />}
                <div className="vt-bolha">
                  <p>{m.texto || "…"}</p>
                  {m.acao && (
                    <Button sm variant="line" onClick={() => irPara(m.acao!)}>
                      {m.acao.tipo === "destacar" ? "Mostrar na tela" : "Me leve lá"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {erro && (
              <p className="vt-erro" role="alert">
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
            <input
              className="input"
              value={digitando}
              onChange={(e) => setDigitando(e.target.value)}
              placeholder="Digite sua dúvida…"
              disabled={carregando}
              aria-label="Sua pergunta para a Vitória"
            />
            <Button type="submit" variant="p" sm disabled={carregando || !digitando.trim()}>
              Enviar
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
