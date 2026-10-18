"use client";

import { useState } from "react";
import { CabecalhoPagina } from "@/components/app/AppChrome";
import { ExecucaoEmAndamento } from "@/components/app/execucao/ExecucaoEmAndamento";
import { ExecucaoEncerrada } from "@/components/app/execucao/ExecucaoEncerrada";
import { FormularioEncerrar } from "@/components/app/execucao/FormularioEncerrar";
import { IniciarExecucao } from "@/components/app/execucao/IniciarExecucao";
import { SuspenderEsquecida } from "@/components/app/execucao/SuspenderEsquecida";
import type { Situacao } from "@/components/app/execucao/situacao";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import type { PerguntaDoChecklist } from "@/lib/checklist-inspecao";
import type { RespostaComPontos } from "@/lib/gamificacao";
import { rotas } from "@/lib/rotas";

interface ExecucaoScreenProps {
  os: { id: string; numero_ordem: string | null; titulo: string; local: string };
  situacao: Situacao;
  /** O checklist de inspeção do plano da OS preventiva, pedido no encerramento (vazio quando a OS não tem). */
  checklist?: PerguntaDoChecklist[];
}

/** Execução da OS: escolhe o que mostrar conforme a situação que a `api` informa (ver `situacao.ts`). */
export function ExecucaoScreen({ os, situacao, checklist = [] }: ExecucaoScreenProps) {
  /** O responsável acabou de assinar o encerramento: a tela final, com os pontos, vale até a página atualizar. */
  const [assinada, setAssinada] = useState(false);
  const [pontos, setPontos] = useState<RespostaComPontos | null>(null);
  const emPausa = situacao.tipo === "em_andamento" && situacao.execucao.pausas.some((p) => !p.fim);

  let corpo;
  if (assinada) corpo = <ExecucaoEncerrada osId={os.id} status="aguardando_supervisor" pontos={pontos} />;
  else if (situacao.tipo === "esquecida") corpo = <SuspenderEsquecida execucao={situacao.execucao} />;
  else if (situacao.tipo === "em_andamento") corpo = <ExecucaoEmAndamento os={os} situacao={situacao} />;
  else if (situacao.tipo === "encerrando")
    corpo = (
      <FormularioEncerrar
        execucao={situacao.execucao}
        osId={os.id}
        checklist={checklist}
        onConcluida={(resposta) => {
          setPontos(resposta);
          setAssinada(true);
        }}
      />
    );
  else if (situacao.tipo === "iniciar") corpo = <IniciarExecucao osId={os.id} apr={situacao.apr} />;
  else if (situacao.tipo === "aguardando_assinaturas")
    corpo = (
      <div className="panel stack g12" style={{ maxWidth: 560 }}>
        <h2>A APR ainda não foi assinada por todos</h2>
        <Notice tone="al" icon="clip">
          A execução só começa quando todos os participantes da APR assinaram, cada um na própria conta. Falta a assinatura de <strong>{situacao.faltam.join(", ")}</strong>.
        </Notice>
        <LinkButton variant="p" href={rotas.app.aprovada(os.id)}>
          {situacao.euFalto ? "Assinar a APR" : "Acompanhar as assinaturas"}
        </LinkButton>
      </div>
    );
  else if (situacao.tipo === "outra_pessoa")
    corpo = (
      <div className="panel stack g12" style={{ maxWidth: 560 }}>
        <Notice tone="al" icon="users">
          {situacao.encerrando ? (
            <>
              <strong>{situacao.executor}</strong> encerrou esta OS e está preenchendo e assinando o encerramento. Só o responsável pela execução assina.
            </>
          ) : (
            <>
              Esta OS está em execução por <strong>{situacao.executor}</strong>. Só quem iniciou a execução pode pausar, suspender ou encerrar.
            </>
          )}
        </Notice>
        <LinkButton variant="line" href={rotas.app.lista}>
          Voltar à lista
        </LinkButton>
      </div>
    );
  else if (situacao.tipo === "terminada") corpo = <ExecucaoEncerrada osId={os.id} status={situacao.status} />;
  else if (situacao.tipo === "fechada")
    corpo = (
      <div className="panel stack g12" style={{ maxWidth: 560 }}>
        <Notice tone="info" icon="lock">
          Esta OS foi <strong>cancelada</strong> e não pode ser executada.
        </Notice>
        <LinkButton variant="line" href={rotas.app.lista}>
          Voltar à lista
        </LinkButton>
      </div>
    );
  else if (situacao.tipo === "devolvida" || situacao.tipo === "reservada")
    corpo = (
      <div className="panel stack g12" style={{ maxWidth: 560 }}>
        <Notice tone="info" icon={situacao.tipo === "devolvida" ? "left" : "lock"}>
          {situacao.tipo === "devolvida" ? (
            <>
              Esta OS foi <strong>devolvida ao SAP</strong> pelo supervisor e não pode ser executada.
            </>
          ) : (
            <>
              Esta OS está reservada para <strong>{situacao.responsavel}</strong>. Só quem o supervisor designou inicia a execução.
            </>
          )}
        </Notice>
        <LinkButton variant="line" href={rotas.app.lista}>
          Voltar à lista
        </LinkButton>
      </div>
    );
  else
    corpo = (
      <div className="panel stack g12" style={{ maxWidth: 560 }}>
        <h2>Preencha a APR antes de iniciar</h2>
        <Notice tone="al" icon="clip">
          Para iniciar a execução é preciso uma APR aprovada hoje para esta OS, assinada por todos os participantes e ainda não usada. Se a anterior deixou de servir (alguém recusou), preencha uma APR nova e volte aqui.
        </Notice>
        <LinkButton variant="p" href={rotas.app.apr(os.id)}>
          Preencher a APR
        </LinkButton>
      </div>
    );

  return (
    <Screen>
      <CabecalhoPagina
        trilha={[
          { rotulo: "OS da equipe", href: rotas.app.lista },
          { rotulo: <span className="mono">OS {os.numero_ordem ?? "—"}</span>, href: rotas.app.os(os.id) },
          { rotulo: "Execução" },
        ]}
      >
        <div className="row wrap g8">
          <span className="mono" style={{ fontSize: 15, fontWeight: 600 }}>
            OS {os.numero_ordem ?? "—"}
          </span>
          {situacao.tipo === "em_andamento" && <Badge tone={emPausa ? "al" : "exe"}>{emPausa ? "Em pausa" : "Em execução"}</Badge>}
          {!assinada && situacao.tipo === "encerrando" && <Badge tone="al">Encerrando</Badge>}
          {assinada && <Badge tone="al">Aguardando o supervisor</Badge>}
          {!assinada && situacao.tipo === "terminada" && <Badge tone={situacao.status === "encerrada" ? "enc" : "al"}>{situacao.status === "encerrada" ? "Encerrada" : "Aguardando o supervisor"}</Badge>}
        </div>
        <h1>Execução da OS</h1>
        <span className="muted">
          {os.titulo} · {os.local}
        </span>
      </CabecalhoPagina>
      {corpo}
    </Screen>
  );
}
