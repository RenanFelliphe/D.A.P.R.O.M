import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ConferenciaDaOs } from "@shared/api/conferencia-execucao";
import type { AprDaOs, ExecucaoDaOs, OsDetalhada, ParticipanteDaApr } from "@shared/api/os-app";
import type { OsStatus } from "@shared/api/tipos";
import { decidirAcao } from "../src/os/detalhe/acao";

const EU = "u-eu";
const COLEGA = "u-colega";
const agora = new Date().toISOString();
const ontem = new Date(Date.now() - 30 * 3600_000).toISOString();

function os(status: OsStatus, extra: Partial<OsDetalhada> = {}): OsDetalhada {
  return {
    id: "os-1",
    numero_ordem: "4031187",
    numero_nota: null,
    tipo: "corretiva",
    tipo_atividade: null,
    codigo_atividade: null,
    titulo: "Trocar a bomba",
    descricao: null,
    equipamento: null,
    plano_manutencao: null,
    item_manutencao: null,
    prioridade: null,
    data_inicio_prog: "2026-10-19",
    data_fim_prog: null,
    status,
    status_sap: null,
    equipe_id: "e1",
    local_instalacao: { id: "l1", codigo: "ETA-01", critico: false },
    equipe: { id: "e1", nome: "Equipe A", centro_trabalho: "CT1", supervisor_id: null },
    justificativa_cancelamento: null,
    pdf_pronto: false,
    ...extra,
  };
}

const participante = (usuario_id: string, extra: Partial<ParticipanteDaApr> = {}): ParticipanteDaApr => ({
  usuario_id,
  nome: usuario_id === EU ? "Eu Mesmo" : "Colega Silva",
  matricula: "1",
  funcao: usuario_id === EU ? "responsavel" : "executor",
  assinatura_path: null,
  assinada_em: null,
  ...extra,
});

function apr(participantes: ParticipanteDaApr[], extra: Partial<AprDaOs> = {}): AprDaOs {
  return {
    id: "apr-1",
    os_id: "os-1",
    resultado: "aprovada",
    observacao_geral: null,
    concluida_em: agora,
    preenchida_por: { id: COLEGA, nome: "Colega Silva" },
    modelo: { codigo: "APR-01", versao: 1, titulo: "Geral" },
    participantes,
    respostas: [],
    itens_reprovados: [],
    ...extra,
  };
}

const execucao = (executor: string, extra: Partial<ExecucaoDaOs> = {}): ExecucaoDaOs => ({
  id: "ex-1",
  apr_id: "apr-1",
  executor: { id: executor, nome: executor === EU ? "Eu Mesmo" : "Colega Silva", matricula: "1" },
  inicio: agora,
  fim: null,
  resultado: null,
  ...extra,
});

const decidir = (o: OsDetalhada, aprs: AprDaOs[] = [], execucoes: ExecucaoDaOs[] = [], ausencia: string | null = null, conferencias?: ConferenciaDaOs[]) => decidirAcao({ os: o, usuarioId: EU, aprs, execucoes, ausencia, conferencias });
const botoes = (d: ReturnType<typeof decidir>) => d.botoes.map((b) => `${b.acao}:${b.titulo}:${b.variante}`);

describe("botão de ação do detalhe da OS, por situação", () => {
  it("liberada sem APR: Nova APR, com a nota de que a execução só vem depois da APR assinada", () => {
    const d = decidir(os("liberada"));
    assert.deepEqual(botoes(d), ["iniciar-apr:Nova APR:primario"]);
    assert.match(d.nota ?? "", /só é liberada depois da APR aprovada e assinada por todos/);
  });

  it("pendente (APR bloqueada antes): Retomar com APR nova", () => {
    assert.deepEqual(botoes(decidir(os("pendente"), [apr([participante(EU)], { resultado: "bloqueada" })])), ["iniciar-apr:Retomar com APR nova:primario"]);
  });

  it("reservada para outra pessoa: sem botão, com o motivo; reservada para mim: Nova APR", () => {
    const outra = decidir(os("liberada", { responsavel: { id: COLEGA, nome: "Colega Silva", reservada_por_nome: "Sup", reservada_em: agora } }));
    assert.deepEqual(outra.botoes, []);
    assert.match(outra.avisos[0]!.titulo ?? "", /OS reservada para Colega Silva/);
    const minha = decidir(os("liberada", { responsavel: { id: EU, nome: "Eu Mesmo", reservada_por_nome: "Sup", reservada_em: agora } }));
    assert.deepEqual(botoes(minha), ["iniciar-apr:Nova APR:primario"]);
  });

  it("APR aprovada hoje em que ainda não assinei: Assinar a APR (e nova APR como segunda opção)", () => {
    const d = decidir(os("liberada"), [apr([participante(EU), participante(COLEGA, { assinada_em: agora })])]);
    assert.deepEqual(botoes(d), ["assinar-apr:Assinar a APR:primario", "iniciar-apr:Fazer uma nova APR:secundario"]);
    assert.match(d.avisos[0]!.titulo ?? "", /aguardando a sua assinatura/);
  });

  it("eu já assinei e faltam outros: Acompanhar as assinaturas, dizendo quem falta", () => {
    const d = decidir(os("liberada"), [apr([participante(EU, { assinada_em: agora }), participante(COLEGA)])]);
    assert.deepEqual(botoes(d), ["acompanhar-assinaturas:Acompanhar as assinaturas:primario", "iniciar-apr:Fazer uma nova APR:secundario"]);
    assert.match(d.avisos[0]!.texto, /Falta assinar: Colega Silva/);
  });

  it("todos assinaram: Iniciar a execução", () => {
    const d = decidir(os("liberada"), [apr([participante(EU, { assinada_em: agora }), participante(COLEGA, { assinada_em: agora })])]);
    assert.deepEqual(botoes(d), ["iniciar-execucao:Iniciar a execução:primario", "iniciar-apr:Fazer uma nova APR:secundario"]);
    assert.equal(d.avisos[0]!.tom, "ok");
  });

  it("APR de hoje de outras pessoas (eu não participo): explica e oferece só a Nova APR", () => {
    const d = decidir(os("liberada"), [apr([participante(COLEGA, { funcao: "responsavel" }), participante("u-outro")])]);
    assert.deepEqual(botoes(d), ["iniciar-apr:Nova APR:primario"]);
    assert.match(d.avisos[0]!.texto, /Só os participantes dela/);
  });

  it("APR que deixou de servir (o responsável recusou): aviso vermelho e Nova APR", () => {
    const d = decidir(os("liberada"), [apr([participante(EU, { funcao: "executor" }), participante(COLEGA, { funcao: "responsavel", recusou_em: agora, recusa_motivo: "x" })])]);
    assert.equal(d.avisos[0]!.tom, "blq");
    assert.match(d.avisos[0]!.titulo ?? "", /não serve mais/);
    assert.deepEqual(botoes(d), ["iniciar-apr:Nova APR:primario"]);
  });

  it("APR de outro dia não vale: volta a ser Nova APR", () => {
    assert.deepEqual(botoes(decidir(os("liberada"), [apr([participante(EU, { assinada_em: ontem }), participante(COLEGA, { assinada_em: ontem })], { concluida_em: ontem })])), ["iniciar-apr:Nova APR:primario"]);
  });

  it("em execução por mim: Continuar a execução; por outra pessoa: só o aviso", () => {
    assert.deepEqual(botoes(decidir(os("em_execucao"), [], [execucao(EU)])), ["continuar-execucao:Continuar a execução:primario"]);
    const outro = decidir(os("em_execucao"), [], [execucao(COLEGA)]);
    assert.deepEqual(outro.botoes, []);
    assert.match(outro.avisos[0]!.texto, /por Colega Silva/);
  });

  it("em execução por outra pessoa, mas eu participo da APR dela: Acompanhar a execução", () => {
    const aprDaExecucao = apr([participante(EU, { assinada_em: agora }), participante(COLEGA, { assinada_em: agora })]);
    const d = decidir(os("em_execucao"), [aprDaExecucao], [execucao(COLEGA)]);
    assert.deepEqual(botoes(d), ["acompanhar-execucao:Acompanhar a execução:primario"]);
    const recusei = decidir(os("em_execucao"), [apr([participante(EU, { recusou_em: agora }), participante(COLEGA, { assinada_em: agora })])], [execucao(COLEGA)]);
    assert.deepEqual(recusei.botoes, [], "quem recusou a APR não acompanha");
  });

  it("encerrando: quem executou preenche e assina; os demais só veem o aviso", () => {
    const meu = decidir(os("encerrando"), [], [execucao(EU, { resultado: "encerrada", fim: agora, encerramento_assinado_em: null })]);
    assert.deepEqual(botoes(meu), ["preencher-encerramento:Preencher e assinar o encerramento:primario"]);
    const deOutro = decidir(os("encerrando"), [], [execucao(COLEGA, { resultado: "encerrada", fim: agora, encerramento_assinado_em: null })]);
    assert.deepEqual(deOutro.botoes, []);
    assert.match(deOutro.avisos[0]!.titulo ?? "", /Colega Silva encerrou a OS/);
  });

  it("aguardando o supervisor: só o aviso", () => {
    const d = decidir(os("aguardando_supervisor"));
    assert.deepEqual(d.botoes, []);
    assert.match(d.avisos[0]!.texto, /supervisor ler o relatório/);
  });

  it("encerrada: Abrir o PDF quando pronto; sem PDF, o aviso de que está sendo gerado", () => {
    assert.deepEqual(botoes(decidir(os("encerrada", { pdf_pronto: true }))), ["abrir-pdf:Abrir o PDF da OS:primario"]);
    const sem = decidir(os("encerrada", { pdf_pronto: false }));
    assert.deepEqual(sem.botoes, []);
    assert.match(sem.avisos[0]!.texto, /ainda está sendo gerado/);
    assert.equal(sem.nota, "OS concluída: só consulta.");
  });

  it("cancelada e devolvida: só consulta, com a justificativa", () => {
    const c = decidir(os("cancelada", { justificativa_cancelamento: "Duplicada" }));
    assert.deepEqual(c.botoes, []);
    assert.equal(c.avisos[0]!.texto, "Duplicada");
    const dev = decidir(os("devolvida", { devolucao: { em: agora, por_nome: "Sup", justificativa: "Erro na ordem", exportada_em: null } }));
    assert.equal(dev.avisos[0]!.texto, "Erro na ordem");
    assert.equal(dev.nota, "OS devolvida ao SAP: só consulta.");
  });

  it("ausente: sem ação de campo nas OS em aberto, mas o PDF da encerrada continua", () => {
    const aberta = decidir(os("liberada"), [], [], "Ausente até 25/10/2026");
    assert.deepEqual(aberta.botoes, []);
    assert.match(aberta.avisos[0]!.titulo ?? "", /Ausente até 25\/10\/2026/);
    assert.deepEqual(botoes(decidir(os("encerrada", { pdf_pronto: true }), [], [], "Ausente até 25/10/2026")), ["abrir-pdf:Abrir o PDF da OS:primario"]);
  });

  describe("a conferência da execução na OS", () => {
    const conferencia = (extra: Partial<ConferenciaDaOs> = {}): ConferenciaDaOs => ({ id: "c-1", execucao_id: "ex-1", estado: "aguardando_responsavel", tipo: "com_divergencia", ...extra });

    it("OS sem conferência: nada muda", () => {
      assert.deepEqual(botoes(decidir(os("aguardando_supervisor"), [], [], null, [])), []);
      assert.equal(decidir(os("aguardando_supervisor"), [], [], null, undefined).avisos.length, 1);
    });

    it("conferência em aberto numa OS sem outra ação: o botão principal abre a conferência, com o estado no aviso", () => {
      const d = decidir(os("aguardando_supervisor"), [], [], null, [conferencia()]);
      assert.deepEqual(botoes(d), ["abrir-conferencia:Abrir a conferência da execução:primario"]);
      assert.equal(d.botoes[0]!.conferenciaId, "c-1");
      const aviso = d.avisos.at(-1)!;
      assert.equal(aviso.tom, "al");
      assert.match(aviso.titulo ?? "", /esperando a escolha do responsável/);
      assert.match(aviso.texto, /supervisor assina a OS por último/);
    });

    it("com outra ação na OS, a conferência vira o botão secundário e não tira o botão de campo", () => {
      const d = decidir(os("liberada"), [], [], null, [conferencia({ estado: "aguardando_sincronizacao", tipo: null })]);
      assert.deepEqual(botoes(d), ["iniciar-apr:Nova APR:primario", "abrir-conferencia:Abrir a conferência da execução:secundario"]);
      assert.match(d.avisos.at(-1)!.titulo ?? "", /esperando todos sincronizarem/);
    });

    it("conferência concluída ou fechada: só Ver, em tom de resultado", () => {
      const concluida = decidir(os("encerrada", { pdf_pronto: true }), [], [], null, [conferencia({ estado: "concluida" })]);
      assert.deepEqual(botoes(concluida), ["abrir-pdf:Abrir o PDF da OS:primario", "abrir-conferencia:Ver a conferência da execução:secundario"]);
      assert.equal(concluida.avisos.at(-1)!.tom, "ok");
      const fechada = decidir(os("encerrada", { pdf_pronto: true }), [], [], null, [conferencia({ estado: "fechada_sem_todos" })]);
      assert.equal(fechada.avisos.at(-1)!.tom, "info");
    });

    it("assinaturas do resumo: o aviso diz que falta a ciência; com divergência, a assinatura", () => {
      assert.match(decidir(os("aguardando_supervisor"), [], [], null, [conferencia({ estado: "aguardando_assinaturas", tipo: "resumo" })]).avisos.at(-1)!.texto, /ciência/);
      assert.match(decidir(os("aguardando_supervisor"), [], [], null, [conferencia({ estado: "aguardando_assinaturas" })]).avisos.at(-1)!.texto, /assinatura/);
    });

    it("duas conferências (uma por execução): o botão abre a que ainda anda, e as duas aparecem nos avisos", () => {
      const velha = conferencia({ id: "c-velha", estado: "aguardando_assinaturas" });
      const concluida = conferencia({ id: "c-nova", estado: "concluida" });
      const d = decidir(os("aguardando_supervisor"), [], [], null, [velha, concluida]);
      assert.equal(d.botoes.find((b) => b.acao === "abrir-conferencia")!.conferenciaId, "c-velha");
      assert.equal(d.avisos.length, 3);
    });

    it("o ausente também vê a conferência (só consulta), sem perder o aviso da ausência", () => {
      const d = decidir(os("liberada"), [], [], "Ausente até 25/10/2026", [conferencia()]);
      assert.match(d.avisos[0]!.titulo ?? "", /Ausente até/);
      assert.deepEqual(botoes(d), ["abrir-conferencia:Abrir a conferência da execução:primario"]);
    });
  });
});
