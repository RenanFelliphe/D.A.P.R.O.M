import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { definicaoDaFuncao } from "../../shared/ia/funcoes";
import { itemModeloApr, localInstalacao, modeloApr, os } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { ajudaDeExecucao } from "./ajuda-execucao";

const CABECALHO = "X-Assinatura-Juridica";

/**
 * A assinatura com validade jurídica (`docs/pessoas-e-equipes.md`, seção 3.3): o ciclo com o provedor (simulado em memória), a exigência
 * nas rotas e nos eventos dos atos assinados, o uso único, o ato feito sem sinal que fica pendente e o webhook.
 */
describe("Assinatura com validade jurídica", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let equipeId: string;
  let localId: string;
  let modeloId: string;
  let itens: (typeof itemModeloApr.$inferSelect)[];
  let contadorOs = 4800000;
  /** A OS do SAP que as OS de apoio dos testes destravam (a de apoio precisa apontar para uma). */
  let osOrigemId: string;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: new Date("2026-10-22T15:00:00Z") });
    h = ajudaDeExecucao(amb);
    admin = await amb.criarUsuario({ perfil: "admin" });
    equipeId = (await amb.criarEquipe()).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Tiago Técnico" });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Carla Colega" });
    const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
    modeloId = m!.id;
    itens = await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, modeloId));
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/ASSINATURA" }).returning({ id: localInstalacao.id })) as [{ id: string }];
    const [origem] = await amb.db.insert(os).values({ numeroOrdem: "4799999", tipo: "corretiva", titulo: "OS de origem", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-22", origem: "sap" }).returning({ id: os.id });
    osOrigemId = origem!.id;
  });
  after(() => amb.fechar());
  afterEach(() => {
    amb.deps.config.assinaturaJuridica.ligada = false;
    amb.assinaturas.falhar = false;
  });

  const ligar = () => {
    amb.deps.config.assinaturaJuridica.ligada = true;
  };

  async function novaOs(origem: "apoio" | "sap" = "apoio") {
    const [o] = await amb.db
      .insert(os)
      .values({
        numeroOrdem: origem === "sap" ? String(++contadorOs) : null,
        tipo: "corretiva",
        titulo: "Serviço do teste de assinatura",
        localInstalacaoId: localId,
        equipeId,
        dataInicioProg: "2026-10-22",
        origem,
        osOrigemId: origem === "apoio" ? osOrigemId : null,
      })
      .returning();
    return o!;
  }

  /** Cria a assinatura e a assina na "página do provedor" (o simulado). Devolve o código da assinatura. */
  async function assinar(quem: UsuarioDeTeste, opcoes: { osId?: string; assinarNoProvedor?: boolean } = {}) {
    const nova = await amb.esperar(201, "POST", "/assinaturas-juridicas", { como: quem, json: { titulo: "Cancelar a OS de apoio", resumo: "Cancelar por duplicidade", ...(opcoes.osId ? { os_id: opcoes.osId } : {}) } });
    if (opcoes.assinarNoProvedor !== false) {
      const [linha] = await amb.sql<{ documento_id: string }>("select documento_id from assinatura_juridica where id = $1", [nova.id]);
      assert.ok(amb.assinaturas.assinar(linha!.documento_id, amb.relogio.agora));
      const depois = await amb.esperar(200, "GET", `/assinaturas-juridicas/${nova.id}`, { como: quem });
      assert.equal(depois.situacao, "assinada");
    }
    return nova.id as string;
  }
  const linhaDe = async (id: string) => (await amb.sql<{ situacao: string; usada_em: string | null; ato: string | null; origem_offline: boolean; pdf_path: string | null }>("select situacao, usada_em, ato, origem_offline, pdf_path from assinatura_juridica where id = $1", [id]))[0]!;
  const statusDaOs = async (id: string) => (await amb.db.select({ s: os.status }).from(os).where(eq(os.id, id)))[0]!.s;

  describe("o ciclo com o provedor", () => {
    it("desligada, criar a assinatura é 409", async () => {
      const r = await amb.req("POST", "/assinaturas-juridicas", { como: tecnico, json: { titulo: "Qualquer ato" } });
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "assinatura_juridica_desligada");
    });

    it("cria o documento no provedor e devolve o link; a consulta acompanha até assinar e guarda o PDF assinado", async () => {
      ligar();
      const antes = amb.assinaturas.criados;
      const nova = await amb.esperar(201, "POST", "/assinaturas-juridicas", { como: tecnico, json: { titulo: "Assinar a APR", resumo: "Li os riscos" } });
      assert.equal(amb.assinaturas.criados, antes + 1);
      assert.equal(nova.situacao, "aguardando");
      assert.match(nova.url_assinatura, /\/assinatura-simulada\//);
      assert.equal(nova.usada, false);
      assert.equal(nova.pdf_pronto, false);

      // O que o provedor recebeu é o termo em PDF.
      const [linha] = await amb.sql<{ documento_id: string }>("select documento_id from assinatura_juridica where id = $1", [nova.id]);
      assert.equal(Buffer.from(amb.assinaturas.documentos.get(linha!.documento_id)!.pdf.slice(0, 4)).toString(), "%PDF");

      const espera = await amb.esperar(200, "GET", `/assinaturas-juridicas/${nova.id}`, { como: tecnico });
      assert.equal(espera.situacao, "aguardando");

      amb.assinaturas.assinar(linha!.documento_id, amb.relogio.agora);
      const pronta = await amb.esperar(200, "GET", `/assinaturas-juridicas/${nova.id}`, { como: tecnico });
      assert.equal(pronta.situacao, "assinada");
      assert.equal(pronta.url_assinatura, null);
      assert.equal(pronta.pdf_pronto, true);
      const { url } = await amb.esperar(200, "GET", `/assinaturas-juridicas/${nova.id}/pdf`, { como: tecnico });
      assert.match(url, new RegExp(`assinaturas-juridicas/${nova.id}\\.pdf`));
    });

    it("a recusa no provedor encerra a espera", async () => {
      ligar();
      const nova = await amb.esperar(201, "POST", "/assinaturas-juridicas", { como: tecnico, json: { titulo: "Ato recusado" } });
      const [linha] = await amb.sql<{ documento_id: string }>("select documento_id from assinatura_juridica where id = $1", [nova.id]);
      amb.assinaturas.recusar(linha!.documento_id);
      assert.equal((await amb.esperar(200, "GET", `/assinaturas-juridicas/${nova.id}`, { como: tecnico })).situacao, "recusada");
    });

    it("provedor fora do ar: criar é 502 e nada fica gravado; a consulta com o provedor fora não muda a situação", async () => {
      ligar();
      const antes = (await amb.sql("select id from assinatura_juridica")).length;
      amb.assinaturas.falhar = true;
      const r = await amb.req("POST", "/assinaturas-juridicas", { como: tecnico, json: { titulo: "Provedor fora" } });
      assert.equal(r.status, 502);
      assert.equal(r.corpo.erro.codigo, "assinatura_juridica_indisponivel");
      assert.equal((await amb.sql("select id from assinatura_juridica")).length, antes);

      amb.assinaturas.falhar = false;
      const id = await assinar(tecnico, { assinarNoProvedor: false });
      amb.assinaturas.falhar = true;
      assert.equal((await amb.esperar(200, "GET", `/assinaturas-juridicas/${id}`, { como: tecnico })).situacao, "aguardando");
    });

    it("só a própria pessoa vê a assinatura; o título é obrigatório; a OS precisa existir", async () => {
      ligar();
      const id = await assinar(tecnico);
      assert.equal((await amb.req("GET", `/assinaturas-juridicas/${id}`, { como: colega })).status, 404);
      assert.equal((await amb.req("GET", `/assinaturas-juridicas/${id}/pdf`, { como: colega })).status, 403);
      assert.equal((await amb.req("POST", "/assinaturas-juridicas", { como: tecnico, json: { titulo: "" } })).status, 422);
      assert.equal((await amb.req("POST", "/assinaturas-juridicas", { como: tecnico, json: { titulo: "Ato", os_id: randomUUID() } })).status, 404);
      // O admin também baixa o PDF assinado de outra pessoa.
      assert.equal((await amb.req("GET", `/assinaturas-juridicas/${id}/pdf`, { como: admin })).status, 200);
    });

    it("GET /me diz se está ligada e se é a simulada", async () => {
      assert.deepEqual((await amb.esperar(200, "GET", "/me", { como: tecnico })).assinatura_juridica, { ligada: false, simulada: true });
      ligar();
      assert.deepEqual((await amb.esperar(200, "GET", "/me", { como: tecnico })).assinatura_juridica, { ligada: true, simulada: true });
    });

    it("o webhook com o segredo certo reconsulta o provedor; com o errado é 401", async () => {
      ligar();
      const id = await assinar(tecnico, { assinarNoProvedor: false });
      const [linha] = await amb.sql<{ documento_id: string }>("select documento_id from assinatura_juridica where id = $1", [id]);
      amb.assinaturas.assinar(linha!.documento_id, amb.relogio.agora);
      assert.equal((await amb.req("POST", "/webhooks/zapsign", { json: { token: linha!.documento_id } })).status, 401);
      assert.equal((await amb.req("POST", "/webhooks/zapsign", { consulta: { segredo: "errado" }, json: { token: linha!.documento_id } })).status, 401);
      assert.equal((await linhaDe(id)).situacao, "aguardando");
      await amb.esperar(200, "POST", "/webhooks/zapsign", { consulta: { segredo: "segredo-do-webhook" }, json: { token: linha!.documento_id } });
      assert.equal((await linhaDe(id)).situacao, "assinada");
    });
  });

  describe("os atos por rota (cancelar a OS de apoio, como exemplo)", () => {
    it("desligada, o ato segue só com a assinatura desenhada", async () => {
      const o = await novaOs();
      await amb.esperar(200, "POST", `/os/${o.id}/cancelar`, { como: admin, json: { justificativa: "Duplicada" } });
      assert.equal(await statusDaOs(o.id), "cancelada");
    });

    it("ligada, sem o código da assinatura o ato é recusado e a OS não muda", async () => {
      ligar();
      const o = await novaOs();
      const r = await amb.req("POST", `/os/${o.id}/cancelar`, { como: admin, json: { justificativa: "Duplicada" } });
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.codigo, "assinatura_juridica_pendente");
      assert.equal(await statusDaOs(o.id), "liberada");
    });

    it("a assinatura ainda não concluída no provedor não vale", async () => {
      ligar();
      const o = await novaOs();
      const id = await assinar(admin, { assinarNoProvedor: false });
      const r = await amb.req("POST", `/os/${o.id}/cancelar`, { como: admin, cabecalhos: { [CABECALHO]: id }, json: { justificativa: "Duplicada" } });
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.codigo, "assinatura_juridica_nao_assinada");
      assert.equal(await statusDaOs(o.id), "liberada");
    });

    it("assinada, o ato passa; a assinatura serve a um ato só e fica gravado qual", async () => {
      ligar();
      const o = await novaOs();
      const id = await assinar(admin, { osId: o.id });
      await amb.esperar(200, "POST", `/os/${o.id}/cancelar`, { como: admin, cabecalhos: { [CABECALHO]: id }, json: { justificativa: "Duplicada" } });
      assert.equal(await statusDaOs(o.id), "cancelada");
      const l = await linhaDe(id);
      assert.notEqual(l.usada_em, null);
      assert.equal(l.ato, `POST /os/${o.id}/cancelar`);

      const outra = await novaOs();
      const r = await amb.req("POST", `/os/${outra.id}/cancelar`, { como: admin, cabecalhos: { [CABECALHO]: id }, json: { justificativa: "Duplicada" } });
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.codigo, "assinatura_juridica_usada");
      assert.equal(await statusDaOs(outra.id), "liberada");
    });

    it("se a rota recusa o ato, a assinatura volta e vale para outro ato", async () => {
      ligar();
      const id = await assinar(admin);
      const doSap = await novaOs("sap");
      const recusada = await amb.req("POST", `/os/${doSap.id}/cancelar`, { como: admin, cabecalhos: { [CABECALHO]: id }, json: { justificativa: "x" } });
      assert.equal(recusada.status, 422);
      assert.equal((await linhaDe(id)).usada_em, null);

      const o = await novaOs();
      await amb.esperar(200, "POST", `/os/${o.id}/cancelar`, { como: admin, cabecalhos: { [CABECALHO]: id }, json: { justificativa: "Duplicada" } });
      assert.equal(await statusDaOs(o.id), "cancelada");
    });

    it("a assinatura de outra pessoa é recusada; a vencida (mais de 30 minutos) também", async () => {
      ligar();
      const o = await novaOs();
      const dele = await assinar(tecnico);
      const r = await amb.req("POST", `/os/${o.id}/cancelar`, { como: admin, cabecalhos: { [CABECALHO]: dele }, json: { justificativa: "x" } });
      assert.equal(r.corpo.erro.codigo, "assinatura_juridica_invalida");

      const minha = await assinar(admin);
      const hora = amb.relogio.agora;
      amb.relogio.agora = new Date(hora.getTime() + 31 * 60_000);
      const velha = await amb.req("POST", `/os/${o.id}/cancelar`, { como: admin, cabecalhos: { [CABECALHO]: minha }, json: { justificativa: "x" } });
      amb.relogio.agora = hora;
      assert.equal(velha.corpo.erro.codigo, "assinatura_juridica_vencida");
      assert.equal(await statusDaOs(o.id), "liberada");
    });
  });

  describe("a função de IA que passa a ler dados (ato que só às vezes assina)", () => {
    it("ligar sem dados não assina; autorizar a leitura exige a assinatura", async () => {
      ligar();
      const versao = definicaoDaFuncao("chatbot").versaoDoTexto;
      await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", { como: admin, json: { ligada: true } });
      const sem = await amb.req("PUT", "/vitoria/ia/chatbot", { como: admin, json: { ligada: true, com_dados: true, versao_do_texto: versao } });
      assert.equal(sem.status, 422);
      assert.equal(sem.corpo.erro.codigo, "assinatura_juridica_pendente");
      const id = await assinar(admin);
      await amb.esperar(200, "PUT", "/vitoria/ia/chatbot", { como: admin, cabecalhos: { [CABECALHO]: id }, json: { ligada: true, com_dados: true, versao_do_texto: versao } });
      assert.notEqual((await linhaDe(id)).usada_em, null);
    });
  });

  describe("os eventos de campo assinados", () => {
    async function aprDeDois(o: { id: string }) {
      const aprId = randomUUID();
      const r = await h.enviar(
        tecnico,
        h.evento(
          "apr_concluida",
          {
            id: aprId,
            modelo_apr_id: modeloId,
            participantes: [
              { usuario_id: tecnico.id, funcao: "responsavel" },
              { usuario_id: colega.id, funcao: "executor" },
            ],
            riscos: [],
            respostas: itens.filter((i) => i.secao === "verificacao").map((i) => ({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" })),
            evidencias: [],
            observacao_geral: null,
            concluida_em: h.agora(),
          },
          o.id,
        ),
      );
      assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
      return aprId;
    }

    it("com sinal e sem o código, o evento fica pendente na fila do cliente", async () => {
      ligar();
      const o = await novaOs("sap");
      const aprId = await aprDeDois(o);
      const r = await h.enviar(tecnico, h.evento("apr_assinada", { apr_id: aprId }, o.id));
      assert.deepEqual(r.confirmados, []);
      assert.equal(r.pendentes[0]?.codigo, "assinatura_juridica_pendente");
    });

    it("com o código de uma assinatura concluída, o evento passa e a assinatura registra o evento", async () => {
      ligar();
      const o = await novaOs("sap");
      const aprId = await aprDeDois(o);
      const id = await assinar(tecnico, { osId: o.id });
      const evento = h.evento("apr_assinada", { apr_id: aprId, assinatura_juridica_id: id }, o.id);
      const r = await h.enviar(tecnico, evento);
      assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
      assert.deepEqual(r.confirmados, [evento.id]);
      assert.equal((await linhaDe(id)).ato, `evento:apr_assinada:${evento.id}`);
    });

    it("o código que não serve é recusado com o motivo (com sinal)", async () => {
      ligar();
      const o = await novaOs("sap");
      const aprId = await aprDeDois(o);
      const id = await assinar(tecnico, { assinarNoProvedor: false });
      const r = await h.enviar(tecnico, h.evento("apr_assinada", { apr_id: aprId, assinatura_juridica_id: id }, o.id));
      assert.equal(r.rejeitados[0]?.codigo, "assinatura_juridica_nao_assinada");
    });

    it("o evento da fila offline vale com a assinatura desenhada e fica pendente para assinar depois", async () => {
      ligar();
      const o = await novaOs("sap");
      const aprId = await aprDeDois(o);
      // Aconteceu há 10 minutos, sem sinal.
      const dezMinutosAtras = new Date(amb.relogio.agora.getTime() - 10 * 60_000).toISOString();
      const evento = h.evento("apr_assinada", { apr_id: aprId }, o.id, dezMinutosAtras);
      const r = await h.enviar(tecnico, evento);
      assert.deepEqual(r.rejeitados, [], JSON.stringify(r.rejeitados));
      assert.deepEqual(r.confirmados, [evento.id]);

      const pendentes = (await amb.esperar(200, "GET", "/assinaturas-juridicas", { como: tecnico, consulta: { situacao: "pendente_offline" } })).assinaturas;
      assert.equal(pendentes.length, 1);
      assert.equal(pendentes[0].titulo, "Assinatura da APR");
      assert.equal(pendentes[0].origem_offline, true);
      assert.equal(pendentes[0].os_id, o.id);
      assert.equal(pendentes[0].usada, true);

      // Voltou o sinal: a pessoa assina o que já fez.
      const criados = amb.assinaturas.criados;
      const enviada = await amb.esperar(200, "POST", `/assinaturas-juridicas/${pendentes[0].id}/enviar`, { como: tecnico });
      assert.equal(amb.assinaturas.criados, criados + 1);
      assert.equal(enviada.situacao, "aguardando");
      assert.match(enviada.url_assinatura, /\/assinatura-simulada\//);
      // Repetir o pedido não cria outro documento.
      await amb.esperar(200, "POST", `/assinaturas-juridicas/${pendentes[0].id}/enviar`, { como: tecnico });
      assert.equal(amb.assinaturas.criados, criados + 1);

      const [linha] = await amb.sql<{ documento_id: string }>("select documento_id from assinatura_juridica where id = $1", [pendentes[0].id]);
      amb.assinaturas.assinar(linha!.documento_id, amb.relogio.agora);
      const depois = await amb.esperar(200, "GET", `/assinaturas-juridicas/${pendentes[0].id}`, { como: tecnico });
      assert.equal(depois.situacao, "assinada");
      assert.equal((await linhaDe(pendentes[0].id)).origem_offline, true);
      assert.deepEqual((await amb.esperar(200, "GET", "/assinaturas-juridicas", { como: tecnico, consulta: { situacao: "pendente_offline" } })).assinaturas, []);
    });

    it("quem vê a OS vê as assinaturas dos atos dela; a outra equipe, não", async () => {
      ligar();
      const o = await novaOs("sap");
      const id = await assinar(tecnico, { osId: o.id });
      const lista = (await amb.esperar(200, "GET", `/os/${o.id}/assinaturas-juridicas`, { como: colega })).assinaturas;
      assert.deepEqual(lista.map((a: { id: string }) => a.id), [id]);
      assert.equal(lista[0].usuario.nome, "Tiago Técnico");
      const deFora = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
      assert.equal((await amb.req("GET", `/os/${o.id}/assinaturas-juridicas`, { como: deFora })).status, 404);
    });
  });
});
