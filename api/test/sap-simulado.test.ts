import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { after, before, describe, it } from "node:test";
import { alerta, apr, equipe, execucao, modeloApr, os } from "../src/db/schema";
import { gerarOrdens, LIMITE_POR_ENVIO, LOCAIS, SERVICOS } from "../src/dominio/sap-simulado";
import { executarLeitura } from "../src/servicos/leitura-sap";
import { ClienteSapHttp } from "../src/servicos/sap-http";
import { configDeTeste, criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** Sorteio reproduzível (mulberry32). */
function sorteioComSemente(semente: number) {
  let a = semente;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ATIVIDADE_CADASTRADA = "Teste, manutenção e válvulas";
const HOJE = new Date("2026-10-12T12:00:00Z");

const novaOrdem = (numero: string, extra: Record<string, unknown> = {}) => ({
  numero_ordem: numero,
  tipo_ordem: "YBA1",
  titulo: `Ordem ${numero}`,
  centro_trabalho: "SERV_ESP",
  local_instalacao: { codigo: "LOCAL/TESTE", endereco: "Rua A, 1", plus_code: "ABCD+12", cliente: "Vale" },
  data_inicio_prog: "2026-10-20",
  data_fim_prog: "2026-10-22",
  status_sap: "LIB IMPR",
  ...extra,
});

describe("Simulador do SAP: gestão das ordens", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;

  const url = "http://api.local/sap-simulado";
  const buscarNaApp: typeof fetch = async (entrada, init) => amb.app.request(new Request(entrada as URL, init));
  const cliente = () => new ClienteSapHttp(url, configDeTeste.sapApiToken, buscarNaApp);
  const ler = () => executarLeitura({ ...amb.deps, sap: cliente() });
  const gestao = (metodo: string, caminho: string, json?: unknown, consulta?: Record<string, string | number>) =>
    amb.req(metodo, `/sap-simulado/gestao${caminho}`, { como: admin, ...(json !== undefined ? { json } : {}), ...(consulta ? { consulta } : {}) });
  const criar = async (numero: string, extra: Record<string, unknown> = {}) => {
    const r = await gestao("POST", "/ordens", novaOrdem(numero, extra));
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    return r.corpo.ordem;
  };
  const lista = async (consulta: Record<string, string | number> = {}) => (await gestao("GET", "/ordens", undefined, { tamanho: 200, ...consulta })).corpo;
  const daLista = async (numero: string) => (await lista({ busca: numero })).ordens.find((o: any) => o.numero_ordem === numero);
  const emMassa = async (json: unknown) => (await gestao("POST", "/ordens/em-massa", json)).corpo;
  const passar = (minutos: number) => (amb.relogio.agora = new Date(amb.relogio.agora.getTime() + minutos * 60_000));

  /** Uma execução em andamento (sem resultado) para a OS. */
  async function abrirExecucao(osId: string, equipeId: string) {
    const t = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const [modelo] = await amb.db.insert(modeloApr).values({ codigo: `APR T${randomUUID().slice(0, 6)}`, versao: 1, titulo: "Modelo de teste" }).returning();
    const aprId = randomUUID();
    await amb.db.insert(apr).values({ id: aprId, osId, modeloAprId: modelo!.id, preenchidaPor: t.id, resultado: "aprovada", concluidaEm: new Date() });
    await amb.db.insert(execucao).values({ id: randomUUID(), osId, aprId, executorId: t.id, numeroPessoas: 1, inicio: new Date() });
    await amb.db.update(os).set({ status: "em_execucao" }).where(eq(os.id, osId));
  }

  let equipeServ: string;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: HOJE, duracaoDoTokenSeg: 7 * 24 * 3600 });
    admin = await amb.criarUsuario({ perfil: "admin" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico" });
    equipeServ = (await amb.criarEquipe({ nome: "Serviços Especiais", centroTrabalho: "SERV_ESP" })).id;
    await amb.criarEquipe({ nome: "Instrumentação", centroTrabalho: "INSTRUM" });
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeServ, supervisor: true });
    await amb.db.update(equipe).set({ supervisorId: supervisor.id }).where(eq(equipe.id, equipeServ));
  });
  after(() => amb.fechar());

  it("a gestão é só do admin logado: 401 sem login, 403 para os outros, e o token do SAP não vale nela", async () => {
    assert.equal((await amb.req("GET", "/sap-simulado/gestao/ordens")).status, 401);
    assert.equal((await amb.req("GET", "/sap-simulado/gestao/ordens", { cabecalhos: { Authorization: `Bearer ${configDeTeste.sapApiToken}` } })).status, 401);
    for (const como of [tecnico, supervisor]) {
      assert.equal((await amb.req("GET", "/sap-simulado/gestao/ordens", { como })).status, 403);
      assert.equal((await amb.req("POST", "/sap-simulado/gestao/ordens", { como, json: novaOrdem("1") })).status, 403);
      assert.equal((await amb.req("GET", "/sap-simulado/gestao/catalogo", { como })).status, 403);
    }
  });

  describe("catálogo", () => {
    it("traz centros (com e sem equipe), locais, atividades do SYNQ OS, serviços, status prontos e o próximo número", async () => {
      const c = (await gestao("GET", "/catalogo")).corpo;
      const serv = c.centros_de_trabalho.find((x: any) => x.centro_trabalho === "SERV_ESP");
      assert.equal(serv.equipe_no_synq_os, "Serviços Especiais");
      assert.equal(c.centros_de_trabalho.find((x: any) => x.centro_trabalho === "MAN_ELE").equipe_no_synq_os, null);
      assert.ok(c.locais.length >= 9);
      assert.ok(c.locais.every((l: any) => l.codigo && "endereco" in l && "plus_code" in l && "cliente" in l));
      assert.deepEqual(c.atividades.find((a: any) => a.codigo === ATIVIDADE_CADASTRADA), { codigo: ATIVIDADE_CADASTRADA, descricao: ATIVIDADE_CADASTRADA });
      assert.ok(c.servicos.length >= 6);
      assert.deepEqual(
        c.status_prontos.map((s: any) => s.codigo),
        ["CRTD", "LIB", "LIB IMPR", "LIB IMPR CAPC", "ENCE"],
      );
      assert.equal(c.proximo_numero, "4031245", "a maior ordem de exemplo (4031244) mais um");
    });
  });

  describe("criação manual", () => {
    it("cria com o local em quatro colunas, a data de criação de agora, e a devolve no contrato (e a próxima sugerida avança)", async () => {
      const o = await criar("4031245", { titulo: "  Com espaços  ", equipamento: "EQ-9", intervalo_ciclo: { quantidade: 3, unidade: "meses" }, plano_manutencao: "10", item_manutencao: "20", tipo_ordem: "yba2" });
      assert.equal(o.titulo, "Com espaços");
      assert.equal(o.tipo_ordem, "YBA2");
      assert.equal(o.criada_em, HOJE.toISOString());
      const noContrato = await cliente().obterOrdem("4031245");
      assert.deepEqual(noContrato?.local_instalacao, { codigo: "LOCAL/TESTE", endereco: "Rua A, 1", plus_code: "ABCD+12", cliente: "Vale" });
      assert.deepEqual(noContrato?.intervalo_ciclo, { quantidade: 3, unidade: "meses" });
      assert.equal((await gestao("GET", "/catalogo")).corpo.proximo_numero, "4031246");
    });

    it("recusa número repetido (409 ordem_duplicada), tipo inválido, centro e título ausentes (422), e data fim antes do início", async () => {
      const dup = await gestao("POST", "/ordens", novaOrdem("4031245"));
      assert.equal(dup.status, 409);
      assert.equal(dup.corpo.erro.codigo, "ordem_duplicada");
      assert.equal((await gestao("POST", "/ordens", novaOrdem("X1", { tipo_ordem: "ZZ" }))).status, 422);
      assert.equal((await gestao("POST", "/ordens", { numero_ordem: "X2", tipo_ordem: "YBA1", data_inicio_prog: "2026-10-20", local_instalacao: { codigo: "L" } })).status, 422);
      assert.equal((await gestao("POST", "/ordens", novaOrdem("X3", { data_fim_prog: "2026-10-01" }))).status, 422);
    });
  });

  describe("gerador", () => {
    const base = { numeroInicial: 5_000_001, atividadesCadastradas: ["1.2", "8.7.1"], hoje: HOJE };

    it("respeita quantidade, tipo, centro e status dos lotes, com números sequenciais e únicos", () => {
      const o = gerarOrdens(
        [
          { quantidade: 10, tipo: "preventiva", centro_trabalho: "SERV_ESP", status: "liberada" },
          { quantidade: 5, tipo: "corretiva", centro_trabalho: "INSTRUM", status: "criada" },
          { quantidade: 20 },
        ],
        { ...base, sorteio: sorteioComSemente(5) },
      );
      assert.equal(o.length, 35);
      assert.ok(o.slice(0, 10).every((x) => x.tipoOrdem === "YBA2" && x.centroTrabalho === "SERV_ESP" && x.statusSap!.split(" ").includes("LIB")));
      assert.ok(o.slice(10, 15).every((x) => x.tipoOrdem === "YBA1" && x.centroTrabalho === "INSTRUM" && x.statusSap === "CRTD"));
      assert.deepEqual(o.map((x) => x.numeroOrdem), Array.from({ length: 35 }, (_, i) => String(5_000_001 + i)));
    });

    it("preventivas levam plano e item (às vezes o intervalo); corretivas, nenhum; serviço e local vêm dos catálogos", () => {
      const o = gerarOrdens([{ quantidade: 60, tipo: "preventiva" }, { quantidade: 60, tipo: "corretiva" }], { ...base, sorteio: sorteioComSemente(9) });
      const preventivas = o.filter((x) => x.tipoOrdem === "YBA2");
      assert.ok(preventivas.every((x) => x.planoManutencao && x.itemManutencao && x.tipoAtividade === "Z02-Manutenção Preventiva"));
      assert.ok(preventivas.some((x) => x.intervaloCiclo != null) && preventivas.some((x) => x.intervaloCiclo == null));
      const corretivas = o.filter((x) => x.tipoOrdem === "YBA1");
      assert.ok(corretivas.every((x) => !x.planoManutencao && !x.itemManutencao && !x.intervaloCiclo && x.tipoAtividade === "Z01-Manutenção Corretiva"));
      assert.ok(o.every((x) => SERVICOS.some((s) => s.titulo === x.titulo) && LOCAIS.some((l) => l.codigo === x.localCodigo && l.endereco === x.localEndereco)));
      assert.ok(o.every((x) => x.criadoPor && x.prioridade));
    });

    it("atividade cadastrada sorteia entre as do SYNQ OS; nova usa códigos inventados", () => {
      const cadastradas = gerarOrdens([{ quantidade: 30, atividade: "cadastrada" }], { ...base, sorteio: sorteioComSemente(1) });
      assert.ok(cadastradas.every((x) => base.atividadesCadastradas.includes(x.codigoAtividade!)));
      const novas = gerarOrdens([{ quantidade: 30, atividade: "nova" }], { ...base, sorteio: sorteioComSemente(1) });
      assert.ok(novas.every((x) => !base.atividadesCadastradas.includes(x.codigoAtividade!) && x.codigoAtividade));
      assert.throws(() => gerarOrdens([{ quantidade: 1, atividade: "cadastrada" }], { ...base, atividadesCadastradas: [] }), /nenhuma atividade cadastrada/);
    });

    it("o início programado sai dos próximos N dias (padrão 14), e o fim não vem antes", () => {
      const hoje = HOJE.toISOString().slice(0, 10);
      const limite = (dias: number) => new Date(HOJE.getTime() + dias * 86_400_000).toISOString().slice(0, 10);
      const padrao = gerarOrdens([{ quantidade: 100 }], { ...base, sorteio: sorteioComSemente(2) });
      assert.ok(padrao.every((x) => x.dataInicioProg >= hoje && x.dataInicioProg <= limite(14) && x.dataFimProg! >= x.dataInicioProg));
      const curto = gerarOrdens([{ quantidade: 50 }], { ...base, dias: 0, sorteio: sorteioComSemente(2) });
      assert.ok(curto.every((x) => x.dataInicioProg === hoje));
      const longo = gerarOrdens([{ quantidade: 200 }], { ...base, dias: 60, sorteio: sorteioComSemente(2) });
      assert.ok(longo.some((x) => x.dataInicioProg > limite(14)));
    });

    it("é reproduzível com o mesmo sorteio e recusa mais de 200 por envio e centro desconhecido", () => {
      assert.deepEqual(gerarOrdens([{ quantidade: 15 }], { ...base, sorteio: sorteioComSemente(3) }), gerarOrdens([{ quantidade: 15 }], { ...base, sorteio: sorteioComSemente(3) }));
      assert.throws(() => gerarOrdens([{ quantidade: 150 }, { quantidade: 51 }], base), /No máximo 200/);
      assert.throws(() => gerarOrdens([{ quantidade: 1, centro_trabalho: "XXX" }], base), /Centro de trabalho desconhecido/);
      assert.equal(LIMITE_POR_ENVIO, 200);
    });

    it("POST /gestao/ordens/aleatorias grava em lotes (com atividade do SYNQ OS) e recusa o que passa do limite", async () => {
      const antes = (await lista()).total;
      const r = await gestao("POST", "/ordens/aleatorias", {
        lotes: [
          { quantidade: 10, tipo: "preventiva", centro_trabalho: "SERV_ESP", status: "liberada", atividade: "cadastrada" },
          { quantidade: 5, tipo: "corretiva", centro_trabalho: "INSTRUM", status: "criada", atividade: "nova" },
        ],
        dias: 7,
      });
      assert.equal(r.status, 201);
      assert.equal(r.corpo.criadas, 15);
      const depois = await lista({ tipo: "YBA2", centro_trabalho: "SERV_ESP" });
      assert.ok(depois.ordens.length >= 10);
      assert.equal((await lista()).total, antes + 15);
      assert.ok(depois.ordens.filter((o: any) => o.codigo_atividade).length >= 10);

      const demais = await gestao("POST", "/ordens/aleatorias", { lotes: [{ quantidade: 150 }, { quantidade: 60 }] });
      assert.equal(demais.status, 422);
      assert.equal(demais.corpo.erro.codigo, "limite_excedido");
      assert.equal((await gestao("POST", "/ordens/aleatorias", { lotes: [{ quantidade: 201 }] })).status, 422);
      assert.equal((await gestao("POST", "/ordens/aleatorias", { lotes: [{ quantidade: 1, centro_trabalho: "XXX" }] })).status, 422);
      assert.equal((await lista()).total, antes + 15, "as recusas não criam nada");
    });
  });

  describe("lista, busca e filtros", () => {
    it("busca por número, título, equipamento ou local (sem acento), filtra por tipo e centro, e pagina", async () => {
      await criar("L1", { titulo: "Inspeção de válvula", equipamento: "VLV-ZZ-77", local_instalacao: { codigo: "ARACRUZ/ERS ARACRUZ" } });
      assert.deepEqual((await lista({ busca: "inspecao de valvula" })).ordens.map((o: any) => o.numero_ordem), ["L1"]);
      assert.deepEqual((await lista({ busca: "vlv-zz-77" })).ordens.map((o: any) => o.numero_ordem), ["L1"]);
      assert.ok((await lista({ busca: "aracruz" })).ordens.some((o: any) => o.numero_ordem === "L1"));
      assert.ok((await lista({ tipo: "YBA2" })).ordens.every((o: any) => o.tipo_ordem === "YBA2"));
      assert.ok((await lista({ centro_trabalho: "INSTRUM" })).ordens.every((o: any) => o.centro_trabalho === "INSTRUM"));
      const pagina = (await gestao("GET", "/ordens", undefined, { tamanho: 3, pagina: 2 })).corpo;
      assert.equal(pagina.ordens.length, 3);
      assert.equal(pagina.pagina, 2);
      assert.ok(pagina.total > 6);
      assert.equal((await gestao("GET", "/ordens", undefined, { tipo: "XX" })).status, 422);
    });
  });

  describe("edição", () => {
    it("muda os campos, menos o número (422), e a ordem passa a contar como alterada", async () => {
      await criar("E1");
      passar(10);
      const r = await gestao("PATCH", "/ordens/E1", { titulo: "Novo título", prioridade: "Baixo", local_instalacao: { codigo: "OUTRO/LOCAL", cliente: null }, intervalo_ciclo: "trimestral", equipamento: "" });
      assert.equal(r.status, 200);
      assert.equal(r.corpo.ordem.titulo, "Novo título");
      assert.equal(r.corpo.ordem.local_instalacao.codigo, "OUTRO/LOCAL");
      assert.equal(r.corpo.ordem.equipamento, null, "texto vazio vira nulo");
      assert.equal((await cliente().obterOrdem("E1"))?.intervalo_ciclo, "trimestral");
      assert.equal((await gestao("PATCH", "/ordens/E1", { numero_ordem: "E2" })).status, 422);
      assert.equal((await gestao("PATCH", "/ordens/NAO", { titulo: "x" })).status, 404);
      assert.equal((await gestao("PATCH", "/ordens/E1", { data_fim_prog: "2026-01-01" })).corpo.erro.codigo, "datas_invalidas");
      assert.equal((await gestao("PATCH", "/ordens/E1", { tipo_ordem: "ZZ" })).status, 422);
      const desde = new Date(amb.relogio.agora.getTime() - 60_000);
      assert.ok((await cliente().listarOrdens({ alteradasDesde: desde, pagina: 1, tamanho: 200 })).ordens.some((o) => o.numero_ordem === "E1"));
    });
  });

  describe("a coluna \"No SYNQ OS\"", () => {
    it("ordem nova é 'Ainda não lida'; depois da leitura, ganha o status da OS; a ignorada mostra o motivo", async () => {
      await criar("N1", { status_sap: "LIB IMPR" });
      await criar("N2", { status_sap: "CRTD" }); // sem LIB: a leitura ignora
      await criar("N3", { centro_trabalho: "SEM_EQUIPE" }); // sem equipe: ignorada com o motivo
      assert.deepEqual((await daLista("N1")).no_synq_os, { situacao: "nao_lida" });

      const r = await ler();
      assert.equal(r.erro, null);
      assert.deepEqual((await daLista("N1")).no_synq_os, { situacao: "liberada" });
      assert.deepEqual((await daLista("N2")).no_synq_os, { situacao: "ignorada", motivo: "Status SAP diferente de liberada" });
      assert.deepEqual((await daLista("N3")).no_synq_os, { situacao: "ignorada", motivo: "Centro de trabalho sem equipe cadastrada" });
    });

    it("mostra cada status da OS: pendente, em execução, encerrada e cancelada", async () => {
      for (const n of ["S1", "S2", "S3", "S4"]) await criar(n);
      passar(1);
      await ler();
      for (const [n, status] of [["S1", "pendente"], ["S2", "em_execucao"], ["S3", "encerrada"], ["S4", "cancelada"]] as const) {
        await amb.db.update(os).set({ status }).where(eq(os.numeroOrdem, n));
        assert.equal((await daLista(n)).no_synq_os.situacao, status);
      }
      const contagem = (await lista()).contagem;
      assert.ok(contagem.pendente >= 1 && contagem.em_execucao >= 1 && contagem.encerrada >= 1 && contagem.cancelada >= 1 && contagem.ignorada >= 2);
      assert.equal((await lista({ no_synq_os: "em_execucao" })).ordens.map((o: any) => o.numero_ordem).includes("S2"), true);
      assert.ok((await lista({ no_synq_os: "ignorada" })).ordens.every((o: any) => o.no_synq_os.situacao === "ignorada"));
      assert.equal((await lista({ no_synq_os: "ignorada", tamanho: 1 })).total, (await lista()).contagem.ignorada);
    });

    it("o selo 'alterada depois da última leitura' mostra o que o SYNQ OS vai pegar na próxima leitura", async () => {
      await criar("A1");
      passar(1);
      await ler();
      assert.equal((await daLista("A1")).alterada_depois_da_leitura, false);
      passar(5);
      await gestao("PATCH", "/ordens/A1", { prioridade: "Muito alto" });
      assert.equal((await daLista("A1")).alterada_depois_da_leitura, true);
      assert.equal((await daLista("N1")).alterada_depois_da_leitura, false, "as outras não mudaram");
      passar(1);
      await ler();
      assert.equal((await daLista("A1")).alterada_depois_da_leitura, false);
    });

    it("sem nenhuma leitura sem erro, toda ordem conta como alterada", async () => {
      const amb2 = await criarAmbiente({ comCarga: true, relogio: HOJE, duracaoDoTokenSeg: 3600 });
      try {
        const adm = await amb2.criarUsuario({ perfil: "admin" });
        const l = (await amb2.esperar(200, "GET", "/sap-simulado/gestao/ordens", { como: adm })).ordens;
        assert.equal(l.length, 11);
        assert.ok(l.every((o: any) => o.alterada_depois_da_leitura === true && o.no_synq_os.situacao === "nao_lida"));
      } finally {
        await amb2.fechar();
      }
    });
  });

  describe("exclusão", () => {
    it("exclui a ordem que o SYNQ OS nunca leu ou que ele ignorou; a que ele já tem não (409 ordem_no_synq_os)", async () => {
      await criar("D1");
      await amb.relogio.agora; // a ordem ainda não foi lida
      assert.equal((await gestao("DELETE", "/ordens/D1")).status, 200);
      assert.equal(await cliente().obterOrdem("D1"), null);
      assert.equal((await gestao("DELETE", "/ordens/D1")).status, 404);

      // ignorada: pode
      assert.equal((await daLista("N2")).no_synq_os.situacao, "ignorada");
      assert.equal((await gestao("DELETE", "/ordens/N2")).status, 200);

      // lida: não pode
      const r = await gestao("DELETE", "/ordens/N1");
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "ordem_no_synq_os");
      assert.match(r.corpo.erro.mensagem, /uma ordem não é apagada: encerre-a/);
      assert.ok(await cliente().obterOrdem("N1"));
    });
  });

  describe("ações em massa", () => {
    it("mudar_status: aplica o status a todas e elas contam como alteradas", async () => {
      await criar("M1", { status_sap: "CRTD" });
      await criar("M2", { status_sap: "CRTD" });
      passar(1);
      const r = await emMassa({ numeros: ["M1", "M2", "M_NAO"], acao: "mudar_status", valor: "LIB IMPR" });
      assert.equal(r.afetadas, 2);
      assert.deepEqual(r.recusadas, [{ numero_ordem: "M_NAO", motivo: "Ordem não encontrada" }]);
      assert.equal((await cliente().obterOrdem("M1"))?.status_sap, "LIB IMPR");
      assert.equal((await gestao("POST", "/ordens/em-massa", { numeros: ["M1"], acao: "mudar_status" })).status, 422, "o status é obrigatório");
    });

    it("mudar_centro: muda o centro de trabalho de todas", async () => {
      const r = await emMassa({ numeros: ["M1", "M2"], acao: "mudar_centro", valor: "INSTRUM" });
      assert.equal(r.afetadas, 2);
      assert.equal((await cliente().obterOrdem("M2"))?.centro_trabalho, "INSTRUM");
      assert.equal((await gestao("POST", "/ordens/em-massa", { numeros: ["M1"], acao: "mudar_centro" })).status, 422);
    });

    it("reprogramar: desloca as datas em N dias (também para trás) ou define o início numa data nova, mantendo a duração", async () => {
      await criar("R1", { data_inicio_prog: "2026-10-20", data_fim_prog: "2026-10-22" });
      await criar("R2", { data_inicio_prog: "2026-10-25", data_fim_prog: null });
      await emMassa({ numeros: ["R1", "R2"], acao: "reprogramar", dias: 3 });
      let o1 = await cliente().obterOrdem("R1");
      assert.deepEqual([o1?.data_inicio_prog, o1?.data_fim_prog], ["2026-10-23", "2026-10-25"]);
      assert.deepEqual([(await cliente().obterOrdem("R2"))?.data_inicio_prog, (await cliente().obterOrdem("R2"))?.data_fim_prog], ["2026-10-28", null]);
      await emMassa({ numeros: ["R1"], acao: "reprogramar", dias: -10 });
      assert.equal((await cliente().obterOrdem("R1"))?.data_inicio_prog, "2026-10-13");
      await emMassa({ numeros: ["R1"], acao: "reprogramar", data: "2026-11-01" });
      o1 = await cliente().obterOrdem("R1");
      assert.deepEqual([o1?.data_inicio_prog, o1?.data_fim_prog], ["2026-11-01", "2026-11-03"]);
      assert.equal((await gestao("POST", "/ordens/em-massa", { numeros: ["R1"], acao: "reprogramar" })).status, 422);
      assert.equal((await gestao("POST", "/ordens/em-massa", { numeros: ["R1"], acao: "reprogramar", dias: 1, data: "2026-11-01" })).status, 422);
    });

    it("excluir: exclui as que o SYNQ OS não tem e devolve as recusadas (as que ele tem)", async () => {
      await criar("X1");
      await criar("X2");
      passar(1);
      await ler(); // X1 e X2 entram no SYNQ OS
      await criar("X3");
      const r = await emMassa({ numeros: ["X1", "X2", "X3"], acao: "excluir" });
      assert.equal(r.afetadas, 1);
      assert.deepEqual(r.recusadas.map((x: any) => x.numero_ordem).sort(), ["X1", "X2"]);
      assert.match(r.recusadas[0].motivo, /já está no SYNQ OS/);
      assert.equal(await cliente().obterOrdem("X3"), null);
      assert.ok(await cliente().obterOrdem("X1"));
    });

    it("todos_da_busca age sobre tudo o que a busca e os filtros acham (inclusive o filtro No SYNQ OS); sem números nem a marca é 422", async () => {
      for (let i = 1; i <= 4; i++) await criar(`T${i}`, { titulo: `Torneira lote ${i}` });
      const r = await emMassa({ todos_da_busca: true, busca: "torneira lote", acao: "mudar_status", valor: "CRTD" });
      assert.equal(r.afetadas, 4);
      assert.ok((await lista({ busca: "torneira lote" })).ordens.every((o: any) => o.status_sap === "CRTD"));
      const exc = await emMassa({ todos_da_busca: true, busca: "torneira lote", no_synq_os: "nao_lida", acao: "excluir" });
      assert.equal(exc.afetadas, 4);
      assert.equal((await lista({ busca: "torneira lote" })).total, 0);
      assert.equal((await gestao("POST", "/ordens/em-massa", { acao: "excluir" })).status, 422);
      assert.equal((await gestao("POST", "/ordens/em-massa", { numeros: ["R1"], todos_da_busca: true, acao: "excluir" })).status, 422);
      assert.equal((await gestao("POST", "/ordens/em-massa", { numeros: ["R1"], acao: "inventada" })).status, 422);
    });
  });

  describe("de ponta a ponta com o SYNQ OS", () => {
    it("1. criar ordens aleatórias, ler e ver as OS criadas", async () => {
      const antes = (await amb.db.select().from(os)).length;
      const r = await gestao("POST", "/ordens/aleatorias", { lotes: [{ quantidade: 6, tipo: "corretiva", centro_trabalho: "SERV_ESP", status: "liberada" }, { quantidade: 3, centro_trabalho: "SERV_ESP", status: "criada" }] });
      assert.equal(r.corpo.criadas, 9);
      passar(1);
      const leitura = await ler();
      assert.equal(leitura.erro, null);
      assert.ok(leitura.criadas >= 6);
      assert.equal((await amb.db.select().from(os)).length, antes + leitura.criadas);
      const ignoradasMotivo = leitura.ignoradas.filter((i) => i.motivo === "Status SAP diferente de liberada");
      assert.ok(ignoradasMotivo.length >= 3, "as três 'criadas' foram ignoradas");
    });

    it("2. tirar o LIB de uma ordem, ler e ver a OS cancelada", async () => {
      await criar("P1", { status_sap: "LIB IMPR" });
      passar(1);
      await ler();
      assert.equal((await amb.db.select().from(os).where(eq(os.numeroOrdem, "P1")))[0]!.status, "liberada");
      passar(1);
      await gestao("PATCH", "/ordens/P1", { status_sap: "ENCE" });
      assert.equal((await daLista("P1")).alterada_depois_da_leitura, true);
      passar(1);
      await ler();
      assert.equal((await amb.db.select().from(os).where(eq(os.numeroOrdem, "P1")))[0]!.status, "cancelada");
      assert.equal((await daLista("P1")).no_synq_os.situacao, "cancelada");
    });

    it("3. o mesmo com uma OS em execução: a execução segue e sai o alerta de conflito", async () => {
      await criar("P2", { status_sap: "LIB IMPR" });
      passar(1);
      await ler();
      const criada = (await amb.db.select().from(os).where(eq(os.numeroOrdem, "P2")))[0]!;
      await abrirExecucao(criada.id, equipeServ);
      passar(1);
      await gestao("PATCH", "/ordens/P2", { status_sap: "ENCE" });
      passar(1);
      await ler();
      const depois = (await amb.db.select().from(os).where(eq(os.numeroOrdem, "P2")))[0]!;
      assert.equal(depois.status, "em_execucao");
      const alertas = await amb.db.select().from(alerta).where(eq(alerta.osId, criada.id));
      assert.deepEqual(alertas.map((a) => a.tipo), ["conflito_planejamento"]);
      assert.equal((await daLista("P2")).no_synq_os.situacao, "em_execucao");
    });

    it("4. reprogramada no SYNQ OS com outra data no SAP: a ordem é ignorada, e a coluna diz o motivo", async () => {
      await criar("P3", { status_sap: "LIB IMPR", data_inicio_prog: "2026-10-20", data_fim_prog: "2026-10-21" });
      passar(1);
      await ler();
      const criada = (await amb.db.select().from(os).where(eq(os.numeroOrdem, "P3")))[0]!;
      // O SYNQ OS reprogramou (a reprogramação vence); o SAP muda a data para outra.
      await amb.db.update(os).set({ dataInicioProg: "2026-10-30", dataFimProg: "2026-10-31" }).where(eq(os.id, criada.id));
      const { reprogramacao } = await import("../src/db/schema");
      await amb.db.insert(reprogramacao).values({ osId: criada.id, dataAnterior: "2026-10-20", dataNova: "2026-10-30", justificativa: "Chuva", usuarioId: admin.id });
      passar(1);
      await emMassa({ numeros: ["P3"], acao: "reprogramar", dias: 5 });
      passar(1);
      const l = await ler();
      assert.ok(l.ignoradas.some((i) => i.numero_ordem === "P3"), JSON.stringify(l.ignoradas));
    });
  });
});
