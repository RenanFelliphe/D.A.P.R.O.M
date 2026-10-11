"use client";

import { useState } from "react";
import { CabecalhoPagina } from "@/components/app/AppChrome";
import { ExecucaoEmAndamento } from "@/components/app/execucao/ExecucaoEmAndamento";
import { ExecucaoEncerrada } from "@/components/app/execucao/ExecucaoEncerrada";
import { IniciarExecucao } from "@/components/app/execucao/IniciarExecucao";
import { SuspenderEsquecida } from "@/components/app/execucao/SuspenderEsquecida";
import type { Situacao } from "@/components/app/execucao/situacao";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { rotas } from "@/lib/rotas";

interface ExecucaoScreenProps {
  os: { id: string; numero_ordem: string | null; titulo: string; local: string };
  usuario: { id: string; nome: string; matricula: string; assinatura_path: string | null };
  situacao: Situacao;
}

/** Execução da OS: escolhe o que mostrar conforme a situação que a `api` informa (ver `situacao.ts`). */
export function ExecucaoScreen({ os, usuario, situacao }: ExecucaoScreenProps) {
  const [encerrada, setEncerrada] = useState(false);
  const emPausa = situacao.tipo === "em_andamento" && situacao.execucao.pausas.some((p) => !p.fim);

  let corpo;
  if (encerrada) corpo = <ExecucaoEncerrada osId={os.id} />;
  else if (situacao.tipo === "esquecida") corpo = <SuspenderEsquecida execucao={situacao.execucao} />;
  else if (situacao.tipo === "em_andamento") corpo = <ExecucaoEmAndamento os={os} usuario={usuario} situacao={situacao} onEncerrada={() => setEncerrada(true)} />;
  else if (situacao.tipo === "iniciar") corpo = <IniciarExecucao osId={os.id} apr={situacao.apr} />;
  else if (situacao.tipo === "outra_pessoa")
    corpo = (
      <div className="panel stack g12" style={{ maxWidth: 560 }}>
        <Notice tone="al" icon="users">
          Esta OS está em execução por <strong>{situacao.executor}</strong>. Só quem iniciou a execução pode pausar, suspender ou encerrar.
        </Notice>
        <LinkButton variant="line" href={rotas.app.lista}>
          Voltar à lista
        </LinkButton>
      </div>
    );
  else if (situacao.tipo === "fechada") corpo = <ExecucaoEncerrada osId={os.id} jaEncerrada />;
  else
    corpo = (
      <div className="panel stack g12" style={{ maxWidth: 560 }}>
        <h2>Preencha a APR antes de iniciar</h2>
        <Notice tone="al" icon="clip">
          Para iniciar a execução é preciso uma APR aprovada hoje para esta OS e ainda não usada. Preencha a APR e volte aqui.
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
          {situacao.tipo === "em_andamento" && !encerrada && <Badge tone={emPausa ? "al" : "exe"}>{emPausa ? "Em pausa" : "Em execução"}</Badge>}
          {(encerrada || situacao.tipo === "fechada") && <Badge tone="enc">Encerrada</Badge>}
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
