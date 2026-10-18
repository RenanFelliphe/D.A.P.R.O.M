import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { atividade, treinamentoServico, treinamentoServicoVersao, usuario, vitoriaUso } from "../src/db/schema";
import { diaDe } from "../src/dominio/tempo";
import { criarAmbiente, configDeTeste, type Ambiente, type UsuarioDeTeste } from "./ajuda";

interface Sobre {
  provedor: string;
  ligada: boolean;
  modelos: { conversa: string; rascunho: string };
  limites: { por_conversa: number; por_conta_dia: number };
  mensagens_hoje: number;
  estatisticas: {
    desde: string | null;
    respondidas: number;
    nao_sei: number;
    com_acao: number;
    idas_na_tela: number;
    tempo_medio_ms: number | null;
    treinamentos_criados: number;
    treinamentos_publicados: number;
    digitalizadas: number;
  };
}

/**
 * `GET /vitoria/sobre` (`vitoria.md`, seção 2.8.7): o lado verdadeiro do perfil da Vitória. Traz o provedor e os modelos
 * da configuração (nunca a chave), os limites e o uso do dia de quem pergunta; abre para todos os perfis, inclusive quem
 * aguarda liberação.
 */
describe("Vitória — GET /vitoria/sobre", () => {
  let amb: Ambiente;
  let tecnico: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente();
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
  });
  after(() => amb.fechar());

  it("traz o provedor, os modelos e os limites da configuração, sem a chave", async () => {
    const r = await amb.req("GET", "/vitoria/sobre", { como: tecnico });
    assert.equal(r.status, 200);
    const sobre = r.corpo as Sobre;
    assert.equal(sobre.provedor, configDeTeste.ia.provedor);
    assert.equal(typeof sobre.ligada, "boolean");
    assert.deepEqual(sobre.modelos, { conversa: configDeTeste.ia.modelos.vitoria, rascunho: configDeTeste.ia.modelos.rascunho });
    assert.deepEqual(sobre.limites, { por_conversa: configDeTeste.vitoria.limitePorConversa, por_conta_dia: configDeTeste.vitoria.limitePorContaDia });
    assert.equal(JSON.stringify(sobre).includes("api_key"), false);
  });

  it("conta as mensagens com IA que a pessoa já usou hoje", async () => {
    await amb.db.insert(vitoriaUso).values({ usuarioId: tecnico.id, dia: diaDe(amb.relogio.agora), mensagens: 7 });
    const r = await amb.req("GET", "/vitoria/sobre", { como: tecnico });
    assert.equal((r.corpo as Sobre).mensagens_hoje, 7);
  });

  it("quem aguarda liberação também vê", async () => {
    const pendente = await amb.criarUsuario({ perfil: "tecnico", nome: "Pendente" });
    await amb.db.update(usuario).set({ liberacao: "pendente" }).where(eq(usuario.id, pendente.id));
    const r = await amb.req("GET", "/vitoria/sobre", { como: pendente });
    assert.equal(r.status, 200);
    assert.equal((r.corpo as Sobre).mensagens_hoje, 0);
  });

  it("sem autenticação é 401", async () => {
    const r = await amb.req("GET", "/vitoria/sobre", {});
    assert.equal(r.status, 401);
  });
});

/** Os números do perfil (`vitoria_estatistica`): só contadores do dia, sem texto nem pessoa. Ambiente próprio, para começar do zero. */
describe("Vitória — números do perfil", () => {
  let amb: Ambiente;
  let tecnico: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente();
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
  });
  after(() => amb.fechar());

  const sobre = async () => ((await amb.req("GET", "/vitoria/sobre", { como: tecnico })).corpo as Sobre).estatisticas;
  const perguntar = (mensagem: string) =>
    amb.req("POST", "/vitoria/mensagens", { como: tecnico, json: { mensagem, tela: "busca", contexto: {}, historico: [], numero_mensagem: 1 } });

  it("antes da primeira resposta, tudo zerado e sem tempo médio", async () => {
    assert.deepEqual(await sobre(), { desde: null, respondidas: 0, nao_sei: 0, com_acao: 0, idas_na_tela: 0, tempo_medio_ms: null, treinamentos_criados: 0, treinamentos_publicados: 0, digitalizadas: 0 });
  });

  it("soma as respostas da IA, o 'não sei', os toques em 'Me leve lá' e as sugestões fixas", async () => {
    amb.ia.falhar = false;
    amb.ia.respostas.push(JSON.stringify({ texto: "O quadro fica no menu.", acao: { tipo: "navegar", destino: "quadro_os" } }));
    assert.equal((await perguntar("Onde fica o quadro?")).status, 200);
    amb.ia.respostas.push(JSON.stringify({ texto: "Não sei.", acao: { tipo: "nao_sei" } }));
    assert.equal((await perguntar("Qual a cor do céu?")).status, 200);

    assert.equal((await amb.req("POST", "/vitoria/eventos", { como: tecnico, json: { tipo: "ida_a_tela" } })).status, 204);
    assert.equal((await amb.req("POST", "/vitoria/eventos", { como: tecnico, json: { tipo: "sugestao" } })).status, 204);

    const e = await sobre();
    assert.equal(e.desde, diaDe(amb.relogio.agora));
    assert.equal(e.respondidas, 2, "a resposta da IA e a sugestão fixa");
    assert.equal(e.nao_sei, 1);
    assert.equal(e.com_acao, 1);
    assert.equal(e.idas_na_tela, 1);
    assert.equal(typeof e.tempo_medio_ms, "number");
    assert.ok(e.tempo_medio_ms! >= 0);
  });

  it("a resposta pelo manual, sem IA, também conta (sem tempo da IA)", async () => {
    amb.ia.respostas.length = 0; // fila vazia: a IA "cai" e a resposta vem do manual
    const antes = await sobre();
    assert.equal((await perguntar("Como faço uma busca no sistema?")).status, 200);
    const depois = await sobre();
    assert.equal(depois.respondidas + depois.nao_sei, antes.respondidas + antes.nao_sei + 1);
    assert.equal(depois.tempo_medio_ms, antes.tempo_medio_ms);
  });

  it("conta os treinamentos montados pelo rascunho da IA e os já publicados; a digitalização ainda é zero", async () => {
    type Estado = "rascunho" | "publicada" | "substituida";
    const criar = async (codigo: string, versoes: { geradoComIa: boolean; estado: Estado }[]) => {
      await amb.db.insert(atividade).values({ codigo, descricao: `Serviço ${codigo}` });
      const [t] = await amb.db.insert(treinamentoServico).values({ atividadeCodigo: codigo }).returning();
      for (const [i, v] of versoes.entries()) {
        await amb.db.insert(treinamentoServicoVersao).values({
          treinamentoId: t!.id,
          versao: i + 1,
          geradoComIa: v.geradoComIa,
          estado: v.estado,
          ...(v.estado !== "rascunho" ? { publicadaEm: amb.relogio.agora, publicadaPor: tecnico.id, assinaturaPath: "x.png" } : {}),
        });
      }
    };
    await criar("VIT-IA-1", [
      { geradoComIa: true, estado: "substituida" },
      { geradoComIa: true, estado: "publicada" },
    ]);
    await criar("VIT-IA-2", [{ geradoComIa: true, estado: "rascunho" }]);
    await criar("VIT-MAO", [{ geradoComIa: false, estado: "publicada" }]);

    const e = await sobre();
    assert.equal(e.treinamentos_criados, 2, "dois treinamentos, mesmo com duas versões num deles; o feito à mão não conta");
    assert.equal(e.treinamentos_publicados, 1);
    assert.equal(e.digitalizadas, 0);
  });

  it("evento desconhecido é recusado, e sem login é 401", async () => {
    assert.equal((await amb.req("POST", "/vitoria/eventos", { como: tecnico, json: { tipo: "outro" } })).status, 422);
    assert.equal((await amb.req("POST", "/vitoria/eventos", { json: { tipo: "sugestao" } })).status, 401);
  });
});
