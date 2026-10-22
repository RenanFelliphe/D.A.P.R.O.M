import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { atividade, localInstalacao, material, os } from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

type Item = { chave: string; tipo: string; acao: string; titulo: string; detalhe: string; urgente: boolean; equipe_nome: string | null; os_id: string | null; atividade_codigo: string | null };

/** A página "Validações" do supervisor (`GET /me/validacoes`): a fila de tudo o que espera a decisão ou a assinatura dele. */
describe("Validações do supervisor", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let supervisorA: UsuarioDeTeste;
  let supervisorB: UsuarioDeTeste;
  let ana: UsuarioDeTeste;
  let alex: UsuarioDeTeste;
  let equipeA: string;
  let equipeB: string;
  let localId: string;
  let osDaAlfa: string;
  let contadorOs = 6_100_000;
  const servico = "9.8.1";

  const fila = async (como: UsuarioDeTeste) => (await amb.esperar(200, "GET", "/me/validacoes", { como })) as { total: number; por_tipo: Record<string, number>; itens: Item[] };
  const novaOs = async (equipeId: string, status: "liberada" | "aguardando_supervisor") => {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "Inspeção", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-15", origem: "sap", codigoAtividade: servico, status })
      .returning({ id: os.id });
    return o!.id;
  };

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-15T15:00:00Z"), duracaoDoTokenSeg: 90 * 86_400 });
    admin = await amb.criarUsuario({ perfil: "admin" });
    equipeA = (await amb.criarEquipe({ nome: "Equipe Alfa" })).id;
    equipeB = (await amb.criarEquipe({ nome: "Equipe Beta" })).id;
    supervisorA = await amb.criarUsuario({ perfil: "tecnico", nome: "Sônia Alfa", equipeId: equipeA, supervisor: true });
    supervisorB = await amb.criarUsuario({ perfil: "tecnico", nome: "Beto Beta", equipeId: equipeB, supervisor: true });
    ana = await amb.criarUsuario({ perfil: "tecnico", nome: "Ana Alfa", equipeId: equipeA });
    alex = await amb.criarUsuario({ perfil: "tecnico", nome: "Alex Alfa", equipeId: equipeA });
    await amb.db.insert(atividade).values({ codigo: servico, descricao: "Inspeção de válvula" });
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "SERRA/ERP" }).returning({ id: localInstalacao.id })) as [{ id: string }];
    await amb.db.insert(material).values({ codigo: "M-1", descricao: "Luva", unidade: "par" }).onConflictDoNothing();
  });
  after(() => amb.fechar());

  it("só o supervisor abre a fila: o técnico e o admin recebem 403", async () => {
    await amb.esperar(403, "GET", "/me/validacoes", { como: ana });
    await amb.esperar(403, "GET", "/me/validacoes", { como: admin });
    await amb.esperar(401, "GET", "/me/validacoes");
  });

  it("sem nada esperando, a fila vem vazia, com os cinco tipos zerados", async () => {
    const f = await fila(supervisorA);
    assert.equal(f.total, 0);
    assert.deepEqual(f.por_tipo, { os_ciencia: 0, treinamento: 0, sugestao_material: 0, conferencia: 0, ausencia: 0 });
    assert.deepEqual(f.itens, []);
  });

  it("a OS aguardando a ciência entra só na fila do supervisor da equipe dela", async () => {
    osDaAlfa = await novaOs(equipeA, "aguardando_supervisor");
    await novaOs(equipeA, "liberada");
    await novaOs(equipeB, "aguardando_supervisor");
    const f = await fila(supervisorA);
    assert.equal(f.total, 1);
    const [item] = f.itens as [Item];
    assert.equal(item.tipo, "os_ciencia");
    assert.equal(item.acao, "assinar");
    assert.equal(item.os_id, osDaAlfa);
    assert.equal(item.equipe_nome, "Equipe Alfa");
    assert.match(item.titulo, /^OS \d+ — Inspeção$/);
    assert.equal((await fila(supervisorB)).total, 1, "a OS da Beta é da fila da Beta");
  });

  it("a sugestão de materiais entra na fila de quem avalia, não na de outra equipe", async () => {
    // A equipe Alfa é quem mais faz o serviço (a OS liberada e a aguardando são dela); a Beta só tem uma.
    const [m] = await amb.db.select({ id: material.id }).from(material);
    await amb.esperar(201, "POST", "/sugestoes-materiais", { como: ana, json: { atividade: servico, tipo: "sugestao", lista: [{ material_id: m!.id, quantidade: 2 }] } });
    const f = await fila(supervisorA);
    const sugestao = f.itens.find((i) => i.tipo === "sugestao_material");
    assert.ok(sugestao, "a sugestão da Ana espera a Sônia");
    assert.equal(sugestao.acao, "decidir");
    assert.equal(sugestao.atividade_codigo, servico);
    assert.match(sugestao.detalhe, /Sugestão de lista de Ana Alfa/);
    assert.equal(f.por_tipo.sugestao_material, 1);
    assert.equal((await fila(supervisorB)).por_tipo.sugestao_material, 0);
  });

  it("o pedido de ausência da equipe entra na fila do supervisor dela, e só na dele", async () => {
    await amb.esperar(201, "POST", "/ausencias", { como: ana, json: { motivo: "Férias", inicio: "2026-10-20", dias: 5 } });
    const f = await fila(supervisorA);
    const pedido = f.itens.find((i) => i.tipo === "ausencia");
    assert.ok(pedido);
    assert.equal(pedido.acao, "pedida");
    assert.match(pedido.titulo, /Ana Alfa pediu ausência/);
    assert.equal(pedido.urgente, false, "ela só começa dia 20");
    assert.equal((await fila(supervisorB)).por_tipo.ausencia, 0);
  });

  it("a ausência vencida sobe para o topo, como urgente, e some quando o supervisor a encerra", async () => {
    const registrada = await amb.esperar(201, "POST", "/ausencias", { como: supervisorA, json: { motivo: "Atestado", usuario_id: alex.id, inicio: "2026-10-15", dias: 2, assinar: true } });
    const id = registrada.ausencia.id as string;
    assert.equal((await fila(supervisorA)).por_tipo.ausencia, 1, "a registrada pelo supervisor vale na hora e ainda não venceu");

    // Dois dias depois do retorno previsto (17/10): vencida e sem retorno confirmado.
    amb.relogio.agora = new Date("2026-10-18T15:00:00Z");
    const f = await fila(supervisorA);
    assert.equal(f.itens[0]!.tipo, "ausencia");
    assert.equal(f.itens[0]!.acao, "vencida");
    assert.equal(f.itens[0]!.urgente, true);
    assert.match(f.itens[0]!.detalhe, /17\/10\/2026/);
    // Os urgentes vêm antes; dentro de cada grupo, os mais antigos primeiro.
    const urgentes = f.itens.filter((i) => i.urgente).length;
    assert.ok(f.itens.slice(0, urgentes).every((i) => i.urgente));

    await amb.esperar(200, "POST", `/ausencias/${id}/encerrar`, { como: supervisorA, json: { assinar: true } });
    assert.ok(!(await fila(supervisorA)).itens.some((i) => i.acao === "vencida"));
  });

  it("o total e a contagem por tipo batem com a lista", async () => {
    const f = await fila(supervisorA);
    assert.equal(f.total, f.itens.length);
    for (const [tipo, n] of Object.entries(f.por_tipo)) assert.equal(f.itens.filter((i) => i.tipo === tipo).length, n, tipo);
  });
});
