import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { definicaoDaFuncao } from "../../shared/ia/funcoes";
import { auditoria, iaFuncao } from "../src/db/schema";
import { prepararRascunhoIA, situacaoDaIA } from "../src/dominio/treinamento-servico-ia";
import { ErroApi } from "../src/http/erros";
import { IAIndisponivel } from "../src/servicos/ia";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * O controle da IA (`docs/ia-e-vitoria.md`, seção 3): o estado de cada função, a assinatura de quem autoriza a leitura de dados, o bloqueio
 * no módulo de IA e as telas que oferecem (ou escondem) a função conforme ela está ligada.
 */
describe("Controle da IA — GET e PUT /vitoria/ia", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;

  const painel = async () => (await amb.esperar(200, "GET", "/vitoria/ia", { como: admin })) as { chave_configurada: boolean; funcoes: { funcao: string; ligada: boolean; com_dados: boolean; texto_desatualizado: boolean; autorizado_por: { id: string; nome: string } | null; modelo: string }[] };
  const funcao = async (nome: string) => (await painel()).funcoes.find((f) => f.funcao === nome)!;
  const pedido = (corpo: Record<string, unknown>) => ({ como: admin, json: corpo });

  before(async () => {
    amb = await criarAmbiente();
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Administradora" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
  });
  after(() => amb.fechar());

  beforeEach(async () => {
    await amb.db.delete(iaFuncao);
    amb.ia.falhar = false;
    amb.ia.respostas = [];
    amb.ia.chamadas.length = 0;
  });

  it("ao instalar, as funções sem dados vêm ligadas, sem ler dados, e as com dados vêm desligadas; só o admin vê", async () => {
    const p = await painel();
    assert.deepEqual(
      p.funcoes.map((f) => [f.funcao, f.ligada, f.com_dados]),
      [["chatbot", true, false], ["minigames", true, false], ["recomendacao", false, false], ["digitalizacao", false, false]],
    );
    assert.equal(p.chave_configurada, true);
    assert.ok(p.funcoes.every((f) => f.modelo.length > 0 && f.autorizado_por === null && !f.texto_desatualizado));
    assert.equal((await amb.req("GET", "/vitoria/ia", { como: tecnico })).status, 403);
    assert.equal((await amb.req("PUT", "/vitoria/ia/chatbot", { como: tecnico, json: { ligada: false } })).status, 403);
  });

  it("função que só funciona com dados: ligar exige a versão do texto e usa a assinatura de quem pediu", async () => {
    const semVersao = await amb.req("PUT", "/vitoria/ia/recomendacao", pedido({ ligada: true }));
    assert.equal(semVersao.status, 409);
    assert.equal(semVersao.corpo.erro.codigo, "texto_mudou");
    const velha = await amb.req("PUT", "/vitoria/ia/recomendacao", pedido({ ligada: true, versao_do_texto: definicaoDaFuncao("recomendacao").versaoDoTexto + 1 }));
    assert.equal(velha.status, 409);
    assert.equal((await funcao("recomendacao")).ligada, false);

    await amb.esperar(200, "PUT", "/vitoria/ia/recomendacao", pedido({ ligada: true, versao_do_texto: definicaoDaFuncao("recomendacao").versaoDoTexto }));
    const f = await funcao("recomendacao");
    assert.deepEqual([f.ligada, f.com_dados, f.autorizado_por?.id], [true, true, admin.id]);
    const [linha] = await amb.db.select().from(iaFuncao).where(eq(iaFuncao.funcao, "recomendacao"));
    assert.equal(linha!.assinaturaPath, await amb.assinaturaDe(admin));
    assert.equal(linha!.versaoDoTexto, definicaoDaFuncao("recomendacao").versaoDoTexto);
  });

  it("o chatbot liga e desliga sem assinar; a leitura de dados é uma segunda chave, que pede a assinatura e só existe com a função ligada", async () => {
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: false }));
    assert.equal((await funcao("chatbot")).ligada, false);
    const semLigar = await amb.req("PUT", "/vitoria/ia/chatbot", pedido({ ligada: false, com_dados: true, versao_do_texto: 1 }));
    assert.equal(semLigar.status, 422);

    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: true }));
    assert.deepEqual([(await funcao("chatbot")).ligada, (await funcao("chatbot")).com_dados], [true, false]);
    const semVersao = await amb.req("PUT", "/vitoria/ia/chatbot", pedido({ ligada: true, com_dados: true }));
    assert.equal(semVersao.status, 409);

    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: true, com_dados: true, versao_do_texto: definicaoDaFuncao("chatbot").versaoDoTexto }));
    assert.deepEqual([(await funcao("chatbot")).ligada, (await funcao("chatbot")).com_dados], [true, true]);

    // Ligar de novo sem mexer na leitura não pede nova assinatura e não a perde.
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: true }));
    assert.equal((await funcao("chatbot")).com_dados, true);

    // Desligar só a leitura volta ao "sem dados"; desligar a função revoga também a leitura.
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: true, com_dados: false }));
    assert.deepEqual([(await funcao("chatbot")).ligada, (await funcao("chatbot")).com_dados], [true, false]);
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: true, com_dados: true, versao_do_texto: 1 }));
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: false }));
    assert.deepEqual([(await funcao("chatbot")).ligada, (await funcao("chatbot")).com_dados], [false, false]);
    const [linha] = await amb.db.select().from(iaFuncao).where(eq(iaFuncao.funcao, "chatbot"));
    assert.deepEqual([linha!.autorizadoPor, linha!.assinaturaPath, linha!.versaoDoTexto], [null, null, null]);
  });

  it("cada mudança fica na auditoria, com quem fez e o que mudou", async () => {
    // A trilha não aceita apagar: os registros dos testes anteriores ficam, e este confere só os novos.
    const anteriores = new Set((await amb.db.select({ id: auditoria.id }).from(auditoria).where(eq(auditoria.entidade, "ia_funcao"))).map((r) => r.id));
    await amb.esperar(200, "PUT", "/vitoria/ia/digitalizacao", pedido({ ligada: true, versao_do_texto: 1 }));
    await amb.esperar(200, "PUT", "/vitoria/ia/digitalizacao", pedido({ ligada: false }));
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: false }));
    const registros = (await amb.db.select().from(auditoria).where(eq(auditoria.entidade, "ia_funcao"))).filter((r) => !anteriores.has(r.id));
    assert.deepEqual(registros.map((r) => r.acao).sort(), ["ia_funcao.autorizar_dados", "ia_funcao.desligar", "ia_funcao.revogar_dados"]);
    const autorizou = registros.find((r) => r.acao === "ia_funcao.autorizar_dados")!;
    assert.equal(autorizou.atorId, admin.id);
    assert.equal(autorizou.entidadeId, "digitalizacao");
    assert.match(autorizou.resumo, /Digitalização de documentos/);
  });

  it("o texto mudou depois da assinatura: a função com dados para de chamar a IA até assinar de novo", async () => {
    await amb.ligarIa("digitalizacao", { como: admin });
    assert.equal((await funcao("digitalizacao")).ligada, true);
    await amb.db.update(iaFuncao).set({ versaoDoTexto: 0 }).where(eq(iaFuncao.funcao, "digitalizacao"));
    const f = await funcao("digitalizacao");
    assert.deepEqual([f.ligada, f.com_dados, f.texto_desatualizado], [false, false, true]);
    await assert.rejects(() => amb.deps.ia.conversar({ modelo: "digitalizacao", mensagens: [{ papel: "usuario", texto: "oi" }] }), IAIndisponivel);
    await amb.ligarIa("digitalizacao", { como: admin });
    assert.equal((await funcao("digitalizacao")).ligada, true);
  });

  it("o módulo de IA recusa a chamada de função desligada, sem falar com o fornecedor, e libera quando liga", async () => {
    amb.ia.respostas = ["{}"];
    const chamada = (modelo: "chatbot" | "recomendacao") => amb.deps.ia.conversar({ modelo, mensagens: [{ papel: "usuario", texto: "oi" }] });
    await assert.rejects(
      () => chamada("recomendacao"),
      (erro) => erro instanceof IAIndisponivel && erro.motivo === "desligada",
    );
    assert.equal(amb.ia.chamadas.length, 0);
    assert.equal(await chamada("chatbot"), "{}");
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: false }));
    await assert.rejects(() => chamada("chatbot"), IAIndisponivel);
    await assert.rejects(async () => {
      for await (const _ of amb.deps.ia.conversarEmStreaming({ modelo: "chatbot", mensagens: [{ papel: "usuario", texto: "oi" }] })) void _;
    }, IAIndisponivel);
    assert.equal(amb.ia.chamadas.length, 1);
  });

  it("Chatbot desligado: a Vitória responde sem IA e o perfil dela diz que está sem IA", async () => {
    amb.ia.respostas = [JSON.stringify({ texto: "Resposta da IA", expressao: "padrao", acao: { tipo: "nenhuma" } })];
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", pedido({ ligada: false }));
    const r = await amb.req("POST", "/vitoria/mensagens", { como: tecnico, json: { mensagem: "Onde fica o ícone de lupa?", tela: "busca", contexto: {}, historico: [], numero_mensagem: 1 } });
    assert.equal(r.status, 200);
    assert.match(new TextDecoder().decode(r.corpo as ArrayBuffer), /"motivo":"sem_ia"/);
    assert.equal(amb.ia.chamadas.length, 0);
    assert.equal((await amb.esperar(200, "GET", "/vitoria/sobre", { como: tecnico })).ligada, false);
    const diagnostico = await amb.esperar(200, "GET", "/vitoria/diagnostico", { como: admin });
    assert.equal(diagnostico.estado, "desligada");
  });

  it("Criação de jogos desligada: o rascunho da IA é recusado com um motivo próprio e a situação mostra por que", async () => {
    await amb.esperar(200, "PUT", "/vitoria/ia/minigames", pedido({ ligada: false }));
    const situacao = await situacaoDaIA(amb.deps, "SERV-QUALQUER");
    assert.deepEqual([situacao.disponivel, situacao.podeGerar], [false, false]);
    assert.match(situacao.motivo ?? "", /Criação de jogos está desligada/);
    await assert.rejects(
      () => prepararRascunhoIA(amb.deps, "SERV-QUALQUER", admin.id, { tipo: "gerar", texto: "x".repeat(200) }),
      (erro) => erro instanceof ErroApi && erro.codigo === "ia_desligada" && erro.status === 503,
    );
    await amb.esperar(200, "PUT", "/vitoria/ia/minigames", pedido({ ligada: true }));
    assert.equal((await situacaoDaIA(amb.deps, "SERV-QUALQUER")).motivo, null);
  });
});
