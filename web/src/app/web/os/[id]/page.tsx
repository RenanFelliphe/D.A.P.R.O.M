import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { AbasDaOs, abaDaConsulta } from "@/components/web/detalhe/AbasDaOs";
import { AlertasDaOs } from "@/components/web/detalhe/AlertasDaOs";
import { AprsDaOs } from "@/components/web/detalhe/AprsDaOs";
import { BotaoCritico } from "@/components/web/detalhe/BotaoCritico";
import { CancelarOs } from "@/components/web/detalhe/CancelarOs";
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
import { ehAdmin, equipesDoSupervisor } from "@/lib/tipos";

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

  const aba = abaDaConsulta(sp.aba);

  // Histórico (só na aba dele): do equipamento, quando a OS tem um, ou de todo o local (`?escopo=local`).
  const escopo = os.equipamento && sp.escopo !== "local" ? "equipamento" : "local";
  const paginaHistorico = Math.max(1, Number.parseInt(typeof sp.hist === "string" ? sp.hist : "1", 10) || 1);
  const historico =
    aba === "historico"
      ? await carregarHistorico(os.local_instalacao_id, escopo === "equipamento" ? os.equipamento : null, paginaHistorico)
      : null;
  const hrefHistorico = (e: "equipamento" | "local", pagina: number) => {
    const q = new URLSearchParams({ aba: "historico", escopo: e });
    if (pagina > 1) q.set("hist", String(pagina));
    return `${rotas.web.os(os.id)}?${q}`;
  };

  const podeEditar = ehAdmin(usuario);
  // Dá a ciência quem supervisiona a equipe da OS e não participou dela (a `api` confere os dois).
  const supervisaEquipeDaOs = equipesDoSupervisor(usuario)?.includes(os.equipe.id) ?? false;
  const podeCancelar = os.origem === "apoio" && (os.status === "liberada" || os.status === "pendente");

  return (
    <Screen>
      <DetalheCabecalho
        os={os}
        acoes={podeEditar && podeCancelar && <CancelarOs osId={os.id} />}
      />
      {os.status === "cancelada" && (
        <Notice tone="al" icon="alert">
          <strong>OS cancelada.</strong> {os.justificativa_cancelamento}
        </Notice>
      )}
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
      <AbasDaOs osId={os.id} atual={aba} contagens={{ aprs: aprs.length + execucoes.length }} />
      <div className="two">
        <div className="stack g16">
          {aba === "resumo" && (
            <>
              <DadosSap os={os} />
              <AlertasDaOs alertas={alertas} reprogramacoes={reprogramacoes} />
            </>
          )}
          {aba === "aprs" && (
            <>
              <AprsDaOs aprs={aprs} />
              <ExecucoesDaOs execucoes={execucoes} />
            </>
          )}
          {aba === "historico" && historico && (
            <>
              <LinhaDoTempo eventos={linha_do_tempo} />
              <HistoricoDoLocal
                osId={os.id}
                local={os.local_instalacao.codigo}
                equipamento={os.equipamento}
                escopo={escopo}
                historico={historico}
                hrefDoEscopo={(e) => hrefHistorico(e, 1)}
                hrefDaPagina={(p) => hrefHistorico(escopo, p)}
              />
            </>
          )}
        </div>
        <aside className="stack g16">
          {podeEditar && <BotaoCritico localId={os.local_instalacao.id} critico={os.local_instalacao.critico} />}
          <DocumentoOs os={os} />
          {os.status === "encerrada" && <CienciaSupervisor os={os} podeDarCiencia={supervisaEquipeDaOs} />}
          <BaixaSap os={os} podeExportar={podeEditar} />
        </aside>
      </div>
    </Screen>
  );
}
