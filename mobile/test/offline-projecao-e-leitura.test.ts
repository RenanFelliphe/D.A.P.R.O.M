import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aprAprovadaDisponivel, execucaoAberta, situacaoDaApr } from "@shared/api/os-app";
import { definirSituacao } from "@shared/api/execucao-situacao";
import { substituirCopia } from "../src/offline/copia";
import { guardarEvento, type NovoEvento } from "../src/offline/fila";
import { criarLeitura, ErroSemCopia } from "../src/offline/leitura";
import { projetar, statusDerivado } from "../src/offline/projecao";
import type { EventoDaFila } from "../src/offline/tipos";
import { COLEGA, EU, MODELO, aprDe, execucaoDe, novoBancoDeTeste, osDe, snapshotDe, uuidDe } from "./ajuda-offline";

const AGORA = new Date("2026-10-19T15:00:00.000Z");
let contador = 0;

/** Um evento da fila como o aparelho o grava. */
function ev(tipo: string, osId: string, payload: Record<string, unknown>, ocorridoEm: string): EventoDaFila {
  contador++;
  return { seq: contador, id: uuidDe(900 + contador), usuarioId: EU, tipo, osId, payload, ocorridoEm, criadoEm: ocorridoEm, tentativas: 0, ultimoErro: null };
}
const comoNovo = ({ id, usuarioId, tipo, osId, payload, ocorridoEm, criadoEm }: EventoDaFila): NovoEvento => ({ id, usuarioId, tipo, osId, payload, ocorridoEm, criadoEm });

const O = osDe(1);
const APR = uuidDe(500);
const EXEC = uuidDe(600);
const PAUSA = uuidDe(700);

/** A APR feita sem sinal: todos os participantes presentes assinam no aparelho do responsável. */
const aprSemSinal = (osId = O.id) =>
  ev("apr_concluida", osId, {
    id: APR,
    modelo_apr_id: MODELO,
    participantes: [
      { usuario_id: EU, funcao: "responsavel" },
      { usuario_id: COLEGA, funcao: "executor" },
    ],
    assinatura_presencial: true,
    riscos: [],
    respostas: [{ item_id: "i1", resposta: "sim" }, { item_id: "i2", resposta: "nao" }],
    concluida_em: "2026-10-19T12:00:00.000Z",
  }, "2026-10-19T12:00:00.000Z");

const base = () => ({ os: O, aprs: [], execucoes: [] });

describe("a projeção das ações pendentes sobre a cópia", () => {
  it("sem evento pendente, devolve a cópia como veio", () => {
    const b = base();
    assert.equal(projetar(b, []), b);
    assert.equal(projetar(b, [ev("pausa_iniciada", uuidDe(2), {}, "2026-10-19T12:00:00.000Z")]), b, "evento de outra OS não conta");
  });

  it("a APR feita sem sinal fica 'aguardando validação', assinada por todos no aparelho, e a execução pode começar", () => {
    const p = projetar(base(), [aprSemSinal()]);
    const [apr] = p.aprs;
    assert.equal(apr!.resultado, "aprovada");
    assert.equal(apr!.aguardando_validacao, true);
    assert.equal(apr!.itens_respondidos, 2);
    assert.ok(apr!.participantes.every((x) => x.assinada_em === "2026-10-19T12:00:00.000Z" && x.assinatura_presencial));
    assert.equal(p.os.status, "liberada");
    assert.equal(situacaoDaApr({ participantes: apr!.participantes.map((x) => ({ ...x })) }).pronta, true);
  });

  it("a APR validada antes de ir para a fila vale o resultado que o servidor deu (bloqueada: pendente, sem assinaturas)", () => {
    const e = ev("apr_concluida", O.id, { id: APR, modelo_apr_id: MODELO, participantes: [{ usuario_id: EU, funcao: "responsavel" }, { usuario_id: COLEGA, funcao: "executor" }], resultado: "bloqueada", concluida_em: "2026-10-19T12:00:00.000Z" }, "2026-10-19T12:00:00.000Z");
    const p = projetar(base(), [e]);
    assert.equal(p.aprs[0]!.resultado, "bloqueada");
    assert.equal(p.os.status, "pendente");
    assert.ok(p.aprs[0]!.participantes.every((x) => !x.assinada_em));
  });

  it("segue o caminho inteiro: APR, execução, pausa, encerrar, assinar o encerramento, com o status de cada passo", () => {
    const eventos = [
      aprSemSinal(),
      ev("execucao_iniciada", O.id, { id: EXEC, apr_id: APR, numero_pessoas: 2, inicio: "2026-10-19T12:10:00.000Z", latitude: -20.3, longitude: -40.3 }, "2026-10-19T12:10:00.000Z"),
    ];
    let p = projetar(base(), eventos);
    assert.equal(p.os.status, "em_execucao");
    assert.deepEqual([p.execucoes[0]!.inicio_latitude, p.execucoes[0]!.numero_pessoas], [-20.3, 2]);

    eventos.push(ev("pausa_iniciada", O.id, { id: PAUSA, execucao_id: EXEC, inicio: "2026-10-19T12:30:00.000Z", motivo: "almoco" }, "2026-10-19T12:30:00.000Z"));
    p = projetar(base(), eventos);
    assert.equal(p.execucoes[0]!.pausas[0]!.fim, null);

    eventos.push(ev("pausa_encerrada", O.id, { pausa_id: PAUSA, fim: "2026-10-19T13:00:00.000Z" }, "2026-10-19T13:00:00.000Z"));
    p = projetar(base(), eventos);
    assert.equal(p.execucoes[0]!.pausas[0]!.fim, "2026-10-19T13:00:00.000Z");

    eventos.push(ev("execucao_encerrada", O.id, { execucao_id: EXEC, fim: "2026-10-19T14:00:00.000Z", latitude: -20.4, longitude: -40.4 }, "2026-10-19T14:00:00.000Z"));
    p = projetar(base(), eventos);
    assert.equal(p.os.status, "encerrando");
    assert.equal(p.execucoes[0]!.resultado, "encerrada");
    assert.equal(p.execucoes[0]!.fim_latitude, -20.4);

    eventos.push(ev("encerramento_assinado", O.id, { execucao_id: EXEC, descricao_atividade: "Feito" }, "2026-10-19T14:10:00.000Z"));
    p = projetar(base(), eventos);
    assert.equal(p.os.status, "aguardando_supervisor");
    assert.equal(p.execucoes[0]!.encerramento_assinado_em, "2026-10-19T14:10:00.000Z");
  });

  it("encerrar com a pausa aberta fecha a pausa no fim; suspender, interromper e cancelar mudam o status como a `api`", () => {
    const comeco = [aprSemSinal(), ev("execucao_iniciada", O.id, { id: EXEC, apr_id: APR, inicio: "2026-10-19T12:10:00.000Z" }, "2026-10-19T12:10:00.000Z"), ev("pausa_iniciada", O.id, { id: PAUSA, execucao_id: EXEC, inicio: "2026-10-19T12:30:00.000Z", motivo: "almoco" }, "2026-10-19T12:30:00.000Z")];
    const encerrada = projetar(base(), [...comeco, ev("execucao_encerrada", O.id, { execucao_id: EXEC, fim: "2026-10-19T13:00:00.000Z" }, "2026-10-19T13:00:00.000Z")]);
    assert.equal(encerrada.execucoes[0]!.pausas[0]!.fim, "2026-10-19T13:00:00.000Z");

    const suspensa = projetar(base(), [...comeco, ev("execucao_suspensa", O.id, { execucao_id: EXEC, fim: "2026-10-19T13:00:00.000Z", motivo: "clima", complemento: null }, "2026-10-19T13:00:00.000Z")]);
    assert.equal(suspensa.os.status, "pendente");
    assert.equal(suspensa.execucoes[0]!.suspensao_motivo, "clima");

    const interrompida = projetar(base(), [...comeco, ev("execucao_interrompida", O.id, { execucao_id: EXEC, fim: "2026-10-19T13:00:00.000Z", motivo: "Vazamento" }, "2026-10-19T13:00:00.000Z")]);
    assert.equal(interrompida.os.status, "pendente");
    assert.equal(interrompida.execucoes[0]!.motivo, "Vazamento");

    // Cancelar por engano devolve a OS ao status de antes (a APR volta a poder ser usada).
    const cancelada = projetar(base(), [...comeco, ev("execucao_cancelada", O.id, { execucao_id: EXEC }, "2026-10-19T12:40:00.000Z")]);
    assert.equal(cancelada.os.status, "liberada");
    assert.equal(cancelada.execucoes[0]!.resultado, "cancelada");
    const detalheDaApr = { id: APR, resultado: "aprovada", concluida_em: new Date().toISOString(), participantes: cancelada.aprs[0]!.participantes } as never;
    assert.equal(aprAprovadaDisponivel([detalheDaApr], [{ apr_id: APR, resultado: "cancelada" }] as never)?.id, APR, "a APR da execução cancelada volta a servir");
  });

  it("assinar e recusar a APR de um colega altera só a linha de quem age", () => {
    const b = { os: O, aprs: [aprDe(O.id, APR)], execucoes: [] };
    const assinada = projetar(b, [ev("apr_assinada", O.id, { apr_id: APR, assinada_em: "2026-10-19T12:05:00.000Z" }, "2026-10-19T12:05:00.000Z")]);
    assert.deepEqual(assinada.aprs[0]!.participantes.map((x) => [x.usuario_id, x.assinada_em]), [[EU, "2026-10-19T12:05:00.000Z"], [COLEGA, null]]);
    const recusada = projetar(b, [ev("apr_recusada", O.id, { apr_id: APR, motivo: "Falta EPI", recusada_em: "2026-10-19T12:06:00.000Z" }, "2026-10-19T12:06:00.000Z")]);
    assert.equal(recusada.aprs[0]!.participantes[0]!.recusou_em, "2026-10-19T12:06:00.000Z");
    assert.equal(recusada.aprs[0]!.participantes[0]!.recusa_motivo, "Falta EPI");
    // Quem já assinou não recusa, e quem já recusou não assina.
    const doisAtos = projetar(b, [ev("apr_assinada", O.id, { apr_id: APR }, "2026-10-19T12:05:00.000Z"), ev("apr_recusada", O.id, { apr_id: APR, motivo: "x" }, "2026-10-19T12:06:00.000Z")]);
    assert.equal(doisAtos.aprs[0]!.participantes[0]!.recusou_em, null);
  });

  it("é idempotente: se a cópia já traz o efeito do evento (o servidor o aplicou antes de a fila limpar), nada muda", () => {
    const eventos = [aprSemSinal(), ev("execucao_iniciada", O.id, { id: EXEC, apr_id: APR, inicio: "2026-10-19T12:10:00.000Z" }, "2026-10-19T12:10:00.000Z"), ev("pausa_iniciada", O.id, { id: PAUSA, execucao_id: EXEC, inicio: "2026-10-19T12:30:00.000Z", motivo: "almoco" }, "2026-10-19T12:30:00.000Z")];
    const unica = projetar(base(), eventos);
    const duas = projetar({ os: unica.os, aprs: unica.aprs, execucoes: unica.execucoes }, eventos);
    assert.deepEqual(duas, unica);
    assert.equal(duas.aprs.length, 1);
    assert.equal(duas.execucoes[0]!.pausas.length, 1);
  });

  it("o status derivado segue a regra da `api`: cancelada e devolvida ficam; execução cancelada não conta", () => {
    const sem = { ciencia_em: null };
    assert.equal(statusDerivado({ status: "cancelada", ...sem }, [], [{ resultado: null, encerramento_assinado_em: null }]), "cancelada");
    assert.equal(statusDerivado({ status: "devolvida", ...sem }, [], []), "devolvida");
    assert.equal(statusDerivado({ status: "liberada", ...sem }, [{ resultado: "bloqueada" }], []), "pendente");
    assert.equal(statusDerivado({ status: "liberada", ciencia_em: "2026-10-19T00:00:00.000Z" }, [], [{ resultado: "encerrada", encerramento_assinado_em: "x" }]), "encerrada");
    assert.equal(statusDerivado({ status: "pendente", ...sem }, [{ resultado: "bloqueada" }], [{ resultado: "cancelada", encerramento_assinado_em: null }]), "pendente");
  });
});

describe("a leitura local no formato da `api`", () => {
  async function comCopia() {
    const banco = await novoBancoDeTeste();
    const [a, b, c, d] = [
      osDe(1, { prioridade: "Baixo", numero_ordem: "4000001", titulo: "Troca de válvula", local_instalacao_id: osDe(1).local_instalacao_id }),
      osDe(2, { prioridade: "Muito alto", numero_ordem: "4000002", titulo: "Inspeção do regulador" }),
      osDe(3, { prioridade: "Alto", numero_ordem: "4000003", titulo: "Purga", status: "pendente", data_inicio_prog: "2026-10-10" }),
      osDe(4, { status: "em_execucao", responsavel_id: COLEGA, reservada_por: EU, numero_ordem: "4000004", titulo: "Medição" }),
    ] as const;
    await substituirCopia(banco, EU, snapshotDe([a, b, c, d], { aprs: [aprDe(d.id, APR)], execucoes: [execucaoDe(d.id, EXEC, APR)] }), new Set(), AGORA);
    const leitura = criarLeitura(banco, () => ({ id: EU, nome: "Tiago Técnico", matricula: "tec1" }), () => AGORA);
    return { banco, leitura, a, b, c, d };
  }

  it("sem cópia, diz que ainda não há dados; a cópia de outra pessoa também não vale", async () => {
    const banco = await novoBancoDeTeste();
    const leitura = criarLeitura(banco, () => ({ id: EU, nome: "Tiago", matricula: "t" }));
    await assert.rejects(leitura.lista({ status: "liberada", pagina: 1, tamanho: 20 }), ErroSemCopia);
    await substituirCopia(banco, COLEGA, snapshotDe([osDe(1)]), new Set(), AGORA);
    await assert.rejects(leitura.detalhe(osDe(1).id), ErroSemCopia);
  });

  it("a lista filtra por status, ordena por prioridade e traz a contagem de cada status", async () => {
    const { leitura, b, a } = await comCopia();
    const liberadas = await leitura.lista({ status: "liberada", pagina: 1, tamanho: 20 });
    assert.deepEqual(liberadas.os.map((o) => o.id), [b.id, a.id], "muito alto antes de baixo");
    assert.equal(liberadas.total, 2);
    assert.equal(liberadas.os[0]!.equipe_nome, "Serviços Especiais");
    assert.equal(liberadas.os[0]!.local_instalacao.codigo, "VILA VELHA/REDE");
    assert.deepEqual([liberadas.contagem_por_status.liberada, liberadas.contagem_por_status.pendente, liberadas.contagem_por_status.em_execucao, liberadas.contagem_por_status.encerrada], [2, 1, 1, 0]);
    const pendentes = await leitura.lista({ status: "pendente", pagina: 1, tamanho: 20 });
    assert.equal(pendentes.os[0]!.atrasada, true, "a data programada passou");
    const emExecucao = await leitura.lista({ status: "em_execucao", pagina: 1, tamanho: 20 });
    assert.deepEqual(emExecucao.os[0]!.responsavel, { id: COLEGA, nome: "Taís Técnica" });
  });

  it("a busca acha pelo número, pelo título (sem acento) e pelo local, e a contagem respeita a busca; a página corta a lista", async () => {
    const { leitura, a } = await comCopia();
    assert.deepEqual((await leitura.lista({ status: "liberada", busca: "valvula", pagina: 1, tamanho: 20 })).os.map((o) => o.id), [a.id]);
    assert.equal((await leitura.lista({ status: "liberada", busca: "4000002", pagina: 1, tamanho: 20 })).total, 1);
    assert.equal((await leitura.lista({ status: "liberada", busca: "vila velha", pagina: 1, tamanho: 20 })).total, 2);
    const filtrada = await leitura.lista({ status: "liberada", busca: "valvula", pagina: 1, tamanho: 20 });
    assert.equal(filtrada.contagem_por_status.liberada, 1);
    assert.equal(filtrada.contagem_por_status.pendente, 0);
    const pagina2 = await leitura.lista({ status: "liberada", pagina: 2, tamanho: 1 });
    assert.deepEqual([pagina2.os.length, pagina2.total, pagina2.pagina], [1, 2, 2]);
  });

  it("a lista mostra o status que as ações pendentes produzem", async () => {
    const { banco, leitura, a } = await comCopia();
    const apr = aprSemSinal(a.id);
    await guardarEvento(banco, comoNovo(apr));
    await guardarEvento(banco, comoNovo(ev("execucao_iniciada", a.id, { id: EXEC, apr_id: APR, inicio: "2026-10-19T12:10:00.000Z" }, "2026-10-19T12:10:00.000Z")));
    const emExecucao = await leitura.lista({ status: "em_execucao", pagina: 1, tamanho: 20 });
    assert.ok(emExecucao.os.some((o) => o.id === a.id), "a OS foi para 'em execução' no aparelho");
    assert.equal((await leitura.lista({ status: "liberada", pagina: 1, tamanho: 20 })).os.some((o) => o.id === a.id), false);
  });

  it("o detalhe traz a OS, o local, a equipe, a reserva, as APRs e as execuções com nome e pausas", async () => {
    const { leitura, d } = await comCopia();
    const detalhe = await leitura.detalhe(d.id);
    assert.equal(detalhe.os.local_instalacao.codigo, "VILA VELHA/REDE");
    assert.equal(detalhe.os.equipe.nome, "Serviços Especiais");
    assert.equal(detalhe.os.responsavel?.nome, "Taís Técnica");
    assert.equal(detalhe.os.responsavel?.reservada_por_nome, "Tiago Técnico");
    assert.equal(detalhe.aprs[0]!.modelo.codigo, "APR 01");
    assert.equal(detalhe.aprs[0]!.preenchida_por.nome, "Tiago Técnico");
    assert.deepEqual(detalhe.aprs[0]!.participantes.map((p) => p.nome), ["Tiago Técnico", "Taís Técnica"]);
    assert.equal(detalhe.execucoes[0]!.executor.nome, "Tiago Técnico");
    assert.deepEqual(detalhe.execucoes[0]!.pausas, []);
    assert.ok(execucaoAberta(detalhe.execucoes));
    await assert.rejects(leitura.detalhe(uuidDe(99)), /OS não encontrada/);
  });

  it("depois da APR sem sinal, o detalhe mostra a APR pronta e a situação da execução vira 'iniciar'", async () => {
    const { banco, leitura, a } = await comCopia();
    await guardarEvento(banco, comoNovo(aprSemSinal(a.id)));
    const detalhe = await leitura.detalhe(a.id);
    assert.equal(detalhe.aprs[0]!.aguardando_validacao, true);
    assert.equal(detalhe.aprs[0]!.itens_respondidos, 2);
    const situacao = definirSituacao({ osStatus: detalhe.os.status, usuarioId: EU, execucoes: detalhe.execucoes, aprs: detalhe.aprs, abertas: [], agora: new Date("2026-10-19T15:00:00.000Z"), reservadaPara: null });
    assert.equal(situacao.tipo, "iniciar");
  });

  it("a escolha do modelo traz o recomendado, a orientação e o que cada modelo achou na OS; o modelo vem sem o que é eliminatório", async () => {
    const { leitura, a } = await comCopia();
    const escolha = await leitura.escolhaDoModelo(a.id);
    assert.equal(escolha.recomendado, "APR 01");
    assert.deepEqual(escolha.modelos[0], { codigo: "APR 01", versao: 4, titulo: "OPERAÇÃO", descricao: "Operação das estações", exemplos: ["Pré-operação"], encontradas: ["válvula"] });
    const modelo = await leitura.modeloPublicado("APR 01");
    assert.equal(modelo.itens.length, 1);
    assert.ok(modelo.itens.every((i) => !("tipo" in i) && !("resposta_bloqueante" in i)));
    await assert.rejects(leitura.modeloPublicado("APR 99"), /Modelo de APR não encontrado/);
  });

  it("a equipe da cópia vem com a assinatura e a ausência; as execuções abertas são só as do próprio técnico", async () => {
    const { banco, leitura, d } = await comCopia();
    const colegas = await leitura.colegas(osDe(1).equipe_id);
    assert.deepEqual(colegas.map((c) => c.nome), ["Taís Técnica", "Tiago Técnico"]);
    assert.equal(colegas[0]!.assinatura_path, "ass-colega");
    const abertas = await leitura.execucoesAbertas();
    assert.deepEqual(abertas.map((e) => [e.id, e.os_id, e.numero_ordem]), [[EXEC, d.id, "4000004"]]);
    // A encerrada pendente na fila sai das abertas.
    await guardarEvento(banco, comoNovo(ev("execucao_encerrada", d.id, { execucao_id: EXEC, fim: "2026-10-19T14:00:00.000Z" }, "2026-10-19T14:00:00.000Z")));
    assert.deepEqual(await leitura.execucoesAbertas(), []);
  });
});
