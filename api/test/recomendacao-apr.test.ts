import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { atividade, localInstalacao, os } from "../src/db/schema";
import { recomendarModelo } from "../src/dominio/recomendacao-apr";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

const orientacoes = [
  { codigo: "APR 02", palavrasChave: ["calibr", "manômetro", "PSV"] },
  { codigo: "APR 03", palavrasChave: ["roçagem", "caixa de válvula", "marimbondo", "pintura"] },
  { codigo: "APR 06", palavrasChave: ["altura", "PTA", "espaço confinado"] },
];

describe("recomendação do modelo de APR (leitura da OS)", () => {
  describe("recomendarModelo", () => {
    it("acha as palavras-chave sem acento nem maiúsculas e devolve como a OS escreveu", () => {
      const r = recomendarModelo({ titulo: "ROÇAGEM da faixa do gasoduto" }, orientacoes);
      assert.equal(r.codigo, "APR 03");
      assert.deepEqual(r.encontradas.get("APR 03"), ["ROÇAGEM"]);
      assert.equal(r.encontradas.has("APR 02"), false, "modelo que nada achou não entra");
    });

    it("com 4 letras ou mais vale o começo da palavra; as curtas, só a palavra inteira", () => {
      assert.equal(recomendarModelo({ titulo: "Calibração de manômetros" }, orientacoes).codigo, "APR 02");
      assert.deepEqual(recomendarModelo({ titulo: "Calibrar a PSV" }, orientacoes).encontradas.get("APR 02"), ["Calibrar", "PSV"]);
      assert.equal(recomendarModelo({ titulo: "Uso de PTAs e PSVs" }, orientacoes).codigo, null, "PTA e PSV não acham PTAs nem PSVs");
    });

    it("a chave de várias palavras precisa aparecer em sequência", () => {
      assert.equal(recomendarModelo({ titulo: "Drenagem da caixa de válvula CV-118" }, orientacoes).codigo, "APR 03");
      assert.equal(recomendarModelo({ titulo: "Caixa nova e válvula trocada" }, orientacoes).codigo, null);
      assert.deepEqual(recomendarModelo({ titulo: "Entrada em espaço-confinado" }, orientacoes).encontradas.get("APR 06"), ["espaço-confinado"]);
    });

    it("o título pesa mais que o serviço, e o serviço mais que a descrição; cada palavra conta uma vez", () => {
      // Título (3) contra descrição (1 + 1): vence o título.
      const r = recomendarModelo({ titulo: "Pintura de suportes", descricao: "Calibrar o manômetro antes" }, orientacoes);
      assert.equal(r.codigo, "APR 03");
      assert.deepEqual(r.encontradas.get("APR 02"), ["Calibrar", "manômetro"]);
      // Serviço (2) contra descrição (1).
      assert.equal(recomendarModelo({ titulo: "OS 4031", servico: "Roçagem semestral", descricao: "Usar a PTA" }, orientacoes).codigo, "APR 03");
      // A mesma palavra no título e na descrição vale só pelo título.
      assert.equal(recomendarModelo({ titulo: "Pintura", descricao: "pintura pintura pintura" }, orientacoes).encontradas.get("APR 03")!.length, 1);
    });

    it("empate no topo não recomenda nenhum, mas mostra o que cada modelo achou", () => {
      const r = recomendarModelo({ titulo: "Remoção de marimbondo em altura" }, orientacoes);
      assert.equal(r.codigo, null);
      assert.deepEqual(r.encontradas.get("APR 03"), ["marimbondo"]);
      assert.deepEqual(r.encontradas.get("APR 06"), ["altura"]);
    });

    it("nada achado, OS sem texto ou orientação sem palavras: nenhuma recomendação", () => {
      assert.equal(recomendarModelo({ titulo: "Serviço diverso" }, orientacoes).codigo, null);
      assert.equal(recomendarModelo({ titulo: "", descricao: null, servico: null }, orientacoes).codigo, null);
      assert.equal(recomendarModelo({ titulo: "Roçagem" }, [{ codigo: "APR 03", palavrasChave: [] }]).codigo, null);
    });
  });

  describe("GET /os/{id}/modelos-apr", () => {
    let amb: Ambiente;
    let tecnico: UsuarioDeTeste;
    let deOutraEquipe: UsuarioDeTeste;
    let equipeId: string;
    let localId: string;
    let numero = 4_500_000;

    before(async () => {
      amb = await criarAmbiente({ comCarga: true });
      equipeId = (await amb.criarEquipe()).id;
      tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
      deOutraEquipe = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
      localId = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning())[0]!.id;
    });
    after(() => amb.fechar());

    const novaOs = async (titulo: string, extra: { descricao?: string; codigoAtividade?: string } = {}) =>
      (
        await amb.db
          .insert(os)
          .values({ numeroOrdem: String(numero++), tipo: "corretiva", titulo, localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-14", origem: "sap", ...extra })
          .returning()
      )[0]!.id;
    const escolha = (osId: string, como = tecnico) => amb.esperar(200, "GET", `/os/${osId}/modelos-apr`, { como });

    it("traz os 8 modelos publicados com título, descrição, exemplos e o que acharam na OS, e o recomendado", async () => {
      const r = await escolha(await novaOs("Roçagem da faixa do gasoduto"));
      assert.equal(r.recomendado, "APR 03");
      assert.deepEqual(
        r.modelos.map((m: any) => m.codigo),
        ["APR 01", "APR 02", "APR 03", "APR 04", "APR 05", "APR 06", "APR 07", "APR 09"],
      );
      const apr03 = r.modelos.find((m: any) => m.codigo === "APR 03");
      assert.deepEqual(Object.keys(apr03).sort(), ["codigo", "descricao", "encontradas", "exemplos", "titulo", "versao"], "as palavras-chave não vão para o técnico");
      assert.equal(apr03.titulo, "OPERAÇÃO MANUTENÇÃO");
      assert.equal(apr03.versao, 4);
      assert.ok(apr03.descricao.length > 0 && apr03.exemplos.length > 0);
      assert.deepEqual(apr03.encontradas, ["Roçagem"]);
      assert.ok(r.modelos.filter((m: any) => m.codigo !== "APR 03").every((m: any) => m.encontradas.length === 0));
    });

    it("lê a descrição da OS e o serviço do catálogo, além do título", async () => {
      const pelaDescricao = await escolha(await novaOs("Atendimento 4031", { descricao: "Conversão do fogão do cliente de GLP para gás natural." }));
      assert.equal(pelaDescricao.recomendado, "APR 05");
      await amb.db.insert(atividade).values({ codigo: "CLB-PI", descricao: "CLB - Calibração PI" }).onConflictDoNothing();
      const peloServico = await escolha(await novaOs("Preventiva mensal", { codigoAtividade: "CLB-PI" }));
      assert.equal(peloServico.recomendado, "APR 02");
    });

    it("empate ou nada achado: nenhum recomendado (o técnico escolhe pela descrição e pelos exemplos)", async () => {
      const empate = await escolha(await novaOs("Remoção de marimbondo em altura"));
      assert.equal(empate.recomendado, null);
      assert.ok(empate.modelos.find((m: any) => m.codigo === "APR 03").encontradas.includes("marimbondo"));
      assert.ok(empate.modelos.find((m: any) => m.codigo === "APR 06").encontradas.includes("altura"));
      assert.equal((await escolha(await novaOs("Serviço diverso"))).recomendado, null);
    });

    it("a orientação editada pelo admin vale na hora; modelo excluído sai da escolha", async () => {
      const admin = await amb.criarUsuario({ perfil: "admin" });
      const osId = await novaOs("Lavagem da estação");
      assert.equal((await escolha(osId)).recomendado, "APR 03");
      await amb.esperar(200, "PUT", "/modelos-apr/APR%2007/orientacao", { como: admin, json: { descricao: "x", exemplos: [], palavras_chave: ["lavagem", "estação"] } });
      assert.equal((await escolha(osId)).recomendado, "APR 07");
      await amb.esperar(200, "DELETE", "/modelos-apr/APR%2009", { como: admin });
      assert.ok(!(await escolha(osId)).modelos.some((m: any) => m.codigo === "APR 09"));
    });

    it("quem não vê a equipe da OS recebe 404; sem login, 401", async () => {
      const osId = await novaOs("Roçagem");
      assert.equal((await amb.req("GET", `/os/${osId}/modelos-apr`, { como: deOutraEquipe })).status, 404);
      assert.equal((await amb.req("GET", `/os/${osId}/modelos-apr`)).status, 401);
      await amb.db.delete(os).where(eq(os.id, osId));
    });
  });
});
