"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { JanelaDeAssinatura } from "@/components/ausencia/JanelaDeAssinatura";
import { AvisoDeLocalizacao } from "@/components/app/execucao/AvisoDeLocalizacao";
import { FormularioInterromper } from "@/components/app/execucao/FormularioInterromper";
import { JanelaDeMotivo } from "@/components/app/execucao/JanelaDeMotivo";
import { MOTIVOS_DA_PAUSA, MOTIVOS_DA_SUSPENSAO } from "@/components/app/execucao/motivos";
import { PedidoParaResponder } from "@/components/app/execucao/PedidoParaResponder";
import { ResumoTempo } from "@/components/app/execucao/ResumoTempo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { ErroDeEnvio } from "@/components/ui/useFormulario";
import { Notice } from "@/components/ui/Notice";
import { BotaoDeEmergencia } from "@/components/app/execucao/BotaoDeEmergencia";
import { enviarEvento, novoId } from "@/lib/cliente-api";
import { pedidoAberto } from "@/lib/execucao-pedidos";
import { comPosicao, obterPosicao } from "@/lib/geolocalizacao";
import { rotas } from "@/lib/rotas";
import { useMinhaAssinatura } from "@/state/minha-assinatura";
import { useToast } from "@/state/toast";
import type { Situacao } from "./situacao";
import { participantesAtivos } from "./tempo";
import { useAcao } from "./useAcao";
import { useAgora } from "./useAgora";

const CANCELAR_ATE_MS = 10 * 60_000;

type Modo = "painel" | "interromper";
type Janela = "pausar" | "suspender" | "encerrar" | null;

interface Props {
  os: { id: string; numero_ordem: string | null; titulo: string; local: string };
  situacao: Extract<Situacao, { tipo: "em_andamento" }>;
}

/** As quatro ações da execução, com o que cada uma faz (a explicação que o técnico vê ao lado dos botões). */
const ACOES = [
  { nome: "Pausar", quando: "Parada curta; a equipe volta ao mesmo serviço no mesmo dia.", efeito: "Pede o motivo. Só o tempo líquido para; “Continuar” retoma com a mesma APR." },
  { nome: "Suspender", quando: "O serviço não continua hoje.", efeito: "Pede o motivo. Encerra esta execução; a OS fica pendente e a retomada pede APR nova." },
  { nome: "Interromper por risco", quando: "Apareceu um risco ou impedimento.", efeito: "Pede motivo, ao menos 1 foto e assinatura; a OS fica pendente e o supervisor é avisado." },
  { nome: "Encerrar OS", quando: "O serviço terminou.", efeito: "Pede a confirmação e o tempo para; depois vêm a assinatura do responsável e, por último, a do supervisor." },
];

/**
 * Execução rodando: cronômetro calculado do início e das pausas que vêm da `api`, pausar/continuar, suspender, interromper
 * por risco, cancelar por engano e encerrar. Pausar não é interromper: a pausa só para o relógio líquido. Pausar e suspender abrem a
 * janela do motivo (obrigatório); encerrar abre a confirmação (o tempo para ali) e segue para o preenchimento e a assinatura.
 * A localização é registrada ao pausar, suspender, interromper e encerrar, sem bloquear o serviço se não houver.
 */
export function ExecucaoEmAndamento({ os, situacao }: Props) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { execucao, participantes } = situacao;
  const agora = useAgora();
  const { ocupado, erro, limparErro, executar } = useAcao();
  const [modo, setModo] = useState<Modo>("painel");
  const [janela, setJanela] = useState<Janela>(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [assinandoCancelamento, setAssinandoCancelamento] = useState(false);
  const assinaturaPath = useMinhaAssinatura();

  const pausaAberta = execucao.pausas.find((p) => !p.fim);
  // Um participante pediu para encerrar ou suspender: o responsável tem 2 minutos para responder (sem resposta, é aprovado sozinho).
  const pedido = pedidoAberto(execucao);
  const passouDoPrazo = agora === null || agora - new Date(execucao.inicio).getTime() >= CANCELAR_ATE_MS;
  const podeCancelar = !passouDoPrazo && execucao.pausas.length === 0;
  const retomarInvalido = erro?.codigo === "continuar_invalido";

  const abrir = (proximo: Modo) => {
    limparErro();
    setModo(proximo);
  };

  async function pausar(escolha: { motivo: string; complemento?: string }) {
    const posicao = await obterPosicao();
    await enviarEvento({
      tipo: "pausa_iniciada",
      os_id: os.id,
      payload: { id: novoId(), execucao_id: execucao.id, inicio: new Date().toISOString(), ...escolha, ...comPosicao(posicao) },
    });
    setJanela(null);
    router.refresh();
  }

  const continuar = () =>
    executar(async () => {
      await enviarEvento({ tipo: "pausa_encerrada", os_id: os.id, payload: { pausa_id: pausaAberta!.id, fim: new Date().toISOString() } });
      router.refresh();
    });

  async function suspender(escolha: { motivo: string; complemento?: string }) {
    const posicao = await obterPosicao();
    await enviarEvento({ tipo: "execucao_suspensa", os_id: os.id, payload: { execucao_id: execucao.id, fim: new Date().toISOString(), ...escolha, ...comPosicao(posicao) } });
    exibirAviso("OS pendente — retome com APR nova");
    router.push(rotas.app.lista);
  }

  async function cancelar() {
    await enviarEvento({ tipo: "execucao_cancelada", os_id: os.id, payload: { execucao_id: execucao.id } });
    exibirAviso("Execução cancelada");
    router.push(rotas.app.os(os.id));
  }

  const principal =
    modo === "interromper" ? (
      <FormularioInterromper osId={os.id} execucaoId={execucao.id} onCancelar={() => abrir("painel")} />
    ) : (
      <div className="panel stack g12">
        {pedido && <PedidoParaResponder key={pedido.id} osId={os.id} pedido={pedido} />}
        <h2>Atividade em andamento</h2>
        <div className="stack g6">
          <span className="lbl">Ordem</span>
          <span>
            <span className="mono">{os.numero_ordem ?? "—"}</span> · {os.titulo}
          </span>
          <span className="lbl">Local</span>
          <span>{os.local}</span>
          <span className="lbl">Participantes da APR</span>
          <span>{participantesAtivos(participantes).map((p) => p.nome).join(", ") || "—"}</span>
          <span className="small">Os participantes também podem pausar, interromper e pedir para encerrar ou suspender: você é avisado e tem 2 minutos para responder um pedido.</span>
        </div>
        <div className="stack g6">
          <span className="lbl">O que cada botão faz</span>
          <div className="list-box">
            {ACOES.map((a) => (
              <div key={a.nome} className="list-row" style={{ minHeight: 0, alignItems: "flex-start", padding: "10px 14px" }}>
                <span className="stack" style={{ gap: 2 }}>
                  <strong style={{ fontSize: 14 }}>{a.nome}</strong>
                  <span className="small">
                    <strong>Quando:</strong> {a.quando} <strong>O que acontece:</strong> {a.efeito}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="small">
          Use <strong>Pausar</strong> para almoço, descanso ou uma espera: a pausa não entra no tempo líquido. Ao concluir a atividade, <strong>encerre</strong>: o tempo
          para na confirmação, e só quem encerrou assina o encerramento.
        </p>
        <AvisoDeLocalizacao />
      </div>
    );

  const lateral = (
    <>
      <ResumoTempo inicio={execucao.inicio} pausas={execucao.pausas} numeroPessoas={execucao.numero_pessoas} agora={agora} />
      {modo === "painel" && (
        <PainelAcoes>
          {erro && (
            <Notice tone="blq" icon="alert" role="alert">
              {retomarInvalido ? "Faça uma APR nova para retomar. Suspenda esta execução e abra uma APR nova." : erro.mensagem}
            </Notice>
          )}
          {confirmandoCancelar ? (
            <div className="stack g8">
              <p className="small">Cancelar por engano apaga esta execução e devolve a APR para uso. Só vale até 10 minutos depois do início, sem pausa nem foto.</p>
              <div className="nav2">
                <Button variant="d" onClick={() => setAssinandoCancelamento(true)} disabled={ocupado}>
                  Assinar e cancelar a execução
                </Button>
                <Button variant="line" onClick={() => setConfirmandoCancelar(false)} disabled={ocupado}>
                  Voltar
                </Button>
              </div>
              {assinandoCancelamento && (
                <JanelaDeAssinatura
                  titulo="Cancelar a execução por engano"
                  tom="d"
                  resumo="A execução é apagada e a APR volta para uso."
                  rotuloConfirmar="Assinar e cancelar"
                  assinaturaPath={assinaturaPath}
                  aoConfirmar={cancelar}
                  aoFechar={() => setAssinandoCancelamento(false)}
                />
              )}
            </div>
          ) : (
            <>
              <Button variant="p" block onClick={() => setJanela("encerrar")} disabled={ocupado || !!pausaAberta} data-treino="exec-encerrar">
                <Icon name="check" size={18} />
                Encerrar OS
              </Button>
              {pausaAberta && <p className="small">Continue a execução para poder encerrá-la.</p>}
              <div className="nav2">
                {pausaAberta ? (
                  <Button variant="line" onClick={continuar} disabled={ocupado} data-treino="exec-pausa">
                    <Icon name="play" size={18} />
                    <span>Continuar</span>
                  </Button>
                ) : (
                  <Button variant="line" onClick={() => setJanela("pausar")} disabled={ocupado} data-treino="exec-pausa">
                    <Icon name="pause" size={18} />
                    <span>Pausar</span>
                  </Button>
                )}
                <Button variant="od" style={{ fontSize: 14 }} onClick={() => abrir("interromper")} disabled={ocupado}>
                  Interromper por risco
                </Button>
              </div>
              <Button variant="line" block onClick={() => setJanela("suspender")} disabled={ocupado} data-treino="exec-suspender">
                Suspender
              </Button>
              <BotaoDeEmergencia osId={os.id} execucaoId={execucao.id} />
              {podeCancelar && (
                <Button
                  variant="ghost"
                  block
                  onClick={() => {
                    limparErro();
                    setConfirmandoCancelar(true);
                  }}
                  disabled={ocupado}
                >
                  Cancelar por engano
                </Button>
              )}
            </>
          )}
        </PainelAcoes>
      )}
      {janela === "pausar" && (
        <JanelaDeMotivo
          titulo="Pausar a execução"
          deQue="da pausa"
          resumo="Pausa curta: só o tempo líquido para, e “Continuar” retoma com a mesma APR. Diga o motivo."
          opcoes={MOTIVOS_DA_PAUSA}
          rotuloConfirmar="Pausar"
          rotuloEnviando="Pausando…"
          dataTreino="exec-pausa-janela"
          aoConfirmar={pausar}
          aoFechar={() => setJanela(null)}
        />
      )}
      {janela === "suspender" && (
        <JanelaDeMotivo
          titulo="Suspender a execução"
          deQue="da suspensão"
          resumo="Suspender termina esta execução agora. A OS fica pendente e a retomada exige uma APR nova. Diga o motivo."
          opcoes={MOTIVOS_DA_SUSPENSAO}
          rotuloConfirmar="Suspender"
          rotuloEnviando="Suspendendo…"
          dataTreino="exec-suspender-janela"
          aoConfirmar={suspender}
          aoFechar={() => setJanela(null)}
        />
      )}
      {janela === "encerrar" && <JanelaDeConfirmarEncerramento osId={os.id} execucaoId={execucao.id} aoFechar={() => setJanela(null)} />}
    </>
  );

  return <Colunas principal={principal} lateral={lateral} />;
}

/**
 * Primeiro passo do encerramento: a confirmação. Avisa que o tempo para ali e que a execução não pode ser retomada. Ao confirmar,
 * grava o fim e a localização (`execucao_encerrada`); a tela segue sozinha para o preenchimento e a assinatura do responsável.
 */
function JanelaDeConfirmarEncerramento({ osId, execucaoId, aoFechar }: { osId: string; execucaoId: string; aoFechar: () => void }) {
  const router = useRouter();
  const { ocupado, erro, executar } = useAcao();
  const [parou, setParou] = useState(false);

  const confirmar = () =>
    executar(async () => {
      const posicao = await obterPosicao();
      await enviarEvento({ tipo: "execucao_encerrada", os_id: osId, payload: { execucao_id: execucaoId, fim: new Date().toISOString(), ...comPosicao(posicao) } });
      setParou(true);
      router.refresh();
    });

  return (
    <JanelaSobreposta titulo="Encerrar a OS?" aoFechar={ocupado || parou ? () => undefined : aoFechar}>
      <div className="stack g12">
        <Notice tone="al" icon="clock">
          <strong>O tempo para agora e a execução não pode ser retomada.</strong> Depois da confirmação, você responde o que falta (checklist, descrição e fotos, se
          houver) e assina o encerramento. Esse preenchimento não conta no tempo.
        </Notice>
        <AvisoDeLocalizacao />
        <ErroDeEnvio mensagem={erro?.mensagem ?? null} />
        <div className="row g8 wrap">
          <Button variant="p" onClick={confirmar} disabled={ocupado || parou} aria-busy={ocupado} data-treino="exec-encerrar-confirmar">
            <Icon name="check" size={18} />
            {parou ? "Tempo parado…" : ocupado ? "Encerrando…" : "Encerrar e parar o tempo"}
          </Button>
          <Button variant="ghost" onClick={aoFechar} disabled={ocupado || parou}>
            Voltar à execução
          </Button>
        </div>
      </div>
    </JanelaSobreposta>
  );
}
