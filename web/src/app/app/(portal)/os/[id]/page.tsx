import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Colunas } from "@/components/app/AppChrome";
import { AcoesDaOs } from "@/components/app/detalhe/AcoesDaOs";
import { AprExigidaCard } from "@/components/app/detalhe/AprExigidaCard";
import { DadosSapCard } from "@/components/app/detalhe/DadosSapCard";
import { HistoricoAprs } from "@/components/app/detalhe/HistoricoAprs";
import { InstrucoesCard } from "@/components/app/detalhe/InstrucoesCard";
import { LocalCard } from "@/components/app/detalhe/LocalCard";
import { Recolhivel } from "@/components/app/detalhe/Recolhivel";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { DecisoesDaOs } from "@/components/web/alertas/DecisoesDaOs";
import { AbasDaOs, abaDaConsulta } from "@/components/web/detalhe/AbasDaOs";
import { AlertasDaOs } from "@/components/web/detalhe/AlertasDaOs";
import { AprsDaOs } from "@/components/web/detalhe/AprsDaOs";
import { BaixaSap } from "@/components/web/detalhe/BaixaSap";
import { BotaoCritico } from "@/components/web/detalhe/BotaoCritico";
import { CancelarOs } from "@/components/web/detalhe/CancelarOs";
import { CienciaSupervisor } from "@/components/web/detalhe/CienciaSupervisor";
import { DadosSap } from "@/components/web/detalhe/DadosSap";
import { DetalheCabecalho } from "@/components/web/detalhe/DetalheCabecalho";
import { DocumentoOs } from "@/components/web/detalhe/DocumentoOs";
import { ExecucoesDaOs } from "@/components/web/detalhe/ExecucoesDaOs";
import { HistoricoDoLocal } from "@/components/web/detalhe/HistoricoDoLocal";
import { LinhaDoTempo } from "@/components/web/detalhe/LinhaDoTempo";
import { carregarDetalhe, carregarHistorico } from "@/data/detalhe";
import { api, usuarioAtual } from "@/lib/api";
import type { ModeloResumo } from "@/lib/apr";
import { aprAprovadaDisponivel, execucaoAberta, type DetalheDaOs as DetalheDoCampo } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { ehAdmin, ehSupervisor, equipesDoSupervisor, rotuloDoStatus, type Equipe } from "@/lib/tipos";

export const metadata: Metadata = { title: "Detalhe da OS" };

/**
 * Detalhe da OS: um endereço só para admin, supervisor e técnico; a estrutura muda por perfil.
 * - Técnico: dados do SAP, local, instruções, APR exigida e as ações que o estado da OS permite (APR, execução).
 * - Admin: a visão de supervisão (abas Resumo, APRs e execuções, Histórico; alertas, PDF, ciência, baixa no SAP, local crítico, cancelar).
 * - Supervisor: a mesma visão de supervisão e, na lateral, as ações de campo (ele também é técnico e executa OS).
 * Quem supervisiona a equipe da OS (e o admin) reprograma ou abre OS de apoio no Resumo, sem depender de um alerta.
 */
export default async function DetalheOsPage({ params, searchParams }: PageProps<"/app/os/[id]">) {
  const { id } = await params;
  const sp = await searchParams;

  const [{ usuario }, detalhe] = await Promise.all([usuarioAtual(), carregarDetalhe(id)]);
  // OS que não existe ou é de outra equipe: a `api` responde 404.
  if (!detalhe) notFound();
  const { os, aprs, execucoes, alertas, reprogramacoes, linha_do_tempo } = detalhe;

  const admin = ehAdmin(usuario);
  const gestao = admin || ehSupervisor(usuario);
  // O admin é só gestão; todo técnico (o supervisor também) aplica APR e executa.
  const executa = !admin;

  // As ações de campo e o card da APR exigida usam os tipos do técnico, que são um recorte do detalhe completo.
  const campo = detalhe as unknown as DetalheDoCampo;
  const aberta = execucaoAberta(campo.execucoes);
  // Versão publicada mais recente do modelo da atividade (a lista vem por código e versão decrescente).
  const codigoDoModelo = os.modelo_apr_codigo ?? null;
  const modelo =
    executa && codigoDoModelo
      ? ((await api<{ modelos: ModeloResumo[] }>("/modelos-apr", { consulta: { codigo: codigoDoModelo, publicados: true } })).modelos[0] ?? null)
      : null;
  const painelDeCampo = executa && (
    <>
      <AprExigidaCard modelo={modelo} codigoDoModelo={codigoDoModelo} aprs={campo.aprs} status={os.status} />
      <AcoesDaOs
        os={campo.os}
        usuarioId={usuario.id}
        execucaoAberta={aberta}
        aprDisponivel={aprAprovadaDisponivel(campo.aprs, campo.execucoes, usuario.id)}
        aprDeOutros={aprAprovadaDisponivel(campo.aprs, campo.execucoes)}
      />
    </>
  );

  const cabecalho = (
    <DetalheCabecalho
      os={os}
      secao={gestao ? "Ordem de Serviço" : "OS da equipe"}
      acoes={admin && os.origem === "apoio" && (os.status === "liberada" || os.status === "pendente") && <CancelarOs osId={os.id} />}
    />
  );
  const aviso = os.status === "cancelada" && (
    <Notice tone="al" icon="alert">
      <strong>OS cancelada.</strong> {os.justificativa_cancelamento}
    </Notice>
  );

  if (!gestao) {
    return (
      <Screen>
        {cabecalho}
        {aviso}
        <Colunas
          principal={
            <>
              <LocalCard local={campo.os.local_instalacao} />
              <DadosSapCard os={campo.os} />
              <InstrucoesCard descricao={os.descricao} titulo={os.titulo} />
              <HistoricoAprs aprs={campo.aprs} execucoes={campo.execucoes} osId={os.id} />
            </>
          }
          lateral={painelDeCampo}
        />
      </Screen>
    );
  }

  const aba = abaDaConsulta(sp.aba);

  // Histórico (só na aba dele): do equipamento, quando a OS tem um, ou de todo o local (`?escopo=local`).
  const escopo = os.equipamento && sp.escopo !== "local" ? "equipamento" : "local";
  const paginaHistorico = Math.max(1, Number.parseInt(typeof sp.hist === "string" ? sp.hist : "1", 10) || 1);
  const historico =
    aba === "historico" ? await carregarHistorico(os.local_instalacao_id, escopo === "equipamento" ? os.equipamento : null, paginaHistorico) : null;
  const hrefHistorico = (e: "equipamento" | "local", pagina: number) => {
    const q = new URLSearchParams({ aba: "historico", escopo: e });
    if (pagina > 1) q.set("hist", String(pagina));
    return `${rotas.app.os(os.id)}?${q}`;
  };

  // Dá a ciência quem supervisiona a equipe da OS e não participou dela (a `api` confere os dois).
  const supervisaEquipeDaOs = equipesDoSupervisor(usuario)?.includes(os.equipe.id) ?? false;
  // Reprogramar e abrir OS de apoio: quem supervisiona a equipe da OS (ou o admin), enquanto ela não começou nem terminou.
  const podeDecidir = (admin || supervisaEquipeDaOs) && (os.status === "liberada" || os.status === "pendente");
  const equipes = podeDecidir && aba === "resumo" ? (await api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } })).equipes : [];

  return (
    <Screen>
      {cabecalho}
      {aviso}
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
              {podeDecidir && (
                <Recolhivel titulo="Reprogramar ou abrir OS de apoio" resumo={os.atrasada ? "OS atrasada" : rotuloDoStatus[os.status]} aberto={os.status === "pendente" || os.atrasada}>
                  <p className="muted">
                    {os.status === "pendente"
                      ? "A OS está pendente (APR bloqueada, execução suspensa ou interrompida). A equipe pode fazer uma nova APR a qualquer momento; se não der para resolver no local, reprograme ou abra uma OS de apoio."
                      : os.atrasada
                        ? "A OS passou da data programada. Reprograme com justificativa ou, se outra equipe precisa resolver algo antes, abra uma OS de apoio."
                        : "Quando a OS não puder ser feita como planejada, reprograme com justificativa ou abra uma OS de apoio para outra equipe resolver antes."}
                  </p>
                  <DecisoesDaOs os={os} usuario={usuario} equipes={equipes} comApoio />
                </Recolhivel>
              )}
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
          {painelDeCampo}
          {admin && <BotaoCritico localId={os.local_instalacao.id} critico={os.local_instalacao.critico} />}
          <DocumentoOs os={os} />
          {os.status === "encerrada" && <CienciaSupervisor os={os} podeDarCiencia={supervisaEquipeDaOs} />}
          <BaixaSap os={os} podeExportar={admin} />
        </aside>
      </div>
    </Screen>
  );
}
