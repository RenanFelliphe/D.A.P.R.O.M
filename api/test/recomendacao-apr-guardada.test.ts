import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { localInstalacao, os, osRecomendacaoApr } from "../src/db/schema";
import { analisarRecomendacoesDeApr, PAUSA_DA_COTA_MIN, RECUOS_DA_IA_MIN } from "../src/dominio/recomendacao-apr-guardada";
import { IAIndisponivel } from "../src/servicos/ia";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * A recomendação do modelo de APR guardada por OS (`docs/ia-e-vitoria.md`, seção 5): palavras-chave para toda OS que entra, a IA depois (quando a
 * função Recomendação está ligada), a análise refeita quando o texto da OS ou os modelos mudam, e a escolha da tela e do aplicativo
 * lendo o que ficou guardado.
 */
describe("recomendação do modelo de APR guardada por OS", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let equipeId: string;
  let localId: string;
  let numero = 4_600_000;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, duracaoDoTokenSeg: 30 * 24 * 3600 });
    equipeId = (await amb.criarEquipe()).id;
    admin = await amb.criarUsuario({ perfil: "admin" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    localId = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning())[0]!.id;
  });
  after(() => amb.fechar());

  beforeEach(async () => {
    await amb.db.delete(os);
    amb.ia.respostas = [];
    amb.ia.chamadas.length = 0;
    amb.ia.falhar = false;
    amb.ia.proximaFalha = null;
    await definirFuncao(false);
  });

  const definirFuncao = async (ligada: boolean) => {
    if (ligada) await amb.ligarIa("recomendacao", { como: admin });
    else await amb.esperar(200, "PUT", "/vitoria/ia/recomendacao", { como: admin, json: { ligada: false } });
  };

  const novaOs = async (titulo: string, extra: Partial<typeof os.$inferInsert> = {}) =>
    (
      await amb.db
        .insert(os)
        .values({ numeroOrdem: String(numero++), tipo: "corretiva", titulo, localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-14", origem: "sap", ...extra })
        .returning()
    )[0]!.id;
  const guardada = async (osId: string) => (await amb.db.select().from(osRecomendacaoApr).where(eq(osRecomendacaoApr.osId, osId)))[0];
  const varrer = (opcoes?: Parameters<typeof analisarRecomendacoesDeApr>[1]) => analisarRecomendacoesDeApr(amb.deps, opcoes);
  const escolha = (osId: string) => amb.esperar(200, "GET", `/os/${osId}/modelos-apr`, { como: tecnico });
  const resposta = (codigo: string | null, motivo = "A OS fala disso.") => JSON.stringify({ codigo, motivo });
  const avancar = (min: number) => {
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + min * 60_000);
  };

  it("toda OS que entra ganha as palavras-chave, qualquer que seja a entrada, sem chamar a IA; rodar de novo não faz nada", async () => {
    const doSap = await novaOs("Roçagem da faixa do gasoduto");
    const daPlanilha = await novaOs("Calibração de manômetros", { origem: "planilha" });
    const doPdf = await novaOs("Serviço diverso", { origem: "pdf", status: "pendente" });
    const deApoio = await novaOs("Pintura de suportes", { origem: "apoio", numeroOrdem: null, osOrigemId: doSap });

    const r = await varrer();
    assert.deepEqual(r, { porPalavras: 4, porIa: 0, falhasDaIa: 0 });
    assert.equal(amb.ia.chamadas.length, 0);
    assert.deepEqual(
      await Promise.all([doSap, daPlanilha, doPdf, deApoio].map(async (id) => (await guardada(id))!.codigo)),
      ["APR 03", "APR 02", null, "APR 03"],
    );
    assert.ok((await Promise.all([doSap, daPlanilha, doPdf, deApoio].map(guardada))).every((g) => g!.fonte === "palavras"));
    assert.deepEqual((await guardada(doSap))!.encontradas, [{ codigo: "APR 03", palavras: ["Roçagem"] }]);

    assert.deepEqual(await varrer(), { porPalavras: 0, porIa: 0, falhasDaIa: 0 });
  });

  it("só as OS que ainda podem receber APR entram: encerrada, cancelada e devolvida ficam de fora", async () => {
    const aberta = await novaOs("Roçagem");
    const encerrada = await novaOs("Roçagem", { status: "encerrada" });
    const cancelada = await novaOs("Roçagem", { status: "cancelada" });
    await varrer();
    assert.ok(await guardada(aberta));
    assert.equal(await guardada(encerrada), undefined);
    assert.equal(await guardada(cancelada), undefined);
  });

  it("com a função ligada, a IA corrige a recomendação; o técnico recebe a fonte, o motivo e as palavras achadas", async () => {
    await definirFuncao(true);
    const osId = await novaOs("Roçagem da faixa do gasoduto", { descricao: "Serviço feito em altura, no talude." });
    amb.ia.respostas = [resposta("APR 06", "A roçagem é no talude, em altura.")];

    assert.deepEqual(await varrer(), { porPalavras: 1, porIa: 1, falhasDaIa: 0 });
    const g = (await guardada(osId))!;
    assert.deepEqual([g.fonte, g.codigo, g.motivo, g.tentativasIa, g.proximaIaEm], ["ia", "APR 06", "A roçagem é no talude, em altura.", 0, null]);

    // O pedido: modelo "recomendacao", a lista dos modelos em cache e o texto da OS (tratado como dado).
    assert.equal(amb.ia.chamadas.length, 1);
    const pedido = amb.ia.chamadas[0]!;
    assert.equal(pedido.modelo, "recomendacao");
    assert.ok(pedido.mensagens.some((m) => m.cache && m.texto.includes("APR 06") && m.texto.includes("APR 03")));
    assert.match(pedido.mensagens.at(-1)!.texto, /Roçagem da faixa do gasoduto/);
    assert.match(pedido.mensagens.at(-1)!.texto, /em altura, no talude/);

    const r = await escolha(osId);
    assert.deepEqual([r.recomendado, r.fonte, r.motivo], ["APR 06", "ia", "A roçagem é no talude, em altura."]);
    // As palavras achadas continuam: a IA decide, mas a tela ainda mostra o que a leitura viu.
    assert.deepEqual(r.modelos.find((m: any) => m.codigo === "APR 03").encontradas, ["Roçagem"]);
    assert.deepEqual(r.modelos.find((m: any) => m.codigo === "APR 06").encontradas, ["altura"]);

    // Já analisada: a próxima varredura não chama a IA de novo.
    assert.deepEqual(await varrer(), { porPalavras: 0, porIa: 0, falhasDaIa: 0 });
    assert.equal(amb.ia.chamadas.length, 1);
  });

  it("a IA pode dizer que nenhum modelo combina (codigo nulo)", async () => {
    await definirFuncao(true);
    const osId = await novaOs("Roçagem da faixa");
    amb.ia.respostas = [resposta(null, "Não deu para saber o tipo de serviço.")];
    await varrer();
    const r = await escolha(osId);
    assert.deepEqual([r.recomendado, r.fonte, r.motivo], [null, "ia", "Não deu para saber o tipo de serviço."]);
  });

  it("função desligada: nenhuma chamada à IA, e as palavras-chave seguem valendo na tela", async () => {
    await definirFuncao(false);
    const osId = await novaOs("Roçagem da faixa do gasoduto");
    amb.ia.respostas = [resposta("APR 06")];
    await varrer();
    assert.equal(amb.ia.chamadas.length, 0);
    const r = await escolha(osId);
    assert.deepEqual([r.recomendado, r.fonte, r.motivo], ["APR 03", "palavras", null]);
    // Ligada depois, a OS que esperava na fila é analisada.
    await definirFuncao(true);
    assert.deepEqual(await varrer(), { porPalavras: 0, porIa: 1, falhasDaIa: 0 });
    assert.equal((await escolha(osId)).recomendado, "APR 06");
  });

  it("a IA fora do ar deixa as palavras, tenta de novo com recuo e para no teto de tentativas", async () => {
    await definirFuncao(true);
    const osId = await novaOs("Roçagem da faixa do gasoduto");

    // Sem resposta programada a IA em memória falha como um fornecedor com problema.
    const inicio = amb.relogio.agora;
    assert.deepEqual(await varrer(), { porPalavras: 1, porIa: 0, falhasDaIa: 1 });
    let g = (await guardada(osId))!;
    assert.deepEqual([g.fonte, g.tentativasIa], ["palavras", 1]);
    assert.equal(g.proximaIaEm!.getTime(), inicio.getTime() + RECUOS_DA_IA_MIN[0] * 60_000);
    assert.equal((await escolha(osId)).recomendado, "APR 03", "a tela segue com as palavras-chave");

    // Antes do recuo, nada é tentado.
    const chamadas = amb.ia.chamadas.length;
    await varrer();
    assert.equal(amb.ia.chamadas.length, chamadas);

    // Falha a falha, cada uma espera o seu recuo; a última deixa a OS sem nova tentativa.
    for (let tentativa = 2; tentativa <= RECUOS_DA_IA_MIN.length + 1; tentativa++) {
      avancar(RECUOS_DA_IA_MIN[tentativa - 2]!);
      await varrer();
      g = (await guardada(osId))!;
      assert.equal(g.tentativasIa, tentativa);
    }
    assert.equal(g.proximaIaEm, null, "esgotadas as tentativas, só uma mudança no texto ou nos modelos volta a chamar a IA");
    const depoisDoTeto = amb.ia.chamadas.length;
    avancar(24 * 60);
    await varrer();
    assert.equal(amb.ia.chamadas.length, depoisDoTeto);

    // O texto da OS mudou: análise nova, tentativas zeradas e a IA tenta outra vez.
    await amb.db.update(os).set({ titulo: "Roçagem da faixa do gasoduto de Vila Velha" }).where(eq(os.id, osId));
    amb.ia.respostas = [resposta("APR 03")];
    assert.deepEqual(await varrer(), { porPalavras: 1, porIa: 1, falhasDaIa: 0 });
    g = (await guardada(osId))!;
    assert.deepEqual([g.fonte, g.tentativasIa], ["ia", 0]);
  });

  it("a cota do fornecedor pausa a IA por um tempo, sem gastar tentativa e sem tentar as outras OS do lote", async () => {
    await definirFuncao(true);
    const a = await novaOs("Roçagem A");
    const b = await novaOs("Roçagem B");
    amb.ia.proximaFalha = new IAIndisponivel("cota", { motivo: "cota" });
    const inicio = amb.relogio.agora;
    const r = await varrer({ concorrencia: 1 });
    assert.deepEqual(r, { porPalavras: 2, porIa: 0, falhasDaIa: 1 });
    assert.equal(amb.ia.chamadas.length, 1, "a segunda OS nem foi tentada");
    const gravadas = [(await guardada(a))!, (await guardada(b))!];
    const pausada = gravadas.find((g) => g.tentativasIa === 0 && g.proximaIaEm!.getTime() === inicio.getTime() + PAUSA_DA_COTA_MIN * 60_000);
    assert.ok(pausada, "a OS que recebeu a recusa ficou em pausa, sem tentativa gasta");
  });

  it("resposta com um modelo que não existe é descartada: a OS fica com as palavras-chave", async () => {
    await definirFuncao(true);
    const osId = await novaOs("Roçagem da faixa do gasoduto");
    amb.ia.respostas = [resposta("APR 99")];
    assert.deepEqual(await varrer(), { porPalavras: 1, porIa: 0, falhasDaIa: 1 });
    const g = (await guardada(osId))!;
    assert.deepEqual([g.fonte, g.codigo, g.tentativasIa], ["palavras", "APR 03", 1]);
    // Texto que nem é JSON também.
    amb.ia.respostas = ["não sei"];
    avancar(RECUOS_DA_IA_MIN[0]);
    await varrer();
    assert.equal((await guardada(osId))!.tentativasIa, 2);
  });

  it("o texto da OS ou a orientação dos modelos mudou: a análise é refeita", async () => {
    await definirFuncao(true);
    const osId = await novaOs("Lavagem da estação");
    amb.ia.respostas = [resposta("APR 03", "Lavagem de estação.")];
    await varrer();
    assert.equal((await guardada(osId))!.fonte, "ia");

    // Entre a mudança e a varredura, a tela já não confia na análise velha e lê as palavras-chave na hora, sem chamar a IA.
    await amb.esperar(200, "PUT", "/modelos-apr/APR%2007/orientacao", { como: admin, json: { descricao: "Lavagem", exemplos: [], palavras_chave: ["lavagem", "estação"] } });
    const entre = await escolha(osId);
    assert.deepEqual([entre.recomendado, entre.fonte], ["APR 07", "palavras"]);
    assert.equal(amb.ia.chamadas.length, 1);

    amb.ia.respostas = [resposta("APR 07", "Lavagem de estação, como diz o modelo.")];
    assert.deepEqual(await varrer(), { porPalavras: 1, porIa: 1, falhasDaIa: 0 });
    assert.deepEqual([(await escolha(osId)).recomendado, (await escolha(osId)).fonte], ["APR 07", "ia"]);

    // O texto da OS mudou (por exemplo, o SAP trouxe outra descrição).
    await amb.db.update(os).set({ descricao: "Agora em espaço confinado" }).where(eq(os.id, osId));
    amb.ia.respostas = [resposta("APR 06", "Espaço confinado.")];
    assert.deepEqual(await varrer(), { porPalavras: 1, porIa: 1, falhasDaIa: 0 });
    assert.equal((await escolha(osId)).recomendado, "APR 06");
  });

  it("o snapshot do aplicativo traz a recomendação guardada, com a fonte e o motivo", async () => {
    await definirFuncao(true);
    const osId = await novaOs("Roçagem da faixa do gasoduto");
    const semAnalise = await novaOs("Calibração de manômetros");
    amb.ia.respostas = [resposta("APR 06", "Em altura.")];
    await varrer({ concorrencia: 1, lote: 1 });
    // Uma das duas foi para a IA; a outra segue só com as palavras (ainda sem a vez da IA).
    const snapshot = await amb.esperar(200, "POST", "/sync/pull", { como: tecnico, json: {} });
    const porId = new Map<string, any>(snapshot.os.map((o: any) => [o.id, o.escolha_do_modelo]));
    const comIa = [...porId.values()].find((e) => e.fonte === "ia");
    const comPalavras = [...porId.values()].find((e) => e.fonte === "palavras");
    assert.ok(comIa && comPalavras);
    assert.deepEqual([comIa.recomendado, comIa.motivo], ["APR 06", "Em altura."]);
    assert.equal(comPalavras.motivo, null);
    assert.ok(comPalavras.encontradas.length > 0);
    assert.equal(porId.size, 2);
    assert.ok(porId.has(osId) && porId.has(semAnalise));
  });
});
