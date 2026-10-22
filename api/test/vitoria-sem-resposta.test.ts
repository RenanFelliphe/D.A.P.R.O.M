import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { vitoriaPerguntaSemResposta } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * `GET /vitoria/sem-resposta` e `PATCH /vitoria/sem-resposta/{id}` (`docs/ia-e-vitoria.md`, seção 4.12): só o admin, e marcar como
 * tratada grava quem tratou e quando.
 */
describe("Vitória — perguntas sem resposta", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente();
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
  });
  after(() => amb.fechar());

  async function novaPerguntaSemResposta(pergunta: string) {
    const [linha] = await amb.db.insert(vitoriaPerguntaSemResposta).values({ pergunta, tela: "padrao", perfil: "tecnico", criadaEm: amb.relogio.agora }).returning();
    return linha!;
  }

  it("só o admin lista e trata; o técnico recebe 403", async () => {
    assert.equal((await amb.req("GET", "/vitoria/sem-resposta", { como: tecnico })).status, 403);
    const pergunta = await novaPerguntaSemResposta("pergunta de permissão");
    assert.equal((await amb.req("PATCH", `/vitoria/sem-resposta/${pergunta.id}`, { como: tecnico })).status, 403);
  });

  it("lista, paginada, filtrável por tratada; marcar como tratada grava quem e quando", async () => {
    const pendente = await novaPerguntaSemResposta("uma dúvida real de quem nunca viu o sistema");

    const antes = await amb.esperar(200, "GET", "/vitoria/sem-resposta", { como: admin, consulta: { tratada: false, tamanho: 200 } });
    assert.ok(antes.perguntas.some((p: any) => p.id === pendente.id));
    assert.ok(antes.perguntas.every((p: any) => p.tratada_em === null));
    assert.ok(!("usuario_id" in antes.perguntas[0]), "a pergunta sem resposta nunca identifica quem perguntou");

    const tratada = await amb.esperar(200, "PATCH", `/vitoria/sem-resposta/${pendente.id}`, { como: admin });
    assert.equal(tratada.tratada_por, admin.id);
    assert.ok(tratada.tratada_em);

    const depois = await amb.esperar(200, "GET", "/vitoria/sem-resposta", { como: admin, consulta: { tratada: true, tamanho: 200 } });
    assert.ok(depois.perguntas.some((p: any) => p.id === pendente.id));

    const restantesPendentes = await amb.esperar(200, "GET", "/vitoria/sem-resposta", { como: admin, consulta: { tratada: false, tamanho: 200 } });
    assert.ok(!restantesPendentes.perguntas.some((p: any) => p.id === pendente.id));
  });

  it("marcar uma pergunta inexistente como tratada é 404", async () => {
    const r = await amb.req("PATCH", "/vitoria/sem-resposta/00000000-0000-4000-8000-000000000000", { como: admin });
    assert.equal(r.status, 404);
  });
});

describe("Vitória — diagnóstico", () => {
  let amb: Ambiente;
  before(async () => {
    amb = await criarAmbiente();
  });
  after(() => amb.fechar());

  it("só o admin lê; mostra o uso do dia contra o limite", async () => {
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
    const admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
    assert.equal((await amb.req("GET", "/vitoria/diagnostico", { como: tecnico })).status, 403);

    const d = await amb.esperar(200, "GET", "/vitoria/diagnostico", { como: admin });
    assert.ok(["ativa", "sem_chave", "limite_do_dia", "fornecedor_com_problema"].includes(d.estado));
    assert.equal(d.uso.restantes, d.uso.limite - d.uso.usadas);
    assert.ok(d.uso.percentual >= 0 && d.uso.percentual <= 100);
  });
});
