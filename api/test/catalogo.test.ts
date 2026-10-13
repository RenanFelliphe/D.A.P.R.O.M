import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { atividade, atividadeMaterial, auditoria, localInstalacao, os } from "../src/db/schema";
import { popularCatalogoDemo } from "../src/db/seed/catalogo-demo";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** Catálogo de serviço: materiais (`/catalogo/materiais`) e a lista de cada serviço (`/catalogo/servicos`). */
describe("Catálogo de serviço", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let equipeId: string;
  let localId: string;
  const servico = "8.7.1";
  const caminho = (codigo: string) => `/catalogo/servicos/${encodeURIComponent(codigo)}`;

  before(async () => {
    amb = await criarAmbiente();
    admin = await amb.criarUsuario({ perfil: "admin" });
    equipeId = (await amb.criarEquipe()).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    await amb.db.insert(atividade).values([
      { codigo: servico, descricao: "Inspeção de estação redutora" },
      { codigo: "8.7.2/8.7.3", descricao: "Teste de válvulas" },
      { codigo: "Lavagem de Estação", descricao: "Lavagem de Estação" },
    ]);
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "CARIACICA/ERP" }).returning({ id: localInstalacao.id })) as [{ id: string }];
  });
  after(() => amb.fechar());

  const criarMaterial = (dados: object) => amb.esperar(201, "POST", "/catalogo/materiais", { como: admin, json: dados });

  describe("materiais", () => {
    it("o admin cadastra; o técnico só lê", async () => {
      const m = await criarMaterial({ codigo: "10002345", descricao: "Óculos de segurança", unidade: "un", categoria: "epi" });
      assert.equal(m.categoria, "epi");
      assert.equal(m.ativo, true);
      assert.equal((await amb.req("POST", "/catalogo/materiais", { como: tecnico, json: { descricao: "X", unidade: "un" } })).status, 403);
      const lista = await amb.esperar(200, "GET", "/catalogo/materiais", { como: tecnico, consulta: { busca: "oculos" } });
      assert.deepEqual(lista.materiais.map((x: { descricao: string }) => x.descricao), ["Óculos de segurança"]);
      assert.equal(lista.materiais[0].servicos_total, 0);
    });

    it("recusa o mesmo código do SAP e a mesma descrição na mesma unidade", async () => {
      await criarMaterial({ codigo: "10009999", descricao: "Fita veda-rosca", unidade: "un" });
      const mesmoCodigo = await amb.req("POST", "/catalogo/materiais", { como: admin, json: { codigo: "10009999", descricao: "Outra coisa", unidade: "m" } });
      assert.equal(mesmoCodigo.status, 409);
      assert.equal(mesmoCodigo.corpo.erro.codigo, "material_duplicado");
      const mesmaDescricao = await amb.req("POST", "/catalogo/materiais", { como: admin, json: { descricao: "  fita VEDA-ROSCA ", unidade: "UN" } });
      assert.equal(mesmaDescricao.status, 409);
      // Outra unidade é outro material.
      await criarMaterial({ descricao: "Fita veda-rosca", unidade: "rolo" });
    });

    it("valida os campos e filtra por categoria e situação", async () => {
      const r = await amb.req("POST", "/catalogo/materiais", { como: admin, json: { descricao: " ", unidade: "un" } });
      assert.equal(r.status, 422);
      assert.equal((await amb.req("POST", "/catalogo/materiais", { como: admin, json: { descricao: "Luva", unidade: "par", categoria: "consumivel" } })).status, 422);
      await criarMaterial({ descricao: "Torquímetro", unidade: "un", categoria: "ferramenta" });
      const ferramentas = await amb.esperar(200, "GET", "/catalogo/materiais", { como: admin, consulta: { categoria: "ferramenta" } });
      assert.ok(ferramentas.materiais.every((x: { categoria: string }) => x.categoria === "ferramenta"));
      assert.ok(ferramentas.total >= 1);
    });
  });

  describe("serviços", () => {
    let luva: { id: string };
    let detector: { id: string };
    let tinta: { id: string };

    before(async () => {
      luva = await criarMaterial({ descricao: "Luva de vaqueta", unidade: "par", categoria: "epi" });
      detector = await criarMaterial({ codigo: "20001111", descricao: "Detector de gases", unidade: "un", categoria: "ferramenta" });
      tinta = await criarMaterial({ descricao: "Tinta epóxi", unidade: "L" });
    });

    it("o admin define a lista do serviço, na ordem enviada; todos leem", async () => {
      const salvo = await amb.esperar(200, "PUT", caminho(servico), {
        como: admin,
        json: { materiais: [{ material_id: detector.id, quantidade: 1, observacao: "Conferir a calibração" }, { material_id: luva.id, quantidade: 2 }, { material_id: tinta.id }] },
      });
      assert.deepEqual(
        salvo.materiais.map((m: { descricao: string; quantidade: number | null; ordem: number }) => [m.descricao, m.quantidade, m.ordem]),
        [
          ["Detector de gases", 1, 1],
          ["Luva de vaqueta", 2, 2],
          ["Tinta epóxi", null, 3],
        ],
      );
      const lido = await amb.esperar(200, "GET", caminho(servico), { como: tecnico });
      assert.equal(lido.materiais[0].observacao, "Conferir a calibração");
      assert.equal(lido.materiais[0].codigo, "20001111");
      assert.equal((await amb.req("PUT", caminho(servico), { como: tecnico, json: { materiais: [] } })).status, 403);
    });

    it("aceita código de serviço com barra", async () => {
      await amb.esperar(200, "PUT", caminho("8.7.2/8.7.3"), { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 1 }] } });
      const lido = await amb.esperar(200, "GET", caminho("8.7.2/8.7.3"), { como: tecnico });
      assert.equal(lido.materiais.length, 1);
    });

    it("recusa material repetido, inexistente, quantidade inválida e serviço que não existe", async () => {
      const repetido = await amb.req("PUT", caminho(servico), { como: admin, json: { materiais: [{ material_id: luva.id }, { material_id: luva.id }] } });
      assert.equal(repetido.corpo.erro.codigo, "material_repetido");
      const inexistente = await amb.req("PUT", caminho(servico), { como: admin, json: { materiais: [{ material_id: "00000000-0000-4000-8000-000000000000" }] } });
      assert.equal(inexistente.corpo.erro.codigo, "material_inexistente");
      assert.equal((await amb.req("PUT", caminho(servico), { como: admin, json: { materiais: [{ material_id: luva.id, quantidade: 0 }] } })).status, 422);
      assert.equal((await amb.req("PUT", caminho("9.9.9"), { como: admin, json: { materiais: [] } })).status, 404);
      // Nada mudou com as recusas.
      assert.equal((await amb.esperar(200, "GET", caminho(servico), { como: admin })).materiais.length, 3);
    });

    it("material desativado fica onde já está, mas não entra em outro serviço", async () => {
      await amb.esperar(200, "PUT", `/catalogo/materiais/${tinta.id}`, { como: admin, json: { descricao: "Tinta epóxi", unidade: "L", categoria: "material", ativo: false } });
      // Continua no 8.7.1 ao salvar de novo a lista.
      await amb.esperar(200, "PUT", caminho(servico), { como: admin, json: { materiais: [{ material_id: detector.id, quantidade: 1 }, { material_id: tinta.id, quantidade: 3.6 }] } });
      const r = await amb.req("PUT", caminho("Lavagem de Estação"), { como: admin, json: { materiais: [{ material_id: tinta.id }] } });
      assert.equal(r.corpo.erro.codigo, "material_inativo");
      const auditados = await amb.db.select().from(auditoria).where(eq(auditoria.entidadeId, tinta.id));
      assert.ok(auditados.some((a) => a.acao === "material.desativar"));
    });

    it("material em uso não é excluído; fora de uso, é", async () => {
      const r = await amb.req("DELETE", `/catalogo/materiais/${detector.id}`, { como: admin });
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "material_em_uso");
      const avulso = await criarMaterial({ descricao: "Estopa", unidade: "kg" });
      await amb.esperar(200, "DELETE", `/catalogo/materiais/${avulso.id}`, { como: admin });
      assert.equal((await amb.req("DELETE", `/catalogo/materiais/${avulso.id}`, { como: admin })).status, 404);
    });

    it("filtra os serviços sem materiais e os que usam um material", async () => {
      const sem = await amb.esperar(200, "GET", "/catalogo/servicos", { como: tecnico, consulta: { sem_materiais: true } });
      assert.deepEqual(sem.servicos.map((s: { codigo: string }) => s.codigo), ["Lavagem de Estação"]);
      const comDetector = await amb.esperar(200, "GET", "/catalogo/servicos", { como: tecnico, consulta: { material_id: detector.id } });
      assert.deepEqual(comDetector.servicos.map((s: { codigo: string }) => s.codigo), [servico]);
      const busca = await amb.esperar(200, "GET", "/catalogo/servicos", { como: tecnico, consulta: { busca: "inspecao" } });
      assert.equal(busca.servicos[0].codigo, servico);
      assert.equal(busca.servicos[0].materiais.length, 2);
    });

    it("a troca da lista entra na auditoria com o antes e o depois", async () => {
      const registros = await amb.db.select().from(auditoria).where(eq(auditoria.entidadeId, servico));
      const listas = registros.filter((r) => r.acao === "atividade.materiais").map((r) => (r.detalhes as { materiais: { para: string[] } }).materiais.para);
      assert.ok(listas.some((para) => JSON.stringify(para) === JSON.stringify(["Detector de gases (1 un)", "Tinta epóxi (3.6 L)"])), JSON.stringify(listas));
    });

    it("o detalhe da OS traz o serviço com os materiais; a OS sem atividade traz nulo", async () => {
      const [comServico] = await amb.db
        .insert(os)
        .values({ numeroOrdem: "7200001", tipo: "preventiva", titulo: "Inspeção da ERP", codigoAtividade: servico, localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-12", origem: "sap" })
        .returning();
      const [semServico] = await amb.db
        .insert(os)
        .values({ numeroOrdem: "7200002", tipo: "corretiva", titulo: "Reparo", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-12", origem: "sap" })
        .returning();
      const detalhe = await amb.esperar(200, "GET", `/os/${comServico!.id}`, { como: tecnico });
      assert.equal(detalhe.servico.codigo, servico);
      assert.deepEqual(detalhe.servico.materiais.map((m: { descricao: string }) => m.descricao), ["Detector de gases", "Tinta epóxi"]);
      assert.equal((await amb.esperar(200, "GET", `/os/${semServico!.id}`, { como: tecnico })).servico, null);
    });

    it("o snapshot do modo offline leva os materiais de cada atividade", async () => {
      const snapshot = await amb.esperar(200, "POST", "/sync/pull", { como: tecnico, json: {} });
      const a = snapshot.atividades.find((x: { codigo: string }) => x.codigo === servico);
      assert.equal(a.materiais.length, 2);
    });

    it("excluir a atividade apaga a lista dela, não os materiais", async () => {
      await amb.db.insert(atividade).values({ codigo: "temporaria", descricao: "Serviço temporário" });
      await amb.esperar(200, "PUT", caminho("temporaria"), { como: admin, json: { materiais: [{ material_id: luva.id }] } });
      await amb.esperar(200, "DELETE", `/atividades/temporaria`, { como: admin });
      assert.equal((await amb.db.select().from(atividadeMaterial).where(eq(atividadeMaterial.atividadeCodigo, "temporaria"))).length, 0);
      assert.equal((await amb.esperar(200, "GET", "/catalogo/materiais", { como: admin, consulta: { busca: "vaqueta" } })).total, 1);
    });
  });

  it("a carga fictícia cria os materiais e as listas uma vez só, sem mexer no que existe", async () => {
    const ambDemo = await criarAmbiente({ comCarga: true });
    try {
      const primeira = await popularCatalogoDemo(ambDemo.db);
      assert.ok(primeira >= 3);
      assert.equal(await popularCatalogoDemo(ambDemo.db), 0);
      const lavagem = (await ambDemo.db.select().from(atividadeMaterial).where(eq(atividadeMaterial.atividadeCodigo, "Lavagem de Estação"))).length;
      assert.ok(lavagem > 0);
    } finally {
      await ambDemo.fechar();
    }
  });
});
