"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Colunas, PainelAcoes } from "@/components/app/AppChrome";
import { FormularioEncerrar } from "@/components/app/execucao/FormularioEncerrar";
import { FormularioInterromper } from "@/components/app/execucao/FormularioInterromper";
import { ResumoTempo } from "@/components/app/execucao/ResumoTempo";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import type { PerguntaDoChecklist } from "@/lib/checklist-inspecao";
import { enviarEvento, novoId } from "@/lib/cliente-api";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";
import { useToast } from "@/state/toast";
import type { Situacao } from "./situacao";
import type { PausaDaApi } from "./tempo";
import { useAcao } from "./useAcao";
import { useAgora } from "./useAgora";

const CANCELAR_ATE_MS = 10 * 60_000;

type Modo = "painel" | "encerrar" | "interromper";
type Confirmando = "suspender" | "cancelar" | null;

interface Props {
  os: { id: string; numero_ordem: string | null; titulo: string; local: string };
  usuario: { id: string; assinatura_path: string | null };
  situacao: Extract<Situacao, { tipo: "em_andamento" }>;
  /** O checklist de inspeção do plano da OS preventiva (vazio quando a OS não tem). */
  checklist: PerguntaDoChecklist[];
  onEncerrada: (resposta: RespostaComPontos) => void;
}

/**
 * Execução rodando: cronômetro calculado do início e das pausas que vêm da `api`, pausar/continuar, suspender, interromper
 * por risco, cancelar por engano e encerrar. Pausar não é interromper: a pausa só para o relógio líquido.
 */
export function ExecucaoEmAndamento({ os, usuario, situacao, checklist, onEncerrada }: Props) {
  const router = useRouter();
  const exibirAviso = useToast();
  const { execucao, participantes } = situacao;
  const agora = useAgora();
  const { ocupado, erro, limparErro, executar } = useAcao();
  const [modo, setModo] = useState<Modo>("painel");
  const [confirmando, setConfirmando] = useState<Confirmando>(null);
  const [motivo, setMotivo] = useState<NonNullable<PausaDaApi["motivo"]> | "">("");

  const pausaAberta = execucao.pausas.find((p) => !p.fim);
  const passouDoPrazo = agora === null || agora - new Date(execucao.inicio).getTime() >= CANCELAR_ATE_MS;
  const podeCancelar = !passouDoPrazo && execucao.pausas.length === 0;
  const retomarInvalido = erro?.codigo === "continuar_invalido";

  const abrir = (proximo: Modo) => {
    limparErro();
    setModo(proximo);
  };
  const confirmar = (proximo: Confirmando) => {
    limparErro();
    setConfirmando(proximo);
  };

  const pausar = () =>
    executar(async () => {
      await enviarEvento({
        tipo: "pausa_iniciada",
        os_id: os.id,
        payload: { id: novoId(), execucao_id: execucao.id, inicio: new Date().toISOString(), motivo: motivo || null },
      });
      setMotivo("");
      router.refresh();
    });

  const continuar = () =>
    executar(async () => {
      await enviarEvento({ tipo: "pausa_encerrada", os_id: os.id, payload: { pausa_id: pausaAberta!.id, fim: new Date().toISOString() } });
      router.refresh();
    });

  const suspender = () =>
    executar(async () => {
      await enviarEvento({ tipo: "execucao_suspensa", os_id: os.id, payload: { execucao_id: execucao.id, fim: new Date().toISOString() } });
      exibirAviso("OS pendente — retome com APR nova");
      router.push(rotas.app.lista);
    });

  const cancelar = () =>
    executar(async () => {
      await enviarEvento({ tipo: "execucao_cancelada", os_id: os.id, payload: { execucao_id: execucao.id } });
      exibirAviso("Execução cancelada");
      router.push(rotas.app.os(os.id));
    });

  const principal =
    modo === "encerrar" ? (
      <FormularioEncerrar
        osId={os.id}
        execucaoId={execucao.id}
        participantes={participantes}
        usuarioId={usuario.id}
        assinaturaDoUsuario={usuario.assinatura_path}
        checklist={checklist}
        onEncerrada={onEncerrada}
        onCancelar={() => abrir("painel")}
      />
    ) : modo === "interromper" ? (
      <FormularioInterromper osId={os.id} execucaoId={execucao.id} onCancelar={() => abrir("painel")} />
    ) : (
      <div className="panel stack g12">
        <h2>Atividade em andamento</h2>
        <div className="stack g6">
          <span className="lbl">Ordem</span>
          <span>
            <span className="mono">{os.numero_ordem ?? "—"}</span> · {os.titulo}
          </span>
          <span className="lbl">Local</span>
          <span>{os.local}</span>
          <span className="lbl">Participantes da APR</span>
          <span>{participantes.map((p) => p.nome).join(", ") || "—"}</span>
        </div>
        <p className="small">
          Use <strong>Pausar</strong> para almoço ou descanso: a pausa não entra no tempo líquido. No fim do expediente, <strong>suspenda</strong>; ao concluir a
          atividade, <strong>encerre</strong> com a descrição, as fotos e a assinatura de todos.
        </p>
      </div>
    );

  const lateral = (
    <>
      <ResumoTempo inicio={execucao.inicio} pausas={execucao.pausas} numeroPessoas={execucao.numero_pessoas} agora={agora} />
      {modo === "painel" && (
        <PainelAcoes>
          {erro && (
            <Notice tone="blq" icon="alert">
              {retomarInvalido ? "Faça uma APR nova para retomar. Suspenda esta execução e abra uma APR nova." : erro.mensagem}
            </Notice>
          )}
          {confirmando === "suspender" ? (
            <div className="stack g8">
              <p className="small">Suspender termina esta execução agora. A OS fica pendente e a retomada exige uma APR nova.</p>
              <div className="nav2">
                <Button variant="p" onClick={suspender} disabled={ocupado}>
                  {ocupado ? "Suspendendo…" : "Suspender"}
                </Button>
                <Button variant="line" onClick={() => confirmar(null)} disabled={ocupado}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : confirmando === "cancelar" ? (
            <div className="stack g8">
              <p className="small">Cancelar por engano apaga esta execução e devolve a APR para uso. Só vale até 10 minutos depois do início, sem pausa nem foto.</p>
              <div className="nav2">
                <Button variant="d" onClick={cancelar} disabled={ocupado}>
                  {ocupado ? "Cancelando…" : "Cancelar execução"}
                </Button>
                <Button variant="line" onClick={() => confirmar(null)} disabled={ocupado}>
                  Voltar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="p" block onClick={() => abrir("encerrar")} disabled={ocupado || !!pausaAberta} data-treino="exec-encerrar">
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
                  <Button variant="line" onClick={pausar} disabled={ocupado} data-treino="exec-pausa">
                    <Icon name="pause" size={18} />
                    <span>Pausar</span>
                  </Button>
                )}
                <Button variant="od" style={{ fontSize: 14 }} onClick={() => abrir("interromper")} disabled={ocupado}>
                  Interromper por risco
                </Button>
              </div>
              {!pausaAberta && (
                <select className="select" aria-label="Motivo da pausa" value={motivo} onChange={(e) => setMotivo(e.target.value as typeof motivo)} disabled={ocupado}>
                  <option value="">Pausa sem motivo</option>
                  <option value="almoco">Almoço</option>
                  <option value="descanso">Descanso</option>
                  <option value="outro">Outro</option>
                </select>
              )}
              <Button variant="line" block onClick={() => confirmar("suspender")} disabled={ocupado}>
                Suspender (fim do expediente)
              </Button>
              {podeCancelar && (
                <Button variant="ghost" block onClick={() => confirmar("cancelar")} disabled={ocupado}>
                  Cancelar por engano
                </Button>
              )}
            </>
          )}
        </PainelAcoes>
      )}
    </>
  );

  return <Colunas principal={principal} lateral={lateral} />;
}
