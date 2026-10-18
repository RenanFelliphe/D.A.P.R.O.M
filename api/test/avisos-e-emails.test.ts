import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { alerta, equipe, importacao, os, tarefa, treinamentoServico, usuario, vitoriaUso } from "../src/db/schema";
import { atualizarSupervisaoDasEquipes } from "../src/dominio/representacao";
import { agendarLeituraDiariaRh } from "../src/dominio/rh";
import { avisarProblemaReportado, avisarTreinamentoPublicado } from "../src/dominio/treinamento-servico";
import { diaDe } from "../src/dominio/tempo";
import { agendarResumosDiarios } from "../src/servicos/email-resumo";
import { executarLeitura } from "../src/servicos/leitura-sap";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { configDeTeste, criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { criarOs } from "./fixture-os";

/** 10h de São Paulo de um sábado: depois da leitura diária do RH (3h) e do resumo diário (7h). */
const AGORA = new Date("2026-10-17T13:00:00Z");
const minutosDepois = (d: Date, n: number) => new Date(d.getTime() + n * 60_000);
const SENHA_INICIAL = "senha-inicial-1";

type LinhaAlerta = typeof alerta.$inferSelect;

/** Os avisos de um tipo (de todos, ou só os de um destinatário). */
async function avisos(amb: Ambiente, tipo: LinhaAlerta["tipo"], destinatarioId?: string): Promise<LinhaAlerta[]> {
  return amb.db.select().from(alerta).where(and(eq(alerta.tipo, tipo), destinatarioId ? eq(alerta.destinatarioId, destinatarioId) : undefined));
}

/** Roda o executor até não sobrar tarefa vencida, avançando o relógio para pegar as novas tentativas. */
async function esgotarTarefas(amb: Ambiente, rodadas = 6) {
  for (let i = 0; i < rodadas; i++) {
    await executarTarefasPendentes(amb.deps);
    amb.relogio.agora = minutosDepois(amb.relogio.agora, 20);
  }
}

describe("Avisos de conta e de cadastro", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let admin2: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA, duracaoDoTokenSeg: 7 * 24 * 3600 });
    equipeId = (await amb.criarEquipe({ nome: "Serviços Especiais", centroTrabalho: "SERV_ESP" })).id;
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Ana Admin" });
    admin2 = await amb.criarUsuario({ perfil: "admin", nome: "Beto Admin" });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: "Sérgio Supervisor" });
  });
  after(() => amb.fechar());

  async function cadastrarPeloSupervisor(matricula: string): Promise<string> {
    amb.registrarFuncionario({ matricula, nome: `Técnico ${matricula}` });
    const { id } = await amb.esperar(201, "POST", "/usuarios", { como: supervisor, json: { matricula, email: `${matricula.toLowerCase()}@empresa.com.br`, senha_inicial: SENHA_INICIAL } });
    return id;
  }

  it("o cadastro do supervisor avisa a pessoa (conta criada) e os admins (aguardando liberação); liberar avisa a pessoa e o supervisor e tira o pendente do não lido", async () => {
    const novo = await cadastrarPeloSupervisor("T100");
    const [conta] = await avisos(amb, "conta_criada", novo);
    assert.ok(conta, "a pessoa recebe o aviso da conta");
    assert.match(conta!.detalhe, /Sérgio Supervisor criou a sua conta/);
    assert.match(conta!.detalhe, /t100@empresa\.com\.br/);
    assert.match(conta!.detalhe, /Campo de treino/);
    const pendentes = await avisos(amb, "cadastro_pendente");
    assert.deepEqual(pendentes.map((a) => a.destinatarioId).sort(), [admin.id, admin2.id].sort());
    assert.ok(pendentes.every((a) => a.usuarioAlvoId === novo && a.lidoEm === null));
    // Cada aviso com e-mail tem a sua tarefa.
    const tarefas = await amb.db.select().from(tarefa).where(eq(tarefa.tipo, "email_alerta"));
    for (const a of [conta!, ...pendentes]) assert.ok(tarefas.some((t) => t.referenciaId === a.id));

    await amb.esperar(200, "POST", `/usuarios/${novo}/liberar`, { como: admin });
    const [liberado] = await avisos(amb, "acesso_liberado", novo);
    assert.match(liberado!.detalhe, /Ana Admin liberou o seu acesso/);
    const [aoSupervisor] = await avisos(amb, "cadastro_liberado", supervisor.id);
    assert.match(aoSupervisor!.detalhe, /liberou o acesso de Técnico T100, que você cadastrou/);
    assert.ok((await avisos(amb, "cadastro_pendente")).every((a) => a.lidoEm !== null), "o pendente saiu do não lido dos dois admins");

    // Os e-mails saem pelo executor, para o e-mail institucional de cada um.
    const antes = amb.email.enviados.length;
    await executarTarefasPendentes(amb.deps);
    const enviados = amb.email.enviados.slice(antes);
    const deConta = enviados.find((m) => m.para === "t100@empresa.com.br" && m.assunto === "[SYNQ OS] Conta criada");
    assert.ok(deConta, "o e-mail da conta criada");
    assert.ok(deConta!.texto.includes("http://painel.local/app/entrar"));
    assert.ok(deConta!.texto.includes("Este aviso é enviado sempre"), "a conta é obrigatória");
    assert.ok(enviados.some((m) => m.para === admin.email && m.assunto === "[SYNQ OS] Cadastro aguardando liberação — Técnico T100"));
  });

  it("recusar avisa a pessoa (mesmo sem acesso) e o supervisor; o supervisor ainda cancela o cadastro pendente que fez, e os avisos da conta somem junto", async () => {
    const recusado = await cadastrarPeloSupervisor("T101");
    await amb.esperar(200, "POST", `/usuarios/${recusado}/recusar`, { como: admin, json: { motivo: "Matrícula de outra área" } });
    const [aviso] = await avisos(amb, "acesso_recusado", recusado);
    assert.match(aviso!.detalhe, /recusado por Ana Admin\. Motivo: Matrícula de outra área/);
    assert.match((await avisos(amb, "cadastro_recusado", supervisor.id))[0]!.detalhe, /Técnico T101/);
    // O recusado não entra, mas o e-mail do acesso recusado sai.
    const antes = amb.email.enviados.length;
    await executarTarefasPendentes(amb.deps);
    assert.ok(amb.email.enviados.slice(antes).some((m) => m.para === "t101@empresa.com.br" && m.assunto === "[SYNQ OS] Acesso recusado"));

    // O admin remove o recusado (libera e-mail e matrícula): os avisos da conta não o prendem ao histórico.
    await amb.esperar(200, "DELETE", `/usuarios/${recusado}`, { como: admin });
    assert.equal((await amb.db.select().from(alerta).where(eq(alerta.usuarioAlvoId, recusado))).length, 0);

    const cancelado = await cadastrarPeloSupervisor("T102");
    await amb.esperar(200, "DELETE", `/usuarios/${cancelado}`, { como: supervisor });
    assert.equal((await amb.db.select().from(alerta).where(eq(alerta.usuarioAlvoId, cancelado))).length, 0);
    // A tarefa do e-mail do aviso apagado termina sem enviar nem falhar.
    await executarTarefasPendentes(amb.deps);
    assert.equal((await amb.db.select().from(tarefa).where(eq(tarefa.estado, "falhou"))).length, 0);
  });

  it("redefinir a senha avisa a pessoa, sem a senha; o admin que redefine a própria não se avisa", async () => {
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const { senha_inicial } = await amb.esperar(200, "POST", `/usuarios/${tecnico.id}/redefinir-senha`, { como: admin });
    const [aviso] = await avisos(amb, "senha_redefinida", tecnico.id);
    assert.match(aviso!.detalhe, /Ana Admin redefiniu a sua senha/);
    assert.ok(!aviso!.detalhe.includes(senha_inicial), "a senha nunca vai no aviso");
    await amb.esperar(200, "POST", `/usuarios/${admin.id}/redefinir-senha`, { como: admin });
    assert.equal((await avisos(amb, "senha_redefinida", admin.id)).length, 0);
  });

  it("GET /alertas: o técnico vê os próprios avisos de conta, com a pessoa de quem se fala", async () => {
    const r = await amb.esperar(200, "GET", "/alertas", { como: supervisor, consulta: { tipo: "cadastro_liberado" } });
    assert.equal(r.alertas.length, 1);
    assert.equal(r.alertas[0].usuario_alvo_nome, "Técnico T100");
    for (const campo of ["equipe_alvo_id", "equipe_alvo_nome", "leitura_rh_id", "treinamento_id", "treinamento_codigo"]) assert.ok(campo in r.alertas[0], campo);
  });
});

describe("Registro de funcionários: readmissão, desligamento e falha da leitura", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let admin2: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA, duracaoDoTokenSeg: 7 * 24 * 3600 });
    equipeId = (await amb.criarEquipe({ nome: "Instrumentação" })).id;
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Ana Admin" });
    admin2 = await amb.criarUsuario({ perfil: "admin", nome: "Beto Admin" });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: "Sérgio Supervisor" });
    for (const u of [admin, admin2, supervisor]) amb.registrarFuncionario({ matricula: u.matricula, nome: `Funcionário ${u.matricula}` });
  });
  after(() => amb.fechar());

  const conferir = (id: string) => amb.esperar(200, "POST", `/usuarios/${id}/atualizar-do-registro`, { como: admin });

  it("o técnico desligado: a conta é desativada e a equipe é avisada, com as OS que continuam reservadas para ele", async () => {
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Diego Desligado" });
    const o = await criarOs(amb, { equipeId });
    await amb.db.update(os).set({ responsavelId: tecnico.id, reservadaPor: supervisor.id, reservadaEm: AGORA }).where(eq(os.id, o.osId));
    amb.registrarFuncionario({ matricula: tecnico.matricula, nome: "Diego Desligado", situacao: "desligado" });
    const r = await conferir(tecnico.id);
    assert.equal(r.desativado, true);
    const [aviso] = await avisos(amb, "membro_desativado", supervisor.id);
    assert.equal(aviso!.usuarioAlvoId, tecnico.id);
    assert.match(aviso!.detalhe, /Diego Desligado .* foi desativada: desligada no registro de funcionários\. Uma OS continua reservada para essa pessoa/);
  });

  it("readmissão: a conta continua desativada, os admins recebem o aviso, e reativar tira o aviso do não lido e avisa a pessoa", async () => {
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Rita Readmitida" });
    amb.registrarFuncionario({ matricula: tecnico.matricula, nome: "Rita Readmitida", situacao: "desligado" });
    await conferir(tecnico.id);
    assert.equal((await amb.db.select({ ativo: usuario.ativo }).from(usuario).where(eq(usuario.id, tecnico.id)))[0]!.ativo, false);

    amb.registrarFuncionario({ matricula: tecnico.matricula, nome: "Rita Readmitida", situacao: "ativo" });
    const r = await conferir(tecnico.id);
    assert.equal(r.readmitido, true);
    assert.equal((await amb.db.select({ ativo: usuario.ativo }).from(usuario).where(eq(usuario.id, tecnico.id)))[0]!.ativo, false, "o automático nunca dá acesso");
    const readmitidos = (await avisos(amb, "funcionario_readmitido")).filter((a) => a.usuarioAlvoId === tecnico.id);
    assert.deepEqual(readmitidos.map((a) => a.destinatarioId).sort(), [admin.id, admin2.id].sort());
    assert.match(readmitidos[0]!.detalhe, /voltou a ficar ativo no registro de funcionários/);
    // Conferir de novo (já ativo no registro) não repete o aviso.
    await conferir(tecnico.id);
    assert.equal((await avisos(amb, "funcionario_readmitido")).filter((a) => a.usuarioAlvoId === tecnico.id).length, 2);

    await amb.esperar(200, "PATCH", `/usuarios/${tecnico.id}`, { como: admin, json: { ativo: true } });
    assert.ok((await avisos(amb, "funcionario_readmitido")).filter((a) => a.usuarioAlvoId === tecnico.id).every((a) => a.lidoEm !== null));
    assert.match((await avisos(amb, "acesso_liberado", tecnico.id))[0]!.detalhe, /reativou a sua conta/);
  });

  it("o supervisor desligado: o representante assume (equipe sem supervisor), os admins são avisados uma vez, e o novo supervisor encerra tudo", async () => {
    const eq2 = await amb.criarEquipe({ nome: "Laboratório Químico" });
    const chefe = await amb.criarUsuario({ perfil: "tecnico", equipeId: eq2.id, supervisor: true, nome: "Carla Chefe" });
    const rep = await amb.criarUsuario({ perfil: "tecnico", equipeId: eq2.id, nome: "Rui Representante" });
    await atualizarSupervisaoDasEquipes(amb.db, amb.relogio.agora, [eq2.id]);
    assert.equal((await amb.db.select().from(equipe).where(eq(equipe.id, eq2.id)))[0]!.representanteId, rep.id);

    amb.registrarFuncionario({ matricula: chefe.matricula, nome: "Carla Chefe", situacao: "desligado" });
    await conferir(chefe.id);

    const [e] = await amb.db.select().from(equipe).where(eq(equipe.id, eq2.id));
    assert.equal(e!.representacaoMotivo, "sem_supervisor");
    assert.ok(e!.semSupervisorAvisadoEm);
    const [assumiu] = await avisos(amb, "representacao_iniciada", rep.id);
    assert.match(assumiu!.detalhe, /a equipe está sem supervisor\. Até o administrador escolher um/);
    const semSupervisor = (await avisos(amb, "equipe_sem_supervisor")).filter((a) => a.equipeId === eq2.id);
    assert.deepEqual(semSupervisor.map((a) => a.destinatarioId).sort(), [admin.id, admin2.id].sort());
    assert.match(semSupervisor[0]!.detalhe, /o supervisor dela, Carla Chefe, foi desativado\. Rui Representante, o representante, responde por ela/);
    // A conferência de hora em hora não avisa de novo.
    await atualizarSupervisaoDasEquipes(amb.db, amb.relogio.agora);
    assert.equal((await avisos(amb, "equipe_sem_supervisor")).filter((a) => a.equipeId === eq2.id).length, 2);

    // O representante no comando responde pela equipe.
    const me = await amb.esperar(200, "GET", "/me", { como: rep });
    assert.deepEqual(me.equipes_representadas.map((x: any) => [x.id, x.motivo, x.supervisor_nome, x.rotulo]), [[eq2.id, "sem_supervisor", null, "a equipe está sem supervisor"]]);

    // O admin escolhe outro supervisor: a marca sai, o aviso sai do não lido e o representante devolve a equipe.
    const novo = await amb.criarUsuario({ perfil: "tecnico", equipeId: eq2.id, nome: "Nina Nova" });
    await amb.esperar(200, "PATCH", `/equipes/${eq2.id}`, { como: admin, json: { supervisor_id: novo.id } });
    const [depois] = await amb.db.select().from(equipe).where(eq(equipe.id, eq2.id));
    assert.deepEqual([depois!.semSupervisorAvisadoEm, depois!.representacaoDesde], [null, null]);
    assert.ok((await avisos(amb, "equipe_sem_supervisor")).filter((a) => a.equipeId === eq2.id).every((a) => a.lidoEm !== null));
    assert.match((await avisos(amb, "representacao_encerrada", rep.id))[0]!.detalhe, /ganhou um supervisor, Nina Nova/);
    assert.match((await avisos(amb, "representacao_encerrada", novo.id))[0]!.detalhe, /Você é o supervisor da equipe Laboratório Químico/);
  });

  it("a leitura pedida em \"Ler agora\" que esgota as tentativas avisa só quem pediu; outra falha reaproveita o aviso ainda não lido", async () => {
    amb.rh.falhar = true;
    try {
      await amb.esperar(202, "POST", "/rh/leituras", { como: admin });
      await esgotarTarefas(amb);
      const [aviso] = await avisos(amb, "rh_leitura_falhou");
      assert.equal(aviso!.destinatarioId, admin.id);
      assert.ok(aviso!.leituraRhId);
      assert.match(aviso!.detalhe, /"Ler agora" falhou: RH fora do ar \(depois de todas as tentativas\)/);

      const { leitura_id: segunda } = await amb.esperar(202, "POST", "/rh/leituras", { como: admin });
      await esgotarTarefas(amb);
      const todos = await avisos(amb, "rh_leitura_falhou");
      assert.equal(todos.length, 1, "o aviso não lido é reaproveitado");
      assert.equal(todos[0]!.leituraRhId, segunda);
      // Só o aviso novo foi por e-mail.
      assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "email_alerta"), eq(tarefa.referenciaId, todos[0]!.id)))).length, 1);
    } finally {
      amb.rh.falhar = false;
    }
  });
});

describe("Falhas que os administradores precisam saber", () => {
  it("a leitura diária do registro que falha de vez avisa todos os admins; a trava de segurança também avisa", async () => {
    const amb = await criarAmbiente({ relogio: AGORA, duracaoDoTokenSeg: 7 * 24 * 3600 });
    try {
      const adm1 = await amb.criarUsuario({ perfil: "admin" });
      const adm2 = await amb.criarUsuario({ perfil: "admin" });
      amb.rh.falhar = true;
      assert.equal(await agendarLeituraDiariaRh(amb.deps), true);
      await esgotarTarefas(amb);
      const diaria = await avisos(amb, "rh_leitura_falhou");
      assert.deepEqual(diaria.map((a) => a.destinatarioId).sort(), [adm1.id, adm2.id].sort());
      assert.match(diaria[0]!.detalhe, /^A leitura diária do registro de funcionários falhou/);

      // A trava: o registro veio vazio e desligaria todo mundo.
      await amb.db.update(alerta).set({ lidoEm: amb.relogio.agora }).where(eq(alerta.tipo, "rh_leitura_falhou"));
      amb.rh.falhar = false;
      await amb.esperar(202, "POST", "/rh/leituras", { como: adm1 });
      await executarTarefasPendentes(amb.deps);
      const trava = (await avisos(amb, "rh_leitura_falhou")).filter((a) => a.lidoEm === null);
      assert.deepEqual(trava.map((a) => a.destinatarioId), [adm1.id]);
      assert.match(trava[0]!.detalhe, /Leitura interrompida: desativaria/);
    } finally {
      await amb.fechar();
    }
  });

  it("o PDF da OS que não sai depois de todas as tentativas avisa os admins", async () => {
    const amb = await criarAmbiente({ relogio: AGORA });
    try {
      const adm = await amb.criarUsuario({ perfil: "admin" });
      const e = await amb.criarEquipe();
      // OS ainda sem execução encerrada: a geração do PDF falha a cada tentativa.
      const o = await criarOs(amb, { equipeId: e.id, status: "liberada" });
      await amb.db.insert(tarefa).values({ tipo: "pdf_os", referenciaId: o.osId, proximaEm: amb.relogio.agora });
      await esgotarTarefas(amb);
      const [aviso] = await avisos(amb, "pdf_os_falhou", adm.id);
      assert.equal(aviso!.osId, o.osId);
      assert.match(aviso!.detalhe, new RegExp(`O PDF da OS ${o.numeroOrdem} .* não foi gerado depois de várias tentativas`));
    } finally {
      await amb.fechar();
    }
  });

  it("a Vitória que passa a responder sem IA (limite do dia) avisa os admins uma vez por dia", async () => {
    const amb = await criarAmbiente({ relogio: AGORA, duracaoDoTokenSeg: 7 * 24 * 3600 });
    try {
      const adm = await amb.criarUsuario({ perfil: "admin" });
      const tec = await amb.criarUsuario({ perfil: "tecnico" });
      await amb.db.insert(vitoriaUso).values({ usuarioId: adm.id, dia: diaDe(amb.relogio.agora), mensagens: configDeTeste.vitoria.limiteGlobalDia });
      const pergunta = { mensagem: "Como faço uma busca?", tela: "busca", contexto: {}, historico: [], numero_mensagem: 1 };
      await amb.req("POST", "/vitoria/mensagens", { como: tec, json: pergunta });
      await amb.req("POST", "/vitoria/mensagens", { como: tec, json: pergunta });
      const hoje = await avisos(amb, "vitoria_sem_ia");
      assert.equal(hoje.length, 1);
      assert.equal(hoje[0]!.destinatarioId, adm.id);
      assert.match(hoje[0]!.detalhe, /atingiu o limite de 1000 respostas com IA do dia/);
      // No dia seguinte avisa de novo.
      amb.relogio.agora = new Date("2026-10-18T13:00:00Z");
      await amb.db.insert(vitoriaUso).values({ usuarioId: adm.id, dia: diaDe(amb.relogio.agora), mensagens: configDeTeste.vitoria.limiteGlobalDia });
      await amb.req("POST", "/vitoria/mensagens", { como: tec, json: pergunta });
      assert.equal((await avisos(amb, "vitoria_sem_ia")).length, 2);
    } finally {
      await amb.fechar();
    }
  });
});

describe("Equipe sem supervisor", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let antigo: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA, duracaoDoTokenSeg: 7 * 24 * 3600 });
    admin = await amb.criarUsuario({ perfil: "admin" });
    equipeId = (await amb.criarEquipe({ nome: "Equipe Órfã" })).id;
    antigo = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Antônio Antigo" });
    // Criado depois: o mais antigo é quem representa a equipe.
    await amb.db.update(usuario).set({ criadoEm: new Date("2020-01-01T00:00:00Z") }).where(eq(usuario.id, antigo.id));
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Clara Colega" });
    await amb.db.update(usuario).set({ criadoEm: new Date("2024-01-01T00:00:00Z") }).where(eq(usuario.id, colega.id));
    await atualizarSupervisaoDasEquipes(amb.db, amb.relogio.agora);
  });
  after(() => amb.fechar());

  it("o representante assume a equipe que nunca teve supervisor, e os admins são avisados; a equipe vazia não avisa", async () => {
    const vazia = await amb.criarEquipe({ nome: "Equipe Vazia" });
    await atualizarSupervisaoDasEquipes(amb.db, amb.relogio.agora);
    const [e] = await amb.db.select().from(equipe).where(eq(equipe.id, equipeId));
    assert.deepEqual([e!.representanteId, e!.representacaoMotivo], [antigo.id, "sem_supervisor"]);
    const semSupervisor = await avisos(amb, "equipe_sem_supervisor");
    assert.deepEqual(semSupervisor.map((a) => [a.equipeId, a.destinatarioId]), [[equipeId, admin.id]]);
    assert.match(semSupervisor[0]!.detalhe, /A equipe Equipe Órfã está sem supervisor: ela não tem supervisor\. Antônio Antigo, o representante/);
    assert.ok(!semSupervisor.some((a) => a.equipeId === vazia.id));
    // Os avisos da equipe vão para o representante, e não mais para os admins.
    const me = await amb.esperar(200, "GET", "/me", { como: antigo });
    assert.deepEqual(me.equipes_supervisionadas.map((x: any) => x.id), [equipeId]);
  });

  it("o pedido de ausência vai para o representante, que responde; o representante não pede a própria ausência", async () => {
    const { ausencia: { id } } = await amb.esperar(201, "POST", "/ausencias", { como: colega, json: { motivo: "Consulta médica", inicio: "2026-10-20", dias: 2 } });
    const [pedido] = await avisos(amb, "ausencia_pedida");
    assert.deepEqual([pedido!.destinatarioId, pedido!.ausenciaId], [antigo.id, id]);
    await amb.esperar(200, "POST", `/ausencias/${id}/aprovar`, { como: antigo, json: { assinar: true } });

    const proprio = await amb.req("POST", "/ausencias", { como: antigo, json: { motivo: "Férias", inicio: "2026-11-02", dias: 10 } });
    assert.equal(proprio.status, 409);
    assert.equal(proprio.corpo.erro.codigo, "equipe_sem_supervisor");
  });
});

describe("Reserva e ciência de OS", () => {
  let amb: Ambiente;
  let supervisor: UsuarioDeTeste;
  let ana: UsuarioDeTeste;
  let bia: UsuarioDeTeste;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA, duracaoDoTokenSeg: 7 * 24 * 3600 });
    equipeId = (await amb.criarEquipe()).id;
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: "Sérgio Supervisor" });
    ana = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Ana" });
    bia = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Bia" });
  });
  after(() => amb.fechar());

  it("reservar avisa quem recebe; trocar avisa quem perdeu; liberar para a equipe avisa o último responsável; reservar para si não avisa", async () => {
    const o = await criarOs(amb, { equipeId });
    await amb.esperar(200, "PUT", `/os/${o.osId}/responsavel`, { como: supervisor, json: { usuario_id: ana.id } });
    assert.match((await avisos(amb, "os_reservada", ana.id))[0]!.detalhe, new RegExp(`Sérgio Supervisor reservou a OS ${o.numeroOrdem} para você`));

    await amb.esperar(200, "PUT", `/os/${o.osId}/responsavel`, { como: supervisor, json: { usuario_id: bia.id } });
    assert.equal((await avisos(amb, "os_reservada", bia.id)).length, 1);
    assert.match((await avisos(amb, "os_reserva_desfeita", ana.id))[0]!.detalhe, /passou a OS .* para Bia/);

    await amb.esperar(200, "DELETE", `/os/${o.osId}/responsavel`, { como: supervisor });
    assert.match((await avisos(amb, "os_reserva_desfeita", bia.id))[0]!.detalhe, /para a equipe toda/);

    await amb.esperar(200, "PUT", `/os/${o.osId}/responsavel`, { como: supervisor, json: { usuario_id: supervisor.id } });
    assert.equal((await avisos(amb, "os_reservada", supervisor.id)).length, 0);
  });

  it("a assinatura final do supervisor avisa quem executou a OS (a OS está concluída)", async () => {
    // A OS só aceita a assinatura do supervisor depois que o responsável assinou o encerramento (`aguardando_supervisor`).
    const o = await criarOs(amb, { equipeId, encerrada: true, status: "aguardando_supervisor" });
    await amb.esperar(200, "POST", `/os/${o.osId}/ciencia`, { como: supervisor });
    const [aviso] = await avisos(amb, "os_ciencia", o.supervisorDaAprId);
    assert.equal(aviso!.osId, o.osId);
    assert.match(aviso!.detalhe, /Sérgio Supervisor assinou como supervisor a OS .*, que você executou: a OS está concluída/);
    // Assinada, a OS não aceita outra assinatura final (e o aviso não se repete).
    assert.equal((await amb.req("POST", `/os/${o.osId}/ciencia`, { como: supervisor })).status, 409);
    assert.equal((await avisos(amb, "os_ciencia", o.supervisorDaAprId)).length, 1);
  });
});

describe("Treinamentos de serviço", () => {
  it("a primeira publicação avisa os técnicos (também quem aguarda liberação); o problema reportado avisa os admins", async () => {
    const amb = await criarAmbiente({ relogio: AGORA, comCarga: true });
    try {
      const adm = await amb.criarUsuario({ perfil: "admin" });
      const tec = await amb.criarUsuario({ perfil: "tecnico" });
      const pendente = await amb.criarUsuario({ perfil: "tecnico" });
      await amb.db.update(usuario).set({ liberacao: "pendente" }).where(eq(usuario.id, pendente.id));
      const inativo = await amb.criarUsuario({ perfil: "tecnico", ativo: false });
      const [servico] = await amb.sql<{ codigo: string }>("select codigo from atividade order by codigo limit 1");
      const [t] = await amb.db.insert(treinamentoServico).values({ atividadeCodigo: servico!.codigo }).returning();

      await avisarTreinamentoPublicado(amb.db, servico!.codigo, amb.relogio.agora);
      const publicados = await avisos(amb, "treinamento_publicado");
      assert.deepEqual(publicados.map((a) => a.destinatarioId).sort(), [tec.id, pendente.id].sort());
      assert.ok(publicados.every((a) => a.treinamentoId === t!.id));
      assert.ok(!publicados.some((a) => a.destinatarioId === inativo.id || a.destinatarioId === adm.id));

      await avisarProblemaReportado(amb.db, servico!.codigo, { quem: "Tadeu", fase: 2, texto: "A resposta certa está marcada errada" }, amb.relogio.agora);
      const [problema] = await avisos(amb, "treinamento_problema", adm.id);
      assert.match(problema!.detalhe, /Tadeu reportou um problema na fase 3 do treinamento de .*: "A resposta certa está marcada errada"/);
      const lista = await amb.esperar(200, "GET", "/alertas", { como: adm, consulta: { tipo: "treinamento_problema" } });
      assert.equal(lista.alertas[0].treinamento_codigo, servico!.codigo);

      const antes = amb.email.enviados.length;
      await executarTarefasPendentes(amb.deps);
      const deTreino = amb.email.enviados.slice(antes).find((m) => m.para === tec.email);
      assert.ok(deTreino!.texto.includes(`/app/catalogo/servicos/${encodeURIComponent(servico!.codigo)}/treinar`));
    } finally {
      await amb.fechar();
    }
  });
});

describe("Preferências de e-mail e resumo diário", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let quieto: UsuarioDeTeste;
  let equipeId: string;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-17T09:00:00Z"), duracaoDoTokenSeg: 7 * 24 * 3600 });
    equipeId = (await amb.criarEquipe()).id;
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Ana Admin" });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: "Sérgio Supervisor" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Tiago Técnico" });
    quieto = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Quim Quieto" });
  });
  after(() => amb.fechar());

  it("PUT /me/emails desliga categorias; as obrigatórias não desligam; GET /me diz o que está desligado e se há servidor", async () => {
    const r = await amb.esperar(200, "PUT", "/me/emails", { como: quieto, json: { desligados: ["resumo_diario", "os", "os"] } });
    assert.deepEqual(r.desligados, ["os", "resumo_diario"]);
    const recusa = await amb.req("PUT", "/me/emails", { como: quieto, json: { desligados: ["seguranca"] } });
    assert.equal(recusa.status, 422);
    assert.equal(recusa.corpo.erro.codigo, "categoria_obrigatoria");
    assert.equal((await amb.req("PUT", "/me/emails", { como: quieto, json: { desligados: ["inexistente"] } })).status, 422);
    const me = await amb.esperar(200, "GET", "/me", { como: quieto });
    assert.deepEqual(me.emails, { desligados: ["os", "resumo_diario"], servidor_configurado: true });
  });

  it("o resumo é agendado a partir da hora configurada, uma vez por dia, para quem não o desligou; sem servidor, nada", async () => {
    // 6h de São Paulo: ainda não.
    assert.equal(await agendarResumosDiarios(amb.deps), 0);
    amb.relogio.agora = new Date("2026-10-17T10:30:00Z");
    amb.email.configurado = false;
    assert.equal(await agendarResumosDiarios(amb.deps), 0);
    amb.email.configurado = true;
    assert.equal(await agendarResumosDiarios(amb.deps), 3, "o admin, o supervisor e o técnico; quem desligou fica de fora");
    assert.equal(await agendarResumosDiarios(amb.deps), 0, "uma vez por dia");
    assert.equal((await amb.db.select().from(tarefa).where(and(eq(tarefa.tipo, "email_resumo"), eq(tarefa.referenciaId, quieto.id)))).length, 0);
  });

  it("cada um recebe o que espera por ele; quem não tem nada não recebe", async () => {
    // Para o supervisor: uma OS aguardando a assinatura dele (a já concluída não entra). Para o técnico: uma OS reservada. Para o admin: um cadastro pendente.
    const encerrada = await criarOs(amb, { equipeId, encerrada: true, status: "aguardando_supervisor" });
    await criarOs(amb, { equipeId, encerrada: true });
    const reservada = await criarOs(amb, { equipeId });
    await amb.db.update(os).set({ responsavelId: tecnico.id, reservadaPor: supervisor.id, reservadaEm: amb.relogio.agora }).where(eq(os.id, reservada.osId));
    const pendente = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Paulo Pendente" });
    await amb.db.update(usuario).set({ liberacao: "pendente" }).where(eq(usuario.id, pendente.id));

    const antes = amb.email.enviados.length;
    await executarTarefasPendentes(amb.deps);
    const resumos = amb.email.enviados.slice(antes).filter((m) => m.assunto === "[SYNQ OS] Resumo do dia 17/10/2026");
    const de = (para: string) => resumos.find((m) => m.para === para);

    assert.ok(de(supervisor.email)!.texto.includes("OS aguardando a sua assinatura (1)"));
    assert.ok(de(supervisor.email)!.texto.includes(`http://painel.local/app/os/${encerrada.osId}`));
    assert.ok(de(tecnico.email)!.texto.includes("OS reservadas para você (1)"));
    assert.ok(de(admin.email)!.texto.includes("Cadastros aguardando a liberação (1)"));
    assert.ok(de(admin.email)!.texto.includes("Paulo Pendente"));
    assert.ok(de(admin.email)!.texto.includes("perfil#emails"), "o rodapé diz como desligar");
    assert.equal(resumos.length, 3);
  });
});

describe("Leitura do SAP: os avisos ficam na importação", () => {
  it("a ordem preventiva com o intervalo que não dá para entender entra, e o aviso fica gravado e sai em GET /importacoes", async () => {
    const amb = await criarAmbiente({ relogio: AGORA });
    try {
      const adm = await amb.criarUsuario({ perfil: "admin" });
      await amb.criarEquipe({ centroTrabalho: "SERV_ESP" });
      amb.sap.ordens = [
        {
          numero_ordem: "4019899",
          tipo_ordem: "YBA2",
          titulo: "Inspeção funcional de retificador",
          centro_trabalho: "SERV_ESP",
          local_instalacao: { codigo: "SERRA/RET-12" },
          data_inicio_prog: "2026-10-13",
          status_sap: "LIB",
          plano_manutencao: "10573",
          item_manutencao: "10603",
          intervalo_ciclo: "sempre que der",
        } as never,
      ];
      const r = await executarLeitura(amb.deps);
      assert.equal(r.criadas, 1);
      const [imp] = await amb.db.select().from(importacao).where(eq(importacao.id, r.importacaoId));
      assert.equal(imp!.avisos, 1);
      assert.deepEqual((imp!.detalheAvisos as { numero_ordem: string }[]).map((a) => a.numero_ordem), ["4019899"]);
      assert.match(JSON.stringify(imp!.detalheAvisos), /Intervalo entre ciclos não reconhecido/);
      const lista = await amb.esperar(200, "GET", "/importacoes", { como: adm });
      assert.equal(lista.importacoes[0].avisos, 1);
      assert.equal(lista.importacoes[0].detalhe_avisos[0].numero_ordem, "4019899");
    } finally {
      await amb.fechar();
    }
  });
});
