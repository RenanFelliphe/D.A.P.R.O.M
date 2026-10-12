import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { after, before, describe, it } from "node:test";
import { equipe, localInstalacao, os, usuario } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * Busca global: os campos de cada um (sem diferenciar maiúsculas nem acentos), só o que tem o texto em algum deles, e a
 * correspondência exata que abre direto a página do item (`GET /busca/exata`).
 */
describe("Busca global", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let supSerrana: UsuarioDeTeste;
  let tecLitoral: UsuarioDeTeste;
  let litoral: string;
  let serrana: string;
  let douglasCarvalho: UsuarioDeTeste;
  let douglasPereira: UsuarioDeTeste;
  let joao: UsuarioDeTeste;
  let inativo: UsuarioDeTeste;
  let osLitoral: string;
  let osSerrana: string;

  async function criarOs(d: { numero: string; titulo: string; equipeId: string; local: string; cliente: string; nota: string }) {
    const [local] = await amb.db.insert(localInstalacao).values({ codigo: d.local, cliente: d.cliente }).returning();
    const [o] = await amb.db
      .insert(os)
      .values({
        numeroOrdem: d.numero,
        numeroNota: d.nota,
        tipo: "corretiva",
        titulo: d.titulo,
        equipamento: "Retificador 9",
        localInstalacaoId: local!.id,
        equipeId: d.equipeId,
        dataInicioProg: "2026-10-09",
        origem: "sap",
      })
      .returning();
    return o!.id;
  }

  const ids = (lista: { id: string }[]) => lista.map((x) => x.id).sort();
  const buscar = async (como: UsuarioDeTeste, caminho: string, busca: string) => amb.esperar(200, "GET", caminho, { como, consulta: { busca } });

  before(async () => {
    amb = await criarAmbiente();
    litoral = (await amb.criarEquipe({ nome: "Equipe Litoral", centroTrabalho: "SERV_LIT" })).id;
    serrana = (await amb.criarEquipe({ nome: "Equipe Serrana", centroTrabalho: "SERV_SER" })).id;
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Administradora" });
    supSerrana = await amb.criarUsuario({ perfil: "tecnico", equipeId: serrana, nome: "Supervisor Serrano" });
    await amb.db.update(equipe).set({ supervisorId: supSerrana.id }).where(eq(equipe.id, serrana));
    tecLitoral = await amb.criarUsuario({ perfil: "tecnico", equipeId: litoral, nome: "Técnico do Litoral" });
    douglasCarvalho = await amb.criarUsuario({ perfil: "tecnico", equipeId: litoral, nome: "Douglas Carvalho", email: "douglas.carvalho@apple.com.br" });
    douglasPereira = await amb.criarUsuario({ perfil: "tecnico", equipeId: serrana, nome: "Douglas Pereira", email: "douglas.pereira@apple.com.br" });
    joao = await amb.criarUsuario({ perfil: "tecnico", equipeId: litoral, nome: "João Ninguém" });
    inativo = await amb.criarUsuario({ perfil: "tecnico", equipeId: serrana, nome: "Zacarias Desligado", ativo: false });
    await amb.db.update(usuario).set({ cargo: "Engenheiro Mecânico", registroProfissional: "ES-050003/D" }).where(eq(usuario.id, douglasCarvalho.id));
    osLitoral = await criarOs({ numero: "4100001", titulo: "Inspeção de retificador", equipeId: litoral, local: "VILA VELHA/REDE", cliente: "Vale", nota: "N-777" });
    osSerrana = await criarOs({ numero: "4100002", titulo: "Troca de disjuntor", equipeId: serrana, local: "SERRA/LITORAL SUL", cliente: "Suzano", nota: "N-888" });
  });
  after(() => amb.fechar());

  describe("campos de cada um", () => {
    it("usuário: nome, matrícula, cargo, e-mail e CREA", async () => {
      for (const termo of ["douglas carv", douglasCarvalho.matricula, "engenheiro mec", "carvalho@apple", "050003/d"]) {
        const r = await buscar(admin, "/usuarios", termo);
        assert.deepEqual(ids(r.usuarios), [douglasCarvalho.id], termo);
      }
    });

    it("equipe: nome e centro de trabalho", async () => {
      assert.deepEqual(ids((await buscar(admin, "/equipes", "litoral")).equipes), [litoral]);
      assert.deepEqual(ids((await buscar(admin, "/equipes", "serv_ser")).equipes), [serrana]);
    });

    it("OS: número, título, código do local, nota e cliente", async () => {
      for (const [termo, esperada] of [["4100001", osLitoral], ["disjuntor", osSerrana], ["vila velha", osLitoral], ["n-888", osSerrana], ["suzano", osSerrana]] as const) {
        assert.deepEqual(ids((await buscar(admin, "/os", termo)).os), [esperada], termo);
      }
    });

    it("não diferencia acentos nem maiúsculas, nos dois sentidos", async () => {
      assert.deepEqual(ids((await buscar(admin, "/usuarios", "JOAO")).usuarios), [joao.id]);
      assert.deepEqual(ids((await buscar(admin, "/usuarios", "ninguém")).usuarios), [joao.id]);
      assert.deepEqual(ids((await buscar(admin, "/os", "inspecao")).os), [osLitoral]);
      assert.deepEqual(ids((await buscar(admin, "/usuarios", "mecânico")).usuarios), [douglasCarvalho.id]);
    });

    it("só o que tem o texto: a pessoa achada não traz a equipe nem as OS dela, e a equipe não traz os membros", async () => {
      assert.deepEqual(ids((await buscar(admin, "/usuarios", "douglas")).usuarios), [douglasCarvalho.id, douglasPereira.id].sort());
      assert.equal((await buscar(admin, "/equipes", "douglas")).total, 0);
      assert.equal((await buscar(admin, "/os", "douglas")).total, 0);
      assert.equal((await buscar(admin, "/usuarios", "serv_lit")).total, 0);
      // "litoral" acha a OS do local SERRA/LITORAL SUL, não as OS da Equipe Litoral
      assert.deepEqual(ids((await buscar(admin, "/os", "litoral")).os), [osSerrana]);
    });

    it("o técnico só acha o que é da própria equipe", async () => {
      assert.deepEqual(ids((await buscar(tecLitoral, "/usuarios", "douglas")).usuarios), [douglasCarvalho.id]);
      assert.equal((await buscar(tecLitoral, "/os", "4100002")).total, 0);
      assert.equal((await buscar(tecLitoral, "/equipes", "serrana")).total, 0);
    });
  });

  describe("GET /busca/exata", () => {
    const exata = async (como: UsuarioDeTeste, q: string) => (await amb.esperar(200, "GET", "/busca/exata", { como, consulta: { q } })).achado;

    it("o texto inteiro de um campo abre o item: e-mail, matrícula, CREA, centro, nome da equipe, número da ordem, nota", async () => {
      assert.deepEqual(await exata(admin, "Douglas.Carvalho@apple.com.br"), { tipo: "usuario", id: douglasCarvalho.id });
      assert.deepEqual(await exata(admin, ` ${douglasPereira.matricula} `), { tipo: "usuario", id: douglasPereira.id });
      assert.deepEqual(await exata(admin, "es-050003/d"), { tipo: "usuario", id: douglasCarvalho.id });
      assert.deepEqual(await exata(admin, "joao ninguem"), { tipo: "usuario", id: joao.id });
      assert.deepEqual(await exata(admin, "SERV_LIT"), { tipo: "equipe", id: litoral });
      assert.deepEqual(await exata(admin, "equipe serrana"), { tipo: "equipe", id: serrana });
      assert.deepEqual(await exata(admin, "4100001"), { tipo: "os", id: osLitoral });
      assert.deepEqual(await exata(admin, "n-888"), { tipo: "os", id: osSerrana });
    });

    it("trecho, nenhum ou mais de um é null (vai para a página de resultados)", async () => {
      assert.equal(await exata(admin, "douglas.carval"), null);
      assert.equal(await exata(admin, "douglas"), null);
      assert.equal(await exata(admin, "não existe"), null);
      const outra = await amb.criarUsuario({ perfil: "admin", nome: "Douglas Carvalho" });
      try {
        assert.equal(await exata(admin, "douglas carvalho"), null, "dois homônimos");
      } finally {
        await amb.db.delete(usuario).where(eq(usuario.id, outra.id));
      }
    });

    it("só conta o que a pessoa enxerga", async () => {
      assert.equal(await exata(tecLitoral, "4100002"), null);
      assert.deepEqual(await exata(supSerrana, "4100002"), { tipo: "os", id: osSerrana });
      assert.equal(await exata(supSerrana, "4100001"), null);
      assert.equal(await exata(supSerrana, inativo.email), null);
      assert.deepEqual(await exata(admin, inativo.email), { tipo: "usuario", id: inativo.id });
    });

    it("exige autenticação e o texto", async () => {
      assert.equal((await amb.req("GET", "/busca/exata", { consulta: { q: "x" } })).status, 401);
      assert.equal((await amb.req("GET", "/busca/exata", { como: admin })).status, 422);
      assert.equal((await amb.req("GET", "/busca/exata", { como: admin, consulta: { q: "  " } })).status, 422);
    });
  });
});
