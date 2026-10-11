import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const MENSAGEM_SEM_ELIMINATORIO = "Modelo precisa de ao menos um item eliminatório";
const MENSAGEM_SEM_RESPOSTA = "Todo item de verificação precisa de resposta bloqueante";

const risco = (ordem: number, nome = `Risco ${ordem}`, classificacao = "Veicular") => ({ classificacao, nome, ordem });
const verificacao = (ordem: number, extra: Record<string, unknown> = {}) => ({
  secao: "verificacao",
  ordem,
  texto: `Pergunta ${ordem}?`,
  resposta_bloqueante: "nao",
  tipo: "eliminatorio",
  ...extra,
});
const medida = (ordem: number, riscoOrdem: number, extra: Record<string, unknown> = {}) => ({
  secao: "medida_preventiva",
  risco_ordem: riscoOrdem,
  ordem,
  texto: `Medida ${ordem}?`,
  tipo: "alerta",
  ...extra,
});

/** Modelo mínimo válido (publicável). */
const corpoMinimo = (extra: Record<string, unknown> = {}) => ({
  titulo: "Modelo de teste",
  riscos: [risco(1, "Insolação")],
  itens: [verificacao(1), medida(2, 1)],
  ...extra,
});

/** O conteúdo de um item sem o que é do banco (ids), para comparar versões. */
const semIds = (itens: any[]) => itens.map(({ id: _id, risco_id: _riscoId, ...resto }) => resto);

describe("Modelo de APR", () => {
  let amb: Ambiente;
  let seguranca: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let analista: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    const equipe = await amb.criarEquipe();
    seguranca = await amb.criarUsuario({ perfil: "seguranca" });
    admin = await amb.criarUsuario({ perfil: "admin" });
    analista = await amb.criarUsuario({ perfil: "analista" });
    supervisor = await amb.criarUsuario({ perfil: "supervisor", equipeId: equipe.id });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipe.id });
  });
  after(() => amb.fechar());

  const publicar = (codigo: string, versao: number, como = seguranca) => amb.req("POST", `/modelos-apr/${encodeURIComponent(codigo)}/versoes/${versao}/publicar`, { como });
  const criarVersao = (codigo: string, json: unknown, como = seguranca) => amb.req("POST", `/modelos-apr/${encodeURIComponent(codigo)}/versoes`, { como, json });
  const ler = (codigo: string, versao: number | string, como = seguranca) => amb.req("GET", `/modelos-apr/${encodeURIComponent(codigo)}/versoes/${versao}`, { como });

  describe("perfis", () => {
    it("exige autenticação", async () => {
      assert.equal((await amb.req("GET", "/modelos-apr")).status, 401);
      assert.equal((await amb.req("GET", "/atividades")).status, 401);
      assert.equal((await amb.req("POST", "/modelos-apr/APR%2001/versoes", { json: {} })).status, 401);
    });

    it("só a segurança escreve: admin, analista, supervisor e técnico recebem 403 em todas as escritas", async () => {
      for (const quem of [admin, analista, supervisor, tecnico]) {
        const c = { como: quem, json: corpoMinimo() };
        assert.equal((await amb.req("POST", "/modelos-apr/APR%2001/versoes", c)).status, 403, `POST versoes ${quem.perfil}`);
        assert.equal((await amb.req("PUT", "/modelos-apr/APR%2001/versoes/4", c)).status, 403, `PUT ${quem.perfil}`);
        assert.equal((await amb.req("DELETE", "/modelos-apr/APR%2001/versoes/4", { como: quem })).status, 403, `DELETE ${quem.perfil}`);
        assert.equal((await publicar("APR 01", 4, quem)).status, 403, `publicar ${quem.perfil}`);
        assert.equal((await amb.req("PUT", "/atividades/8.7.1", { como: quem, json: { descricao: "x", modelo_apr_codigo: null } })).status, 403, `PUT atividade ${quem.perfil}`);
      }
    });

    it("todo perfil autenticado lê modelos, versões e atividades", async () => {
      for (const quem of [seguranca, admin, analista, supervisor, tecnico]) {
        assert.equal((await amb.req("GET", "/modelos-apr", { como: quem })).status, 200, `lista ${quem.perfil}`);
        assert.equal((await ler("APR 01", "publicada", quem)).status, 200, `modelo ${quem.perfil}`);
        assert.equal((await amb.req("GET", "/atividades", { como: quem })).status, 200, `atividades ${quem.perfil}`);
      }
    });
  });

  describe("leitura", () => {
    it("lista os 8 modelos da carga, por código, com resumo sem itens", async () => {
      const c = await amb.esperar(200, "GET", "/modelos-apr", { como: tecnico });
      assert.deepEqual(
        c.modelos.map((m: any) => m.codigo),
        ["APR 01", "APR 02", "APR 03", "APR 04", "APR 05", "APR 06", "APR 07", "APR 09"],
      );
      assert.equal(c.total, 8);
      const apr01 = c.modelos[0];
      assert.deepEqual(Object.keys(apr01).sort(), ["codigo", "data_documento", "id", "itens_total", "publicado_em", "rascunho", "titulo", "versao"]);
      assert.equal(apr01.versao, 4);
      assert.equal(apr01.data_documento, "2026-07-24");
      assert.equal(apr01.rascunho, false);
      assert.equal(apr01.itens_total, 43); // 11 verificações + 32 medidas
      assert.ok(apr01.publicado_em);
    });

    it("filtra por código e por publicados", async () => {
      const c = await amb.esperar(200, "GET", "/modelos-apr", { como: seguranca, consulta: { codigo: "APR 03" } });
      assert.deepEqual(c.modelos.map((m: any) => `${m.codigo} v${m.versao}`), ["APR 03 v4"]);
      const vazio = await amb.esperar(200, "GET", "/modelos-apr", { como: seguranca, consulta: { codigo: "APR 77" } });
      assert.equal(vazio.total, 0);
    });

    it("entrega o modelo completo: dados, pae, riscos e itens; `publicada` e o número dão o mesmo modelo", async () => {
      const m = await amb.esperar(200, "GET", `/modelos-apr/${encodeURIComponent("APR 01")}/versoes/publicada`, { como: tecnico });
      assert.equal(m.codigo, "APR 01");
      assert.equal(m.versao, 4);
      assert.equal(m.rascunho, false);
      assert.equal(m.riscos.length, 10);
      assert.equal(m.itens.length, 43);
      assert.ok(m.pae?.linhas, "o PAE vem com as chaves como foram gravadas");
      const [primeiraMedida] = m.itens.filter((i: any) => i.secao === "medida_preventiva");
      assert.ok(m.riscos.some((r: any) => r.id === primeiraMedida.risco_id && r.ordem === primeiraMedida.risco_ordem));
      assert.ok(m.itens.filter((i: any) => i.secao === "verificacao").every((i: any) => i.risco_id === null && i.risco_ordem === null));
      assert.deepEqual(m.itens.map((i: any) => i.ordem), [...m.itens.map((i: any) => i.ordem)].sort((a, b) => a - b));
      const porNumero = await amb.esperar(200, "GET", `/modelos-apr/${encodeURIComponent("APR 01")}/versoes/4`, { como: tecnico });
      assert.deepEqual(porNumero, m);
    });

    it("modelo ou versão que não existe é 404", async () => {
      assert.equal((await ler("APR 77", "publicada")).status, 404);
      assert.equal((await ler("APR 01", 99)).status, 404);
      assert.equal((await ler("APR 01", "abc")).status, 404);
      assert.equal((await amb.req("DELETE", "/modelos-apr/APR%2001/versoes/99", { como: seguranca })).status, 404);
      assert.equal((await publicar("APR 01", 99)).status, 404);
    });
  });

  describe("fluxo de edição: rascunho, publicação e nova versão", () => {
    let rascunhoId: string;

    it("criar a versão seguinte copia a publicada mais recente e nasce rascunho (201)", async () => {
      const criado = await amb.esperar(201, "POST", "/modelos-apr/APR%2002/versoes", { como: seguranca, json: {} });
      assert.equal(criado.versao, 5);
      assert.match(criado.id, /^[0-9a-f-]{36}$/);
      rascunhoId = criado.id;

      const anterior = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/4`, { como: seguranca });
      const novo = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/5`, { como: seguranca });
      assert.equal(novo.rascunho, true);
      assert.equal(novo.publicado_em, null);
      assert.equal(novo.titulo, anterior.titulo);
      assert.deepEqual(novo.pae, anterior.pae);
      assert.equal(novo.data_documento, null);
      assert.deepEqual(novo.riscos.map(({ id: _i, ...r }: any) => r), anterior.riscos.map(({ id: _i, ...r }: any) => r));
      assert.deepEqual(semIds(novo.itens), semIds(anterior.itens));
      // ids próprios: nada é compartilhado com a versão publicada
      assert.ok(novo.riscos.every((r: any) => !anterior.riscos.some((a: any) => a.id === r.id)));
      const riscoDaMedida = novo.itens.find((i: any) => i.secao === "medida_preventiva");
      assert.ok(novo.riscos.some((r: any) => r.id === riscoDaMedida.risco_id));
    });

    it("a publicada não muda e o rascunho só aparece para a segurança", async () => {
      const publicada = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/publicada`, { como: tecnico });
      assert.equal(publicada.versao, 4);

      assert.equal((await ler("APR 02", 5, tecnico)).status, 404);
      const listaTecnico = await amb.esperar(200, "GET", "/modelos-apr", { como: tecnico, consulta: { codigo: "APR 02" } });
      assert.deepEqual(listaTecnico.modelos.map((m: any) => m.versao), [4]);

      const listaSeguranca = await amb.esperar(200, "GET", "/modelos-apr", { como: seguranca, consulta: { codigo: "APR 02" } });
      assert.deepEqual(listaSeguranca.modelos.map((m: any) => [m.versao, m.rascunho]), [[5, true], [4, false]]);
      const soPublicados = await amb.esperar(200, "GET", "/modelos-apr", { como: seguranca, consulta: { codigo: "APR 02", publicados: true } });
      assert.deepEqual(soPublicados.modelos.map((m: any) => m.versao), [4]);
    });

    it("com um rascunho aberto, criar outro do mesmo código é 409", async () => {
      const r = await criarVersao("APR 02", {});
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "rascunho_existente");
      // outro código não é afetado
      await amb.esperar(201, "POST", "/modelos-apr/APR%2009/versoes", { como: seguranca, json: { titulo: "APR 09 revisada" } });
      await amb.esperar(200, "DELETE", "/modelos-apr/APR%2009/versoes/3", { como: seguranca });
    });

    it("PUT substitui o conteúdo do rascunho (inclusive riscos e medidas)", async () => {
      const atual = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/5`, { como: seguranca });
      const itens = atual.itens.filter((i: any) => i.secao === "verificacao").map((i: any) => ({ ...i, texto: i.ordem === atual.itens[0].ordem ? "Pergunta reescrita?" : i.texto }));
      const riscos = [risco(1, "Risco único", "Ambiente de trabalho")];
      const resposta = await amb.esperar(200, "PUT", "/modelos-apr/APR%2002/versoes/5", {
        como: seguranca,
        json: { titulo: "Título novo", data_documento: "2026-09-01", pae: { titulo: "PAE novo", linhas: [] }, riscos, itens: [...itens, medida(900, 1, { texto: "Medida nova?" })] },
      });
      assert.deepEqual(resposta, { id: rascunhoId, versao: 5 });

      const depois = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/5`, { como: seguranca });
      assert.equal(depois.titulo, "Título novo");
      assert.equal(depois.data_documento, "2026-09-01");
      assert.deepEqual(depois.pae, { titulo: "PAE novo", linhas: [] });
      assert.equal(depois.riscos.length, 1);
      assert.equal(depois.itens.length, itens.length + 1);
      assert.equal(depois.itens[0].texto, "Pergunta reescrita?");
      const nova = depois.itens.find((i: any) => i.ordem === 900);
      assert.equal(nova.risco_ordem, 1);
      assert.equal(nova.risco_id, depois.riscos[0].id);
      // a publicada continua como estava
      const publicada = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/4`, { como: seguranca });
      assert.equal(publicada.riscos.length, 11);
    });

    it("publicar: 200 com {id, versao, publicado_em}; vira a publicada mais recente e a anterior segue legível", async () => {
      const r = await amb.esperar(200, "POST", "/modelos-apr/APR%2002/versoes/5/publicar", { como: seguranca });
      assert.deepEqual(r, { id: rascunhoId, versao: 5, publicado_em: amb.relogio.agora.toISOString() });

      const publicada = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/publicada`, { como: tecnico });
      assert.equal(publicada.versao, 5);
      assert.equal(publicada.rascunho, false);
      assert.equal(publicada.titulo, "Título novo");
      const anterior = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/4`, { como: tecnico });
      assert.equal(anterior.rascunho, false);
      const lista = await amb.esperar(200, "GET", "/modelos-apr", { como: tecnico, consulta: { codigo: "APR 02" } });
      assert.deepEqual(lista.modelos.map((m: any) => m.versao), [5, 4]);
    });

    it("depois de publicado nada se altera: PUT, DELETE e nova publicação dão 409", async () => {
      const put = await amb.req("PUT", "/modelos-apr/APR%2002/versoes/5", { como: seguranca, json: corpoMinimo() });
      assert.equal(put.status, 409);
      assert.equal(put.corpo.erro.codigo, "modelo_publicado");
      const del = await amb.req("DELETE", "/modelos-apr/APR%2002/versoes/5", { como: seguranca });
      assert.equal(del.status, 409);
      const de_novo = await publicar("APR 02", 5);
      assert.equal(de_novo.status, 409);
      assert.equal(de_novo.corpo.erro.codigo, "ja_publicado");
      assert.equal((await publicar("APR 02", 4)).status, 409);
      const intacto = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/5`, { como: seguranca });
      assert.equal(intacto.titulo, "Título novo");
    });

    it("o banco também recusa mexer no publicado (check_violation), mesmo fora da api", async () => {
      await assert.rejects(() => amb.sql(`update modelo_apr set titulo = 'x' where codigo = 'APR 02' and versao = 5`), /publicado/);
      await assert.rejects(() => amb.sql(`delete from item_modelo_apr where modelo_apr_id = $1`, [rascunhoId]), /publicado/);
      await assert.rejects(() => amb.sql(`delete from risco_modelo_apr where modelo_apr_id = $1`, [rascunhoId]), /publicado/);
    });

    it("nova edição: a versão seguinte sai da publicada mais recente (5), e rascunho descartado libera o número", async () => {
      const criado = await amb.esperar(201, "POST", "/modelos-apr/APR%2002/versoes", { como: seguranca, json: { titulo: "Terceira" } });
      assert.equal(criado.versao, 6);
      const copia = await amb.esperar(200, "GET", `/modelos-apr/APR%2002/versoes/6`, { como: seguranca });
      assert.equal(copia.titulo, "Terceira");
      assert.deepEqual(copia.pae, { titulo: "PAE novo", linhas: [] }, "copiou o PAE da 5, não da 4");
      assert.equal(copia.riscos.length, 1);

      await amb.esperar(200, "DELETE", "/modelos-apr/APR%2002/versoes/6", { como: seguranca });
      assert.equal((await ler("APR 02", 6)).status, 404);
      assert.equal((await amb.sql(`select 1 from risco_modelo_apr where modelo_apr_id = $1`, [criado.id])).length, 0, "riscos e itens foram junto");
      const outra = await amb.esperar(201, "POST", "/modelos-apr/APR%2002/versoes", { como: seguranca, json: {} });
      assert.equal(outra.versao, 6);
      await amb.esperar(200, "DELETE", "/modelos-apr/APR%2002/versoes/6", { como: seguranca });
    });
  });

  describe("copiar da anterior", () => {
    it("campos informados valem; os omitidos vêm da publicada", async () => {
      const novo = await amb.esperar(201, "POST", "/modelos-apr/APR%2007/versoes", {
        como: seguranca,
        json: { riscos: [risco(1, "Só um")], itens: [verificacao(1), medida(2, 1)], data_documento: "2026-10-01" },
      });
      assert.equal(novo.versao, 5);
      const anterior = await amb.esperar(200, "GET", `/modelos-apr/APR%2007/versoes/4`, { como: seguranca });
      const m = await amb.esperar(200, "GET", `/modelos-apr/APR%2007/versoes/5`, { como: seguranca });
      assert.equal(m.titulo, anterior.titulo);
      assert.deepEqual(m.pae, anterior.pae);
      assert.equal(m.data_documento, "2026-10-01");
      assert.equal(m.riscos.length, 1);
      assert.equal(m.itens.length, 2);
      await amb.esperar(200, "DELETE", "/modelos-apr/APR%2007/versoes/5", { como: seguranca });
    });

    it("pae: null limpa o PAE copiado", async () => {
      await amb.esperar(201, "POST", "/modelos-apr/APR%2007/versoes", { como: seguranca, json: { pae: null } });
      assert.equal((await ler("APR 07", 5)).corpo.pae, null);
      await amb.esperar(200, "DELETE", "/modelos-apr/APR%2007/versoes/5", { como: seguranca });
    });

    it("um código que não existe cria a versão 1 e exige titulo, riscos e itens", async () => {
      for (const faltando of ["titulo", "riscos", "itens"]) {
        const corpo: Record<string, unknown> = corpoMinimo();
        delete corpo[faltando];
        const r = await criarVersao("APR 50", corpo);
        assert.equal(r.status, 422, faltando);
        assert.equal(r.corpo.erro.codigo, "conteudo_obrigatorio");
      }
      assert.equal((await ler("APR 50", 1)).status, 404, "nada ficou gravado");
      const criado = await amb.esperar(201, "POST", "/modelos-apr/APR%2050/versoes", { como: seguranca, json: corpoMinimo({ pae: { titulo: "PAE" }, data_documento: "2026-10-10" }) });
      assert.equal(criado.versao, 1);
      const m = await amb.esperar(200, "GET", "/modelos-apr/APR%2050/versoes/1", { como: seguranca });
      assert.equal(m.data_documento, "2026-10-10");
      assert.deepEqual(m.pae, { titulo: "PAE" });
    });
  });

  describe("regras de publicação", () => {
    it("sem item eliminatório: 422 e o modelo continua rascunho", async () => {
      await amb.esperar(201, "POST", "/modelos-apr/APR%2060/versoes", {
        como: seguranca,
        json: corpoMinimo({ itens: [verificacao(1, { tipo: "alerta" }), medida(2, 1)] }),
      });
      const r = await publicar("APR 60", 1);
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.mensagem, MENSAGEM_SEM_ELIMINATORIO);
      assert.equal((await ler("APR 60", 1)).corpo.rascunho, true);
    });

    it("sem nenhum item também é recusado como sem eliminatório", async () => {
      await amb.esperar(201, "POST", "/modelos-apr/APR%2061/versoes", { como: seguranca, json: { titulo: "Vazio", riscos: [], itens: [] } });
      const r = await publicar("APR 61", 1);
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.mensagem, MENSAGEM_SEM_ELIMINATORIO);
    });

    it("item de verificação sem resposta bloqueante: 422, mesmo que outro item seja eliminatório", async () => {
      const { resposta_bloqueante: _r, ...semResposta } = verificacao(2) as Record<string, unknown>;
      await amb.esperar(201, "POST", "/modelos-apr/APR%2062/versoes", { como: seguranca, json: corpoMinimo({ itens: [verificacao(1), semResposta] }) });
      const r = await publicar("APR 62", 1);
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.mensagem, MENSAGEM_SEM_RESPOSTA);

      // resposta_bloqueante: null também vale como ausente
      await amb.esperar(200, "PUT", "/modelos-apr/APR%2062/versoes/1", { como: seguranca, json: corpoMinimo({ itens: [verificacao(1), verificacao(2, { resposta_bloqueante: null })] }) });
      assert.equal((await publicar("APR 62", 1)).corpo.erro.mensagem, MENSAGEM_SEM_RESPOSTA);
    });

    it("medida preventiva pode ficar sem resposta bloqueante; corrigido o rascunho, publica", async () => {
      await amb.esperar(200, "PUT", "/modelos-apr/APR%2062/versoes/1", { como: seguranca, json: corpoMinimo({ itens: [verificacao(1), verificacao(2, { resposta_bloqueante: "sim", tipo: "alerta" }), medida(3, 1)] }) });
      const r = await amb.esperar(200, "POST", "/modelos-apr/APR%2062/versoes/1/publicar", { como: seguranca });
      assert.equal(r.versao, 1);
      assert.ok(r.publicado_em);
    });

    it("com os dois problemas, aponta o primeiro (eliminatório) e a correção de um não basta", async () => {
      const { resposta_bloqueante: _r, ...semResposta } = verificacao(1, { tipo: "alerta" }) as Record<string, unknown>;
      await amb.esperar(201, "POST", "/modelos-apr/APR%2063/versoes", { como: seguranca, json: corpoMinimo({ itens: [semResposta] }) });
      assert.equal((await publicar("APR 63", 1)).corpo.erro.mensagem, MENSAGEM_SEM_ELIMINATORIO);
    });
  });

  describe("validação do conteúdo", () => {
    const recusa = async (json: unknown, codigo: string, onde = "POST") => {
      const r = onde === "POST" ? await criarVersao("APR 70", json) : await amb.req("PUT", "/modelos-apr/APR%2070/versoes/1", { como: seguranca, json });
      assert.equal(r.status, 422, JSON.stringify(r.corpo));
      assert.equal(r.corpo.erro.codigo, codigo, JSON.stringify(r.corpo));
    };

    it("tipo, secao, evidencia e resposta bloqueante só aceitam os valores da especificação", async () => {
      await recusa(corpoMinimo({ itens: [verificacao(1, { tipo: "critico" })] }), "validacao");
      await recusa(corpoMinimo({ itens: [verificacao(1, { secao: "outra" })] }), "validacao");
      await recusa(corpoMinimo({ itens: [verificacao(1, { evidencia: "video" })] }), "validacao");
      await recusa(corpoMinimo({ itens: [verificacao(1, { resposta_bloqueante: "talvez" })] }), "validacao");
      await recusa(corpoMinimo({ itens: [verificacao(1, { texto: "  " })] }), "validacao");
      await recusa(corpoMinimo({ itens: [verificacao(1, { ordem: -1 })] }), "validacao");
      await recusa(corpoMinimo({ data_documento: "2026-13-45" }), "validacao");
      await recusa(corpoMinimo({ data_documento: "24/07/2026" }), "validacao");
      assert.equal((await criarVersao("APR 70", "não é objeto")).status, 422);
      assert.equal((await amb.req("POST", "/modelos-apr/APR%2070/versoes", { como: seguranca, cabecalhos: { "Content-Type": "application/json" } })).status, 400);
    });

    it("ordem é única entre os itens e entre os riscos", async () => {
      await recusa(corpoMinimo({ itens: [verificacao(1), verificacao(1)] }), "ordem_duplicada");
      await recusa(corpoMinimo({ itens: [verificacao(1), medida(1, 1)] }), "ordem_duplicada");
      await recusa(corpoMinimo({ riscos: [risco(1), risco(1, "Outro")] }), "ordem_duplicada");
    });

    it("toda medida preventiva precisa de um risco_ordem que exista; verificação não tem risco", async () => {
      const { risco_ordem: _r, ...medidaSemRisco } = medida(2, 1) as Record<string, unknown>;
      await recusa(corpoMinimo({ itens: [verificacao(1), medidaSemRisco] }), "medida_sem_risco");
      await recusa(corpoMinimo({ itens: [verificacao(1), medida(2, 1, { risco_ordem: null })] }), "medida_sem_risco");
      await recusa(corpoMinimo({ itens: [verificacao(1), medida(2, 9)] }), "risco_inexistente");
      await recusa(corpoMinimo({ itens: [verificacao(1, { risco_ordem: 1 })] }), "risco_em_verificacao");
      assert.equal((await ler("APR 70", 1)).status, 404, "nada ficou gravado");
    });

    it("aplica os padrões: evidencia = foto, permite_na = false, resposta_bloqueante nula", async () => {
      await amb.esperar(201, "POST", "/modelos-apr/APR%2071/versoes", { como: seguranca, json: corpoMinimo({ itens: [verificacao(1), medida(2, 1), verificacao(3, { evidencia: "texto", permite_na: true })] }) });
      const m = await amb.esperar(200, "GET", "/modelos-apr/APR%2071/versoes/1", { como: seguranca });
      assert.equal(m.itens[0].evidencia, "foto");
      assert.equal(m.itens[0].permite_na, false);
      assert.equal(m.itens[1].resposta_bloqueante, null);
      assert.equal(m.itens[1].tipo, "alerta");
      assert.equal(m.itens[2].evidencia, "texto");
      assert.equal(m.itens[2].permite_na, true);
    });

    it("o PUT aplica as mesmas regras e, se falhar, o rascunho fica como estava", async () => {
      await amb.esperar(201, "POST", "/modelos-apr/APR%2070/versoes", { como: seguranca, json: corpoMinimo() });
      await recusa(corpoMinimo({ itens: [verificacao(1), verificacao(1)] }), "ordem_duplicada", "PUT");
      await recusa(corpoMinimo({ itens: [verificacao(1), medida(2, 5)] }), "risco_inexistente", "PUT");
      const m = await amb.esperar(200, "GET", "/modelos-apr/APR%2070/versoes/1", { como: seguranca });
      assert.equal(m.titulo, "Modelo de teste");
      assert.equal(m.itens.length, 2);
      const naoExiste = await amb.req("PUT", "/modelos-apr/APR%2070/versoes/9", { como: seguranca, json: corpoMinimo() });
      assert.equal(naoExiste.status, 404);
    });

    it("riscos e medidas: várias medidas por risco, risco sem medida, classificações diferentes", async () => {
      await amb.esperar(201, "POST", "/modelos-apr/APR%2072/versoes", {
        como: seguranca,
        json: {
          titulo: "Riscos",
          riscos: [risco(1, "Insolação", "Veicular"), risco(2, "Áreas molhadas", "Ambiente de trabalho"), risco(3, "Sem medida", "Ambiente de trabalho")],
          itens: [verificacao(1), medida(2, 1), medida(3, 1), medida(4, 2)],
        },
      });
      const m = await amb.esperar(200, "GET", "/modelos-apr/APR%2072/versoes/1", { como: seguranca });
      assert.deepEqual(m.riscos.map((r: any) => [r.ordem, r.classificacao, r.nome]), [[1, "Veicular", "Insolação"], [2, "Ambiente de trabalho", "Áreas molhadas"], [3, "Ambiente de trabalho", "Sem medida"]]);
      assert.deepEqual(m.itens.map((i: any) => i.risco_ordem), [null, 1, 1, 2]);
      const porId = new Map(m.riscos.map((r: any) => [r.id, r.ordem]));
      assert.deepEqual(m.itens.map((i: any) => (i.risco_id ? porId.get(i.risco_id) : null)), [null, 1, 1, 2]);
      assert.equal((await amb.req("POST", "/modelos-apr/APR%2072/versoes/1/publicar", { como: seguranca })).status, 200);
      // a cópia preserva os vínculos medida → risco
      await amb.esperar(201, "POST", "/modelos-apr/APR%2072/versoes", { como: seguranca, json: {} });
      const copia = await amb.esperar(200, "GET", "/modelos-apr/APR%2072/versoes/2", { como: seguranca });
      assert.deepEqual(copia.itens.map((i: any) => i.risco_ordem), [null, 1, 1, 2]);
    });
  });

  describe("atividades", () => {
    it("lista paginada, ordenada por código, com a carga inicial", async () => {
      const c = await amb.esperar(200, "GET", "/atividades", { como: tecnico, consulta: { tamanho: 10 } });
      assert.equal(c.total, 116);
      assert.equal(c.pagina, 1);
      assert.equal(c.tamanho, 10);
      assert.equal(c.atividades.length, 10);
      const codigos = c.atividades.map((a: any) => a.codigo);
      const esperados = await amb.sql<{ codigo: string }>("select codigo from atividade order by codigo limit 10");
      assert.deepEqual(codigos, esperados.map((e) => e.codigo));
      assert.deepEqual(Object.keys(c.atividades[0]).sort(), ["codigo", "descricao", "modelo_apr_codigo", "provisorio"]);
      const p2 = await amb.esperar(200, "GET", "/atividades", { como: tecnico, consulta: { tamanho: 10, pagina: 2 } });
      assert.ok(p2.atividades[0].codigo !== c.atividades[0].codigo);
    });

    it("?busca= filtra por trecho do código ou da descrição, sem diferenciar maiúsculas", async () => {
      const porCodigo = await amb.esperar(200, "GET", "/atividades", { como: seguranca, consulta: { busca: "8.7.1" } });
      assert.ok(porCodigo.atividades.some((a: any) => a.codigo === "8.7.1"));
      const porTexto = await amb.esperar(200, "GET", "/atividades", { como: seguranca, consulta: { busca: "DRENAGEM caixa" } });
      assert.ok(porTexto.atividades.some((a: any) => a.codigo === "8.7.1"));
      assert.ok(porTexto.atividades.every((a: any) => /drenagem caixa/i.test(a.descricao) || /drenagem caixa/i.test(a.codigo)));
      const curinga = await amb.esperar(200, "GET", "/atividades", { como: seguranca, consulta: { busca: "%" } });
      assert.equal(curinga.total, 0, "% é texto, não curinga");
    });

    it("?sem_modelo=true mostra só as atividades sem modelo", async () => {
      const c = await amb.esperar(200, "GET", "/atividades", { como: seguranca, consulta: { sem_modelo: true } });
      assert.deepEqual(c.atividades.map((a: any) => a.codigo), ["Inspeção operacional em estação de gás natural"]);
      assert.equal(c.total, 1);
      assert.equal((await amb.req("GET", "/atividades", { como: seguranca, consulta: { sem_modelo: "talvez" } })).status, 422);
    });

    it("PUT com o código que tem pontos (8.7.1) troca o modelo e mantém o resto", async () => {
      const r = await amb.esperar(200, "PUT", "/atividades/8.7.1", { como: seguranca, json: { descricao: "Drenagem Caixa de Válvula (revisada)", modelo_apr_codigo: "APR 01" } });
      assert.deepEqual(r, { codigo: "8.7.1", descricao: "Drenagem Caixa de Válvula (revisada)", modelo_apr_codigo: "APR 01", provisorio: true });
      const lista = await amb.esperar(200, "GET", "/atividades", { como: tecnico, consulta: { busca: "8.7.1" } });
      assert.equal(lista.atividades.find((a: any) => a.codigo === "8.7.1").modelo_apr_codigo, "APR 01");
      assert.equal(lista.atividades.filter((a: any) => a.codigo === "8.7.1").length, 1, "não duplicou a linha");
    });

    it("PUT cria a atividade nova (código com barra também) e provisorio = false por padrão", async () => {
      const nova = await amb.esperar(200, "PUT", "/atividades/9.1.1", { como: seguranca, json: { descricao: "Atividade nova", modelo_apr_codigo: "APR 03" } });
      assert.deepEqual(nova, { codigo: "9.1.1", descricao: "Atividade nova", modelo_apr_codigo: "APR 03", provisorio: false });
      const barra = await amb.esperar(200, "PUT", "/atividades/9.2/1", { como: seguranca, json: { descricao: "Com barra", modelo_apr_codigo: null, provisorio: true } });
      assert.equal(barra.codigo, "9.2/1");
      assert.equal(barra.provisorio, true);
      const codificada = await amb.esperar(200, "PUT", `/atividades/${encodeURIComponent("9.3/1")}`, { como: seguranca, json: { descricao: "Barra codificada", modelo_apr_codigo: null } });
      assert.equal(codificada.codigo, "9.3/1");
      const doTexto = await amb.esperar(200, "PUT", `/atividades/${encodeURIComponent("Texto com espaço")}`, { como: seguranca, json: { descricao: "Chave em texto", modelo_apr_codigo: null } });
      assert.equal(doTexto.codigo, "Texto com espaço");
    });

    it("provisorio só muda quando informado", async () => {
      await amb.esperar(200, "PUT", "/atividades/8.7.2", { como: seguranca, json: { descricao: "Já com o código real", modelo_apr_codigo: "APR 03", provisorio: false } });
      await amb.esperar(200, "PUT", "/atividades/8.7.2", { como: seguranca, json: { descricao: "Já com o código real", modelo_apr_codigo: "APR 03" } });
      const [linha] = await amb.sql<{ provisorio: boolean }>(`select provisorio from atividade where codigo = '8.7.2'`);
      assert.equal(linha!.provisorio, false);
    });

    it("modelo_apr_codigo nulo desliga o modelo; a atividade aparece em ?sem_modelo", async () => {
      await amb.esperar(200, "PUT", "/atividades/8.7.3", { como: seguranca, json: { descricao: "Sem modelo agora", modelo_apr_codigo: null } });
      const c = await amb.esperar(200, "GET", "/atividades", { como: seguranca, consulta: { sem_modelo: true } });
      assert.ok(c.atividades.some((a: any) => a.codigo === "8.7.3"));
    });

    it("modelo que não existe ou que só tem rascunho é 422; com uma versão publicada, vale", async () => {
      const inexistente = await amb.req("PUT", "/atividades/8.7.4", { como: seguranca, json: { descricao: "x", modelo_apr_codigo: "APR 99" } });
      assert.equal(inexistente.status, 422);
      assert.equal(inexistente.corpo.erro.codigo, "modelo_sem_versao_publicada");

      await amb.esperar(201, "POST", "/modelos-apr/APR%2080/versoes", { como: seguranca, json: corpoMinimo() });
      const soRascunho = await amb.req("PUT", "/atividades/8.7.4", { como: seguranca, json: { descricao: "x", modelo_apr_codigo: "APR 80" } });
      assert.equal(soRascunho.status, 422);
      assert.equal(soRascunho.corpo.erro.codigo, "modelo_sem_versao_publicada");
      const [antes] = await amb.sql<{ modelo_apr_codigo: string }>(`select modelo_apr_codigo from atividade where codigo = '8.7.4'`);
      assert.equal(antes!.modelo_apr_codigo, "APR 03", "a recusa não alterou a atividade");

      await publicar("APR 80", 1);
      await amb.esperar(200, "PUT", "/atividades/8.7.4", { como: seguranca, json: { descricao: "x", modelo_apr_codigo: "APR 80" } });
    });

    it("valida o corpo: descrição obrigatória e modelo_apr_codigo presente", async () => {
      assert.equal((await amb.req("PUT", "/atividades/8.7.5", { como: seguranca, json: { modelo_apr_codigo: null } })).status, 422);
      assert.equal((await amb.req("PUT", "/atividades/8.7.5", { como: seguranca, json: { descricao: " ", modelo_apr_codigo: null } })).status, 422);
      assert.equal((await amb.req("PUT", "/atividades/8.7.5", { como: seguranca, json: { descricao: "x" } })).status, 422);
    });

    it("a nova versão publicada de um modelo continua valendo para a atividade (a ligação é pelo código)", async () => {
      const antes = await amb.esperar(200, "GET", "/atividades", { como: seguranca, consulta: { busca: "9.1.1" } });
      assert.equal(antes.atividades[0].modelo_apr_codigo, "APR 03");
      await amb.esperar(201, "POST", "/modelos-apr/APR%2003/versoes", { como: seguranca, json: {} });
      await amb.esperar(200, "POST", "/modelos-apr/APR%2003/versoes/5/publicar", { como: seguranca });
      const depois = await amb.esperar(200, "GET", "/atividades", { como: seguranca, consulta: { busca: "9.1.1" } });
      assert.equal(depois.atividades[0].modelo_apr_codigo, "APR 03");
      assert.equal((await ler("APR 03", "publicada")).corpo.versao, 5);
    });
  });
});
