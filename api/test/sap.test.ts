import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { alerta, apr, atividade, equipe, execucao, importacao, localInstalacao, modeloApr, os, reprogramacao, tarefa, usuario } from "../src/db/schema";
import { contarMotivos, faixasDoPeriodo, OUTROS_MOTIVOS } from "../src/dominio/importacao-resumo";
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
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true });
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

    // Uma hora à frente do relógio real: as leituras seguintes deste bloco continuam sendo as mais recentes do histórico.
    const cancelamento = new Date(Math.ceil(Date.now() / 1000) * 1000 + 3_600_000);
    amb.relogio.agora = cancelamento;
    comOrdens({ ...a, status_sap: "ENCE" }, { ...b, status_sap: "CNF" });
    const r = await ler();
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [0, 2, 0]);
    for (const n of [a.numero_ordem, b.numero_ordem]) {
      const o = (await osDe(n))!;
      assert.equal(o.status, "cancelada");
      assert.equal(o.canceladaEm?.toISOString(), cancelamento.toISOString());
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

  it("sem supervisor na equipe, o alerta de conflito vai para cada admin ativo", async () => {
    const outra = await amb.criarEquipe({ centroTrabalho: "SEM_SUP" });
    const a1 = await amb.criarUsuario({ perfil: "admin" });
    const a2 = await amb.criarUsuario({ perfil: "admin" });
    const inativo = await amb.criarUsuario({ perfil: "admin", ativo: false });
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
    const admin = await amb.criarUsuario({ perfil: "admin" });
    await amb.db.insert(reprogramacao).values({ osId: criada.id, usuarioId: admin.id, dataAnterior: "2026-10-12", dataNova: "2026-10-19", justificativa: "Sem acesso ao local" });
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
    const admin = await amb.criarUsuario({ perfil: "admin" });
    await amb.db.insert(reprogramacao).values({ osId: criada.id, usuarioId: admin.id, dataAnterior: "2026-10-12", dataNova: "2026-10-19", justificativa: "Chuva" });
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

  it("API fora do ar: nenhuma OS muda, a importação fica com erro e os admins recebem o alerta de falha", async () => {
    const admin = await amb.criarUsuario({ perfil: "admin" });
    const totalDeOs = async () => (await amb.db.select({ id: os.id }).from(os)).length;
    const antes = await totalDeOs();
    const o = ordem();
    comOrdens(o);
    amb.sap.falhar = true;
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 60_000);
    const r = await ler();
    assert.equal(r.erro, "SAP fora do ar");
    assert.deepEqual([r.criadas, r.atualizadas, r.ignoradas.length], [0, 0, 0]);
    assert.equal(await osDe(o.numero_ordem), undefined);
    assert.equal(await totalDeOs(), antes);
    const [i] = await amb.db.select().from(importacao).where(eq(importacao.id, r.importacaoId));
    assert.deepEqual([i!.origem, i!.erro, i!.criadas], ["api", "SAP fora do ar", 0]);

    const lista = await amb.esperar(200, "GET", "/importacoes", { como: admin });
    assert.equal(lista.importacoes[0].id, r.importacaoId);
    assert.equal(lista.importacoes[0].erro, "SAP fora do ar");
    assert.equal("ultima_leitura_com_erro" in lista, false);

    // A leitura agendada não tem autor: o alerta vai para cada admin ativo, sem OS e apontando para a importação.
    const alertasDe = () => amb.db.select().from(alerta).where(and(eq(alerta.destinatarioId, admin.id), eq(alerta.tipo, "falha_importacao")));
    const [primeiro, ...outros] = await alertasDe();
    assert.equal(outros.length, 0);
    assert.deepEqual([primeiro!.osId, primeiro!.importacaoId, primeiro!.lidoEm, primeiro!.emailEnviadoEm], [null, r.importacaoId, null, null]);
    assert.equal(primeiro!.detalhe, "A sincronização com a API do SAP falhou: SAP fora do ar. Nenhuma OS foi criada, alterada ou removida.");
    const sino = await amb.esperar(200, "GET", "/alertas", { como: admin, consulta: { lido: false } });
    const noSino = sino.alertas.find((a: any) => a.id === primeiro!.id);
    assert.deepEqual([noSino.tipo, noSino.os_id, noSino.numero_ordem, noSino.titulo, noSino.importacao_id, noSino.importacao_origem], ["falha_importacao", null, null, null, r.importacaoId, "api"]);

    // Outra falha antes de ler o alerta reaproveita o mesmo: aponta para a falha nova e sobe para o topo.
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 60_000);
    const segunda = await ler();
    const [reaproveitado, ...nenhum] = await alertasDe();
    assert.equal(nenhum.length, 0);
    assert.deepEqual([reaproveitado!.id, reaproveitado!.importacaoId, reaproveitado!.criadoEm.getTime()], [primeiro!.id, segunda.importacaoId, amb.relogio.agora.getTime()]);

    // Lido o alerta, a próxima falha abre um novo.
    await amb.esperar(200, "PATCH", `/alertas/${primeiro!.id}`, { como: admin, json: { lido: true } });
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 60_000);
    await ler();
    assert.equal((await alertasDe()).length, 2);

    amb.sap.falhar = false;
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 60_000);
    const boa = await ler();
    assert.equal(boa.erro, null);
    assert.ok(await osDe(o.numero_ordem));
    assert.equal((await alertasDe()).length, 2);
  });

  it("\"Sincronizar agora\" que falha avisa só quem pediu", async () => {
    const quemPediu = await amb.criarUsuario({ perfil: "admin" });
    const outroAdmin = await amb.criarUsuario({ perfil: "admin" });
    const pedido = await amb.esperar(202, "POST", "/sap/leituras", { como: quemPediu });
    amb.sap.falhar = true;
    try {
      await manipularLeituraSap(amb.deps, { id: randomUUID(), referenciaId: pedido.importacao_id });
    } finally {
      amb.sap.falhar = false;
    }
    const doPedido = await amb.db.select().from(alerta).where(eq(alerta.importacaoId, pedido.importacao_id));
    assert.deepEqual(
      doPedido.map((a) => a.destinatarioId),
      [quemPediu.id],
    );
    assert.equal((await amb.db.select().from(alerta).where(eq(alerta.destinatarioId, outroAdmin.id))).length, 0);
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
  const consultas: (Date | undefined)[] = [];

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-12T10:00:00Z") });
    equipeId = (await amb.criarEquipe({ centroTrabalho: CT })).id;
    admin = await amb.criarUsuario({ perfil: "admin" });
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
    const corpo = await amb.esperar(202, "POST", "/sap/leituras", { como: admin });
    assert.match(corpo.importacao_id, /^[0-9a-f-]{36}$/);
    const [i] = await amb.db.select().from(importacao).where(eq(importacao.id, corpo.importacao_id));
    assert.deepEqual([i!.origem, i!.usuarioId, i!.erro, i!.criadas], ["api", admin.id, null, 0]);
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
    assert.deepEqual([depois!.criadas, depois!.erro, depois!.usuarioId], [1, null, admin.id]);
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

  it("só o admin lê o SAP e vê as importações", async () => {
    const supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true });
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    // O relógio andou nos testes anteriores: os tokens do `before` já expiraram, então os de quem tem acesso são novos.
    admin = await amb.criarUsuario({ perfil: "admin" });
    assert.equal((await amb.req("POST", "/sap/leituras")).status, 401);
    for (const u of [supervisor, tecnico]) {
      assert.equal((await amb.req("POST", "/sap/leituras", { como: u })).status, 403, u.perfil);
      assert.equal((await amb.req("GET", "/importacoes", { como: u })).status, 403, u.perfil);
      assert.equal((await amb.req("POST", "/importacoes", { como: u, form: new FormData() })).status, 403, u.perfil);
    }
    await amb.esperar(202, "POST", "/sap/leituras", { como: admin });
    await amb.esperar(200, "GET", "/importacoes", { como: admin });
  });

  it("GET /importacoes pagina, do mais recente ao mais antigo, com as contagens e quem fez", async () => {
    const pagina1 = await amb.esperar(200, "GET", "/importacoes", { como: admin, consulta: { tamanho: 2 } });
    assert.equal(pagina1.importacoes.length, 2);
    assert.equal(pagina1.pagina, 1);
    assert.equal(pagina1.tamanho, 2);
    assert.ok(pagina1.total >= 5);
    assert.ok(pagina1.importacoes[0].criada_em >= pagina1.importacoes[1].criada_em);
    assert.deepEqual(Object.keys(pagina1.importacoes[0]).sort(), ["arquivo", "atualizadas", "criada_em", "criadas", "detalhe_ignoradas", "erro", "id", "ignoradas", "origem", "usuario_id", "usuario_nome"]);
    const todas = await amb.esperar(200, "GET", "/importacoes", { como: admin });
    const feita = todas.importacoes.find((i: any) => i.usuario_id === admin.id);
    const [dono] = await amb.db.select({ nome: usuario.nome }).from(usuario).where(eq(usuario.id, admin.id));
    assert.equal(feita.usuario_nome, dono!.nome);
  });
});

describe("Integração SAP: diagnóstico da entrada de OS e sincronização", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;

  before(async () => {
    // Quarta-feira, 14/10/2026, 12h em São Paulo.
    amb = await criarAmbiente({ relogio: new Date("2026-10-14T15:00:00Z") });
    admin = await amb.criarUsuario({ perfil: "admin" });
    await amb.db.insert(importacao).values([
      {
        origem: "api",
        criadas: 3,
        atualizadas: 2,
        ignoradas: 1,
        detalheIgnoradas: [{ numero_ordem: "4100001", motivo: "Status SAP diferente de liberada" }],
        criadaEm: new Date("2026-10-14T13:00:00Z"),
      },
      // 23h do dia 12 em São Paulo (já dia 13 em UTC): conta no dia 12.
      {
        origem: "planilha",
        arquivo: "x/ordens.xlsx",
        usuarioId: admin.id,
        criadas: 5,
        ignoradas: 3,
        detalheIgnoradas: [
          { linha: 2, centro_trabalho: "CT_X", motivo: "Centro de trabalho sem equipe cadastrada" },
          { linha: 3, motivo: "Ordem inválida: data_fim_prog: A data fim programada é anterior ao início" },
          { linha: 4, motivo: "Ordem inválida: titulo: obrigatório" },
        ],
        criadaEm: new Date("2026-10-13T02:00:00Z"),
      },
      { origem: "api", erro: "SAP fora do ar", criadaEm: new Date("2026-10-10T12:00:00Z") },
      { origem: "api", criadas: 4, criadaEm: new Date("2026-10-05T12:00:00Z") },
      {
        origem: "planilha",
        arquivo: "y/antiga.xlsx",
        criadas: 7,
        ignoradas: 1,
        detalheIgnoradas: [{ linha: 9, motivo: "Reprogramada no sistema" }],
        criadaEm: new Date("2026-09-01T12:00:00Z"),
      },
      { origem: "api", criadas: 9, criadaEm: new Date("2025-10-20T12:00:00Z") },
    ]);
  });
  after(() => amb.fechar());

  const resumo = (periodo?: string) => amb.esperar(200, "GET", "/importacoes/resumo", { como: admin, consulta: { periodo } });

  it("7 dias: um ponto por dia até hoje, criadas por origem e leituras no dia de São Paulo, totais e o período anterior", async () => {
    const r = await resumo("7d");
    assert.deepEqual([r.periodo, r.agrupamento, r.de, r.ate], ["7d", "dia", "2026-10-08", "2026-10-14"]);
    assert.equal(r.serie.length, 7);
    assert.deepEqual(r.serie.at(-1), { inicio: "2026-10-14", fim: "2026-10-15", api: 3, planilha: 0, leituras: 1, falhas: 0 });
    assert.deepEqual(r.serie.find((p: any) => p.inicio === "2026-10-12"), { inicio: "2026-10-12", fim: "2026-10-13", api: 0, planilha: 5, leituras: 0, falhas: 0 });
    assert.deepEqual(r.serie.find((p: any) => p.inicio === "2026-10-10"), { inicio: "2026-10-10", fim: "2026-10-11", api: 0, planilha: 0, leituras: 1, falhas: 1 });
    assert.deepEqual(r.totais, { criadas: 8, atualizadas: 2, ignoradas: 4 });
    assert.deepEqual(r.por_origem.api, { criadas: 3, atualizadas: 2, ignoradas: 1, leituras: 2, leituras_com_erro: 1 });
    assert.deepEqual(r.por_origem.planilha, { criadas: 5, atualizadas: 0, ignoradas: 3, arquivos: 1, arquivos_com_erro: 0 });
    assert.deepEqual(r.anterior, { criadas: 4, atualizadas: 0, ignoradas: 0 });
  });

  it("os motivos das linhas ignoradas são só do período, agrupados pelo início do texto e do mais comum ao menos", async () => {
    assert.deepEqual((await resumo("7d")).motivos_ignoradas, [
      { motivo: "Ordem inválida", total: 2 },
      { motivo: "Centro de trabalho sem equipe cadastrada", total: 1 },
      { motivo: "Status SAP diferente de liberada", total: 1 },
    ]);
    assert.ok((await resumo("12m")).motivos_ignoradas.some((m: any) => m.motivo === "Reprogramada no sistema" && m.total === 1));
  });

  it("acima de cinco motivos, os menos comuns somam em \"Outros motivos\"; detalhe sem motivo não quebra a contagem", () => {
    const linhas = (motivo: string, n: number) => Array.from({ length: n }, () => ({ motivo }));
    const contados = contarMotivos([[...linhas("A", 6), ...linhas("B", 5), ...linhas("C", 4), ...linhas("D", 3), ...linhas("E", 2), ...linhas("F", 1)], [{}], null, "x"]);
    assert.deepEqual(contados, [
      { motivo: "A", total: 6 },
      { motivo: "B", total: 5 },
      { motivo: "C", total: 4 },
      { motivo: "D", total: 3 },
      { motivo: OUTROS_MOTIVOS, total: 4 },
    ]);
    assert.deepEqual(contarMotivos([[{}]]), [{ motivo: "Sem motivo informado", total: 1 }]);
  });

  it("sem período são 30 dias; 90 dias vira 13 semanas de segunda a domingo; 12 meses, um ponto por mês", async () => {
    const trinta = await resumo();
    assert.deepEqual([trinta.periodo, trinta.serie.length, trinta.de, trinta.totais.criadas, trinta.anterior.criadas], ["30d", 30, "2026-09-15", 12, 7]);

    const semanas = await resumo("90d");
    assert.equal(semanas.agrupamento, "semana");
    assert.equal(semanas.serie.length, 13);
    assert.deepEqual([semanas.serie[0].inicio, semanas.serie.at(-1).inicio, semanas.serie.at(-1).fim], ["2026-07-20", "2026-10-12", "2026-10-19"]);
    assert.deepEqual([semanas.serie.at(-1).api, semanas.serie.at(-1).planilha], [3, 5]);
    assert.deepEqual([semanas.serie.at(-2).api, semanas.serie.at(-2).planilha, semanas.serie.at(-2).leituras, semanas.serie.at(-2).falhas], [4, 0, 2, 1]);

    const meses = await resumo("12m");
    assert.equal(meses.agrupamento, "mes");
    assert.deepEqual(
      [meses.serie.length, meses.serie[0].inicio, meses.serie.at(-1).inicio, meses.serie.at(-1).fim],
      [12, "2025-11-01", "2026-10-01", "2026-11-01"],
    );
    assert.equal(meses.serie.find((p: any) => p.inicio === "2026-09-01").planilha, 7);
    assert.deepEqual([meses.totais.criadas, meses.anterior.criadas], [19, 9]);
  });

  it("período inválido é 422; só o admin vê o diagnóstico e a sincronização", async () => {
    assert.equal((await amb.req("GET", "/importacoes/resumo", { como: admin, consulta: { periodo: "1a" } })).status, 422);
    for (const caminho of ["/importacoes/resumo", "/sap/sincronizacao"]) {
      assert.equal((await amb.req("GET", caminho)).status, 401, caminho);
      for (const perfil of ["tecnico"] as const) {
        const u = await amb.criarUsuario({ perfil });
        assert.equal((await amb.req("GET", caminho, { como: u })).status, 403, `${caminho} ${perfil}`);
      }
      await amb.esperar(200, "GET", caminho, { como: await amb.criarUsuario({ perfil: "admin" }) });
    }
  });

  it("as faixas atravessam a virada do ano e o período anterior tem o mesmo tamanho", () => {
    const meses = faixasDoPeriodo("12m", "2026-01-15");
    assert.deepEqual([meses.faixas[0], meses.faixas.at(-1), meses.anterior], [
      { inicio: "2025-02-01", fim: "2025-03-01" },
      { inicio: "2026-01-01", fim: "2026-02-01" },
      { inicio: "2024-02-01", fim: "2025-02-01" },
    ]);
    const dias = faixasDoPeriodo("7d", "2026-01-02");
    assert.deepEqual([dias.faixas[0]!.inicio, dias.faixas.at(-1)!.fim, dias.anterior], ["2025-12-27", "2026-01-03", { inicio: "2025-12-20", fim: "2025-12-27" }]);
    // Domingo pertence à semana que começou na segunda anterior.
    assert.equal(faixasDoPeriodo("90d", "2026-10-18").faixas.at(-1)!.inicio, "2026-10-12");
  });

  it("GET /sap/sincronizacao: última leitura sem erro, leitura automática e o intervalo; uma falha não muda a última leitura boa", async () => {
    const sincronizacao = () => amb.esperar(200, "GET", "/sap/sincronizacao", { como: admin });
    assert.deepEqual(await sincronizacao(), { ultima_leitura_sem_erro_em: "2026-10-14T13:00:00.000Z", automatica: true, intervalo_min: 15 });
    // Uma leitura mais nova com erro não muda a última leitura boa (a falha vira alerta, ver a leitura das ordens).
    await amb.db.insert(importacao).values({ origem: "api", erro: "SAP fora do ar", criadaEm: new Date("2026-10-14T14:00:00Z") });
    assert.deepEqual(await sincronizacao(), { ultima_leitura_sem_erro_em: "2026-10-14T13:00:00.000Z", automatica: true, intervalo_min: 15 });
  });
});

describe("Integração SAP: planilha", () => {
  let amb: Ambiente;
  let equipeId: string;
  let admin: UsuarioDeTeste;

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
  const enviar = (arquivo: File, como: UsuarioDeTeste | null = admin) => {
    const form = new FormData();
    form.set("arquivo", arquivo);
    return amb.req("POST", "/importacoes", { como, form });
  };
  const osDe = async (numero: string) => (await amb.db.select().from(os).where(eq(os.numeroOrdem, numero)))[0];

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    equipeId = (await amb.criarEquipe({ centroTrabalho: CT })).id;
    admin = await amb.criarUsuario({ perfil: "admin" });
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
    assert.deepEqual([i!.origem, i!.usuarioId, i!.criadas, i!.atualizadas, i!.ignoradas, i!.erro], ["planilha", admin.id, 3, 0, 5, null]);
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

  it("arquivo que não é o export esperado: 422, nenhuma OS muda, a falha fica no histórico e quem enviou recebe o alerta", async () => {
    const totalDeOs = async () => (await amb.db.select({ id: os.id }).from(os)).length;
    const osAntes = await totalDeOs();
    const r = await enviar(await xlsx([["Ordem", "Tipo", "Título"], [4200040, "YBA1", "x"]], "export errado.xlsx"));
    assert.equal(r.status, 422);
    assert.equal(r.corpo.erro.mensagem, "Colunas obrigatórias ausentes: Centro de trabalho, Local de instalação, Início programado");
    assert.equal(await osDe("4200040"), undefined);
    assert.equal(await totalDeOs(), osAntes);

    // O registro da tentativa, com o erro e o arquivo enviado (para conferir o que veio).
    const [falha] = await amb.db.select().from(importacao).where(eq(importacao.erro, r.corpo.erro.mensagem));
    assert.deepEqual([falha!.origem, falha!.usuarioId, falha!.criadas, falha!.atualizadas, falha!.ignoradas], ["planilha", admin.id, 0, 0, 0]);
    assert.equal(falha!.arquivo, `${falha!.id}/export_errado.xlsx`);
    assert.ok(await amb.armazenamento.ler("importacoes", falha!.arquivo!));

    const alertasDoAdmin = () => amb.db.select().from(alerta).where(and(eq(alerta.destinatarioId, admin.id), eq(alerta.tipo, "falha_importacao")));
    const [aviso, ...outros] = await alertasDoAdmin();
    assert.equal(outros.length, 0);
    assert.deepEqual([aviso!.importacaoId, aviso!.osId, aviso!.lidoEm], [falha!.id, null, null]);
    assert.equal(
      aviso!.detalhe,
      'A importação da planilha "export errado.xlsx" falhou: Colunas obrigatórias ausentes: Centro de trabalho, Local de instalação, Início programado. Nenhuma OS foi criada, alterada ou removida.',
    );

    // Outra planilha recusada antes de o alerta ser lido: o mesmo alerta passa a apontar para ela.
    const vazia = await enviar(await xlsx([]));
    assert.equal(vazia.status, 422);
    assert.match(vazia.corpo.erro.mensagem, /^Colunas obrigatórias ausentes: Ordem, Tipo de ordem, Título/);
    const [atualizado, ...nenhum] = await alertasDoAdmin();
    assert.equal(nenhum.length, 0);
    assert.equal(atualizado!.id, aviso!.id);
    assert.notEqual(atualizado!.importacaoId, falha!.id);
  });

  it("erro inesperado ao gravar: 500, nenhuma OS muda e a falha vira alerta", async () => {
    const outro = await amb.criarUsuario({ perfil: "admin" });
    const gravarOriginal = amb.armazenamento.gravar.bind(amb.armazenamento);
    const erroOriginal = console.error;
    amb.armazenamento.gravar = async () => {
      throw new Error("disco cheio");
    };
    console.error = () => {};
    try {
      const r = await enviar(await xlsx([CABECALHO, linhaBoa(4200045)]), outro);
      assert.equal(r.status, 500);
    } finally {
      amb.armazenamento.gravar = gravarOriginal;
      console.error = erroOriginal;
    }
    assert.equal(await osDe("4200045"), undefined);
    const [aviso] = await amb.db.select().from(alerta).where(eq(alerta.destinatarioId, outro.id));
    assert.match(aviso!.detalhe, /falhou: erro inesperado ao gravar as ordens\. Nenhuma OS foi criada, alterada ou removida\.$/);
    const [falha] = await amb.db.select().from(importacao).where(eq(importacao.id, aviso!.importacaoId!));
    assert.deepEqual([falha!.erro, falha!.arquivo], ["erro inesperado ao gravar as ordens", null]);
  });

  it("recusa o que não é uma planilha .xlsx, o envio sem arquivo e o arquivo vazio", async () => {
    const texto = await enviar(new File(["ordem;tipo\n1;YBA1"], "ordens.csv", { type: "text/csv" }));
    assert.equal(texto.status, 422);
    assert.equal(texto.corpo.erro.codigo, "planilha_invalida");
    assert.equal((await amb.req("POST", "/importacoes", { como: admin, form: new FormData() })).status, 422);
    assert.equal((await amb.req("POST", "/importacoes", { como: admin, json: {} })).status, 422);
    assert.equal((await enviar(new File([], "vazio.xlsx"))).status, 422);
  });

  it("só o admin importa; sem token é 401", async () => {
    const arquivo = await xlsx([CABECALHO, linhaBoa(4200050)]);
    assert.equal((await enviar(arquivo, null)).status, 401);
    for (const perfil of ["tecnico"] as const) {
      const u = await amb.criarUsuario({ perfil, equipeId });
      assert.equal((await enviar(arquivo, u)).status, 403, perfil);
    }
    const admin = await amb.criarUsuario({ perfil: "admin" });
    assert.equal((await enviar(arquivo, admin)).status, 201);
    assert.ok(await osDe("4200050"));
  });

  it("a lista de importações mostra a planilha com o arquivo e quem enviou, e também as que falharam", async () => {
    const lista = await amb.esperar(200, "GET", "/importacoes", { como: admin });
    const planilhas = lista.importacoes.filter((i: any) => i.origem === "planilha");
    const boas = planilhas.filter((i: any) => i.erro === null);
    assert.ok(boas.length >= 3);
    assert.ok(boas.every((i: any) => i.arquivo.endsWith(".xlsx")));
    assert.ok(planilhas.some((i: any) => i.erro?.startsWith("Colunas obrigatórias ausentes")));
    assert.equal("ultima_leitura_com_erro" in lista, false);
  });
});

describe("Integração SAP: OS de apoio e locais", () => {
  let amb: Ambiente;
  let equipeA: string;
  let equipeB: string;
  let localId: string;
  /** OS lida do SAP, da equipe A: a que o apoio destrava. */
  let originalId: string;
  let admin: UsuarioDeTeste;
  let supervisorA: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;

  const corpoOs = (extra: Record<string, unknown> = {}) => ({
    tipo: "corretiva",
    titulo: "Drenar caixa de válvula",
    descricao: "Caixa cheia d'água",
    local_instalacao_id: localId,
    equipe_id: equipeB,
    data_inicio_prog: "2026-10-12",
    prioridade: "Muito alto",
    os_origem_id: originalId,
    ...extra,
  });
  const osPorId = async (id: string) => (await amb.db.select().from(os).where(eq(os.id, id)))[0]!;
  const osDoSap = async (equipeId: string) => {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: proximoNumero(), tipo: "corretiva", titulo: "OS do SAP", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-12", origem: "sap" })
      .returning({ id: os.id });
    return o!.id;
  };

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    equipeA = (await amb.criarEquipe({ centroTrabalho: "A" })).id;
    equipeB = (await amb.criarEquipe({ centroTrabalho: "B" })).id;
    admin = await amb.criarUsuario({ perfil: "admin" });
    supervisorA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, supervisor: true });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA });
    localId = (await amb.db.insert(localInstalacao).values({ codigo: "LOCAL/APOIO" }).returning({ id: localInstalacao.id }))[0]!.id;
    originalId = await osDoSap(equipeA);
  });
  after(() => amb.fechar());

  it("OS de apoio: o admin abre para qualquer equipe; nasce liberada, origem apoio, sem número de ordem, ligada à original", async () => {
    for (const [u, equipe] of [[admin, equipeB], [admin, equipeA]] as const) {
      const c = await amb.esperar(201, "POST", "/os", { como: u, json: corpoOs({ equipe_id: equipe, equipamento: "EQ-7", data_fim_prog: "2026-10-13" }) });
      const o = await osPorId(c.id);
      assert.deepEqual(
        [o.origem, o.status, o.numeroOrdem, o.equipeId, o.tipo, o.titulo, o.descricao, o.prioridade, o.equipamento, o.dataInicioProg, o.dataFimProg, o.osOrigemId],
        ["apoio", "liberada", null, equipe, "corretiva", "Drenar caixa de válvula", "Caixa cheia d'água", "Muito alto", "EQ-7", "2026-10-12", "2026-10-13", originalId],
      );
    }
  });

  it("supervisor abre OS de apoio para qualquer equipe, a partir de uma OS que ele vê; a original continua como está", async () => {
    await amb.db.update(os).set({ status: "pendente" }).where(eq(os.id, originalId));
    const antes = await osPorId(originalId);

    const apoio = await amb.esperar(201, "POST", "/os", { como: supervisorA, json: corpoOs({ equipe_id: equipeB }) });
    const o = await osPorId(apoio.id);
    assert.deepEqual([o.osOrigemId, o.equipeId, o.origem, o.status], [originalId, equipeB, "apoio", "liberada"]);
    assert.deepEqual(await osPorId(originalId), antes);

    const daPropriaEquipe = await amb.esperar(201, "POST", "/os", { como: supervisorA, json: corpoOs({ equipe_id: equipeA }) });
    assert.equal((await osPorId(daPropriaEquipe.id)).equipeId, equipeA);
  });

  it("não existe OS sem origem no SAP: sem os_origem_id é 422, e o número de ordem e o solicitante enviados são ignorados", async () => {
    const semOrigem: Record<string, unknown> = corpoOs();
    delete semOrigem.os_origem_id;
    for (const u of [admin, supervisorA]) assert.equal((await amb.req("POST", "/os", { como: u, json: semOrigem })).status, 422, u.perfil);
    assert.equal((await amb.req("POST", "/os", { como: admin, json: { ...semOrigem, os_origem_id: null } })).status, 422);

    const c = await amb.esperar(201, "POST", "/os", { como: admin, json: corpoOs({ numero_ordem: "9000001", solicitante: "Central" }) });
    const o = await osPorId(c.id);
    assert.deepEqual([o.numeroOrdem, o.solicitante, o.origem], [null, null, "apoio"]);
    assert.equal((await amb.db.select().from(os).where(eq(os.numeroOrdem, "9000001"))).length, 0);
  });

  it("técnico não cria OS; sem token é 401", async () => {
    assert.equal((await amb.req("POST", "/os", { json: corpoOs() })).status, 401);
    assert.equal((await amb.req("POST", "/os", { como: tecnico, json: corpoOs() })).status, 403);
  });

  it("a OS de origem precisa existir e, para o supervisor, ser de uma equipe que ele vê", async () => {
    const inexistente = await amb.req("POST", "/os", { como: admin, json: corpoOs({ os_origem_id: randomUUID() }) });
    assert.equal(inexistente.status, 422);
    assert.equal(inexistente.corpo.erro.codigo, "os_origem_inexistente");
    const deB = await osDoSap(equipeB);
    assert.equal((await amb.req("POST", "/os", { como: supervisorA, json: corpoOs({ os_origem_id: deB }) })).status, 422);
    // Supervisor de outra equipe (sem equipe própria): não vê a OS de origem.
    const semEquipe = await amb.criarUsuario({ perfil: "tecnico", equipeId: null });
    await amb.criarEquipe({ supervisorId: semEquipe.id });
    assert.equal((await amb.req("POST", "/os", { como: semEquipe, json: corpoOs() })).status, 422);
    assert.equal((await amb.req("POST", "/os", { como: admin, json: corpoOs({ os_origem_id: deB }) })).status, 201);
  });

  it("valida o corpo: tipo, datas, referências e atividade", async () => {
    const quer = async (status: number, extra: Record<string, unknown>) => {
      const r = await amb.req("POST", "/os", { como: admin, json: corpoOs(extra) });
      assert.equal(r.status, status, JSON.stringify([extra, r.corpo]));
      return r.corpo;
    };
    await quer(422, { tipo: "outro" });
    await quer(422, { titulo: "  " });
    await quer(422, { data_inicio_prog: "12/10/2026" });
    await quer(422, { data_inicio_prog: "2026-02-31" });
    await quer(422, { os_origem_id: "nao-e-uuid" });
    assert.equal((await quer(422, { data_fim_prog: "2026-10-01" })).erro.codigo, "datas_invalidas");
    assert.equal((await quer(422, { local_instalacao_id: randomUUID() })).erro.codigo, "local_inexistente");
    assert.equal((await quer(422, { equipe_id: randomUUID() })).erro.codigo, "equipe_inexistente");
    assert.equal((await quer(422, { codigo_atividade: "não existe" })).erro.codigo, "atividade_inexistente");

    const comAtividade = await quer(201, { codigo_atividade: ATIVIDADE_COM_MODELO });
    assert.equal((await osPorId(comAtividade.id)).codigoAtividade, ATIVIDADE_COM_MODELO);
  });

  it("POST /locais não existe: o local só vem do SAP", async () => {
    for (const u of [supervisorA, admin]) assert.equal((await amb.req("POST", "/locais", { como: u, json: { codigo: "CARIACICA/RAMAL NOVO" } })).status, 404, u.perfil);
    assert.equal((await amb.db.select().from(localInstalacao).where(eq(localInstalacao.codigo, "CARIACICA/RAMAL NOVO"))).length, 0);
  });

  it("PATCH /locais/{id}: só o admin muda a criticidade", async () => {
    await amb.esperar(200, "PATCH", `/locais/${localId}`, { como: admin, json: { critico: true } });
    assert.equal((await amb.db.select().from(localInstalacao).where(eq(localInstalacao.id, localId)))[0]!.critico, true);
    await amb.esperar(200, "PATCH", `/locais/${localId}`, { como: admin, json: { critico: false } });
    assert.equal((await amb.db.select().from(localInstalacao).where(eq(localInstalacao.id, localId)))[0]!.critico, false);
    for (const u of [supervisorA, tecnico]) assert.equal((await amb.req("PATCH", `/locais/${localId}`, { como: u, json: { critico: true } })).status, 403, u.perfil);
    assert.equal((await amb.req("PATCH", `/locais/${randomUUID()}`, { como: admin, json: { critico: true } })).status, 404);
    assert.equal((await amb.req("PATCH", "/locais/nao-e-uuid", { como: admin, json: { critico: true } })).status, 404);
    assert.equal((await amb.req("PATCH", `/locais/${localId}`, { como: admin, json: { critico: "sim" } })).status, 422);
  });

  it("GET /locais: qualquer perfil lê, com paginação e filtro por trecho do código (sem tratar % como curinga)", async () => {
    await amb.db.insert(localInstalacao).values(["ZZ/LISTA 1", "ZZ/LISTA 2", "ZZ/LISTA 3", "ZZ_100%"].map((codigo) => ({ codigo })));
    for (const u of [tecnico, supervisorA, admin]) assert.equal((await amb.req("GET", "/locais", { como: u })).status, 200, u.perfil);
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

  let admin: UsuarioDeTeste;
  /** A gestão do simulador (o que a tela `/simulador/ordens` usa): com o admin logado, não com o token do SAP. */
  const gestao = (metodo: string, caminho: string, json?: unknown) => amb.req(metodo, `/sap-simulado/gestao${caminho}`, { como: admin, ...(json !== undefined ? { json } : {}) });

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
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-12T12:00:00Z"), duracaoDoTokenSeg: 24 * 3600 });
    admin = await amb.criarUsuario({ perfil: "admin" });
  });
  after(() => amb.fechar());

  it("exige o token do SAP, mas não login de usuário; o contrato é só leitura (sem POST nem PATCH)", async () => {
    assert.equal((await sim("GET", "/ordens", { token: null })).status, 401);
    assert.equal((await sim("GET", "/ordens", { token: "errado" })).status, 401);
    assert.equal((await sim("GET", "/ordens/4023470", { token: "errado" })).status, 401);
    assert.equal((await sim("POST", "/ordens", { token: "errado", json: {} })).status, 401);
    assert.equal((await sim("POST", "/ordens", { json: ordem({ numero_ordem: "7999999" }) })).status, 404, "criar ordem não é do contrato: é da gestão");
    assert.equal((await sim("PATCH", "/ordens/4023470", { json: { status_sap: "ENCE" } })).status, 404, "mudar o status também");
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

  it("a gestão cria uma ordem (201), recusa repetida (409) e inválida (422); alteradas_desde filtra pelo que mudou", async () => {
    const nova = ordem({ numero_ordem: "7000001", status_sap: "LIB" });
    const criada = await gestao("POST", "/ordens", nova);
    assert.equal(criada.status, 201);
    assert.equal(criada.corpo.ordem.numero_ordem, "7000001");
    assert.equal(criada.corpo.ordem.local_instalacao.codigo, "LOCAL/A");
    assert.equal((await sim("GET", "/ordens/7000001")).status, 200);
    assert.equal((await gestao("POST", "/ordens", nova)).status, 409);
    assert.equal((await gestao("POST", "/ordens", { ...nova, numero_ordem: "7000002", tipo_ordem: "XX" })).status, 422);
    assert.equal((await gestao("POST", "/ordens", { titulo: "sem nada" })).status, 422);

    // As fixtures são de antes de agora; só a OS injetada mudou depois de `desde`.
    const desde = new Date(amb.relogio.agora.getTime() - 60_000).toISOString();
    const alteradas = (await sim("GET", "/ordens", { consulta: { alteradas_desde: desde } })).corpo.ordens.map((o: any) => o.numero_ordem);
    assert.deepEqual(alteradas, ["7000001"]);
  });

  it("a gestão muda o status SAP (200), a ordem passa a contar como alterada, e a ordem inexistente é 404", async () => {
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 3_600_000);
    const mudou = await gestao("PATCH", "/ordens/4023470", { status_sap: "ENCE" });
    assert.equal(mudou.status, 200);
    assert.equal(mudou.corpo.ordem.status_sap, "ENCE");
    assert.equal((await sim("GET", "/ordens/4023470")).corpo.status_sap, "ENCE");
    const desde = new Date(amb.relogio.agora.getTime() - 60_000).toISOString();
    assert.deepEqual((await sim("GET", "/ordens", { consulta: { alteradas_desde: desde } })).corpo.ordens.map((o: any) => o.numero_ordem), ["4023470"]);
    assert.equal((await gestao("PATCH", "/ordens/0000000", { status_sap: "ENCE" })).status, 404);
    assert.equal((await gestao("PATCH", "/ordens/4023470", { numero_ordem: "9999999" })).status, 422, "o número da ordem não muda");
    // Devolve ao estado inicial para os próximos testes.
    await gestao("PATCH", "/ordens/4023470", { status_sap: "LIB IMPR CAPC" });
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
    await gestao("PATCH", "/ordens/4023470", { status_sap: "ENCE" });
    const r2 = await executarLeitura(deps);
    assert.deepEqual([r2.criadas, r2.atualizadas, r2.ignoradas.length], [0, 1, 0]);
    assert.equal((await amb.db.select().from(os).where(eq(os.numeroOrdem, "4023470")))[0]!.status, "cancelada");
  });
});
