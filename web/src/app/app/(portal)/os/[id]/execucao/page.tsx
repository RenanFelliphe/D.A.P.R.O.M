import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExecucaoScreen } from "@/components/app/execucao/ExecucaoScreen";
import { definirSituacao } from "@/components/app/execucao/situacao";
import type { AprDaApi, ExecucaoAberta, ExecucaoDaApi } from "@/components/app/execucao/tempo";
import { api, apiOuNulo, usuarioAtual } from "@/lib/api";
import type { PerguntaDoChecklist } from "@/lib/checklist-inspecao";

export const metadata: Metadata = { title: "Execução" };

interface DetalheDaOs {
  os: {
    id: string;
    numero_ordem: string | null;
    titulo: string;
    status: string;
    local_instalacao: { codigo: string };
    responsavel?: { id: string; nome: string } | null;
  };
  execucoes: ExecucaoDaApi[];
  aprs: AprDaApi[];
  /** O checklist de inspeção do plano da OS preventiva (o Campo de treino não o traz). */
  checklist_inspecao?: PerguntaDoChecklist[];
}

export default async function ExecucaoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [detalhe, { usuario }, { execucoes: abertas }] = await Promise.all([
    apiOuNulo<DetalheDaOs>(`/os/${id}`),
    usuarioAtual(),
    api<{ execucoes: ExecucaoAberta[] }>("/me/execucoes-abertas"),
  ]);
  if (!detalhe) notFound();

  const situacao = definirSituacao({
    osStatus: detalhe.os.status,
    usuarioId: usuario.id,
    execucoes: detalhe.execucoes,
    aprs: detalhe.aprs,
    abertas,
    agora: new Date(),
    reservadaPara: detalhe.os.responsavel ?? null,
  });

  return (
    <ExecucaoScreen
      os={{ id: detalhe.os.id, numero_ordem: detalhe.os.numero_ordem, titulo: detalhe.os.titulo, local: detalhe.os.local_instalacao.codigo }}
      usuario={{ id: usuario.id, nome: usuario.nome, matricula: usuario.matricula, assinatura_path: usuario.assinatura_path }}
      situacao={situacao}
      checklist={detalhe.checklist_inspecao ?? []}
    />
  );
}
