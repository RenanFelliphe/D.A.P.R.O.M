import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dadosDaInspecao, faltaObservacao } from "@shared/api/checklist-inspecao";
import { comoEvidencia, pdfComoEvidencia } from "@shared/api/evidencias";
import { complementoDoMotivo, faltaNoMotivo, MOTIVOS_DA_PAUSA, MOTIVOS_DA_SUSPENSAO } from "@shared/api/execucao-motivos";
import { contagemDoPedido, pedeAprovacaoDoResponsavel, pedidoAberto, quemEncerrou, restanteDoPedido, type PedidoDaApi } from "@shared/api/execucao-pedidos";
import { definirSituacao, participaDaExecucao } from "@shared/api/execucao-situacao";
import { calcularTempo, cronometro, horasMinutos, type AprDaApi, type ExecucaoAberta, type ExecucaoDaApi, type ParticipanteDaApr } from "@shared/api/execucao-tempo";
import { arredondarPosicao, comPosicao } from "@shared/api/localizacao";
import { comLimiteDeTempo } from "../src/campo/tempo-limite";
import { intervaloDaLeitura } from "../src/execucao/intervalo-da-leitura";
import { dataEHoraComoInstante, faltaNoFim, paraCampoDeData, paraCampoDeHora } from "../src/execucao/data-e-hora";
import { rotaDaAcao, rotas } from "../src/os/rotas";

const EU = "u-eu";
const COLEGA = "u-colega";
/** 12h em Brasília, segunda-feira. */
const agora = new Date("2026-10-19T15:00:00Z");
const hoje = "2026-10-19T13:00:00Z";
const ontem = "2026-10-18T13:00:00Z";

const participante = (usuario_id: string, extra: Partial<ParticipanteDaApr> = {}): ParticipanteDaApr => ({
  usuario_id,
  nome: usuario_id === EU ? "Eu" : "Colega",
  matricula: "1",
  funcao: usuario_id === EU ? "responsavel" : "executor",
  assinatura_path: null,
  assinada_em: "2026-10-19T13:05:00Z",
  ...extra,
});

const apr = (id: string, extra: Partial<AprDaApi> = {}): AprDaApi => ({ id, resultado: "aprovada", concluida_em: hoje, participantes: [participante(EU), participante(COLEGA)], ...extra });

const execucao = (extra: Partial<ExecucaoDaApi> = {}): ExecucaoDaApi => ({
  id: "ex-1",
  apr_id: "apr-1",
  executor: { id: EU, nome: "Eu", matricula: "1" },
  numero_pessoas: 2,
  inicio: hoje,
  fim: null,
  resultado: null,
  pausas: [],
  ...extra,
});

const aberta = (extra: Partial<ExecucaoAberta> = {}): ExecucaoAberta => ({ id: "ex-1", os_id: "os-1", apr_id: "apr-1", inicio: hoje, numero_ordem: "4031187", titulo: "Trocar a bomba", ...extra });

const situacao = (entrada: Partial<Parameters<typeof definirSituacao>[0]> = {}) =>
  definirSituacao({ osStatus: "liberada", usuarioId: EU, execucoes: [], aprs: [], abertas: [], agora, reservadaPara: null, ...entrada });

describe("situação da execução (a mesma regra da web)", () => {
  it("sem APR de hoje, pede a APR", () => {
    assert.equal(situacao().tipo, "sem_apr");
    assert.equal(situacao({ aprs: [apr("apr-1", { concluida_em: ontem })] }).tipo, "sem_apr", "a APR vale só no dia");
    assert.equal(situacao({ aprs: [apr("apr-1", { resultado: "bloqueada" })] }).tipo, "sem_apr");
  });

  it("APR assinada por todos libera iniciar; faltando assinatura, espera por ela e diz quem falta", () => {
    assert.equal(situacao({ aprs: [apr("apr-1")] }).tipo, "iniciar");
    const faltando = situacao({ aprs: [apr("apr-1", { participantes: [participante(EU), participante(COLEGA, { assinada_em: null })] })] });
    assert.equal(faltando.tipo, "aguardando_assinaturas");
    if (faltando.tipo === "aguardando_assinaturas") {
      assert.deepEqual(faltando.faltam, ["Colega"]);
      assert.equal(faltando.euFalto, false);
    }
    const euFalto = situacao({ aprs: [apr("apr-1", { participantes: [participante(EU, { assinada_em: null }), participante(COLEGA)] })] });
    assert.equal(euFalto.tipo === "aguardando_assinaturas" && euFalto.euFalto, true);
  });

  it("a APR usada por uma execução não serve de novo, mas a da execução cancelada volta a servir", () => {
    const usada = situacao({ aprs: [apr("apr-1")], execucoes: [execucao({ resultado: "suspensa", fim: "2026-10-19T14:00:00Z" })], osStatus: "pendente" });
    assert.equal(usada.tipo, "sem_apr");
    const cancelada = situacao({ aprs: [apr("apr-1")], execucoes: [execucao({ resultado: "cancelada", fim: "2026-10-19T13:05:00Z" })] });
    assert.equal(cancelada.tipo, "iniciar");
  });

  it("a APR que o responsável recusou, ou que ficou com menos de 2 pessoas, não serve", () => {
    const recusou = apr("apr-1", { participantes: [participante(EU, { recusou_em: hoje }), participante(COLEGA)] });
    assert.equal(situacao({ aprs: [recusou] }).tipo, "sem_apr");
  });

  it("execução minha em andamento, com as pausas e os participantes da APR", () => {
    const s = situacao({ osStatus: "em_execucao", execucoes: [execucao()], aprs: [apr("apr-1")] });
    assert.equal(s.tipo, "em_andamento");
    if (s.tipo === "em_andamento") assert.equal(s.participantes.length, 2);
  });

  it("execução de outro dia (em qualquer OS) obriga a suspendê-la antes de tudo", () => {
    const s = situacao({ abertas: [aberta({ inicio: ontem })], osStatus: "em_execucao", execucoes: [execucao({ inicio: ontem })] });
    assert.equal(s.tipo, "esquecida");
  });

  it("encerrando: o responsável volta ao preenchimento; os demais esperam por ele", () => {
    const parada = execucao({ resultado: "encerrada", fim: "2026-10-19T14:00:00Z", encerramento_assinado_em: null });
    assert.equal(situacao({ osStatus: "encerrando", execucoes: [parada] }).tipo, "encerrando");
    const deOutro = situacao({ osStatus: "encerrando", usuarioId: COLEGA, execucoes: [parada] });
    assert.equal(deOutro.tipo, "outra_pessoa");
    if (deOutro.tipo === "outra_pessoa") assert.equal(deOutro.encerrando, true);
  });

  it("participante da APR acompanha a execução de outra pessoa, com as pausas e os participantes; quem não participa só vê o aviso", () => {
    const deColega = execucao({ executor: { id: COLEGA, nome: "Colega", matricula: "2" }, pausas: [{ id: "p1", inicio: "2026-10-19T13:30:00Z", fim: null, motivo: "almoco" }] });
    const s = situacao({ osStatus: "em_execucao", execucoes: [deColega], aprs: [apr("apr-1")] });
    assert.equal(s.tipo, "acompanhando");
    if (s.tipo === "acompanhando") {
      assert.equal(s.execucao.id, "ex-1");
      assert.equal(s.execucao.pausas.length, 1);
      assert.deepEqual(s.participantes.map((p) => p.usuario_id), [EU, COLEGA]);
    }
    const forasteiro = situacao({ osStatus: "em_execucao", usuarioId: "u-forasteiro", execucoes: [deColega], aprs: [apr("apr-1")] });
    assert.equal(forasteiro.tipo, "outra_pessoa");
    const recusou = situacao({ osStatus: "em_execucao", execucoes: [deColega], aprs: [apr("apr-1", { participantes: [participante(EU, { recusou_em: hoje }), participante(COLEGA)] })] });
    assert.equal(recusou.tipo, "outra_pessoa", "quem recusou a APR saiu dela e não acompanha");
    assert.equal(situacao({ osStatus: "em_execucao", execucoes: [deColega], aprs: [] }).tipo, "outra_pessoa", "sem a APR na cópia, não dá para saber se participa");
  });

  it("a execução que eu iniciei continua em andamento, e o encerramento de outra pessoa continua sendo só espera", () => {
    assert.equal(situacao({ osStatus: "em_execucao", execucoes: [execucao()], aprs: [apr("apr-1")] }).tipo, "em_andamento");
    const parada = execucao({ executor: { id: COLEGA, nome: "Colega", matricula: "2" }, resultado: "encerrada", fim: "2026-10-19T14:00:00Z", encerramento_assinado_em: null });
    assert.equal(situacao({ osStatus: "encerrando", execucoes: [parada], aprs: [apr("apr-1")] }).tipo, "outra_pessoa");
  });

  it("participaDaExecucao: só quem está na APR e não recusou", () => {
    const aprs = [apr("apr-1", { participantes: [participante(EU), participante(COLEGA, { recusou_em: hoje })] })];
    assert.equal(participaDaExecucao({ apr_id: "apr-1" }, aprs, EU), true);
    assert.equal(participaDaExecucao({ apr_id: "apr-1" }, aprs, COLEGA), false);
    assert.equal(participaDaExecucao({ apr_id: "apr-1" }, aprs, "u-forasteiro"), false);
    assert.equal(participaDaExecucao({ apr_id: "apr-2" }, aprs, EU), false);
  });

  it("execução de outra pessoa, OS terminada, cancelada, devolvida e reservada", () => {
    assert.equal(situacao({ osStatus: "em_execucao", execucoes: [execucao({ executor: { id: COLEGA, nome: "Colega", matricula: "2" } })] }).tipo, "outra_pessoa");
    assert.deepEqual(situacao({ osStatus: "aguardando_supervisor" }), { tipo: "terminada", status: "aguardando_supervisor" });
    assert.deepEqual(situacao({ osStatus: "encerrada" }), { tipo: "terminada", status: "encerrada" });
    assert.equal(situacao({ osStatus: "cancelada" }).tipo, "fechada");
    assert.equal(situacao({ osStatus: "devolvida" }).tipo, "devolvida");
    assert.deepEqual(situacao({ reservadaPara: { id: COLEGA, nome: "Colega" } }), { tipo: "reservada", responsavel: "Colega" });
    assert.equal(situacao({ reservadaPara: { id: EU, nome: "Eu" } }).tipo, "sem_apr", "quem tem a OS reservada para si segue o fluxo normal");
  });
});

describe("execução compartilhada: quem encerrou assina, e o pedido ao responsável", () => {
  const doColega = { id: COLEGA, nome: "Colega" };
  const parada = (extra: Partial<ExecucaoDaApi> = {}) => execucao({ resultado: "encerrada", fim: "2026-10-19T14:00:00Z", encerramento_assinado_em: null, ...extra });

  it("o encerramento é de quem encerrou: o participante que encerrou preenche e assina; o responsável só espera", () => {
    const porColega = parada({ finalizada_por: doColega });
    assert.deepEqual(quemEncerrou(porColega), doColega);
    assert.equal(situacao({ osStatus: "encerrando", usuarioId: COLEGA, execucoes: [porColega], aprs: [apr("apr-1")] }).tipo, "encerrando");
    const doResponsavel = situacao({ osStatus: "encerrando", usuarioId: EU, execucoes: [porColega], aprs: [apr("apr-1")] });
    assert.equal(doResponsavel.tipo, "outra_pessoa");
    if (doResponsavel.tipo === "outra_pessoa") assert.deepEqual([doResponsavel.executor, doResponsavel.encerrando], ["Colega", true]);
    // Sem `finalizada_por` (execução anterior à funcionalidade), vale o responsável.
    assert.deepEqual(quemEncerrou(parada()), { id: EU, nome: "Eu", matricula: "1" });
    assert.equal(situacao({ osStatus: "encerrando", execucoes: [parada()], aprs: [apr("apr-1")] }).tipo, "encerrando");
  });

  it("o que o participante faz na hora e o que pede: só encerrar e suspender por motivo comum pedem a aprovação", () => {
    assert.equal(pedeAprovacaoDoResponsavel("encerrar"), true);
    assert.equal(pedeAprovacaoDoResponsavel("suspender", "fim_expediente"), true);
    assert.equal(pedeAprovacaoDoResponsavel("suspender", "lesao"), false, "a saúde não espera");
    assert.equal(pedeAprovacaoDoResponsavel("suspender", "enfermidade"), false);
    for (const acao of ["pausar", "continuar", "interromper", "cancelar"] as const) assert.equal(pedeAprovacaoDoResponsavel(acao, "almoco"), false);
  });

  it("a contagem dos 2 minutos usa o que a api mediu, menos o tempo que passou no aparelho (o relógio dele não conta)", () => {
    const pedido: PedidoDaApi = { id: "p1", tipo: "encerrar", estado: "aberto", solicitante: doColega, instante: hoje, motivo: null, complemento: null, criado_em: hoje, expira_em: hoje, decidido_em: null, decidido_por: null, motivo_recusa: null, apoios: [], restante_ms: 120_000 };
    assert.equal(restanteDoPedido(pedido, 1_000_000, 1_000_000), 120_000);
    assert.equal(restanteDoPedido(pedido, 1_000_000, 1_042_000), 78_000);
    assert.equal(restanteDoPedido(pedido, 1_000_000, 1_500_000), 0, "nunca negativa");
    assert.equal(restanteDoPedido(pedido, 1_000_000, 900_000), 120_000, "relógio que voltou não aumenta o prazo");
    assert.equal(contagemDoPedido(120_000), "2:00");
    assert.equal(contagemDoPedido(102_400), "1:43");
    assert.equal(contagemDoPedido(0), "0:00");
    assert.equal(pedidoAberto({ pedidos: [{ ...pedido, estado: "recusado" }, pedido] })?.id, "p1");
    assert.equal(pedidoAberto({ pedidos: [{ ...pedido, estado: "aprovado_por_prazo" }] }), null);
    assert.equal(pedidoAberto({}), null);
  });

  it("a execução é relida mais depressa quando há pedido aberto, a cada 5 s para o responsável e a cada 10 s para quem acompanha", () => {
    const pedido = { id: "p1", estado: "aberto" } as PedidoDaApi;
    const minha = execucao();
    const deColega = execucao({ executor: { id: COLEGA, nome: "Colega", matricula: "2" } });
    assert.equal(intervaloDaLeitura([minha], EU), 5_000);
    assert.equal(intervaloDaLeitura([deColega], EU), 10_000);
    assert.equal(intervaloDaLeitura([{ ...deColega, pedidos: [pedido] }], EU), 3_000);
    assert.equal(intervaloDaLeitura([{ ...minha, pedidos: [pedido] }], EU), 3_000);
    assert.equal(intervaloDaLeitura([parada()], EU), false, "a execução terminada e assinada pelo próprio responsável não pede releitura");
    assert.equal(intervaloDaLeitura([parada({ executor: { id: COLEGA, nome: "Colega", matricula: "2" } })], EU), 10_000, "o encerramento de outra pessoa em preenchimento ainda muda");
    assert.equal(intervaloDaLeitura([], EU), false);
  });
});

describe("cronômetro", () => {
  it("o tempo líquido é o total menos as pausas, calculado do início (não depende do app aberto)", () => {
    const inicio = "2026-10-19T12:00:00Z";
    const pausas = [{ id: "p1", inicio: "2026-10-19T12:30:00Z", fim: "2026-10-19T12:45:00Z", motivo: "almoco" as const }];
    const t = calcularTempo(inicio, pausas, new Date("2026-10-19T13:00:00Z").getTime());
    assert.equal(t.totalMs, 3600_000);
    assert.equal(t.pausaMs, 900_000);
    assert.equal(t.liquidoMs, 2700_000);
    assert.equal(t.emPausa, false);
  });

  it("a pausa aberta vale até agora e o cronômetro congela o líquido", () => {
    const inicio = "2026-10-19T12:00:00Z";
    const pausas = [{ id: "p1", inicio: "2026-10-19T12:30:00Z", fim: null, motivo: "descanso" as const }];
    const as1300 = calcularTempo(inicio, pausas, new Date("2026-10-19T13:00:00Z").getTime());
    const as1400 = calcularTempo(inicio, pausas, new Date("2026-10-19T14:00:00Z").getTime());
    assert.equal(as1300.emPausa, true);
    assert.equal(as1300.liquidoMs, 1800_000);
    assert.equal(as1400.liquidoMs, 1800_000);
  });

  it("formata h:mm:ss e 1h07", () => {
    assert.equal(cronometro(4029_000), "1:07:09");
    assert.equal(cronometro(0), "0:00:00");
    assert.equal(horasMinutos(4020_000), "1h07");
  });
});

describe("motivos da pausa e da suspensão", () => {
  const valores = (motivo: string, complemento = "") => ({ motivo, complemento });

  it("sem motivo, diz qual falta; aguardando e outro exigem o complemento; lesão e enfermidade o têm opcional", () => {
    assert.deepEqual(faltaNoMotivo(MOTIVOS_DA_PAUSA, "da pausa", valores("")), { campo: "motivo", mensagem: "Escolha o motivo da pausa." });
    assert.equal(faltaNoMotivo(MOTIVOS_DA_PAUSA, "da pausa", valores("aguardando"))?.campo, "complemento");
    assert.deepEqual(faltaNoMotivo(MOTIVOS_DA_PAUSA, "da pausa", valores("aguardando", "  ")), faltaNoMotivo(MOTIVOS_DA_PAUSA, "da pausa", valores("aguardando")));
    assert.equal(faltaNoMotivo(MOTIVOS_DA_PAUSA, "da pausa", valores("aguardando", "peça")), null);
    assert.equal(faltaNoMotivo(MOTIVOS_DA_SUSPENSAO, "da suspensão", valores("outro"))?.campo, "complemento");
    assert.equal(faltaNoMotivo(MOTIVOS_DA_SUSPENSAO, "da suspensão", valores("lesao")), null);
    assert.equal(faltaNoMotivo(MOTIVOS_DA_PAUSA, "da pausa", valores("almoco")), null);
  });

  it("o complemento só vai no evento quando o motivo o abre (e o opcional, só se foi escrito)", () => {
    assert.deepEqual(complementoDoMotivo(MOTIVOS_DA_PAUSA, valores("almoco", "ignorado")), {});
    assert.deepEqual(complementoDoMotivo(MOTIVOS_DA_PAUSA, valores("aguardando", " peça do almoxarifado ")), { complemento: "peça do almoxarifado" });
    assert.deepEqual(complementoDoMotivo(MOTIVOS_DA_PAUSA, valores("lesao", "")), {});
    assert.deepEqual(complementoDoMotivo(MOTIVOS_DA_PAUSA, valores("lesao", "cortou a mão")), { complemento: "cortou a mão" });
  });
});

describe("evidências do evento", () => {
  it("a foto leva o id da evidência, o arquivo, a hora e, se houver, a posição", () => {
    assert.deepEqual(comoEvidencia({ id: "e1", arquivoId: "a1", previa: "file:///f.jpg", capturadaEm: "2026-10-19T12:00:00Z" }), { id: "e1", arquivo_id: "a1", capturada_em: "2026-10-19T12:00:00Z" });
    assert.deepEqual(comoEvidencia({ id: "e1", arquivoId: "a1", previa: "x", capturadaEm: "2026-10-19T12:00:00Z", latitude: -23.5, longitude: -46.6 }), {
      id: "e1",
      arquivo_id: "a1",
      capturada_em: "2026-10-19T12:00:00Z",
      latitude: -23.5,
      longitude: -46.6,
    });
  });

  it("o PDF leva o tipo e o nome do arquivo", () => {
    assert.deepEqual(pdfComoEvidencia({ id: "e2", arquivoId: "a2", nome: "laudo.pdf", capturadaEm: "2026-10-19T12:00:00Z" }), { id: "e2", arquivo_id: "a2", tipo: "pdf", nome: "laudo.pdf", capturada_em: "2026-10-19T12:00:00Z" });
  });
});

describe("checklist de inspeção", () => {
  const perguntas = [
    { id: "p1", texto: "Válvula sem vazamento?" },
    { id: "p2", texto: "Manômetro calibrado?" },
  ];

  it("a pergunta não marcada pede observação; a marcada não", () => {
    assert.equal(faltaObservacao(undefined), true);
    assert.equal(faltaObservacao({ marcado: false, observacao: "  " }), true);
    assert.equal(faltaObservacao({ marcado: false, observacao: "vazando" }), false);
    assert.equal(faltaObservacao({ marcado: true, observacao: "" }), false);
  });

  it("monta uma resposta por pergunta pelo id, com a observação aparada ou nula", () => {
    assert.deepEqual(dadosDaInspecao(perguntas, { p1: { marcado: true, observacao: "" }, p2: { marcado: false, observacao: " folga na rosca " } }), {
      itens: [
        { pergunta_id: "p1", marcado: true, observacao: null },
        { pergunta_id: "p2", marcado: false, observacao: "folga na rosca" },
      ],
    });
    assert.deepEqual(dadosDaInspecao(perguntas, {}).itens.map((i) => i.marcado), [false, false], "a pergunta sem resposta vai como não marcada");
  });
});

describe("localização", () => {
  it("sem posição o evento segue sem coordenadas; com posição leva as duas", () => {
    assert.deepEqual(comPosicao(null), {});
    assert.deepEqual(comPosicao({ latitude: -23.5, longitude: -46.6 }), { latitude: -23.5, longitude: -46.6 });
  });

  it("arredonda para seis casas", () => {
    assert.deepEqual(arredondarPosicao({ latitude: -23.55052012345, longitude: -46.63330898765 }), { latitude: -23.55052, longitude: -46.633309 });
  });

  it("comLimiteDeTempo devolve o padrão quando passa do tempo ou falha, e o valor quando chega a tempo", async () => {
    assert.equal(await comLimiteDeTempo(new Promise<number>((r) => setTimeout(() => r(1), 200)), 20, 0), 0);
    assert.equal(await comLimiteDeTempo(Promise.resolve(7), 200, 0), 7);
    assert.equal(await comLimiteDeTempo(Promise.reject(new Error("gps desligado")), 200, 5), 5);
  });
});

describe("hora real do fim da execução esquecida", () => {
  it("lê dd/mm/aaaa e hh:mm e recusa o que não existe", () => {
    const d = dataEHoraComoInstante("18/10/2026", "17:30");
    assert.ok(d);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 9);
    assert.equal(d.getDate(), 18);
    assert.equal(d.getHours(), 17);
    assert.equal(d.getMinutes(), 30);
    assert.equal(dataEHoraComoInstante("31/02/2026", "10:00"), null);
    assert.equal(dataEHoraComoInstante("18/10/2026", "25:00"), null);
    assert.equal(dataEHoraComoInstante("18-10-2026", "10:00"), null);
    assert.equal(dataEHoraComoInstante("", ""), null);
  });

  it("ida e volta com os campos", () => {
    const d = new Date(2026, 9, 5, 7, 4);
    assert.equal(paraCampoDeData(d), "05/10/2026");
    assert.equal(paraCampoDeHora(d), "07:04");
    assert.equal(dataEHoraComoInstante(paraCampoDeData(d), paraCampoDeHora(d))?.getTime(), d.getTime());
  });

  it("o fim tem de existir, ser depois do início e não estar no futuro", () => {
    const inicio = new Date(2026, 9, 18, 8, 0);
    const agoraLocal = new Date(2026, 9, 19, 9, 0);
    assert.equal(faltaNoFim("18/10/2026", "17:00", inicio, agoraLocal), null);
    assert.match(faltaNoFim("", "", inicio, agoraLocal)!, /Informe a data/);
    assert.match(faltaNoFim("18/10/2026", "07:00", inicio, agoraLocal)!, /depois do início/);
    assert.match(faltaNoFim("19/10/2026", "12:00", inicio, agoraLocal)!, /futuro/);
  });
});

describe("rotas das telas de campo", () => {
  it("cada botão do detalhe da OS leva à tela da situação", () => {
    assert.equal(rotaDaAcao("iniciar-apr", "os-1"), "/os/os-1/apr");
    assert.equal(rotaDaAcao("assinar-apr", "os-1"), "/os/os-1/aprovada");
    assert.equal(rotaDaAcao("acompanhar-assinaturas", "os-1"), "/os/os-1/aprovada");
    assert.equal(rotaDaAcao("iniciar-execucao", "os-1"), "/os/os-1/execucao");
    assert.equal(rotaDaAcao("continuar-execucao", "os-1"), "/os/os-1/execucao");
    assert.equal(rotaDaAcao("preencher-encerramento", "os-1"), "/os/os-1/execucao");
    assert.equal(rotas.checklist("os-1"), "/os/os-1/checklist");
    assert.equal(rotas.bloqueio("os-1"), "/os/os-1/bloqueio");
  });
});
