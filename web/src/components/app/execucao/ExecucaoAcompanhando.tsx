"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { AvisoDeLocalizacao } from "@/components/app/execucao/AvisoDeLocalizacao";
import { FormularioInterromper } from "@/components/app/execucao/FormularioInterromper";
import { JanelaDeMotivo } from "@/components/app/execucao/JanelaDeMotivo";
import { MOTIVOS_DA_PAUSA, MOTIVOS_DA_SUSPENSAO, rotuloDoMotivo } from "@/components/app/execucao/motivos";
import { PedidoDoParticipante } from "@/components/app/execucao/PedidoDoParticipante";
import { ResumoTempo } from "@/components/app/execucao/ResumoTempo";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { JanelaSobreposta } from "@/components/ui/JanelaSobreposta";
import { Notice } from "@/components/ui/Notice";
import { ErroDeEnvio } from "@/components/ui/useFormulario";
import { enviarEvento, novoId } from "@/lib/cliente-api";
import { pedeAprovacaoDoResponsavel, pedidoAberto } from "@/lib/execucao-pedidos";
import { hora } from "@/lib/formatar";
import { comPosicao, obterPosicao } from "@/lib/geolocalizacao";
import { ehMotivoDeSaude } from "@/lib/motivos-de-parada";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";
import type { Situacao } from "./situacao";
import { participantesAtivos } from "./tempo";
import { useAcao } from "./useAcao";
import { useAgora } from "./useAgora";

interface Props {
  os: { id: string; numero_ordem: string | null; titulo: string; local: string };
  usuarioId: string;
  situacao: Extract<Situacao, { tipo: "acompanhando" }>;
}

type Janela = "pausar" | "suspender" | "encerrar" | "continuar_saude" | null;

/**
 * A execução vista por quem participa da APR e não a iniciou (execução compartilhada): o mesmo cronômetro do responsável, as pausas com o
 * motivo, quem está na equipe e as ações. Pausar, continuar, interromper por risco e suspender por lesão ou enfermidade valem na hora (o
 * responsável é avisado); encerrar e suspender por outro motivo são um pedido ao responsável, que tem 2 minutos para responder (sem
 * resposta, é aprovado sozinho). A página relê a execução sozinha (`AtualizarSozinha`). A web é sempre online: sem sinal, só o app.
 */
export function ExecucaoAcompanhando({ os, usuarioId, situacao }: Props) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { execucao, participantes } = situacao;
  const agora = useAgora();
  const { ocupado, erro, limparErro, executar } = useAcao();
  const [janela, setJanela] = useState<Janela>(null);
  const [interrompendo, setInterrompendo] = useState(false);
  const [semContinuar, setSemContinuar] = useState(false);
  const responsavel = execucao.executor.nome;
  const pausaAberta = execucao.pausas.find((p) => !p.fim);
  const pedido = pedidoAberto(execucao);

  async function pausar(escolha: { motivo: string; complemento?: string }) {
    const posicao = await obterPosicao();
    await enviarEvento({ tipo: "pausa_iniciada", os_id: os.id, payload: { id: novoId(), execucao_id: execucao.id, inicio: new Date().toISOString(), ...escolha, ...comPosicao(posicao) } });
    setJanela(null);
    router.refresh();
  }

  const continuar = () =>
    executar(async () => {
      await enviarEvento({ tipo: "pausa_encerrada", os_id: os.id, payload: { pausa_id: pausaAberta!.id, fim: new Date().toISOString() } });
      setJanela(null);
      router.refresh();
    });

  async function suspender(escolha: { motivo: string; complemento?: string }) {
    const posicao = await obterPosicao();
    const instante = new Date().toISOString();
    if (pedeAprovacaoDoResponsavel("suspender", escolha.motivo)) {
      await enviarEvento({ tipo: "pedido_aberto", os_id: os.id, payload: { id: novoId(), execucao_id: execucao.id, tipo: "suspender", instante, ...escolha, ...comPosicao(posicao) } });
      exibirAviso(`Pedido enviado — aguardando ${responsavel}`);
      setJanela(null);
      router.refresh();
      return;
    }
    await enviarEvento({ tipo: "execucao_suspensa", os_id: os.id, payload: { execucao_id: execucao.id, fim: instante, ...escolha, ...comPosicao(posicao) } });
    exibirAviso("OS pendente — retome com APR nova");
    router.push(rotas.app.lista);
  }

  const pedirParaEncerrar = () =>
    executar(async () => {
      const posicao = await obterPosicao();
      await enviarEvento({ tipo: "pedido_aberto", os_id: os.id, payload: { id: novoId(), execucao_id: execucao.id, tipo: "encerrar", instante: new Date().toISOString(), ...comPosicao(posicao) } });
      exibirAviso(`Pedido enviado — aguardando ${responsavel}`);
      setJanela(null);
      router.refresh();
    });

  const haPedido = () => {
    limparErro();
    return pedido !== null;
  };

  const principal = interrompendo ? (
    <FormularioInterromper osId={os.id} execucaoId={execucao.id} onCancelar={() => setInterrompendo(false)} />
  ) : (
    <div className="panel stack g12">
      <h2>Execução em andamento</h2>
      {pedido ? (
        <PedidoDoParticipante key={pedido.id} osId={os.id} usuarioId={usuarioId} responsavel={responsavel} pedido={pedido} />
      ) : (
        <Notice tone="info" icon="users">
          <strong>Você participa da execução de {responsavel}.</strong> Pausar, continuar e interromper por risco valem na hora, e {responsavel} é avisado. Encerrar e suspender
          pedem a resposta dele em até 2 minutos.
        </Notice>
      )}
      <div className="stack g6">
        <span className="lbl">Ordem</span>
        <span>
          <span className="mono">{os.numero_ordem ?? "—"}</span> · {os.titulo}
        </span>
        <span className="lbl">Local</span>
        <span>{os.local}</span>
      </div>
      <div className="stack g6">
        <span className="lbl">Quem está na execução</span>
        <div className="list-box">
          {participantesAtivos(participantes).map((p) => (
            <div key={p.usuario_id} className="list-row" style={{ minHeight: 0, padding: "10px 14px" }}>
              <span>{p.usuario_id === usuarioId ? `${p.nome} (você)` : p.nome}</span>
              {p.usuario_id === execucao.executor.id && <Badge tone="exe">Responsável pela execução</Badge>}
            </div>
          ))}
        </div>
      </div>
      <div className="stack g6">
        <span className="lbl">Pausas</span>
        {execucao.pausas.length === 0 ? (
          <span className="small">Nenhuma pausa até agora.</span>
        ) : (
          <div className="list-box">
            {execucao.pausas.map((p) => (
              <div key={p.id} className="list-row" style={{ minHeight: 0, alignItems: "flex-start", padding: "10px 14px" }}>
                <span className="stack" style={{ gap: 2 }}>
                  <strong style={{ fontSize: 14 }}>{p.complemento ? `${rotuloDoMotivo(p.motivo)} — ${p.complemento}` : rotuloDoMotivo(p.motivo)}</strong>
                  <span className="small">
                    {p.fim ? `${hora(p.inicio)} às ${hora(p.fim)}` : `Desde ${hora(p.inicio)} (em andamento)`}
                    {p.iniciada_por && p.iniciada_por.id !== execucao.executor.id ? ` · por ${p.iniciada_por.nome}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      <AvisoDeLocalizacao />
    </div>
  );

  const lateral = (
    <>
      <ResumoTempo inicio={execucao.inicio} pausas={execucao.pausas} numeroPessoas={execucao.numero_pessoas} agora={agora} />
      {!interrompendo && (
        <PainelAcoes>
          {erro && !janela && (
            <Notice tone="blq" icon="alert" role="alert">
              {erro.mensagem}
            </Notice>
          )}
          <Button
            variant="p"
            block
            onClick={() => {
              if (pausaAberta) return setSemContinuar(true);
              if (haPedido()) return;
              setJanela("encerrar");
            }}
            disabled={ocupado}
          >
            <Icon name="check" size={18} />
            Pedir para encerrar a OS
          </Button>
          {semContinuar && pausaAberta && <p className="small">Continue a execução para poder encerrá-la.</p>}
          <div className="nav2">
            {pausaAberta ? (
              <Button
                variant="line"
                onClick={() => {
                  limparErro();
                  if (ehMotivoDeSaude(pausaAberta.motivo)) setJanela("continuar_saude");
                  else void continuar();
                }}
                disabled={ocupado}
              >
                <Icon name="play" size={18} />
                <span>Continuar</span>
              </Button>
            ) : (
              <Button
                variant="line"
                onClick={() => {
                  limparErro();
                  setSemContinuar(false);
                  setJanela("pausar");
                }}
                disabled={ocupado}
              >
                <Icon name="pause" size={18} />
                <span>Pausar</span>
              </Button>
            )}
            <Button
              variant="od"
              style={{ fontSize: 14 }}
              onClick={() => {
                limparErro();
                setInterrompendo(true);
              }}
              disabled={ocupado}
            >
              Interromper por risco
            </Button>
          </div>
          <Button
            variant="line"
            block
            onClick={() => {
              if (haPedido()) return;
              setJanela("suspender");
            }}
            disabled={ocupado}
          >
            Suspender
          </Button>
          <LinkButton variant="ghost" block href={rotas.app.os(os.id)}>
            Voltar à OS
          </LinkButton>
        </PainelAcoes>
      )}
      {janela === "pausar" && (
        <JanelaDeMotivo
          titulo="Pausar a execução"
          deQue="da pausa"
          resumo={`Pausa curta: só o tempo líquido para, e “Continuar” retoma com a mesma APR. ${responsavel} é avisado. Diga o motivo.`}
          opcoes={MOTIVOS_DA_PAUSA}
          rotuloConfirmar="Pausar"
          rotuloEnviando="Pausando…"
          aoConfirmar={pausar}
          aoFechar={() => setJanela(null)}
        />
      )}
      {janela === "suspender" && (
        <JanelaDeMotivo
          titulo="Suspender a execução"
          deQue="da suspensão"
          resumo={`Suspender termina a execução. Por lesão ou enfermidade vale na hora; por outro motivo, você pede a ${responsavel}, que tem 2 minutos para responder. Diga o motivo.`}
          opcoes={MOTIVOS_DA_SUSPENSAO}
          rotuloConfirmar="Suspender ou pedir"
          rotuloEnviando="Enviando…"
          aoConfirmar={suspender}
          aoFechar={() => setJanela(null)}
        />
      )}
      {janela === "encerrar" && (
        <JanelaSobreposta titulo="Pedir para encerrar a OS?" aoFechar={ocupado ? () => undefined : () => setJanela(null)}>
          <div className="stack g12">
            <Notice tone="al" icon="clock">
              <strong>O tempo para no instante do seu pedido, se {responsavel} aprovar.</strong> {responsavel} tem 2 minutos para aprovar ou recusar; sem resposta, o pedido é aprovado
              sozinho. Aprovado, quem assina o encerramento é você.
            </Notice>
            <AvisoDeLocalizacao />
            <ErroDeEnvio mensagem={erro?.mensagem ?? null} />
            <div className="row g8 wrap">
              <Button variant="p" onClick={() => void pedirParaEncerrar()} disabled={ocupado} aria-busy={ocupado}>
                <Icon name="check" size={18} />
                {ocupado ? "Enviando…" : "Pedir para encerrar"}
              </Button>
              <Button variant="ghost" onClick={() => setJanela(null)} disabled={ocupado}>
                Voltar à execução
              </Button>
            </div>
          </div>
        </JanelaSobreposta>
      )}
      {janela === "continuar_saude" && pausaAberta && (
        <JanelaSobreposta titulo="Retomar a execução?" aoFechar={ocupado ? () => undefined : () => setJanela(null)}>
          <div className="stack g12">
            <Notice tone="blq" icon="alert">
              <strong>A execução está pausada por {rotuloDoMotivo(pausaAberta.motivo).toLowerCase()}.</strong> Só continue se a pessoa está bem e o serviço pode voltar com
              segurança. O responsável é avisado.
            </Notice>
            <ErroDeEnvio mensagem={erro?.mensagem ?? null} />
            <div className="row g8 wrap">
              <Button variant="p" onClick={() => void continuar()} disabled={ocupado} aria-busy={ocupado}>
                <Icon name="play" size={18} />
                Está tudo bem: continuar
              </Button>
              <Button variant="ghost" onClick={() => setJanela(null)} disabled={ocupado}>
                Voltar
              </Button>
            </div>
          </div>
        </JanelaSobreposta>
      )}
    </>
  );

  return <Colunas principal={principal} lateral={lateral} />;
}
