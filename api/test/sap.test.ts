import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { alerta, apr, atividade, equipe, execucao, importacao, localInstalacao, modeloApr, os, reprogramacao, tarefa, usuario } from "../src/db/schema";
import { executarLeitura, manipularLeituraSap } from "../src/servicos/leitura-sap";
import { ClienteSapHttp } from "../src/servicos/sap-http";
import type { OrdemSap } from "../src/servicos/sap";
import { configDeTeste, criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const CT = "SERV_ESP";
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
/** Atividade com modelo de APR na carga inicial. */
const ATIVIDADE_COM_MODELO = "Teste, manutenção e válvulas";

let sequencia = 4_100_000;
const proximoNumero = () => String(++sequencia);

function ordem(extra: Partial<OrdemSap> = {}): OrdemSap {
  const numero = extra.numero_ordem ?? proximoNumero();
  return {
    numero_ordem: numero,
    numero_nota: "10001",
    tipo_ordem: "YBA1",
    tipo_atividade: "Z01-Manutenção Corretiva",
    codigo_atividade: null,
    titulo: `OS ${numero}`,
    descricao: "Descrição da ordem",
    centro_trabalho: CT,
    local_instalacao: { codigo: "LOCAL/A", endereco: "Rua A, 1", plus_code: "ABCD+12", cliente: "Vale" },
    equipamento: "EQ-1",
    prioridade: "Alto",
    data_inicio_prog: "2026-10-12",
    data_fim_prog: "2026-10-13",
    status_sap: "LIB IMPR",
    solicitante: null,
    criado_por: "RFAVARO",
    criada_em: "2026-10-08T10:00:00-03:00",
    plano_manutencao: null,
    item_manutencao: null,
    ...extra,
  };
}

describe("Integração SAP: leitura das ordens", () => {
  let amb: Ambiente;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;

  const osDe = async (numero: string) => (await amb.db.select().from(os).where(eq(os.numeroOrdem, numero)))[0];
  const ler = (opcoes: Parameters<typeof executarLeitura>[1] = {}) => executarLeitura(amb.deps, opcoes);
  const comOrdens = (...ordens: OrdemSap[]) => {
    amb.sap.ordens = ordens;
    amb.sap.falhar = false;
  };

  /** Uma execução em andamento (sem resultado) para a OS. */
  async function abrirExecucao(osId: string) {
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const [modelo] = await amb.db.insert(modeloApr).values({ codigo: `APR T${randomUUID().slice(0, 6)}`, versao: 1, titulo: "Modelo de teste" }).returning();
    const aprId = randomUUID();
    await amb.db.insert(apr).values({ id: aprId, osId, modeloAprId: modelo!.id, preenchidaPor: tecnico.id, resultado: "aprovada", concluidaEm: new Date() });
    await amb.db.insert(execucao).values({ id: randomUUID(), osId, aprId, executorId: tecnico.id, numeroPessoas: 1, inicio: new Date() });
    await amb.db.update(os).set({ status: "em_execucao" }).where(eq(os.id, osId));
  }

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    equipeId = (await amb.criarEquipe({ nome: "Serviços Especiais", centroTrabalho: CT })).id;
    supervisor = await amb.criarUsuario({ perfil: "supervisor", equipeId });
    await amb.db.update(equipe).set({ supervisorId: supervisor.id }).where(eq(equipe.id, equipeId));
  });
  after(() => amb.fechar());

  it("ordem nova liberada cria a OS liberada, com equipe pelo centro de trabalho, origem sap e local criado pelo código", async () => {
    const o = ordem({ tipo_ordem: "YBA2", plano_manutencao: "10573", item_manutencao: "10603", codigo_atividade: ATIVIDADE_COM_MODELO, status_sap: "IMPR LIB CAPC" });
    comOrdens(o);
    const r = await ler();
    assert.equal(r.erro, null);
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [1, 0, 0]);
    assert.deepEqual(r.avisos, []);

    const criada = (await osDe(o.numero_ordem))!;
    assert.equal(criada.status, "liberada");
    assert.equal(criada.origem, "sap");
    assert.equal(criada.equipeId, equipeId);
    assert.equal(criada.tipo, "preventiva");
    assert.equal(criada.planoManutencao, "10573");
    assert.equal(criada.itemManutencao, "10603");
    assert.equal(criada.codigoAtividade, ATIVIDADE_COM_MODELO);
    assert.equal(criada.dataOrdem, "2026-10-08");
    assert.equal(criada.criadoPorSap, "RFAVARO");
    assert.equal(criada.statusSap, "IMPR LIB CAPC");
    assert.equal(criada.dataFimProg, "2026-10-13");

    const [local] = await amb.db.select().from(localInstalacao).where(eq(localInstalacao.id, criada.localInstalacaoId));
    assert.deepEqual([local!.codigo, local!.endereco, local!.plusCode, local!.cliente, local!.critico], ["LOCAL/A", "Rua A, 1", "ABCD+12", "Vale", false]);
  });

  it("a leitura registra a importação com origem api, as contagens e as ignoradas", async () => {
    comOrdens(ordem(), ordem({ status_sap: "CRTD" }));
    const r = await ler();
    const [i] = await amb.db.select().from(importacao).where(eq(importacao.id, r.importacaoId));
    assert.equal(i!.origem, "api");
    assert.equal(i!.usuarioId, null);
    assert.deepEqual([i!.criadas, i!.atualizadas, i!.ignoradas, i!.erro], [1, 0, 1, null]);
    assert.deepEqual(i!.detalheIgnoradas, r.ignoradas);
  });

  it("ordem nova com outro status no SAP é ignorada, e só o código LIB inteiro conta como liberada", async () => {
    const a = ordem({ status_sap: "CRTD" });
    const b = ordem({ status_sap: "RELIB IMPR" });
    const c = ordem({ status_sap: null });
    comOrdens(a, b, c);
    const r = await ler();
    assert.equal(r.criadas, 0);
    assert.deepEqual(
      r.ignoradas.map((i) => [i.numero_ordem, i.motivo]),
      [a, b, c].map((o) => [o.numero_ordem, "Status SAP diferente de liberada"]),
    );
    assert.equal(await osDe(a.numero_ordem), undefined);
  });

  it("reler a mesma ordem atualiza só as colunas de planejamento e nunca duplica", async () => {
    const o = ordem({ codigo_atividade: null });
    comOrdens(o);
    await ler();
    const antes = (await osDe(o.numero_ordem))!;
    // Mudanças do sistema que a releitura não pode tocar.
    const outraEquipe = await amb.criarEquipe({ centroTrabalho: "OUTRA_CT" });
    await amb.db.update(os).set({ status: "pendente", equipeId: outraEquipe.id, origem: "planilha", cienciaPor: supervisor.id, cienciaEm: new Date() }).where(eq(os.id, antes.id));

    comOrdens({
      ...o,
      titulo: "Título novo",
      descricao: "Descrição nova",
      equipamento: "EQ-9",
      prioridade: "Muito alto",
      data_inicio_prog: "2026-10-20",
      data_fim_prog: "2026-10-22",
      plano_manutencao: "999",
      item_manutencao: "111",
      tipo_atividade: "Z02-Manutenção Preventiva",
      solicitante: "Fulano",
      numero_nota: "777",
      criada_em: "2026-10-05",
      criado_por: "OUTRO",
      status_sap: "LIB IMPR NOAP",
      local_instalacao: { codigo: "LOCAL/B", endereco: "Rua B", plus_code: null, cliente: null },
      codigo_atividade: ATIVIDADE_COM_MODELO,
    });
    const r = await ler();
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [0, 1, 0]);

    const depois = (await osDe(o.numero_ordem))!;
    assert.equal(depois.id, antes.id);
    assert.deepEqual(
      [depois.titulo, depois.descricao, depois.equipamento, depois.prioridade, depois.dataInicioProg, depois.dataFimProg, depois.planoManutencao, depois.itemManutencao],
      ["Título novo", "Descrição nova", "EQ-9", "Muito alto", "2026-10-20", "2026-10-22", "999", "111"],
    );
    assert.deepEqual([depois.tipoAtividade, depois.solicitante, depois.numeroNota, depois.dataOrdem, depois.criadoPorSap, depois.statusSap], ["Z02-Manutenção Preventiva", "Fulano", "777", "2026-10-05", "OUTRO", "LIB IMPR NOAP"]);
    assert.notEqual(depois.localInstalacaoId, antes.localInstalacaoId);
    // `codigo_atividade` entra quando a OS ainda não tinha e a atividade existe com modelo.
    assert.equal(depois.codigoAtividade, ATIVIDADE_COM_MODELO);
    // O que não é planejamento fica como estava.
    assert.equal(depois.status, "pendente");
    assert.equal(depois.equipeId, outraEquipe.id);
    assert.equal(depois.origem, "planilha");
    assert.equal(depois.cienciaPor, supervisor.id);
    assert.equal((await amb.db.select().from(os).where(eq(os.numeroOrdem, o.numero_ordem))).length, 1);
  });

  it("OS encerrada ou pendente que reaparece conta em atualizadas sem mexer no status", async () => {
    const a = ordem();
    const b = ordem();
    comOrdens(a, b);
    await ler();
    await amb.db.update(os).set({ status: "encerrada" }).where(eq(os.numeroOrdem, a.numero_ordem));
    await amb.db.update(os).set({ status: "pendente" }).where(eq(os.numeroOrdem, b.numero_ordem));

    comOrdens({ ...a, titulo: "A mudou" }, { ...b, titulo: "B mudou" });
    const r = await ler();
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [0, 2, 0]);
    const [oa, ob] = [(await osDe(a.numero_ordem))!, (await osDe(b.numero_ordem))!];
    assert.deepEqual([oa.status, oa.titulo, ob.status, ob.titulo], ["encerrada", "A mudou", "pendente", "B mudou"]);
  });

  it("reler não desfaz uma OS cancelada nem a reabre", async () => {
    const o = ordem();
    comOrdens(o);
    await ler();
    comOrdens({ ...o, status_sap: "ENCE" });
    await ler();
    assert.equal((await osDe(o.numero_ordem))!.status, "cancelada");
    comOrdens({ ...o, titulo: "Voltou" });
    const r = await ler();
    assert.equal(r.atualizadas, 1);
    assert.equal((await osDe(o.numero_ordem))!.status, "cancelada");
  });

  it("ordem cancelada ou encerrada no SAP, sem execução em andamento, vira cancelada (liberada e pendente)", async () => {
    const a = ordem();
    const b = ordem();
    comOrdens(a, b);
    await ler();
    await amb.db.update(os).set({ status: "pendente" }).where(eq(os.numeroOrdem, b.numero_ordem));

    amb.relogio.agora = new Date("2026-10-12T15:00:00Z");
    comOrdens({ ...a, status_sap: "ENCE" }, { ...b, status_sap: "CNF" });
    const r = await ler();
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [0, 2, 0]);
    for (const n of [a.numero_ordem, b.numero_ordem]) {
      const o = (await osDe(n))!;
      assert.equal(o.status, "cancelada");
      assert.equal(o.canceladaEm?.toISOString(), "2026-10-12T15:00:00.000Z");
      assert.equal(o.canceladaPor, null);
    }
    assert.equal((await osDe(a.numero_ordem))!.statusSap, "ENCE");
  });

  it("OS já encerrada no sistema não vira cancelada quando o SAP a encerra depois da baixa", async () => {
    const o = ordem();
    comOrdens(o);
    await ler();
    await amb.db.update(os).set({ status: "encerrada" }).where(eq(os.numeroOrdem, o.numero_ordem));
    comOrdens({ ...o, status_sap: "ENCE" });
    const r = await ler();
    assert.equal(r.atualizadas, 1);
    const depois = (await osDe(o.numero_ordem))!;
    assert.deepEqual([depois.status, depois.canceladaEm, depois.statusSap], ["encerrada", null, "ENCE"]);
  });

  it("cancelada no SAP com execução em andamento: a execução segue, grava o status SAP e alerta o supervisor", async () => {
    const o = ordem();
    comOrdens(o);
    await ler();
    const criada = (await osDe(o.numero_ordem))!;
    await abrirExecucao(criada.id);

    comOrdens({ ...o, status_sap: "ENCE" });
    const r = await ler();
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [0, 1, 0]);
    const depois = (await osDe(o.numero_ordem))!;
    assert.deepEqual([depois.status, depois.canceladaEm, depois.statusSap], ["em_execucao", null, "ENCE"]);
    const alertas = await amb.db.select().from(alerta).where(eq(alerta.osId, criada.id));
    assert.equal(alertas.length, 1);
    assert.deepEqual([alertas[0]!.tipo, alertas[0]!.destinatarioId, alertas[0]!.lidoEm, alertas[0]!.emailEnviadoEm], ["conflito_planejamento", supervisor.id, null, null]);
    assert.match(alertas[0]!.detalhe, new RegExp(o.numero_ordem));
    // Conflito vira alerta, e não e-mail (só o bloqueio vai por e-mail).
    assert.equal((await amb.db.select().from(tarefa).where(eq(tarefa.referenciaId, alertas[0]!.id))).length, 0);

    // Ler de novo a mesma ordem não repete o alerta.
    await ler();
    assert.equal((await amb.db.select().from(alerta).where(eq(alerta.osId, criada.id))).length, 1);
  });

  it("sem supervisor na equipe, o alerta de conflito vai para cada analista ativo", async () => {
    const outra = await amb.criarEquipe({ centroTrabalho: "SEM_SUP" });
    const a1 = await amb.criarUsuario({ perfil: "analista" });
    const a2 = await amb.criarUsuario({ perfil: "analista" });
    const inativo = await amb.criarUsuario({ perfil: "analista", ativo: false });
    const o = ordem({ centro_trabalho: "SEM_SUP" });
    comOrdens(o);
    await ler();
    const criada = (await osDe(o.numero_ordem))!;
    assert.equal(criada.equipeId, outra.id);
    await abrirExecucao(criada.id);
    comOrdens({ ...o, status_sap: "ENCE" });
    await ler();
    const destinatarios = (await amb.db.select({ d: alerta.destinatarioId }).from(alerta).where(eq(alerta.osId, criada.id))).map((a) => a.d);
    assert.ok(destinatarios.includes(a1.id) && destinatarios.includes(a2.id));
    assert.ok(!destinatarios.includes(inativo.id));
    assert.ok(!destinatarios.includes(supervisor.id));
  });

  it("reprogramação registrada no sistema e data diferente: linha ignorada; com a mesma data, atualiza", async () => {
    const o = ordem({ data_inicio_prog: "2026-10-12", data_fim_prog: "2026-10-13" });
    comOrdens(o);
    await ler();
    const criada = (await osDe(o.numero_ordem))!;
    const analista = await amb.criarUsuario({ perfil: "analista" });
    await amb.db.insert(reprogramacao).values({ osId: criada.id, usuarioId: analista.id, dataAnterior: "2026-10-12", dataNova: "2026-10-19", justificativa: "Sem acesso ao local" });
    await amb.db.update(os).set({ dataInicioProg: "2026-10-19", dataFimProg: "2026-10-20" }).where(eq(os.id, criada.id));

    comOrdens({ ...o, titulo: "Título do SAP" });
    const r = await ler();
    assert.deepEqual([r.criadas, r.atualizadas], [0, 0]);
    assert.deepEqual(r.ignoradas, [{ numero_ordem: o.numero_ordem, motivo: "Reprogramada no sistema" }]);
    const intacta = (await osDe(o.numero_ordem))!;
    assert.deepEqual([intacta.dataInicioProg, intacta.dataFimProg, intacta.titulo], ["2026-10-19", "2026-10-20", `OS ${o.numero_ordem}`]);

    comOrdens({ ...o, data_inicio_prog: "2026-10-19", data_fim_prog: "2026-10-20", titulo: "Título do SAP" });
    const r2 = await ler();
    assert.deepEqual([r2.atualizadas, r2.ignoradas.length], [1, 0]);
    assert.equal((await osDe(o.numero_ordem))!.titulo, "Título do SAP");
  });

  it("reprogramação registrada não impede o cancelamento pelo SAP", async () => {
    const o = ordem();
    comOrdens(o);
    await ler();
    const criada = (await osDe(o.numero_ordem))!;
    const analista = await amb.criarUsuario({ perfil: "analista" });
    await amb.db.insert(reprogramacao).values({ osId: criada.id, usuarioId: analista.id, dataAnterior: "2026-10-12", dataNova: "2026-10-19", justificativa: "Chuva" });
    await amb.db.update(os).set({ dataInicioProg: "2026-10-19", dataFimProg: null }).where(eq(os.id, criada.id));
    comOrdens({ ...o, status_sap: "ENCE" });
    const r = await ler();
    assert.deepEqual([r.atualizadas, r.ignoradas.length], [1, 0]);
    assert.equal((await osDe(o.numero_ordem))!.status, "cancelada");
  });

  it("centro de trabalho sem equipe cadastrada, linha sem número e ordem inválida são ignorados, e as demais entram", async () => {
    const boa = ordem();
    const semEquipe = ordem({ centro_trabalho: "LAB_QUI" });
    const semNumero = ordem({ numero_ordem: "" });
    const tipoRuim = ordem({ tipo_ordem: "XYZ9" });
    const semTitulo = ordem({ titulo: "  " });
    const dataRuim = ordem({ data_inicio_prog: "12/10/2026" });
    const fimAntes = ordem({ data_inicio_prog: "2026-10-12", data_fim_prog: "2026-10-01" });
    comOrdens(semEquipe, semNumero, boa, tipoRuim, semTitulo, dataRuim, fimAntes, "lixo" as unknown as OrdemSap);
    const r = await ler();
    assert.equal(r.erro, null);
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [1, 0, 7]);
    assert.deepEqual(r.ignoradas[0], { numero_ordem: semEquipe.numero_ordem, centro_trabalho: "LAB_QUI", motivo: "Centro de trabalho sem equipe cadastrada" });
    assert.deepEqual(r.ignoradas[1], { linha: 2, motivo: "Linha sem número de ordem" });
    assert.match(r.ignoradas[2]!.motivo, /^Ordem inválida: tipo_ordem: Tipo de ordem inválido/);
    assert.match(r.ignoradas[3]!.motivo, /^Ordem inválida: titulo: Campo obrigatório/);
    assert.match(r.ignoradas[4]!.motivo, /^Ordem inválida: data_inicio_prog: Data inválida/);
    assert.match(r.ignoradas[5]!.motivo, /^Ordem inválida: data_fim_prog/);
    assert.ok(await osDe(boa.numero_ordem));
    assert.equal(await osDe(semEquipe.numero_ordem), undefined);
    assert.equal(await osDe(tipoRuim.numero_ordem), undefined);
  });

  it("atividade fora da tabela ou OS sem plano: entra com código nulo, cadastra o código sem modelo e avisa", async () => {
    const desconhecida = ordem({ tipo_ordem: "YBA2", codigo_atividade: "1.2", plano_manutencao: "10573", item_manutencao: "10603", titulo: "1.2 - Inspeção Funcional de Retificador" });
    const semPlano = ordem({ codigo_atividade: null });
    const comModelo = ordem({ codigo_atividade: ATIVIDADE_COM_MODELO });
    comOrdens(desconhecida, semPlano, comModelo);
    const r = await ler();
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [3, 0, 0]);
    assert.deepEqual(
      r.avisos.map((a) => [a.numero_ordem, a.motivo]),
      [
        [desconhecida.numero_ordem, "Atividade sem modelo de APR"],
        [semPlano.numero_ordem, "Atividade sem modelo de APR"],
      ],
    );
    assert.equal((await osDe(desconhecida.numero_ordem))!.codigoAtividade, null);
    assert.equal((await osDe(semPlano.numero_ordem))!.codigoAtividade, null);
    assert.equal((await osDe(comModelo.numero_ordem))!.codigoAtividade, ATIVIDADE_COM_MODELO);
    const [nova] = await amb.db.select().from(atividade).where(eq(atividade.codigo, "1.2"));
    assert.deepEqual([nova!.modeloAprCodigo, nova!.provisorio], [null, false]);

    // O aviso não vai para as ignoradas gravadas na importação.
    const [i] = await amb.db.select().from(importacao).where(eq(importacao.id, r.importacaoId));
    assert.deepEqual(i!.detalheIgnoradas, []);

    // Quando a Segurança mapeia a atividade, a releitura preenche o código na OS que ainda não tinha.
    await amb.db.update(atividade).set({ modeloAprCodigo: "APR 02" }).where(eq(atividade.codigo, "1.2"));
    comOrdens(desconhecida);
    const r2 = await ler();
    assert.equal(r2.atualizadas, 1);
    assert.equal((await osDe(desconhecida.numero_ordem))!.codigoAtividade, "1.2");
    // Já preenchido, não muda mais.
    comOrdens({ ...desconhecida, codigo_atividade: ATIVIDADE_COM_MODELO });
    await ler();
    assert.equal((await osDe(desconhecida.numero_ordem))!.codigoAtividade, "1.2");
  });

  it("API fora do ar: nada é gravado, a importação fica com erro e a faixa acende até a próxima leitura boa", async () => {
    const analista = await amb.criarUsuario({ perfil: "analista" });
    const o = ordem();
    comOrdens(o);
    amb.sap.falhar = true;
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 60_000);
    const r = await ler();
    assert.equal(r.erro, "SAP fora do ar");
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [0, 0, 0]);
    assert.equal(await osDe(o.numero_ordem), undefined);
    const [i] = await amb.db.select().from(importacao).where(eq(importacao.id, r.importacaoId));
    assert.deepEqual([i!.origem, i!.erro, i!.criadas], ["api", "SAP fora do ar", 0]);

    const lista = await amb.esperar(200, "GET", "/importacoes", { como: analista });
    assert.equal(lista.ultima_leitura_com_erro, true);
    assert.equal(lista.importacoes[0].id, r.importacaoId);
    assert.equal(lista.importacoes[0].erro, "SAP fora do ar");

    amb.sap.falhar = false;
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 60_000);
    const boa = await ler();
    assert.equal(boa.erro, null);
    assert.ok(await osDe(o.numero_ordem));
    assert.equal((await amb.esperar(200, "GET", "/importacoes", { como: analista })).ultima_leitura_com_erro, false);
  });

  it("resposta inválida da API também não grava nada", async () => {
    const o = ordem();
    const original = amb.sap.listarOrdens.bind(amb.sap);
    amb.sap.listarOrdens = (async () => ({ ordens: "não é lista" })) as never;
    try {
      const r = await ler();
      assert.match(r.erro!, /Resposta inválida/);
      assert.equal(await osDe(o.numero_ordem), undefined);
    } finally {
      amb.sap.listarOrdens = original;
    }
  });

  it("falha no meio da leitura desfaz tudo: nada é gravado e a importação fica com erro", async () => {
    const antes = (await amb.db.select({ id: os.id }).from(os)).length;
    const boa = ordem();
    // Uma ordem que quebra fora das regras tratadas (erro que não é do Postgres) aborta a leitura inteira.
    const quebra = { numero_ordem: proximoNumero(), status_sap: "LIB", get titulo(): string { throw new Error("explodiu"); } } as unknown as OrdemSap;
    comOrdens(boa, quebra);
    const erroOriginal = console.error;
    console.error = () => {};
    const r = await ler().finally(() => (console.error = erroOriginal));
    assert.match(r.erro!, /Falha ao gravar as ordens: explodiu/);
    assert.equal(await osDe(boa.numero_ordem), undefined);
    assert.equal((await amb.db.select({ id: os.id }).from(os)).length, antes);
    const [i] = await amb.db.select().from(importacao).where(eq(importacao.id, r.importacaoId));
    assert.match(i!.erro!, /explodiu/);
  });

  it("pagina até proxima_pagina acabar", async () => {
    const lote = Array.from({ length: 205 }, () => ordem());
    comOrdens(...lote);
    const r = await ler();
    assert.deepEqual([r.criadas, r.ignoradas.length], [205, 0]);
    assert.equal((await amb.db.select({ id: os.id }).from(os).where(eq(os.titulo, `OS ${lote[204]!.numero_ordem}`))).length, 1);
  });

  it("um próximo número de página que não avança é resposta inválida", async () => {
    const original = amb.sap.listarOrdens.bind(amb.sap);
    amb.sap.listarOrdens = (async () => ({ ordens: [], proxima_pagina: 1 })) as never;
    try {
      assert.match((await ler()).erro!, /Resposta inválida/);
    } finally {
      amb.sap.listarOrdens = original;
    }
  });
});

describe("Integração SAP: cursor, \"Ler agora\" e permissões", () => {
  let amb: Ambiente;
  let equipeId: string;
  let admin: UsuarioDeTeste;
  let analista: UsuarioDeTeste;
  const consultas: (Date | undefined)[] = [];

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-12T10:00:00Z") });
    equipeId = (await amb.criarEquipe({ centroTrabalho: CT })).id;
    admin = await amb.criarUsuario({ perfil: "admin" });
    analista = await amb.criarUsuario({ perfil: "analista" });
    const original = amb.sap.listarOrdens.bind(amb.sap);
    amb.sap.listarOrdens = (async (o: Parameters<typeof original>[0]) => {
      consultas.push(o.alteradasDesde);
      return original(o);
    }) as typeof original;
  });
  after(() => amb.fechar());

  it("a primeira leitura consulta tudo; as seguintes, desde o início da última leitura bem-sucedida", async () => {
    amb.sap.ordens = [ordem()];
    const primeira = await executarLeitura(amb.deps);
    assert.equal(consultas.at(-1), undefined);
    const [i1] = await amb.db.select().from(importacao).where(eq(importacao.id, primeira.importacaoId));
    assert.equal(i1!.criadaEm.toISOString(), "2026-10-12T10:00:00.000Z");

    amb.relogio.agora = new Date("2026-10-12T10:15:00Z");
    await executarLeitura(amb.deps);
    assert.equal(consultas.at(-1)?.toISOString(), "2026-10-12T10:00:00.000Z");

    // Uma leitura com erro não move o cursor: a seguinte retoma de onde a última boa parou.
    amb.relogio.agora = new Date("2026-10-12T10:30:00Z");
    amb.sap.falhar = true;
    await executarLeitura(amb.deps);
    amb.sap.falhar = false;
    amb.relogio.agora = new Date("2026-10-12T10:45:00Z");
    await executarLeitura(amb.deps);
    assert.equal(consultas.at(-1)?.toISOString(), "2026-10-12T10:15:00.000Z");
  });

  it("POST /sap/leituras registra a importação e enfileira a tarefa leitura_sap com a referência", async () => {
    const corpo = await amb.esperar(202, "POST", "/sap/leituras", { como: analista });
    assert.match(corpo.importacao_id, /^[0-9a-f-]{36}$/);
    const [i] = await amb.db.select().from(importacao).where(eq(importacao.id, corpo.importacao_id));
    assert.deepEqual([i!.origem, i!.usuarioId, i!.erro, i!.criadas], ["api", analista.id, null, 0]);
    const tarefas = await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "leitura_sap"), eq(tarefa.referenciaId, corpo.importacao_id)));
    assert.equal(tarefas.length, 1);
    assert.equal(tarefas[0]!.estado, "pendente");

    // O executor chama a tarefa com a importação já criada.
    amb.sap.ordens = [ordem()];
    const antes = consultas.length;
    await manipularLeituraSap(amb.deps, { id: tarefas[0]!.id, referenciaId: corpo.importacao_id });
    assert.equal(consultas.length, antes + 1);
    // A importação pendente de outra tarefa e a própria ficam fora do cursor.
    assert.equal(consultas.at(-1)?.toISOString(), "2026-10-12T10:45:00.000Z");
    const [depois] = await amb.db.select().from(importacao).where(eq(importacao.id, corpo.importacao_id));
    assert.deepEqual([depois!.criadas, depois!.erro, depois!.usuarioId], [1, null, analista.id]);
    assert.equal((await amb.db.select().from(importacao).where(eq(importacao.origem, "api"))).filter((x) => x.id === corpo.importacao_id).length, 1);
  });

  it("uma importação ainda na fila não serve de cursor, e a leitura agendada (referência nula) cria a própria importação", async () => {
    const pendente = await amb.esperar(202, "POST", "/sap/leituras", { como: admin });
    amb.relogio.agora = new Date("2026-10-12T11:00:00Z");
    const agendada = await manipularLeituraSap(amb.deps, { id: randomUUID(), referenciaId: null });
    assert.equal(agendada, undefined);
    // O cursor é o da leitura anterior concluída, não o da importação que só está na fila.
    assert.equal(consultas.at(-1)?.toISOString(), "2026-10-12T10:45:00.000Z");
    const lista = await amb.db.select().from(importacao).where(eq(importacao.origem, "api"));
    const agendadaLinha = lista.find((i) => i.criadaEm.toISOString() === "2026-10-12T11:00:00.000Z");
    assert.equal(agendadaLinha?.usuarioId, null);
    assert.ok(lista.some((i) => i.id === pendente.importacao_id));
  });

  it("manipularLeituraSap com importação inexistente falha", async () => {
    await assert.rejects(() => manipularLeituraSap(amb.deps, { id: randomUUID(), referenciaId: randomUUID() }), /não encontrada/);
  });

  it("só analista e admin leem o SAP e veem as importações", async () => {
    const supervisor = await amb.criarUsuario({ perfil: "supervisor", equipeId });
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const seguranca = await amb.criarUsuario({ perfil: "seguranca" });
    // O relógio andou nos testes anteriores: os tokens do `before` já expiraram, então os de quem tem acesso são novos.
    admin = await amb.criarUsuario({ perfil: "admin" });
    analista = await amb.criarUsuario({ perfil: "analista" });
    assert.equal((await amb.req("POST", "/sap/leituras")).status, 401);
    for (const u of [supervisor, tecnico, seguranca]) {
      assert.equal((await amb.req("POST", "/sap/leituras", { como: u })).status, 403, u.perfil);
      assert.equal((await amb.req("GET", "/importacoes", { como: u })).status, 403, u.perfil);
      assert.equal((await amb.req("POST", "/importacoes", { como: u, form: new FormData() })).status, 403, u.perfil);
    }
    await amb.esperar(202, "POST", "/sap/leituras", { como: admin });
    await amb.esperar(200, "GET", "/importacoes", { como: admin });
  });

  it("GET /importacoes pagina, do mais recente ao mais antigo, com as contagens e quem fez", async () => {
    const pagina1 = await amb.esperar(200, "GET", "/importacoes", { como: analista, consulta: { tamanho: 2 } });
    assert.equal(pagina1.importacoes.length, 2);
    assert.equal(pagina1.pagina, 1);
    assert.equal(pagina1.tamanho, 2);
    assert.ok(pagina1.total >= 5);
    assert.ok(pagina1.importacoes[0].criada_em >= pagina1.importacoes[1].criada_em);
    assert.deepEqual(Object.keys(pagina1.importacoes[0]).sort(), ["arquivo", "atualizadas", "criada_em", "criadas", "detalhe_ignoradas", "erro", "id", "ignoradas", "origem", "usuario_id", "usuario_nome"]);
    const todas = await amb.esperar(200, "GET", "/importacoes", { como: analista });
    const feita = todas.importacoes.find((i: any) => i.usuario_id === admin.id);
    const [dono] = await amb.db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, admin.id));
    assert.equal(feita.usuario_nome, dono!.nome);
  });
});

describe("Integração SAP: planilha", () => {
  let amb: Ambiente;
  let equipeId: string;
  let analista: UsuarioDeTeste;

  const CABECALHO = ["Ordem", "Nota", "Tipo de Ordem", "CENTRO DE TRABALHO", "Local de Instalacao", "Endereço", "Equipamento", "Início Programado", "Fim programado", "Prioridade", "Status do sistema", "Título", "Descrição", "Cliente"];
  const linhaBoa = (numero: string | number | null, extra: Record<number, unknown> = {}) => {
    const l: unknown[] = [numero, "10001", "YBA1", CT, "LOCAL/P1", "Rua P, 10", "EQ-P1", new Date(Date.UTC(2026, 9, 12)), "13/10/2026", "Alto", "LIB IMPR", `Título ${numero}`, "Descrição", "Vale"];
    for (const [i, v] of Object.entries(extra)) l[Number(i)] = v;
    return l;
  };

  async function xlsx(linhas: unknown[][], nome = "export_ordens.xlsx") {
    const livro = new ExcelJS.Workbook();
    const aba = livro.addWorksheet("Ordens");
    for (const l of linhas) aba.addRow(l);
    return new File([await livro.xlsx.writeBuffer()], nome, { type: TIPO_XLSX });
  }
  const enviar = (arquivo: File, como: UsuarioDeTeste | null = analista) => {
    const form = new FormData();
    form.set("arquivo", arquivo);
    return amb.req("POST", "/importacoes", { como, form });
  };
  const osDe = async (numero: string) => (await amb.db.select().from(os).where(eq(os.numeroOrdem, numero)))[0];

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    equipeId = (await amb.criarEquipe({ centroTrabalho: CT })).id;
    analista = await amb.criarUsuario({ perfil: "analista" });
  });
  after(() => amb.fechar());

  it("importa a planilha com o mesmo processamento: cria, ignora com o motivo e guarda o arquivo no bucket", async () => {
    const arquivo = await xlsx([
      CABECALHO,
      linhaBoa(4200001, { 2: "Corretiva" }),
      linhaBoa("4200002", { 2: "yba2", 7: "2026-10-14", 8: null, 3: "SERV_ESP", 14: undefined }),
      linhaBoa(null),
      linhaBoa(4200004, { 3: "SEM_EQUIPE" }),
      linhaBoa(4200005, { 10: "CRTD" }),
      linhaBoa(4200006, { 7: "31/02/2026" }),
      linhaBoa(4200007, { 7: "12/10/2026" }),
      [],
      linhaBoa(4200009, { 2: "Inspeção" }),
    ]);
    const r = await enviar(arquivo);
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.match(r.corpo.importacao_id, /^[0-9a-f-]{36}$/);
    assert.deepEqual([r.corpo.criadas, r.corpo.atualizadas], [3, 0]);
    assert.deepEqual(r.corpo.avisos.map((a: any) => [a.linha, a.numero_ordem, a.motivo]), [
      [2, "4200001", "Atividade sem modelo de APR"],
      [3, "4200002", "Atividade sem modelo de APR"],
      [8, "4200007", "Atividade sem modelo de APR"],
    ]);
    assert.deepEqual(
      r.corpo.ignoradas.map((i: any) => [i.linha, i.motivo]),
      [
        [4, "Linha sem número de ordem"],
        [5, "Centro de trabalho sem equipe cadastrada"],
        [6, "Status SAP diferente de liberada"],
        [7, "Ordem inválida: data_inicio_prog: Data inválida (use AAAA-MM-DD)"],
        [10, "Ordem inválida: tipo_ordem: Tipo de ordem inválido (use YBA1 ou YBA2)"],
      ],
    );
    assert.equal(r.corpo.ignoradas[1].numero_ordem, "4200004");
    assert.equal(r.corpo.ignoradas[1].centro_trabalho, "SEM_EQUIPE");

    const o1 = (await osDe("4200001"))!;
    assert.deepEqual([o1.origem, o1.status, o1.tipo, o1.equipeId, o1.dataInicioProg, o1.dataFimProg, o1.equipamento, o1.prioridade, o1.titulo], ["planilha", "liberada", "corretiva", equipeId, "2026-10-12", "2026-10-13", "EQ-P1", "Alto", "Título 4200001"]);
    const o2 = (await osDe("4200002"))!;
    assert.deepEqual([o2.tipo, o2.dataInicioProg, o2.dataFimProg], ["preventiva", "2026-10-14", null]);
    assert.equal((await osDe("4200007"))!.dataInicioProg, "2026-10-12");
    const [local] = await amb.db.select().from(localInstalacao).where(eq(localInstalacao.id, o1.localInstalacaoId));
    assert.deepEqual([local!.codigo, local!.endereco, local!.cliente], ["LOCAL/P1", "Rua P, 10", "Vale"]);

    const [i] = await amb.db.select().from(importacao).where(eq(importacao.id, r.corpo.importacao_id));
    assert.deepEqual([i!.origem, i!.usuarioId, i!.criadas, i!.atualizadas, i!.ignoradas, i!.erro], ["planilha", analista.id, 3, 0, 5, null]);
    assert.deepEqual(i!.detalheIgnoradas, r.corpo.ignoradas);
    assert.equal(i!.arquivo, `${r.corpo.importacao_id}/export_ordens.xlsx`);
    const guardado = await amb.armazenamento.ler("importacoes", i!.arquivo!);
    assert.ok(guardado && guardado.length > 100);
    assert.equal(guardado[0], 0x50); // cabeçalho "PK" de um zip (.xlsx)
  });

  it("reimportar a mesma planilha atualiza em vez de duplicar, e a ordem do sistema (SAP) é a mesma", async () => {
    const arquivo = await xlsx([CABECALHO, linhaBoa(4200010), linhaBoa(4200011)]);
    const a = await enviar(arquivo);
    assert.deepEqual([a.corpo.criadas, a.corpo.atualizadas], [2, 0]);
    const b = await enviar(await xlsx([CABECALHO, linhaBoa(4200010, { 11: "Título novo" }), linhaBoa(4200011)]));
    assert.deepEqual([b.corpo.criadas, b.corpo.atualizadas], [0, 2]);
    assert.equal((await osDe("4200010"))!.titulo, "Título novo");
    assert.equal((await amb.db.select({ id: os.id }).from(os).where(eq(os.numeroOrdem, "4200010"))).length, 1);
  });

  it("aceita cabeçalhos com e sem acento, em maiúsculas e a linha de cabeçalho depois de um título", async () => {
    const arquivo = await xlsx([
      ["Exportação de ordens - outubro"],
      [],
      ["ORDEM", "TIPO", "CENTRO DE TRABALHO", "LOCAL DE INSTALAÇÃO", "TEXTO BREVE", "INICIO PROGRAMADO", "Status Sap"],
      [4200020, "YBA2", CT, "LOCAL/P2", "Texto breve", "20/10/2026", "LIB"],
    ]);
    const r = await enviar(arquivo);
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.deepEqual([r.corpo.criadas, r.corpo.ignoradas.length], [1, 0]);
    assert.equal((await osDe("4200020"))!.titulo, "Texto breve");
  });

  it("sem coluna de status, as linhas valem como liberadas", async () => {
    const r = await enviar(await xlsx([["Ordem", "Tipo", "Centro de Trabalho", "Local de Instalação", "Título", "Início Programado"], [4200030, "YBA1", CT, "LOCAL/P3", "Sem status", "2026-10-21"]]));
    assert.deepEqual([r.corpo.criadas, r.corpo.ignoradas.length], [1, 0]);
    assert.equal((await osDe("4200030"))!.statusSap, "LIB");
  });

  it("arquivo que não é o export esperado: 422 com as colunas ausentes e nada é gravado", async () => {
    const antes = (await amb.db.select({ id: importacao.id }).from(importacao)).length;
    const arquivosAntes = amb.armazenamento.arquivos.size;
    const r = await enviar(await xlsx([["Ordem", "Tipo", "Título"], [4200040, "YBA1", "x"]]));
    assert.equal(r.status, 422);
    assert.equal(r.corpo.erro.mensagem, "Colunas obrigatórias ausentes: Centro de trabalho, Local de instalação, Início programado");
    assert.equal(await osDe("4200040"), undefined);
    assert.equal((await amb.db.select({ id: importacao.id }).from(importacao)).length, antes);
    assert.equal(amb.armazenamento.arquivos.size, arquivosAntes);

    const vazia = await enviar(await xlsx([]));
    assert.equal(vazia.status, 422);
    assert.match(vazia.corpo.erro.mensagem, /^Colunas obrigatórias ausentes: Ordem, Tipo de ordem, Título/);
  });

  it("recusa o que não é uma planilha .xlsx, o envio sem arquivo e o arquivo vazio", async () => {
    const texto = await enviar(new File(["ordem;tipo\n1;YBA1"], "ordens.csv", { type: "text/csv" }));
    assert.equal(texto.status, 422);
    assert.equal(texto.corpo.erro.codigo, "planilha_invalida");
    assert.equal((await amb.req("POST", "/importacoes", { como: analista, form: new FormData() })).status, 422);
    assert.equal((await amb.req("POST", "/importacoes", { como: analista, json: {} })).status, 422);
    assert.equal((await enviar(new File([], "vazio.xlsx"))).status, 422);
  });

  it("só analista e admin importam; sem token é 401", async () => {
    const arquivo = await xlsx([CABECALHO, linhaBoa(4200050)]);
    assert.equal((await enviar(arquivo, null)).status, 401);
    for (const perfil of ["tecnico", "supervisor", "seguranca"] as const) {
      const u = await amb.criarUsuario({ perfil, equipeId: perfil === "seguranca" ? null : equipeId });
      assert.equal((await enviar(arquivo, u)).status, 403, perfil);
    }
    const admin = await amb.criarUsuario({ perfil: "admin" });
    assert.equal((await enviar(arquivo, admin)).status, 201);
    assert.ok(await osDe("4200050"));
  });

  it("a lista de importações mostra a planilha com o arquivo e quem enviou", async () => {
    const lista = await amb.esperar(200, "GET", "/importacoes", { como: analista });
    const planilhas = lista.importacoes.filter((i: any) => i.origem === "planilha");
    assert.ok(planilhas.length >= 3);
    assert.ok(planilhas.every((i: any) => i.arquivo.endsWith(".xlsx") && i.erro === null));
    assert.equal(lista.ultima_leitura_com_erro, false);
  });
});

describe("Integração SAP: OS manual, OS de apoio e locais", () => {
  let amb: Ambiente;
  let equipeA: string;
  let equipeB: string;
  let localId: string;
  let admin: UsuarioDeTeste;
  let analista: UsuarioDeTeste;
  let supervisorA: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let seguranca: UsuarioDeTeste;

  const corpoOs = (extra: Record<string, unknown> = {}) => ({
    tipo: "corretiva",
    titulo: "Vazamento urgente",
    descricao: "Cheiro de gás",
    local_instalacao_id: localId,
    equipe_id: equipeA,
    data_inicio_prog: "2026-10-12",
    prioridade: "Muito alto",
    ...extra,
  });
  const osPorId = async (id: string) => (await amb.db.select().from(os).where(eq(os.id, id)))[0]!;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    equipeA = (await amb.criarEquipe({ centroTrabalho: "A" })).id;
    equipeB = (await amb.criarEquipe({ centroTrabalho: "B" })).id;
    admin = await amb.criarUsuario({ perfil: "admin" });
    analista = await amb.criarUsuario({ perfil: "analista" });
    supervisorA = await amb.criarUsuario({ perfil: "supervisor", equipeId: equipeA });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA });
    seguranca = await amb.criarUsuario({ perfil: "seguranca" });
    localId = (await amb.esperar(201, "POST", "/locais", { como: analista, json: { codigo: "LOCAL/MANUAL" } })).id;
  });
  after(() => amb.fechar());

  it("OS manual: analista e admin criam para qualquer equipe; nasce liberada, origem manual, sem número de ordem", async () => {
    for (const [u, equipe] of [[analista, equipeB], [admin, equipeA]] as const) {
      const c = await amb.esperar(201, "POST", "/os", { como: u, json: corpoOs({ equipe_id: equipe, equipamento: "EQ-7", solicitante: "Central", data_fim_prog: "2026-10-13" }) });
      const o = await osPorId(c.id);
      assert.deepEqual([o.origem, o.status, o.numeroOrdem, o.equipeId, o.tipo, o.titulo, o.descricao, o.prioridade, o.equipamento, o.solicitante, o.dataInicioProg, o.dataFimProg, o.osOrigemId], ["manual", "liberada", null, equipe, "corretiva", "Vazamento urgente", "Cheiro de gás", "Muito alto", "EQ-7", "Central", "2026-10-12", "2026-10-13", null]);
    }
  });

  it("supervisor cria OS manual só para a própria equipe", async () => {
    await amb.esperar(201, "POST", "/os", { como: supervisorA, json: corpoOs({ equipe_id: equipeA }) });
    const r = await amb.req("POST", "/os", { como: supervisorA, json: corpoOs({ equipe_id: equipeB }) });
    assert.equal(r.status, 403);
    const semEquipe = await amb.criarUsuario({ perfil: "supervisor", equipeId: null });
    assert.equal((await amb.req("POST", "/os", { como: semEquipe, json: corpoOs() })).status, 403);
  });

  it("técnico e segurança não criam OS; sem token é 401", async () => {
    assert.equal((await amb.req("POST", "/os", { json: corpoOs() })).status, 401);
    assert.equal((await amb.req("POST", "/os", { como: tecnico, json: corpoOs() })).status, 403);
    assert.equal((await amb.req("POST", "/os", { como: seguranca, json: corpoOs() })).status, 403);
  });

  it("OS de apoio: supervisor cria para qualquer equipe, ligada à original, que continua como está", async () => {
    const original = (await amb.esperar(201, "POST", "/os", { como: supervisorA, json: corpoOs({ numero_ordem: "9000001" }) })).id;
    await amb.db.update(os).set({ status: "pendente" }).where(eq(os.id, original));
    const antes = await osPorId(original);

    const apoio = await amb.esperar(201, "POST", "/os", { como: supervisorA, json: corpoOs({ equipe_id: equipeB, titulo: "Drenar caixa de válvula", os_origem_id: original }) });
    const o = await osPorId(apoio.id);
    assert.deepEqual([o.osOrigemId, o.equipeId, o.origem, o.status], [original, equipeB, "manual", "liberada"]);
    assert.deepEqual(await osPorId(original), antes);

    const doAnalista = await amb.esperar(201, "POST", "/os", { como: analista, json: corpoOs({ equipe_id: equipeB, os_origem_id: original }) });
    assert.equal((await osPorId(doAnalista.id)).osOrigemId, original);
  });

  it("OS de apoio exige uma OS de origem existente (e visível ao supervisor)", async () => {
    const inexistente = await amb.req("POST", "/os", { como: analista, json: corpoOs({ os_origem_id: randomUUID() }) });
    assert.equal(inexistente.status, 422);
    assert.equal(inexistente.corpo.erro.codigo, "os_origem_inexistente");
    const deB = (await amb.esperar(201, "POST", "/os", { como: analista, json: corpoOs({ equipe_id: equipeB }) })).id;
    assert.equal((await amb.req("POST", "/os", { como: supervisorA, json: corpoOs({ os_origem_id: deB }) })).status, 422);
  });

  it("valida o corpo: tipo, datas, referências, atividade e número de ordem repetido", async () => {
    const quer = async (status: number, extra: Record<string, unknown>) => {
      const r = await amb.req("POST", "/os", { como: analista, json: corpoOs(extra) });
      assert.equal(r.status, status, JSON.stringify([extra, r.corpo]));
      return r.corpo;
    };
    await quer(422, { tipo: "outro" });
    await quer(422, { titulo: "  " });
    await quer(422, { data_inicio_prog: "12/10/2026" });
    await quer(422, { data_inicio_prog: "2026-02-31" });
    assert.equal((await quer(422, { data_fim_prog: "2026-10-01" })).erro.codigo, "datas_invalidas");
    assert.equal((await quer(422, { local_instalacao_id: randomUUID() })).erro.codigo, "local_inexistente");
    assert.equal((await quer(422, { equipe_id: randomUUID() })).erro.codigo, "equipe_inexistente");
    assert.equal((await quer(422, { codigo_atividade: "não existe" })).erro.codigo, "atividade_inexistente");

    const comAtividade = await quer(201, { codigo_atividade: ATIVIDADE_COM_MODELO });
    assert.equal((await osPorId(comAtividade.id)).codigoAtividade, ATIVIDADE_COM_MODELO);

    await quer(201, { numero_ordem: "9100001" });
    const repetida = await quer(409, { numero_ordem: "9100001" });
    assert.equal(repetida.erro.codigo, "numero_ordem_duplicado");
    // Uma OS lida do SAP também ocupa o número.
    await amb.db.insert(os).values({ numeroOrdem: "9100002", tipo: "corretiva", titulo: "x", localInstalacaoId: localId, equipeId: equipeA, dataInicioProg: "2026-10-12", origem: "sap" });
    await quer(409, { numero_ordem: "9100002" });
  });

  it("POST /locais: supervisor, analista e admin cadastram; código repetido é 409 \"Local já cadastrado\"", async () => {
    const dados = { codigo: "CARIACICA/RAMAL NOVO", endereco: "Av. Principal, 5", plus_code: "7QX2+R3", cliente: "Suzano" };
    const c = await amb.esperar(201, "POST", "/locais", { como: supervisorA, json: dados });
    const [l] = await amb.db.select().from(localInstalacao).where(eq(localInstalacao.id, c.id));
    assert.deepEqual([l!.codigo, l!.endereco, l!.plusCode, l!.cliente, l!.critico], ["CARIACICA/RAMAL NOVO", "Av. Principal, 5", "7QX2+R3", "Suzano", false]);

    for (const u of [supervisorA, analista, admin]) {
      const repetido = await amb.req("POST", "/locais", { como: u, json: { codigo: "CARIACICA/RAMAL NOVO" } });
      assert.equal(repetido.status, 409, u.perfil);
      assert.equal(repetido.corpo.erro.mensagem, "Local já cadastrado");
    }
    assert.equal((await amb.req("POST", "/locais", { como: tecnico, json: { codigo: "X" } })).status, 403);
    assert.equal((await amb.req("POST", "/locais", { como: seguranca, json: { codigo: "X" } })).status, 403);
    assert.equal((await amb.req("POST", "/locais", { como: admin, json: { codigo: " " } })).status, 422);
    assert.equal((await amb.req("POST", "/locais", { json: { codigo: "X" } })).status, 401);
  });

  it("PATCH /locais/{id}: só analista e admin mudam a criticidade", async () => {
    await amb.esperar(200, "PATCH", `/locais/${localId}`, { como: analista, json: { critico: true } });
    assert.equal((await amb.db.select().from(localInstalacao).where(eq(localInstalacao.id, localId)))[0]!.critico, true);
    await amb.esperar(200, "PATCH", `/locais/${localId}`, { como: admin, json: { critico: false } });
    assert.equal((await amb.db.select().from(localInstalacao).where(eq(localInstalacao.id, localId)))[0]!.critico, false);
    for (const u of [supervisorA, tecnico, seguranca]) assert.equal((await amb.req("PATCH", `/locais/${localId}`, { como: u, json: { critico: true } })).status, 403, u.perfil);
    assert.equal((await amb.req("PATCH", `/locais/${randomUUID()}`, { como: analista, json: { critico: true } })).status, 404);
    assert.equal((await amb.req("PATCH", "/locais/nao-e-uuid", { como: analista, json: { critico: true } })).status, 404);
    assert.equal((await amb.req("PATCH", `/locais/${localId}`, { como: analista, json: { critico: "sim" } })).status, 422);
  });

  it("GET /locais: qualquer perfil lê, com paginação e filtro por trecho do código (sem tratar % como curinga)", async () => {
    for (const codigo of ["ZZ/LISTA 1", "ZZ/LISTA 2", "ZZ/LISTA 3", "ZZ_100%"]) await amb.esperar(201, "POST", "/locais", { como: analista, json: { codigo } });
    for (const u of [tecnico, supervisorA, seguranca, analista, admin]) assert.equal((await amb.req("GET", "/locais", { como: u })).status, 200, u.perfil);
    assert.equal((await amb.req("GET", "/locais")).status, 401);

    const filtrados = await amb.esperar(200, "GET", "/locais", { como: tecnico, consulta: { codigo: "zz/lista", tamanho: 2 } });
    assert.deepEqual(filtrados.locais.map((l: any) => l.codigo), ["ZZ/LISTA 1", "ZZ/LISTA 2"]);
    assert.deepEqual([filtrados.pagina, filtrados.tamanho, filtrados.total], [1, 2, 3]);
    const pagina2 = await amb.esperar(200, "GET", "/locais", { como: tecnico, consulta: { codigo: "ZZ/LISTA", tamanho: 2, pagina: 2 } });
    assert.deepEqual(pagina2.locais.map((l: any) => l.codigo), ["ZZ/LISTA 3"]);
    assert.deepEqual(Object.keys(filtrados.locais[0]).sort(), ["cliente", "codigo", "critico", "endereco", "id", "plus_code"]);

    assert.equal((await amb.esperar(200, "GET", "/locais", { como: tecnico, consulta: { codigo: "%" } })).total, 1);
    assert.equal((await amb.esperar(200, "GET", "/locais", { como: tecnico, consulta: { codigo: "_" } })).total, 1);
    assert.equal((await amb.esperar(200, "GET", "/locais", { como: tecnico, consulta: { codigo: "inexistente" } })).total, 0);
  });
});

describe("Integração SAP: simulador e cliente HTTP", () => {
  let amb: Ambiente;
  const base = "http://api.local/sap-simulado";
  const auth = { Authorization: `Bearer ${configDeTeste.sapApiToken}` };

  const sim = (metodo: string, caminho: string, o: { json?: unknown; consulta?: Record<string, string | number>; token?: string | null } = {}) =>
    amb.req(metodo, `/sap-simulado${caminho}`, {
      ...(o.json !== undefined ? { json: o.json } : {}),
      ...(o.consulta ? { consulta: o.consulta } : {}),
      cabecalhos: o.token === null ? {} : { Authorization: `Bearer ${o.token ?? configDeTeste.sapApiToken}` },
    });

  /** `fetch` que cai direto na aplicação, sem rede. */
  const buscarNaApp: typeof fetch = async (entrada, init) => amb.app.request(new Request(entrada as URL, init));

  before(async () => {
    // As fixtures são de antes de 2026-10-12; o relógio fixo faz o filtro `alteradas_desde` ser determinístico.
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-12T12:00:00Z") });
  });
  after(() => amb.fechar());

  it("exige o token do SAP, mas não login de usuário", async () => {
    assert.equal((await sim("GET", "/ordens", { token: null })).status, 401);
    assert.equal((await sim("GET", "/ordens", { token: "errado" })).status, 401);
    assert.equal((await sim("GET", "/ordens/4023470", { token: "errado" })).status, 401);
    assert.equal((await sim("POST", "/ordens", { token: "errado", json: {} })).status, 401);
    assert.equal((await sim("PATCH", "/ordens/4023470", { token: "errado", json: { status_sap: "ENCE" } })).status, 401);
    assert.equal((await sim("GET", "/ordens")).status, 200);
    assert.equal((await amb.req("GET", "/sap-simulado/ordens", { cabecalhos: { Authorization: "Bearer" } })).status, 401);
  });

  it("as fixtures trazem as ordens de exemplo: a corretiva sem plano e a preventiva com plano e item", async () => {
    const lista = (await sim("GET", "/ordens")).corpo;
    assert.equal(lista.ordens.length, 11);
    assert.equal(lista.proxima_pagina, undefined);
    const corretiva = (await sim("GET", "/ordens/4023470")).corpo;
    assert.deepEqual(
      [corretiva.tipo_ordem, corretiva.plano_manutencao, corretiva.item_manutencao, corretiva.codigo_atividade, corretiva.centro_trabalho, corretiva.numero_nota],
      ["YBA1", null, null, null, "SERV_ESP", "10006463"],
    );
    assert.deepEqual(Object.keys(corretiva.local_instalacao).sort(), ["cliente", "codigo", "endereco", "plus_code"]);
    const preventiva = (await sim("GET", "/ordens/4019821")).corpo;
    assert.deepEqual(
      [preventiva.tipo_ordem, preventiva.plano_manutencao, preventiva.item_manutencao, preventiva.titulo],
      ["YBA2", "10573", "10603", "1.2 - Inspeção Funcional de Retificador"],
    );
    const status: string[] = lista.ordens.map((o: any) => o.status_sap);
    assert.ok(status.some((s) => s.split(" ").includes("LIB")));
    assert.ok(status.some((s) => !s.split(" ").includes("LIB")));
    assert.equal((await sim("GET", "/ordens/0000000")).status, 404);
  });

  it("pagina com pagina e tamanho, e proxima_pagina some na última", async () => {
    const p1 = (await sim("GET", "/ordens", { consulta: { tamanho: 5 } })).corpo;
    assert.equal(p1.ordens.length, 5);
    assert.equal(p1.proxima_pagina, 2);
    const p3 = (await sim("GET", "/ordens", { consulta: { tamanho: 5, pagina: 3 } })).corpo;
    assert.equal(p3.ordens.length, 1);
    assert.equal(p3.proxima_pagina, undefined);
    assert.equal((await sim("GET", "/ordens", { consulta: { tamanho: 0 } })).status, 422);
    assert.equal((await sim("GET", "/ordens", { consulta: { alteradas_desde: "ontem" } })).status, 422);
  });

  it("POST injeta uma OS (201), recusa repetida (409) e inválida (422); alteradas_desde filtra pelo que mudou", async () => {
    const nova = ordem({ numero_ordem: "7000001", status_sap: "LIB" });
    const criada = await sim("POST", "/ordens", { json: nova });
    assert.equal(criada.status, 201);
    assert.equal(criada.corpo.numero_ordem, "7000001");
    assert.equal(criada.corpo.local_instalacao.codigo, "LOCAL/A");
    assert.equal((await sim("GET", "/ordens/7000001")).status, 200);
    assert.equal((await sim("POST", "/ordens", { json: nova })).status, 409);
    assert.equal((await sim("POST", "/ordens", { json: { ...nova, numero_ordem: "7000002", tipo_ordem: "XX" } })).status, 422);
    assert.equal((await sim("POST", "/ordens", { json: { titulo: "sem nada" } })).status, 422);

    // As fixtures são de antes de agora; só a OS injetada mudou depois de `desde`.
    const desde = new Date(amb.relogio.agora.getTime() - 60_000).toISOString();
    const alteradas = (await sim("GET", "/ordens", { consulta: { alteradas_desde: desde } })).corpo.ordens.map((o: any) => o.numero_ordem);
    assert.deepEqual(alteradas, ["7000001"]);
  });

  it("PATCH muda o status SAP (200), a ordem passa a contar como alterada, e a ordem inexistente é 404", async () => {
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 3_600_000);
    const mudou = await sim("PATCH", "/ordens/4023470", { json: { status_sap: "ENCE" } });
    assert.equal(mudou.status, 200);
    assert.equal(mudou.corpo.status_sap, "ENCE");
    assert.equal((await sim("GET", "/ordens/4023470")).corpo.status_sap, "ENCE");
    const desde = new Date(amb.relogio.agora.getTime() - 60_000).toISOString();
    assert.deepEqual((await sim("GET", "/ordens", { consulta: { alteradas_desde: desde } })).corpo.ordens.map((o: any) => o.numero_ordem), ["4023470"]);
    assert.equal((await sim("PATCH", "/ordens/0000000", { json: { status_sap: "ENCE" } })).status, 404);
    assert.equal((await sim("PATCH", "/ordens/4023470", { json: {} })).status, 422);
    // Devolve ao estado inicial para os próximos testes.
    await sim("PATCH", "/ordens/4023470", { json: { status_sap: "LIB IMPR CAPC" } });
  });

  it("ClienteSapHttp lê o simulador: lista com paginação, obtém uma ordem e devolve nulo para 404", async () => {
    const cliente = new ClienteSapHttp(base, configDeTeste.sapApiToken, buscarNaApp);
    const p1 = await cliente.listarOrdens({ pagina: 1, tamanho: 5 });
    assert.equal(p1.ordens.length, 5);
    assert.equal(p1.proxima_pagina, 2);
    const ultima = await cliente.listarOrdens({ pagina: 3, tamanho: 5 });
    assert.equal(ultima.proxima_pagina, undefined);

    const desde = new Date(amb.relogio.agora.getTime() - 60_000);
    assert.deepEqual((await cliente.listarOrdens({ alteradasDesde: desde, pagina: 1, tamanho: 50 })).ordens.map((o) => o.numero_ordem), ["4023470"]);

    assert.equal((await cliente.obterOrdem("4019821"))?.plano_manutencao, "10573");
    assert.equal(await cliente.obterOrdem("0000000"), null);
  });

  it("ClienteSapHttp envia o Bearer e os parâmetros, e lança exceção com token errado, erro HTTP ou resposta inválida", async () => {
    const chamadas: { url: string; autorizacao: string | null }[] = [];
    const registrar = (corpo: () => Response): typeof fetch =>
      (async (entrada: unknown, init?: RequestInit) => {
        chamadas.push({ url: String(entrada), autorizacao: new Headers(init?.headers).get("Authorization") });
        return corpo();
      }) as typeof fetch;

    const ok = new ClienteSapHttp("http://sap.local/api/", "segredo", registrar(() => Response.json({ ordens: [], proxima_pagina: null })));
    assert.deepEqual(await ok.listarOrdens({ alteradasDesde: new Date("2026-10-12T10:00:00Z"), pagina: 2, tamanho: 25 }), { ordens: [] });
    assert.equal(chamadas[0]!.url, "http://sap.local/api/ordens?alteradas_desde=2026-10-12T10%3A00%3A00.000Z&pagina=2&tamanho=25");
    assert.equal(chamadas[0]!.autorizacao, "Bearer segredo");
    await ok.obterOrdem("40 23");
    assert.equal(chamadas[1]!.url, "http://sap.local/api/ordens/40%2023");

    const tokenErrado = new ClienteSapHttp(base, "errado", buscarNaApp);
    await assert.rejects(() => tokenErrado.listarOrdens({ pagina: 1, tamanho: 10 }), /401/);
    await assert.rejects(() => tokenErrado.obterOrdem("4019821"), /401/);
    await assert.rejects(() => new ClienteSapHttp("http://sap.local", "t", registrar(() => new Response("erro", { status: 500 }))).listarOrdens({ pagina: 1, tamanho: 10 }), /500/);
    await assert.rejects(() => new ClienteSapHttp("http://sap.local", "t", registrar(() => Response.json({ coisa: 1 }))).listarOrdens({ pagina: 1, tamanho: 10 }), /Resposta inválida/);
    await assert.rejects(() => new ClienteSapHttp("http://sap.local", "t", registrar(() => Response.json({ ordens: [1, 2] }))).listarOrdens({ pagina: 1, tamanho: 10 }), /Resposta inválida/);
    await assert.rejects(() => new ClienteSapHttp("http://sap.local", "t", registrar(() => new Response("<html>", { status: 200 }))).listarOrdens({ pagina: 1, tamanho: 10 }), /JSON/);
    await assert.rejects(() => new ClienteSapHttp("http://sap.local", "t", registrar(() => Response.json([]))).obterOrdem("1"), /Resposta inválida/);
    await assert.rejects(() => new ClienteSapHttp("http://sap.local", "t", registrar(() => new Response("", { status: 503 }))).obterOrdem("1"), /503/);
    const fora = new ClienteSapHttp("http://sap.local", "t", (async () => { throw new TypeError("fetch failed"); }) as typeof fetch);
    await assert.rejects(() => fora.listarOrdens({ pagina: 1, tamanho: 10 }), /inacessível/);
    await assert.rejects(() => new ClienteSapHttp("", "t").listarOrdens({ pagina: 1, tamanho: 10 }), /SAP_API_URL/);
  });

  it("ClienteSapHttp funciona contra um servidor HTTP de verdade (porta efêmera)", async () => {
    const { serve } = await import("@hono/node-server");
    const servidor = serve({ fetch: amb.app.fetch, port: 0, hostname: "127.0.0.1" });
    try {
      await new Promise<void>((ok) => (servidor.listening ? ok() : servidor.once("listening", () => ok())));
      const endereco = servidor.address() as { port: number };
      const cliente = new ClienteSapHttp(`http://127.0.0.1:${endereco.port}/sap-simulado`, configDeTeste.sapApiToken);
      assert.equal((await cliente.listarOrdens({ pagina: 1, tamanho: 3 })).ordens.length, 3);
      assert.equal((await cliente.obterOrdem("4023470"))?.centro_trabalho, "SERV_ESP");
      assert.equal(await cliente.obterOrdem("nao-existe"), null);
    } finally {
      await new Promise<void>((ok) => servidor.close(() => ok()));
    }
  });

  it("leitura de ponta a ponta contra o simulador: cria, ignora com o motivo e avisa sobre atividade sem modelo", async () => {
    await amb.criarEquipe({ centroTrabalho: "SERV_ESP" });
    await amb.criarEquipe({ centroTrabalho: "INSTRUM" });
    const deps = { ...amb.deps, sap: new ClienteSapHttp(base, configDeTeste.sapApiToken, buscarNaApp) };
    const r = await executarLeitura(deps);
    assert.equal(r.erro, null);
    // 11 ordens nas fixtures mais a 7000001 injetada (centro SERV_ESP, liberada).
    assert.equal(r.criadas, 10);
    assert.deepEqual(
      r.ignoradas.map((i) => [i.numero_ordem, i.motivo]),
      [
        ["4031222", "Centro de trabalho sem equipe cadastrada"],
        ["4031230", "Status SAP diferente de liberada"],
      ],
    );
    assert.deepEqual(
      r.avisos.map((a) => a.numero_ordem),
      ["4019821", "4023470", "4031192", "4031210", "4031236", "7000001"],
    );
    const [corretiva] = await amb.db.select().from(os).where(eq(os.numeroOrdem, "4023470"));
    assert.deepEqual([corretiva!.planoManutencao, corretiva!.tipo, corretiva!.status, corretiva!.origem, corretiva!.codigoAtividade], [null, "corretiva", "liberada", "sap", null]);
    const [preventiva] = await amb.db.select().from(os).where(eq(os.numeroOrdem, "4019821"));
    assert.deepEqual([preventiva!.planoManutencao, preventiva!.itemManutencao, preventiva!.titulo, preventiva!.codigoAtividade], ["10573", "10603", "1.2 - Inspeção Funcional de Retificador", null]);
    assert.equal((await amb.db.select().from(atividade).where(eq(atividade.codigo, "1.2")))[0]?.modeloAprCodigo, null);

    // O SAP cancela a 4023470: a próxima leitura (só as alteradas) cancela a OS.
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 7_200_000);
    await sim("PATCH", "/ordens/4023470", { json: { status_sap: "ENCE" } });
    const r2 = await executarLeitura(deps);
    assert.deepEqual([r2.criadas, r2.atualizadas, r2.ignoradas.length], [0, 1, 0]);
    assert.equal((await amb.db.select().from(os).where(eq(os.numeroOrdem, "4023470")))[0]!.status, "cancelada");
  });
});
