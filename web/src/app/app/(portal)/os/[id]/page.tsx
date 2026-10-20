import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Colunas } from "@/components/app/AppChrome";
import { FaixaDeAssinaturas } from "@/components/app/FaixaDeAssinaturas";
import { AcoesDaOs } from "@/components/app/detalhe/AcoesDaOs";
import { AprExigidaCard } from "@/components/app/detalhe/AprExigidaCard";
import { ChecklistDaOsCard } from "@/components/app/detalhe/ChecklistDaOsCard";
import { DadosSapCard } from "@/components/app/detalhe/DadosSapCard";
import { HistoricoAprs } from "@/components/app/detalhe/HistoricoAprs";
import { InstrucoesCard } from "@/components/app/detalhe/InstrucoesCard";
import { LocalCard } from "@/components/app/detalhe/LocalCard";
import { MateriaisCard } from "@/components/app/detalhe/MateriaisCard";
import { Recolhivel } from "@/components/app/detalhe/Recolhivel";
import { AtualizacaoAutomatica } from "@/components/ui/AtualizacaoAutomatica";
import { Notice } from "@/components/ui/Notice";
import { Screen } from "@/components/ui/Screen";
import { DecisoesDaOs } from "@/components/web/alertas/DecisoesDaOs";
import { AbasDaOs, abaDaConsulta } from "@/components/web/detalhe/AbasDaOs";
import { AlertasDaOs } from "@/components/web/detalhe/AlertasDaOs";
import { AprsDaOs } from "@/components/web/detalhe/AprsDaOs";
import { BaixaSap } from "@/components/web/detalhe/BaixaSap";
import { BotaoCritico } from "@/components/web/detalhe/BotaoCritico";
import { AtribuicaoDaOs } from "@/components/web/detalhe/AtribuicaoDaOs";
import { CancelarOs } from "@/components/web/detalhe/CancelarOs";
import { CienciaSupervisor } from "@/components/web/detalhe/CienciaSupervisor";
import { DadosSap } from "@/components/web/detalhe/DadosSap";
import { DetalheCabecalho } from "@/components/web/detalhe/DetalheCabecalho";
import { DevolverOs } from "@/components/web/detalhe/DevolverOs";
import { DocumentoOs } from "@/components/web/detalhe/DocumentoOs";
import { ExecucaoEmPapel } from "@/components/web/detalhe/ExecucaoEmPapel";
import { ExecucoesDaOs } from "@/components/web/detalhe/ExecucoesDaOs";
import { HistoricoDoLocal } from "@/components/web/detalhe/HistoricoDoLocal";
import { LinhaDoTempo } from "@/components/web/detalhe/LinhaDoTempo";
import { RelatorioDaExecucao } from "@/components/web/detalhe/RelatorioDaExecucao";
import { CicloDaOs } from "@/components/web/preventivas/CicloDaOs";
import { carregarDetalhe, carregarHistorico } from "@/data/detalhe";
import { api, usuarioAtual } from "@/lib/api";
import { dataHora } from "@/lib/formatar";
import { aprAprovadaDisponivel, aprDeHoje, execucaoAberta, execucaoEncerrando, situacaoDaApr, type DetalheDaOs as DetalheDoCampo } from "@/lib/os-app";
import { rotas } from "@/lib/rotas";
import { emTreino } from "@/lib/treino-modo";
import { ehAdmin, ehSupervisor, equipesDoSupervisor, rotuloDoStatus, type Equipe, type Usuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Detalhe da OS" };

/**
 * Detalhe da OS: um endereço só para admin, supervisor e técnico; a estrutura muda por perfil.
 * - Técnico: dados do SAP, o ciclo da preventiva, local, instruções, materiais do catálogo, APR exigida e as ações que o estado
 *   da OS permite (APR, execução).
 * - Admin: a visão de supervisão (abas Resumo, APRs e execuções, Histórico; alertas, PDF, assinatura final do supervisor, baixa no SAP, local crítico, cancelar).
 * - Supervisor: a mesma visão de supervisão e, na lateral, as ações de campo (ele também é técnico e executa OS).
 * Quem supervisiona a equipe da OS (e o admin) reprograma ou abre OS de apoio no Resumo, sem depender de um alerta. Só o
 * supervisor da equipe reserva a OS a uma pessoa (atribuição individual) e a devolve ao SAP. A tela atualiza sozinha.
 */
export default async function DetalheOsPage({ params, searchParams }: PageProps<"/app/os/[id]">) {
  const { id } = await params;
  const sp = await searchParams;

  const [{ usuario, ausencia }, detalhe] = await Promise.all([usuarioAtual(), carregarDetalhe(id)]);
  // O ausente só visualiza: as ações de campo e de supervisão desta tela ficam recolhidas, com o motivo.
  const ausente = Boolean(ausencia);
  // OS que não existe ou é de outra equipe: a `api` responde 404.
  if (!detalhe) notFound();
  const { os, servico, aprs, execucoes, alertas, reprogramacoes, linha_do_tempo } = detalhe;
  const checklist = detalhe.checklist_inspecao ?? [];

  const admin = ehAdmin(usuario);
  const gestao = admin || ehSupervisor(usuario);
  // O admin é só gestão; todo técnico (o supervisor também) aplica APR e executa.
  const executa = !admin;
  // Sugerir e contestar a lista de materiais: todo perfil menos o admin (que edita a lista no catálogo); no campo de treino, nada.
  const colaboracao = (await emTreino()) ? null : admin ? "ver" : "sugerir";

  // As ações de campo e o card da APR exigida usam os tipos do técnico, que são um recorte do detalhe completo.
  const campo = detalhe as unknown as DetalheDoCampo;
  const aberta = execucaoAberta(campo.execucoes);
  // A APR de hoje de que o técnico participa e que deixou de servir (recusa): a tela explica e leva a uma APR nova.
  const aprDoDia = aprDeHoje(campo.aprs, campo.execucoes, usuario.id);
  const painelDeCampo = executa && (
    <>
      <FaixaDeAssinaturas osId={os.id} />
      <AprExigidaCard aprs={campo.aprs} status={os.status} />
      <AcoesDaOs
        os={campo.os}
        usuarioId={usuario.id}
        execucaoAberta={aberta}
        execucaoEncerrando={execucaoEncerrando(campo.execucoes)}
        aprDisponivel={aprAprovadaDisponivel(campo.aprs, campo.execucoes, usuario.id)}
        aprDeOutros={aprAprovadaDisponivel(campo.aprs, campo.execucoes)}
        aprInviavel={aprDoDia && situacaoDaApr(aprDoDia).inviavel ? aprDoDia : null}
        ausencia={ausencia?.rotulo ?? null}
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
  // O apêndice da OS devolvida: a justificativa do supervisor, que vai na planilha de baixa para o SAP corrigir a ordem.
  const avisoDevolucao = os.status === "devolvida" && os.devolucao && (
    <Notice tone="info" icon="left">
      <strong>OS devolvida ao SAP{os.devolucao.por_nome ? ` por ${os.devolucao.por_nome}` : ""}.</strong> {os.devolucao.justificativa}{" "}
      <span className="muted">
        ({dataHora(os.devolucao.em)} · {os.devolucao.exportada_em ? "já saiu na planilha de baixa" : "sai na próxima planilha de baixa"})
      </span>
    </Notice>
  );
  const avisoReserva = os.responsavel && (os.status === "liberada" || os.status === "pendente") && (
    <Notice tone="info" icon="user">
      <strong>{os.responsavel.id === usuario.id ? "Esta OS foi reservada para você" : `OS reservada para ${os.responsavel.nome}`}</strong>
      {os.responsavel.reservada_por_nome ? ` por ${os.responsavel.reservada_por_nome}` : ""}. Só essa pessoa inicia a APR e a execução.
    </Notice>
  );

  if (!gestao) {
    return (
      <Screen>
        {cabecalho}
        {aviso}
        {avisoDevolucao}
        {avisoReserva}
        <Colunas
          principal={
            <>
              <LocalCard local={campo.os.local_instalacao} />
              <DadosSapCard os={campo.os} />
              <CicloDaOs osId={os.id} preventiva={os.tipo === "preventiva"} gestao={false} estilo="card" />
              <ChecklistDaOsCard perguntas={checklist} />
              <InstrucoesCard descricao={os.descricao} titulo={os.titulo} />
              <MateriaisCard servico={servico ?? null} colaboracao={colaboracao} />
              <HistoricoAprs aprs={campo.aprs} execucoes={campo.execucoes} osId={os.id} />
            </>
          }
          lateral={painelDeCampo}
        />
        <AtualizacaoAutomatica />
      </Screen>
    );
  }

  // Dá a assinatura final quem supervisiona a equipe da OS, mesmo que tenha participado do serviço (a `api` confere).
  const supervisaEquipeDaOs = equipesDoSupervisor(usuario)?.includes(os.equipe.id) ?? false;
  // O relatório da execução é do supervisor da equipe e do admin, a partir de uma execução finalizada.
  const podeVerRelatorio = (admin || supervisaEquipeDaOs) && execucoes.some((e) => e.fim !== null);
  const aba = abaDaConsulta(sp.aba, podeVerRelatorio);

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

  // Reprogramar e abrir OS de apoio: quem supervisiona a equipe da OS (ou o admin), enquanto ela não começou nem terminou.
  const podeDecidir = (admin || (supervisaEquipeDaOs && !ausente)) && (os.status === "liberada" || os.status === "pendente");
  const equipes = podeDecidir && aba === "resumo" ? (await api<{ equipes: Equipe[] }>("/equipes", { consulta: { tamanho: 200 } })).equipes : [];
  // Atribuição individual e devolução são só do supervisor da equipe da OS, enquanto ela não começou (a devolução, só se ainda liberada).
  const podeReservar = supervisaEquipeDaOs && !ausente && (os.status === "liberada" || os.status === "pendente");
  const podeDevolver = supervisaEquipeDaOs && !ausente && os.status === "liberada" && os.origem !== "apoio";
  const colegas = podeReservar
    ? (await api<{ usuarios: Usuario[] }>("/usuarios", { consulta: { equipe_id: os.equipe_id, tamanho: 200 } })).usuarios
        // Quem está ausente não recebe reserva de OS.
        .filter((u) => u.perfil === "tecnico" && u.ativo && (u.liberacao ?? "liberado") === "liberado" && !u.ausencia)
        .map(({ id, nome }) => ({ id, nome }))
    : [];

  return (
    <Screen>
      {cabecalho}
      {aviso}
      {avisoDevolucao}
      {avisoReserva}
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
      <AbasDaOs osId={os.id} atual={aba} contagens={{ aprs: aprs.length + execucoes.length }} comRelatorio={podeVerRelatorio} />
      <div className="two">
        <div className="stack g16">
          {aba === "resumo" && (
            <>
              {os.em_papel && <ExecucaoEmPapel papel={os.em_papel} />}
              <DadosSap os={os} />
              <CicloDaOs osId={os.id} preventiva={os.tipo === "preventiva"} gestao estilo="panel" />
              <ChecklistDaOsCard perguntas={checklist} />
              <MateriaisCard servico={servico ?? null} colaboracao={colaboracao} />
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
          {aba === "relatorio" && <RelatorioDaExecucao os={os} aprs={aprs} execucoes={execucoes} />}
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
          {podeReservar && <AtribuicaoDaOs osId={os.id} responsavel={os.responsavel ? { id: os.responsavel.id, nome: os.responsavel.nome } : null} colegas={colegas} />}
          {podeDevolver && <DevolverOs osId={os.id} />}
          {admin && <BotaoCritico localId={os.local_instalacao.id} critico={os.local_instalacao.critico} />}
          <DocumentoOs os={os} podeVerRelatorio={podeVerRelatorio} />
          <CienciaSupervisor os={os} podeDarCiencia={supervisaEquipeDaOs && !ausente} />
          <BaixaSap os={os} podeExportar={admin} />
        </aside>
      </div>
      <AtualizacaoAutomatica />
    </Screen>
  );
}
