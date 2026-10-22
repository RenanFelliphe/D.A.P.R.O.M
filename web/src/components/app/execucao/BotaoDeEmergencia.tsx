"use client";

import { useEffect, useRef, useState } from "react";
import { mensagemDoErro } from "@/components/app/execucao/useAcao";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import { chamar, enviarEvento, novoId } from "@/lib/cliente-api";
import { CONTATOS_PUBLICOS, LIMITE_DA_OBSERVACAO_DA_EMERGENCIA, telefoneParaLigar, type ContatoDeEmergencia, type ContatosDeEmergencia } from "@/lib/emergencia";
import { comPosicao, obterPosicao } from "@/lib/geolocalizacao";

type Etapa = "fechada" | "confirmar" | "enviada";

function Contatos({ contatos }: { contatos: ContatosDeEmergencia }) {
  const linha = (c: ContatoDeEmergencia) => (
    <a key={`${c.nome}-${c.telefone}`} className="btn btn-d btn-block" href={`tel:${telefoneParaLigar(c.telefone)}`} aria-label={`Ligar para ${c.nome}, ${c.telefone}`}>
      <Icon name="users" size={18} />
      <span>
        <strong>{c.nome}</strong> · {c.telefone}
        {c.descricao ? ` · ${c.descricao}` : ""}
      </span>
    </a>
  );
  return (
    <div className="stack g8">
      <strong>Ligue agora</strong>
      {contatos.pae.map(linha)}
      {contatos.pae.length === 0 && <p className="small">O PAE da empresa ainda não foi cadastrado: fale com o administrador. Enquanto isso, use os números públicos.</p>}
      {contatos.publicos.map(linha)}
    </div>
  );
}

/**
 * O botão de emergência (`docs/operacao-de-campo.md`, seção 5.9), sempre à vista na execução. A janela mostra primeiro os contatos para ligar (o
 * PAE e os números públicos; no celular, o toque abre o discador) e oferece "Avisar o supervisor e o administrador", que manda na hora o nome e a
 * posição do aparelho (sino, push e e-mail). A observação é opcional. O id do acionamento é um só por abertura da janela: clicar duas vezes não
 * avisa duas vezes. Na web não há fila offline: sem conexão o aviso não vai, a janela diz e os contatos continuam à mão para ligar.
 */
export function BotaoDeEmergencia({ osId, execucaoId }: { osId: string; execucaoId?: string }) {
  const [etapa, setEtapa] = useState<Etapa>("fechada");
  const [contatos, setContatos] = useState<ContatosDeEmergencia>({ pae: [], publicos: CONTATOS_PUBLICOS });
  const [observacao, setObservacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const idDoAcionamento = useRef<string>("");

  useEffect(() => {
    if (etapa === "fechada") return;
    let ativo = true;
    chamar<ContatosDeEmergencia>("GET", "/emergencia/contatos")
      .then((c) => ativo && setContatos({ pae: c.pae, publicos: c.publicos }))
      .catch(() => undefined);
    return () => {
      ativo = false;
    };
  }, [etapa]);

  function abrir() {
    setErro(null);
    setObservacao("");
    idDoAcionamento.current = novoId();
    setEtapa("confirmar");
  }

  async function acionar() {
    setEnviando(true);
    setErro(null);
    try {
      const posicao = await obterPosicao();
      await enviarEvento({
        id: idDoAcionamento.current,
        tipo: "emergencia_acionada",
        os_id: osId,
        payload: { id: idDoAcionamento.current, ...(execucaoId ? { execucao_id: execucaoId } : {}), ...(observacao.trim() ? { observacao: observacao.trim() } : {}), ...comPosicao(posicao) },
      });
      setEtapa("enviada");
    } catch (e) {
      setErro(mensagemDoErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Button variant="d" block onClick={abrir} data-treino="exec-emergencia">
        <Icon name="alert" size={18} />
        Emergência
      </Button>
      {etapa !== "fechada" && (
        <JanelaSobreposta titulo="Emergência" aoFechar={enviando ? () => undefined : () => setEtapa("fechada")}>
          <div className="stack g12">
            {etapa === "confirmar" ? (
              <>
                <Contatos contatos={contatos} />
                <Notice tone="blq" icon="alert">
                  <strong>Avisar o supervisor e o administrador agora?</strong> Eles recebem o seu nome, a OS e a sua posição, por notificação e por e-mail. Use só em emergência de verdade.
                </Notice>
                <label className="stack g4">
                  <span className="small">O que está acontecendo? (opcional)</span>
                  <textarea
                    className="input"
                    rows={3}
                    value={observacao}
                    maxLength={LIMITE_DA_OBSERVACAO_DA_EMERGENCIA}
                    onChange={(e) => setObservacao(e.target.value)}
                    placeholder="Ex.: vazamento na rua, uma pessoa passando mal"
                  />
                </label>
                {erro && (
                  <Notice tone="blq" icon="alert" role="alert">
                    {erro} Se for urgente, ligue pelos contatos acima.
                  </Notice>
                )}
                <div className="nav2">
                  <Button variant="d" onClick={() => void acionar()} disabled={enviando} aria-busy={enviando}>
                    {enviando ? "Avisando…" : "Avisar o supervisor e o administrador"}
                  </Button>
                  <Button variant="line" onClick={() => setEtapa("fechada")} disabled={enviando}>
                    Voltar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Notice tone="ok" icon="check" role="status">
                  <strong>Avisamos o supervisor e o administrador.</strong> Eles já receberam o seu nome e a sua posição. Se precisar de socorro agora, ligue.
                </Notice>
                <Contatos contatos={contatos} />
                <p className="small">Mantenha-se em local seguro e siga o plano de atendimento a emergências.</p>
                <Button variant="line" onClick={() => setEtapa("fechada")}>
                  Fechar
                </Button>
              </>
            )}
          </div>
        </JanelaSobreposta>
      )}
    </>
  );
}
