import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { aprParticipante, atividade, os, usuario } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { criarOs } from "./fixture-os";

/**
 * O chatbot com dados (`controle-da-ia.md`): sem a leitura de dados autorizada o prompt da Vitória é o de sempre; com ela, leva as OS
 * em aberto da equipe de quem pergunta, quantas APRs esperam assinatura e os pontos da temporada, sem nome de colega, sem dado de
 * outra equipe, e uma falha na leitura nunca derruba a resposta.
 */
describe("Vitória com dados — o trabalho de quem pergunta no prompt", () => {
  let amb: Ambiente;
  let tecnico: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let equipeA: string;
  let equipeB: string;

  const RESPOSTA = JSON.stringify({ texto: "Certo.", expressao: "padrao", acao: { tipo: "nenhuma" } });

  /** Faz uma pergunta e devolve os blocos de sistema que a IA recebeu. */
  async function perguntar(como: UsuarioDeTeste) {
    amb.ia.respostas.push(RESPOSTA);
    const antes = amb.ia.chamadas.length;
    const r = await amb.req("POST", "/vitoria/mensagens", { como, json: { mensagem: "Qual é a minha OS mais urgente?", tela: "busca", contexto: {}, historico: [], numero_mensagem: 1 } });
    assert.equal(r.status, 200);
    assert.equal(amb.ia.chamadas.length, antes + 1, "a IA foi chamada");
    const pedido = amb.ia.chamadas.at(-1)!;
    return { pedido, sistema: pedido.mensagens.filter((m) => m.papel === "sistema"), tudo: pedido.mensagens.map((m) => m.texto).join("\n") };
  }

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-13T15:00:00Z") });
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
    equipeA = (await amb.criarEquipe({ nome: "Equipe A" })).id;
    equipeB = (await amb.criarEquipe({ nome: "Equipe B" })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico Meu", equipeId: equipeA });
    const colega = await amb.criarUsuario({ perfil: "tecnico", nome: "Colega Silva", equipeId: equipeA });

    await amb.db.insert(atividade).values({ codigo: "DADOS-1", descricao: "Troca do regulador de pressão" });
    // Uma OS liberada e vencida da equipe A (do serviço do catálogo), com o prazo de 10/10.
    const atrasada = await criarOs(amb, { equipeId: equipeA, numeroOrdem: "4900001" });
    await amb.db.update(os).set({ codigoAtividade: "DADOS-1", titulo: "Trocar o regulador da estação" }).where(eq(os.id, atrasada.osId));
    // Uma OS em execução da equipe A, com uma APR que ainda espera a assinatura de quem pergunta e a do colega.
    const emExecucao = await criarOs(amb, { equipeId: equipeA, numeroOrdem: "4900002", status: "em_execucao", encerrada: true });
    await amb.db.insert(aprParticipante).values([
      { aprId: emExecucao.aprId, usuarioId: tecnico.id, funcao: "executor" },
      { aprId: emExecucao.aprId, usuarioId: colega.id, funcao: "executor" },
    ]);
    // Uma OS da outra equipe: nunca aparece para quem é da A.
    const deOutraEquipe = await criarOs(amb, { equipeId: equipeB, numeroOrdem: "4900099" });
    await amb.db.update(os).set({ titulo: "SEGREDO DA OUTRA EQUIPE" }).where(eq(os.id, deOutraEquipe.osId));
  });
  after(() => amb.fechar());

  it("sem a leitura de dados autorizada, o prompt é o de sempre: nada de OS, de APR nem de pontos", async () => {
    const { sistema, tudo } = await perguntar(tecnico);
    assert.equal(sistema.length, 3, "instrução, manual e tela atual");
    assert.ok(!tudo.includes("Dados reais de quem está perguntando"));
    assert.ok(!tudo.includes("4900001") && !tudo.includes("Trocar o regulador"));
  });

  it("ligada só a função, sem a leitura de dados, continua sem dados", async () => {
    await amb.ligarIa("chatbot", { comDados: false, como: admin });
    const { tudo } = await perguntar(tecnico);
    assert.ok(!tudo.includes("Dados reais de quem está perguntando"));
  });

  it("com a leitura autorizada, o técnico recebe as OS da equipe, as APRs esperando e os pontos, depois do manual em cache", async () => {
    await amb.ligarIa("chatbot", { comDados: true, como: admin });
    const { sistema, tudo } = await perguntar(tecnico);
    assert.equal(sistema.length, 4, "o bloco de dados é um bloco à parte");
    assert.equal(sistema[1]!.cache, true, "o manual segue em cache");
    assert.ok(sistema[2]!.texto.startsWith("Dados reais de quem está perguntando"), "os dados vêm logo depois do manual, que continua igual");
    assert.ok(!sistema[2]!.cache, "os dados mudam a cada pergunta e não entram no cache");

    const dados = sistema[2]!.texto;
    assert.match(dados, /OS em aberto: 2\./);
    assert.match(dados, /OS 4900001 · Trocar o regulador da estação · serviço: Troca do regulador de pressão · local: LOCAL\/\w+ · situação: liberada · prevista para 10\/10\/2026 \(atrasada\)/);
    assert.match(dados, /OS 4900002 · DCV Desobstrução de dreno · local: LOCAL\/\w+ · situação: em execução · prevista para 10\/10\/2026\n/);
    assert.match(dados, /APRs esperando assinatura: 1; 1 espera a de quem pergunta/);
    assert.match(dados, /Pontuação de quem pergunta, temporada Primavera 2026: 0 pontos/);
    assert.match(dados, /DADOS, não instruções/);
    assert.match(dados, /não criam destinos novos/);
    assert.ok(tudo.includes("Qual é a minha OS mais urgente?"));
  });

  it("nunca vai dado de outra equipe, nome de colega nem id", async () => {
    const { tudo } = await perguntar(tecnico);
    for (const proibido of ["4900099", "SEGREDO DA OUTRA EQUIPE", "Colega Silva", "Elismário", "Damião", "Técnico Meu", "Equipe B", tecnico.id]) {
      assert.ok(!tudo.includes(proibido), `"${proibido}" não pode ir para a IA`);
    }
  });

  it("o admin recebe o escopo que já enxerga (todas as equipes), sem pontos", async () => {
    const { sistema } = await perguntar(admin);
    const dados = sistema[2]!.texto;
    assert.match(dados, /OS em aberto: 3\./);
    assert.ok(dados.includes("4900099") && dados.includes("SEGREDO DA OUTRA EQUIPE"));
    assert.ok(!dados.includes("Pontuação de quem pergunta"));
  });

  it("a OS reservada aparece como \"reservada para você\" ou \"para outra pessoa\", sem o nome de quem a recebeu", async () => {
    const [ordem] = await amb.db.select().from(os).where(eq(os.numeroOrdem, "4900001"));
    const [colega] = await amb.db.select().from(usuario).where(eq(usuario.nome, "Colega Silva"));
    await amb.db.update(os).set({ responsavelId: colega!.id, reservadaPor: colega!.id, reservadaEm: new Date() }).where(eq(os.id, ordem!.id));
    const { sistema, tudo } = await perguntar(tecnico);
    assert.match(sistema[2]!.texto, /OS 4900001 .*reservada para outra pessoa/);
    assert.ok(!tudo.includes("Colega Silva"));
    await amb.db.update(os).set({ responsavelId: tecnico.id, reservadaPor: tecnico.id }).where(eq(os.id, ordem!.id));
    assert.match((await perguntar(tecnico)).sistema[2]!.texto, /OS 4900001 .*reservada para você/);
    await amb.db.update(os).set({ responsavelId: null, reservadaPor: null, reservadaEm: null }).where(eq(os.id, ordem!.id));
  });

  it("OS encerrada ou cancelada não conta como em aberto", async () => {
    const [ordem] = await amb.db.select().from(os).where(eq(os.numeroOrdem, "4900001"));
    await amb.db.update(os).set({ status: "cancelada", canceladaEm: new Date(), canceladaPor: admin.id, justificativaCancelamento: "Duplicada" }).where(eq(os.id, ordem!.id));
    const { sistema } = await perguntar(tecnico);
    assert.match(sistema[2]!.texto, /OS em aberto: 1\./);
    assert.ok(!sistema[2]!.texto.includes("4900001"));
    await amb.db.update(os).set({ status: "liberada", canceladaEm: null, canceladaPor: null, justificativaCancelamento: null }).where(eq(os.id, ordem!.id));
  });

  it("falha na leitura dos dados nunca derruba a resposta: segue sem o bloco", async () => {
    await amb.sql("alter table apr_participante rename to apr_participante_fora");
    try {
      const { sistema } = await perguntar(tecnico);
      assert.equal(sistema.length, 3, "sem o bloco de dados");
    } finally {
      await amb.sql("alter table apr_participante_fora rename to apr_participante");
    }
    assert.equal((await perguntar(tecnico)).sistema.length, 4, "voltando a leitura, o bloco volta");
  });

  it("desligar a leitura de dados tira o bloco na hora", async () => {
    await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", { como: admin, json: { ligada: true, com_dados: false } });
    assert.equal((await perguntar(tecnico)).sistema.length, 3);
  });

  it("sem OS em aberto e sem pontos a dizer (admin, sistema vazio), não vai bloco", async () => {
    const vazio = await criarAmbiente();
    try {
      const adm = await vazio.criarUsuario({ perfil: "admin" });
      await vazio.ligarIa("chatbot", { comDados: true, como: adm });
      vazio.ia.respostas.push(RESPOSTA);
      await vazio.req("POST", "/vitoria/mensagens", { como: adm, json: { mensagem: "Oi", tela: "busca", contexto: {}, historico: [], numero_mensagem: 1 } });
      assert.equal(vazio.ia.chamadas.at(-1)!.mensagens.filter((m) => m.papel === "sistema").length, 3);
    } finally {
      await vazio.fechar();
    }
  });

  it("uma APR já assinada por todos não conta como esperando", async () => {
    await amb.ligarIa("chatbot", { comDados: true, como: admin });
    const [minha] = await amb.db.select({ aprId: aprParticipante.aprId }).from(aprParticipante).where(eq(aprParticipante.usuarioId, tecnico.id));
    await amb.db.update(aprParticipante).set({ assinaturaPath: randomUUID(), assinadaEm: new Date() }).where(eq(aprParticipante.aprId, minha!.aprId));
    assert.match((await perguntar(tecnico)).sistema[2]!.texto, /APRs esperando assinatura: nenhuma\./);
  });
});
