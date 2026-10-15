import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { alerta, auditoria, execucao, planoPreventiva, planoPreventivaPergunta } from "../src/db/schema";
import { gerarPdfOs } from "../src/servicos/pdf-os";
import { criarOs, textoDoPdf } from "./fixture-os";
import { prepararCampo, type Campo, type UsuarioDeTeste } from "./gamificacao-ajuda";

describe("Checklist de inspeção das preventivas", () => {
  let c: Campo;
  let planoId: string;
  let planoSemChecklistId: string;
  let perguntas: { id: string; texto: string }[];

  before(async () => {
    c = await prepararCampo();
    // Uma OS da equipe no plano (a equipe da última OS é quem vê e edita o plano).
    [{ id: planoId }] = (await c.amb.db.insert(planoPreventiva).values({ planoManutencao: "10573", itemManutencao: "10603" }).returning({ id: planoPreventiva.id })) as [{ id: string }];
    [{ id: planoSemChecklistId }] = (await c.amb.db.insert(planoPreventiva).values({ planoManutencao: "20001", itemManutencao: "1" }).returning({ id: planoPreventiva.id })) as [{ id: string }];
    await c.novaOs({ tipo: "preventiva", planoManutencao: "10573", itemManutencao: "10603" });
    await c.novaOs({ tipo: "preventiva", planoManutencao: "20001", itemManutencao: "1" });
  });
  after(() => c.amb.fechar());

  const salvar = (como: UsuarioDeTeste, id: string, checklist: unknown) => c.amb.req("PUT", `/preventivas/${id}`, { como, json: { checklist } });
  const lerChecklist = async (id = planoId) => (await c.amb.esperar(200, "GET", `/preventivas/${id}`, { como: c.supervisor })).plano.checklist as { id: string; texto: string }[];

  /** OS preventiva do plano, com a APR e a execução em andamento. */
  async function emExecucao(tecnico: UsuarioDeTeste, plano: { plano: string; item: string | null } = { plano: "10573", item: "10603" }) {
    const o = await c.novaOs({ tipo: "preventiva", planoManutencao: plano.plano, itemManutencao: plano.item });
    const { aprId } = await c.apr(tecnico, o.id);
    const execId = await c.iniciar(tecnico, o.id, aprId);
    return { o, execId };
  }

  /** `execucao_encerrada` com o checklist; `ocorridoEm` antigo faz o evento chegar como se viesse da fila offline. */
  async function encerrar(tecnico: UsuarioDeTeste, execId: string, dados?: unknown, ocorridoEm = c.agora()) {
    return c.enviar(tecnico, {
      id: randomUUID(),
      tipo: "execucao_encerrada",
      os_id: null,
      payload: {
        execucao_id: execId,
        fim: c.agora(),
        descricao_atividade: "Inspeção feita",
        evidencias: [{ id: await c.foto(), capturada_em: c.agora() }],
        assinaturas: [{ usuario_id: tecnico.id }],
        ...(dados !== undefined && { dados_inspecao: dados }),
      },
      ocorrido_em: ocorridoEm,
    });
  }
  const respostas = (...marcas: [boolean, string?][]) => ({ itens: marcas.map(([marcado, observacao], i) => ({ pergunta_id: perguntas[i]!.id, marcado, ...(observacao ? { observacao } : {}) })) });

  describe("o checklist do plano", () => {
    it("o supervisor define as perguntas, na ordem, e a edição entra na auditoria", async () => {
      const r = await salvar(c.supervisor, planoId, [{ texto: "  Tensão de saída dentro da faixa?  " }, { texto: "Telemetria funcionando?" }, { texto: "Gabinete limpo e sem corrosão?" }]);
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      perguntas = r.corpo.plano.checklist;
      assert.deepEqual(perguntas.map((p) => p.texto), ["Tensão de saída dentro da faixa?", "Telemetria funcionando?", "Gabinete limpo e sem corrosão?"]);
      assert.ok(perguntas.every((p) => typeof p.id === "string"));

      const linhas = await c.amb.db.select().from(auditoria).where(and(eq(auditoria.entidade, "plano_preventiva"), eq(auditoria.entidadeId, planoId)));
      assert.equal(linhas.length, 1);
      assert.match(linhas[0]!.resumo, /checklist de inspeção/);
      assert.deepEqual((linhas[0]!.detalhes as any).checklist.de, []);
      assert.equal((linhas[0]!.detalhes as any).checklist.para.length, 3);
    });

    it("reordena, edita e remove: quem tem id continua a mesma pergunta, quem sumiu da lista é removida", async () => {
      const [a, b, d] = perguntas as [(typeof perguntas)[number], (typeof perguntas)[number], (typeof perguntas)[number]];
      const r = await salvar(c.supervisor, planoId, [{ id: d.id, texto: d.texto }, { id: a.id, texto: "Tensão de saída (Vcc) dentro da faixa?" }, { texto: "Ventilação desobstruída?" }]);
      assert.equal(r.status, 200);
      const depois = await lerChecklist();
      assert.deepEqual(depois.map((p) => p.texto), [d.texto, "Tensão de saída (Vcc) dentro da faixa?", "Ventilação desobstruída?"]);
      assert.equal(depois[0]!.id, d.id);
      assert.equal(depois[1]!.id, a.id);
      assert.equal((await c.amb.db.select().from(planoPreventivaPergunta).where(eq(planoPreventivaPergunta.id, b.id))).length, 0);

      // Volta ao checklist do resto dos testes.
      // A pergunta removida já não existe: voltar com ela é criar outra (com id novo).
      const volta = await salvar(c.supervisor, planoId, [{ id: a.id, texto: a.texto }, { texto: b.texto }, { id: d.id, texto: d.texto }]);
      assert.equal(volta.status, 200);
      perguntas = await lerChecklist();
      assert.deepEqual(perguntas.map((p) => p.texto), ["Tensão de saída dentro da faixa?", "Telemetria funcionando?", "Gabinete limpo e sem corrosão?"]);
    });

    it("recusa pergunta vazia, comprida, pergunta de outro plano e mais de 50 perguntas", async () => {
      assert.equal((await salvar(c.supervisor, planoId, [{ texto: "   " }])).status, 422);
      assert.equal((await salvar(c.supervisor, planoId, [{ texto: "x".repeat(301) }])).status, 422);
      assert.equal((await salvar(c.supervisor, planoId, Array.from({ length: 51 }, (_, i) => ({ texto: `Pergunta ${i}` })))).status, 422);
      assert.equal((await salvar(c.supervisor, planoId, [{ texto: "x".repeat(300) }, ...Array.from({ length: 49 }, (_, i) => ({ texto: `P${i}` }))])).status, 200);
      const outro = await salvar(c.supervisor, planoSemChecklistId, [{ id: perguntas[0]!.id, texto: "roubada" }]);
      assert.equal(outro.status, 422);
      assert.equal(outro.corpo.erro.codigo, "pergunta_invalida");
      assert.equal((await lerChecklist(planoSemChecklistId)).length, 0, "a recusa desfaz tudo");

      // Restaura o checklist de três perguntas.
      const volta = await salvar(c.supervisor, planoId, perguntas.map((p) => ({ texto: p.texto })));
      assert.equal(volta.status, 200);
      perguntas = volta.corpo.plano.checklist;
    });

    it("só o admin e o supervisor da equipe editam; o técnico lê", async () => {
      const tecnico = await c.tecnico();
      assert.equal((await salvar(tecnico, planoId, [{ texto: "Nova?" }])).status, 403);
      const lista = await c.amb.esperar(200, "GET", "/preventivas", { como: tecnico });
      const p = lista.planos.find((x: { id: string }) => x.id === planoId);
      assert.equal(p.total_perguntas, 3);
      assert.equal(p.checklist, undefined, "a lista leva só o total");
      const detalhe = await c.amb.esperar(200, "GET", `/preventivas/${planoId}`, { como: tecnico });
      assert.equal(detalhe.plano.checklist.length, 3);
      assert.equal((await salvar(c.admin, planoId, perguntas)).status, 200);
    });

    it("a OS preventiva traz o checklist do plano no detalhe e no snapshot offline; a corretiva e o plano sem perguntas, vazio", async () => {
      const tecnico = await c.tecnico();
      const o = await c.novaOs({ tipo: "preventiva", planoManutencao: "10573", itemManutencao: "10603" });
      const detalhe = await c.amb.esperar(200, "GET", `/os/${o.id}`, { como: tecnico });
      assert.deepEqual(detalhe.checklist_inspecao, perguntas);

      const corretiva = await c.novaOs();
      assert.deepEqual((await c.amb.esperar(200, "GET", `/os/${corretiva.id}`, { como: tecnico })).checklist_inspecao, []);
      const semPerguntas = await c.novaOs({ tipo: "preventiva", planoManutencao: "20001", itemManutencao: "1" });
      assert.deepEqual((await c.amb.esperar(200, "GET", `/os/${semPerguntas.id}`, { como: tecnico })).checklist_inspecao, []);
      const semItem = await c.novaOs({ tipo: "preventiva", planoManutencao: "10573", itemManutencao: null });
      assert.deepEqual((await c.amb.esperar(200, "GET", `/os/${semItem.id}`, { como: tecnico })).checklist_inspecao, [], "outro item é outro plano");

      const snapshot = await c.amb.esperar(200, "POST", "/sync/pull", { como: tecnico, json: {} });
      const doSnapshot = (id: string) => snapshot.os.find((x: { id: string }) => x.id === id);
      assert.deepEqual(doSnapshot(o.id).checklist_inspecao, perguntas);
      assert.deepEqual(doSnapshot(corretiva.id).checklist_inspecao, []);
    });
  });

  describe("o encerramento", () => {
    it("recusa o encerramento sem o checklist e sem alguma pergunta", async () => {
      const tecnico = await c.tecnico();
      const { execId } = await emExecucao(tecnico);

      const sem = await encerrar(tecnico, execId);
      assert.equal(sem.rejeitados[0].codigo, "checklist_incompleto");
      const faltando = await encerrar(tecnico, execId, respostas([true], [true]));
      assert.equal(faltando.rejeitados[0].codigo, "checklist_incompleto");
      assert.match(faltando.rejeitados[0].mensagem, /Gabinete limpo/);
      const [e] = await c.amb.db.select().from(execucao).where(eq(execucao.id, execId));
      assert.equal(e!.resultado, null, "a execução continua aberta");
    });

    it("o item não marcado pede observação", async () => {
      const tecnico = await c.tecnico();
      const { execId } = await emExecucao(tecnico);
      const r = await encerrar(tecnico, execId, respostas([true], [false], [true]));
      assert.equal(r.rejeitados[0].codigo, "observacao_obrigatoria");
      const branca = await encerrar(tecnico, execId, respostas([true], [false, "   "], [true]));
      assert.equal(branca.rejeitados[0].codigo, "observacao_obrigatoria");
    });

    it("tudo marcado encerra e guarda as perguntas como estavam, sem alerta; mudar o checklist depois não altera a execução", async () => {
      const tecnico = await c.tecnico();
      const { o, execId } = await emExecucao(tecnico);
      const r = await encerrar(tecnico, execId, respostas([true, "  Leitura: 24,8 Vcc  "], [true], [true]));
      assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
      assert.deepEqual(r.alertas ?? [], []);

      const guardado = (await c.amb.db.select().from(execucao).where(eq(execucao.id, execId)))[0]!.dadosInspecao;
      assert.deepEqual(guardado, {
        itens: [
          { pergunta: "Tensão de saída dentro da faixa?", marcado: true, observacao: "Leitura: 24,8 Vcc" },
          { pergunta: "Telemetria funcionando?", marcado: true, observacao: null },
          { pergunta: "Gabinete limpo e sem corrosão?", marcado: true, observacao: null },
        ],
      });
      assert.equal((await c.amb.db.select().from(alerta).where(and(eq(alerta.osId, o.id), eq(alerta.tipo, "inspecao_com_pendencia")))).length, 0);

      // O detalhe da OS mostra o que foi respondido, com a pergunta de então.
      const novo = await salvar(c.supervisor, planoId, [{ texto: "Pergunta nova?" }]);
      assert.equal(novo.status, 200);
      const detalhe = await c.amb.esperar(200, "GET", `/os/${o.id}`, { como: c.supervisor });
      assert.deepEqual(detalhe.execucoes[0].dados_inspecao, guardado);
      assert.deepEqual(detalhe.checklist_inspecao.map((p: { texto: string }) => p.texto), ["Pergunta nova?"]);
      const volta = await salvar(c.supervisor, planoId, perguntas.map((p) => ({ texto: p.texto })));
      perguntas = volta.corpo.plano.checklist;
    });

    it("item não marcado com observação não bloqueia: a OS encerra e o supervisor recebe o alerta com os itens", async () => {
      const tecnico = await c.tecnico();
      const { o, execId } = await emExecucao(tecnico);
      const r = await encerrar(tecnico, execId, respostas([true], [false, "Sem sinal de telemetria; chamado aberto"], [false, "Corrosão na base"]));
      assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));

      const [e] = await c.amb.db.select().from(execucao).where(eq(execucao.id, execId));
      assert.equal(e!.resultado, "encerrada");
      const avisos = await c.amb.db.select().from(alerta).where(and(eq(alerta.osId, o.id), eq(alerta.tipo, "inspecao_com_pendencia")));
      assert.equal(avisos.length, 1);
      assert.equal(avisos[0]!.destinatarioId, c.supervisor.id);
      assert.match(avisos[0]!.detalhe, /plano 10573, item 10603/);
      assert.match(avisos[0]!.detalhe, /2 itens não marcados/);
      assert.match(avisos[0]!.detalhe, /Telemetria funcionando\?": Sem sinal de telemetria; chamado aberto/);
      assert.match(avisos[0]!.detalhe, /Gabinete limpo e sem corrosão\?": Corrosão na base/);
      assert.ok(!avisos[0]!.detalhe.includes("Tensão de saída"), "o item marcado não entra no aviso");

      // O alerta aparece no sino do supervisor.
      const sino = await c.amb.esperar(200, "GET", "/alertas", { como: c.supervisor, consulta: { tipo: "inspecao_com_pendencia" } });
      assert.ok(sino.alertas.some((a: { os_id: string }) => a.os_id === o.id));
    });

    it("pergunta que o aparelho não conhecia: recusada online; da fila offline entra como não respondida", async () => {
      const tecnico = await c.tecnico();
      const { o, execId } = await emExecucao(tecnico);
      // O aparelho respondeu a duas perguntas e a terceira foi acrescentada depois.
      const duas = respostas([true], [true]);
      assert.equal((await encerrar(tecnico, execId, duas)).rejeitados[0].codigo, "checklist_incompleto");

      const cincoMinutosAntes = new Date(c.amb.relogio.agora.getTime() - 5 * 60_000).toISOString();
      const r = await encerrar(tecnico, execId, duas, cincoMinutosAntes);
      assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
      const itens = ((await c.amb.db.select().from(execucao).where(eq(execucao.id, execId)))[0]!.dadosInspecao as { itens: any[] }).itens;
      assert.deepEqual(itens[2], { pergunta: "Gabinete limpo e sem corrosão?", marcado: null, observacao: null });
      // Não respondida não é "não marcada": não gera alerta de pendência.
      assert.equal((await c.amb.db.select().from(alerta).where(and(eq(alerta.osId, o.id), eq(alerta.tipo, "inspecao_com_pendencia")))).length, 0);
    });

    it("a resposta de uma pergunta que já não existe é ignorada", async () => {
      const tecnico = await c.tecnico();
      const { execId } = await emExecucao(tecnico);
      const r = await encerrar(tecnico, execId, { itens: [...respostas([true], [true], [true]).itens, { pergunta_id: randomUUID(), marcado: false }] });
      assert.equal(r.rejeitados.length, 0, JSON.stringify(r.rejeitados));
      const itens = ((await c.amb.db.select().from(execucao).where(eq(execucao.id, execId)))[0]!.dadosInspecao as { itens: any[] }).itens;
      assert.equal(itens.length, 3);
    });

    it("plano sem checklist e OS corretiva encerram como antes", async () => {
      const tecnico = await c.tecnico();
      const { execId } = await emExecucao(tecnico, { plano: "20001", item: "1" });
      assert.equal((await encerrar(tecnico, execId)).rejeitados.length, 0);
      assert.equal((await c.amb.db.select().from(execucao).where(eq(execucao.id, execId)))[0]!.dadosInspecao, null);

      const o = await c.novaOs();
      const { aprId } = await c.apr(tecnico, o.id);
      const corretivaId = await c.iniciar(tecnico, o.id, aprId);
      assert.equal((await encerrar(tecnico, corretivaId)).rejeitados.length, 0);
    });

    it("interromper por risco não pede o checklist", async () => {
      const tecnico = await c.tecnico();
      const { execId } = await emExecucao(tecnico);
      await c.interromper(tecnico, execId);
      const [e] = await c.amb.db.select().from(execucao).where(eq(execucao.id, execId));
      assert.equal(e!.resultado, "interrompida");
    });

    it("recusa respostas com formato inválido", async () => {
      const tecnico = await c.tecnico();
      const { execId } = await emExecucao(tecnico);
      assert.equal((await encerrar(tecnico, execId, { itens: [{ pergunta_id: "x", marcado: "sim" }] })).rejeitados[0].codigo, "payload_invalido");
      assert.equal((await encerrar(tecnico, execId, respostas([true], [true, "x".repeat(501)], [true]))).rejeitados[0].codigo, "payload_invalido");
    });
  });

  describe("o PDF da OS", () => {
    it("lista o checklist com a caixa marcada ou vazia, a pergunta e a observação", async () => {
      const o = await criarOs(c.amb, { equipeId: c.equipe.id, encerrada: true });
      await c.amb.db
        .update(execucao)
        .set({
          dadosInspecao: {
            itens: [
              { pergunta: "Tensão de saída dentro da faixa?", marcado: true, observacao: null },
              { pergunta: "Telemetria funcionando?", marcado: false, observacao: "Sem sinal" },
              { pergunta: "Gabinete limpo?", marcado: null, observacao: null },
            ],
          },
        })
        .where(eq(execucao.id, o.execId));
      const texto = textoDoPdf(await gerarPdfOs(c.amb.deps, o.osId, { comprimir: false }));
      for (const esperado of ["CHECKLIST DE INSPEÇÃO", "Tensão de saída dentro da faixa?", "[X]", "Telemetria funcionando?", "[  ]", "Obs.: Sem sinal", "Gabinete limpo?", "[?]", "Não respondida."]) {
        assert.ok(texto.includes(esperado), `faltou "${esperado}" no PDF`);
      }
    });

    it("a inspeção sem estrutura (de antes do checklist) continua saindo como campo e valor", async () => {
      const o = await criarOs(c.amb, { equipeId: c.equipe.id, encerrada: true });
      await c.amb.db.update(execucao).set({ dadosInspecao: { tensao_saida_vcc: 5.25 } }).where(eq(execucao.id, o.execId));
      const texto = textoDoPdf(await gerarPdfOs(c.amb.deps, o.osId, { comprimir: false }));
      assert.ok(texto.includes("tensao_saida_vcc: 5.25"));
      assert.ok(!texto.includes("CHECKLIST DE INSPEÇÃO"));
    });
  });
});
