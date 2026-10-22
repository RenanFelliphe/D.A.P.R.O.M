import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { LIMITE_DE_PEDIDOS_POR_HORA } from "../src/dominio/solicitacao-conta";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * O pedido de conta feito na tela de entrada (`docs/pessoas-e-equipes.md`, seção 2.2): as duas rotas abertas, os avisos (admins e quem responde
 * pela equipe escolhida), a resposta que não revela nada, os pedidos que cada um vê, o descarte e o cadastro que atende o pedido.
 */
describe("Pedido de conta na tela de entrada", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let outroSupervisor: UsuarioDeTeste;
  let equipeId: string;
  let outraEquipeId: string;

  const pedir = (json: unknown) => amb.req("POST", "/solicitacoes-conta", { json });
  const avisosDe = (u: UsuarioDeTeste) =>
    amb.sql<{ detalhe: string; solicitacao_conta_id: string }>("select detalhe, solicitacao_conta_id from alerta where tipo = 'conta_solicitada' and destinatario_id = $1 order by criado_em", [u.id]);
  const pedidos = (email: string) => amb.sql<{ id: string; estado: string; nome: string; equipe_id: string | null; usuario_id: string | null }>("select * from solicitacao_conta where email = $1 order by criada_em", [email]);

  before(async () => {
    amb = await criarAmbiente();
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Ana Admin" });
    const equipe = await amb.criarEquipe({ nome: "Serviços Especiais", centroTrabalho: "SERV_ESP" });
    const outra = await amb.criarEquipe({ nome: "Instrumentação", centroTrabalho: "INSTRUM" });
    equipeId = equipe.id;
    outraEquipeId = outra.id;
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, supervisor: true, nome: "Sérgio Supervisor" });
    outroSupervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId: outraEquipeId, supervisor: true });
  });
  after(() => amb.fechar());

  it("as equipes para escolher saem sem login, só com o id e o nome", async () => {
    const r = await amb.esperar(200, "GET", "/solicitacoes-conta/equipes");
    assert.deepEqual(r.equipes.map((e: { nome: string }) => e.nome), ["Instrumentação", "Serviços Especiais"]);
    assert.deepEqual(Object.keys(r.equipes[0]).sort(), ["id", "nome"]);
  });

  it("sem equipe, avisa só os administradores; com equipe, também quem responde por ela", async () => {
    assert.equal((await pedir({ nome: "Bruno Sem Equipe", email: "Bruno.Sem@Empresa.com.br" })).status, 202);
    const [semEquipe] = await pedidos("bruno.sem@empresa.com.br");
    assert.equal(semEquipe!.estado, "pendente");
    assert.equal((await avisosDe(admin)).length, 1);
    assert.equal((await avisosDe(supervisor)).length, 0);

    assert.equal((await pedir({ nome: "Carla Com Equipe", email: "carla.com@empresa.com.br", equipe_id: equipeId })).status, 202);
    const doSupervisor = await avisosDe(supervisor);
    assert.equal(doSupervisor.length, 1);
    assert.match(doSupervisor[0]!.detalhe, /Carla Com Equipe \(carla\.com@empresa\.com\.br\).*equipe Serviços Especiais/);
    assert.equal((await avisosDe(admin)).length, 2);
    assert.equal((await avisosDe(outroSupervisor)).length, 0);
  });

  it("a resposta não revela nada: e-mail com conta não gera pedido, e pedir de novo só atualiza, sem avisar outra vez", async () => {
    const comConta = await pedir({ nome: "Já Tenho", email: supervisor.email });
    assert.equal(comConta.status, 202);
    assert.equal((await pedidos(supervisor.email)).length, 0);

    const antes = (await avisosDe(admin)).length;
    assert.equal((await pedir({ nome: "Carla C. Equipe", email: "carla.com@empresa.com.br", equipe_id: outraEquipeId })).status, 202);
    const [atualizado, ...resto] = await pedidos("carla.com@empresa.com.br");
    assert.equal(resto.length, 0, "um pedido pendente por e-mail");
    assert.equal(atualizado!.nome, "Carla C. Equipe");
    assert.equal(atualizado!.equipe_id, outraEquipeId);
    assert.equal((await avisosDe(admin)).length, antes);
  });

  it("recusa corpo incompleto, e-mail inválido e equipe inexistente (422)", async () => {
    assert.equal((await pedir({ email: "x.y@empresa.com.br" })).status, 422);
    assert.equal((await pedir({ nome: "Sem E-mail" })).status, 422);
    assert.equal((await pedir({ nome: "E-mail ruim", email: "nao-e-email" })).status, 422);
    const equipe = await pedir({ nome: "Equipe errada", email: "equipe.errada@empresa.com.br", equipe_id: "00000000-0000-4000-8000-000000000000" });
    assert.equal(equipe.status, 422);
    assert.equal(equipe.corpo.erro.codigo, "equipe_inexistente");
  });

  it("o admin vê todos os pendentes; quem supervisiona, os das equipes dele; o técnico, nenhum (403)", async () => {
    const doAdmin = await amb.esperar(200, "GET", "/solicitacoes-conta", { como: admin });
    assert.deepEqual(doAdmin.solicitacoes.map((s: { email: string }) => s.email), ["bruno.sem@empresa.com.br", "carla.com@empresa.com.br"]);
    const doOutro = await amb.esperar(200, "GET", "/solicitacoes-conta", { como: outroSupervisor });
    assert.deepEqual(doOutro.solicitacoes.map((s: { email: string; equipe_nome: string }) => [s.email, s.equipe_nome]), [["carla.com@empresa.com.br", "Instrumentação"]]);
    assert.equal((await amb.esperar(200, "GET", "/solicitacoes-conta", { como: supervisor })).solicitacoes.length, 0);
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    assert.equal((await amb.req("GET", "/solicitacoes-conta", { como: tecnico })).status, 403);
    assert.equal((await amb.req("GET", "/solicitacoes-conta")).status, 401);
  });

  it("descartar: só quem vê o pedido; fica na auditoria e some da lista", async () => {
    const [pedido] = await pedidos("bruno.sem@empresa.com.br");
    assert.equal((await amb.req("POST", `/solicitacoes-conta/${pedido!.id}/descartar`, { como: supervisor })).status, 403, "pedido sem equipe é só do admin");
    await amb.esperar(200, "POST", `/solicitacoes-conta/${pedido!.id}/descartar`, { como: admin });
    assert.equal((await pedidos("bruno.sem@empresa.com.br"))[0]!.estado, "descartada");
    assert.equal((await amb.req("POST", `/solicitacoes-conta/${pedido!.id}/descartar`, { como: admin })).status, 404, "já resolvido");
    const [auditoria] = await amb.sql<{ acao: string; ator_id: string }>("select acao, ator_id from auditoria where entidade_id = $1", [pedido!.id]);
    assert.deepEqual(auditoria, { acao: "usuario.descartar_pedido_de_conta", ator_id: admin.id });

    // Descartado, a pessoa pode pedir de novo (e avisa outra vez).
    const antes = (await avisosDe(admin)).length;
    assert.equal((await pedir({ nome: "Bruno Sem Equipe", email: "bruno.sem@empresa.com.br" })).status, 202);
    assert.equal((await avisosDe(admin)).length, antes + 1);
  });

  it("cadastrar a pessoa com o mesmo e-mail atende o pedido", async () => {
    amb.registrarFuncionario({ matricula: "PC100", nome: "Carla Com Equipe", email: "carla.com@empresa.com.br", centro_trabalho: "INSTRUM", setor: "Instrumentação" });
    const { id } = await amb.esperar(201, "POST", "/usuarios", {
      como: admin,
      json: { matricula: "PC100", email: "carla.com@empresa.com.br", perfil: "tecnico", equipe_id: outraEquipeId, senha_inicial: "senha-inicial-1" },
    });
    const [atendido] = await pedidos("carla.com@empresa.com.br");
    assert.equal(atendido!.estado, "atendida");
    assert.equal(atendido!.usuario_id, id);
    assert.equal((await amb.esperar(200, "GET", "/solicitacoes-conta", { como: outroSupervisor })).solicitacoes.length, 0);
  });

  it(`acima de ${LIMITE_DE_PEDIDOS_POR_HORA} pedidos novos na última hora, recusa (429) sem gravar`, async () => {
    const jaFeitos = Number((await amb.sql<{ n: string }>("select count(*) as n from solicitacao_conta"))[0]!.n);
    for (let i = jaFeitos; i < LIMITE_DE_PEDIDOS_POR_HORA; i++) assert.equal((await pedir({ nome: `Pessoa ${i}`, email: `pessoa.${i}@empresa.com.br` })).status, 202);
    const demais = await pedir({ nome: "Uma a mais", email: "uma.a.mais@empresa.com.br" });
    assert.equal(demais.status, 429);
    assert.equal(demais.corpo.erro.codigo, "muitos_pedidos");
    assert.equal((await pedidos("uma.a.mais@empresa.com.br")).length, 0);
  });
});
