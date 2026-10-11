import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { AcoesDaOs } from "@/components/web/detalhe/AcoesDaOs";
import { AlertasDaOs } from "@/components/web/detalhe/AlertasDaOs";
import { AprsDaOs } from "@/components/web/detalhe/AprsDaOs";
import { BaixaSap } from "@/components/web/detalhe/BaixaSap";
import { CienciaSupervisor } from "@/components/web/detalhe/CienciaSupervisor";
import { DadosSap } from "@/components/web/detalhe/DadosSap";
import { DetalheCabecalho } from "@/components/web/detalhe/DetalheCabecalho";
import { DocumentoOs } from "@/components/web/detalhe/DocumentoOs";
import { ExecucoesDaOs } from "@/components/web/detalhe/ExecucoesDaOs";
import { HistoricoDoLocal } from "@/components/web/detalhe/HistoricoDoLocal";
import { LinhaDoTempo } from "@/components/web/detalhe/LinhaDoTempo";
import { carregarDetalhe, carregarHistorico } from "@/data/detalhe";
import { usuarioAtual } from "@/lib/api";
import { rotas } from "@/lib/rotas";

export const metadata: Metadata = { title: "Detalhe da OS" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DetalheOsPage({ params, searchParams }: PageProps<"/web/os/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const sp = await searchParams;

  const [{ usuario }, detalhe] = await Promise.all([usuarioAtual(), carregarDetalhe(id)]);
  // OS que não existe ou é de outra equipe: a `api` responde 404.
  if (!detalhe) notFound();
  const { os, aprs, execucoes, alertas, reprogramacoes, linha_do_tempo } = detalhe;

  // Histórico: do equipamento, quando a OS tem um, ou de todo o local (`?escopo=local`).
  const escopo = os.equipamento && sp.escopo !== "local" ? "equipamento" : "local";
  const paginaHistorico = Math.max(1, Number.parseInt(typeof sp.hist === "string" ? sp.hist : "1", 10) || 1);
  const historico = await carregarHistorico(os.local_instalacao_id, escopo === "equipamento" ? os.equipamento : null, paginaHistorico);
  const hrefHistorico = (e: "equipamento" | "local", pagina: number) => {
    const q = new URLSearchParams({ escopo: e });
    if (pagina > 1) q.set("hist", String(pagina));
    return `${rotas.web.os(os.id)}?${q}#historico`;
  };

  const podeEditar = usuario.perfil === "analista" || usuario.perfil === "admin";

  return (
    <Screen>
      <DetalheCabecalho os={os} />
      {os.eventos_com_relogio_suspeito > 0 && (
        <Notice tone="al" icon="clock">
          <strong>Relógio do aparelho suspeito.</strong>{" "}
          {os.eventos_com_relogio_suspeito === 1
            ? "1 registro desta OS traz um horário à frente do servidor"
            : `${os.eventos_com_relogio_suspeito} registros desta OS trazem horários à frente do servidor`}
          . Confira os tempos antes de usar o PDF ou a exportação.
        </Notice>
      )}
      {os.execucao_aberta_ha_horas !== null && (
        <Notice tone="al" icon="alert">
          <strong>Execução aberta há {os.execucao_aberta_ha_horas} h.</strong> Pode ter ficado esquecida em andamento.
        </Notice>
      )}
      <div className="two">
        <div className="stack g16">
          <DadosSap os={os} />
          <AprsDaOs aprs={aprs} />
          <ExecucoesDaOs execucoes={execucoes} />
          <div id="historico" className="stack">
            <HistoricoDoLocal
              osId={os.id}
              local={os.local_instalacao.codigo}
              equipamento={os.equipamento}
              escopo={escopo}
              historico={historico}
              hrefDoEscopo={(e) => hrefHistorico(e, 1)}
              hrefDaPagina={(p) => hrefHistorico(escopo, p)}
            />
          </div>
        </div>
        <aside className="stack g16">
          <DocumentoOs os={os} />
          {os.status === "encerrada" && <CienciaSupervisor os={os} podeDarCiencia={usuario.perfil === "supervisor"} />}
          <BaixaSap os={os} podeExportar={podeEditar} />
          <AcoesDaOs os={os} podeEditar={podeEditar} />
          <LinhaDoTempo eventos={linha_do_tempo} />
          <AlertasDaOs alertas={alertas} reprogramacoes={reprogramacoes} />
        </aside>
      </div>
    </Screen>
  );
}
