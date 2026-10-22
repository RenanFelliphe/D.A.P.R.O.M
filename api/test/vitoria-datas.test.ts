import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { blocoDeDatas } from "../src/dominio/vitoria-datas";
import { criarAmbiente } from "./ajuda";

/**
 * A data de hoje no pedido à IA (`docs/ia-e-vitoria.md`, seção 4.7): "mês passado" e o mês sem o ano ("maio") dependem de saber
 * que dia é hoje, e quem faz a conta de calendário é o servidor, não a IA.
 */
describe("Vitória — datas no pedido à IA", () => {
  const linhasDaTabela = (bloco: string) => bloco.split("\n").filter((l) => l.startsWith("- "));

  it("a tabela traz hoje e os 12 últimos meses, do mais recente ao mais antigo, com os nomes relativos", () => {
    const bloco = blocoDeDatas("2026-10-17");
    assert.match(bloco, /^Hoje é 17\/10\/2026\./);
    const linhas = linhasDaTabela(bloco);
    assert.equal(linhas.length, 12);
    assert.equal(linhas[0], "- outubro de 2026 = 2026-10 (este mês)");
    assert.equal(linhas[1], "- setembro de 2026 = 2026-09 (mês passado)");
    assert.equal(linhas[2], "- agosto de 2026 = 2026-08 (mês retrasado)");
    assert.equal(linhas[3], "- julho de 2026 = 2026-07");
    assert.equal(linhas[11], "- novembro de 2025 = 2025-11");
  });

  it("o mês só com o nome vale a ocorrência mais recente: maio já passou este ano, mas não chegou no começo do ano", () => {
    assert.ok(linhasDaTabela(blocoDeDatas("2026-10-17")).includes("- maio de 2026 = 2026-05"));
    assert.ok(linhasDaTabela(blocoDeDatas("2026-03-10")).includes("- maio de 2025 = 2025-05"), "em março de 2026, maio é o de 2025");
    assert.ok(!blocoDeDatas("2026-03-10").includes("2026-05"), "nunca oferece um mês no futuro");
  });

  it("a virada do ano: em janeiro, o mês passado é dezembro do ano anterior", () => {
    const linhas = linhasDaTabela(blocoDeDatas("2027-01-15"));
    assert.equal(linhas[0], "- janeiro de 2027 = 2027-01 (este mês)");
    assert.equal(linhas[1], "- dezembro de 2026 = 2026-12 (mês passado)");
    assert.equal(linhas[2], "- novembro de 2026 = 2026-11 (mês retrasado)");
    assert.equal(linhas[11], "- fevereiro de 2026 = 2026-02");
  });

  it("o último dia do mês e o primeiro do ano não fazem a conta errar", () => {
    assert.equal(linhasDaTabela(blocoDeDatas("2026-03-31"))[1], "- fevereiro de 2026 = 2026-02 (mês passado)");
    assert.equal(linhasDaTabela(blocoDeDatas("2026-01-01"))[1], "- dezembro de 2025 = 2025-12 (mês passado)");
  });

  it("o pedido que chega à IA leva a tabela no último bloco de sistema, depois do manual em cache", async () => {
    // Um ambiente próprio com o relógio em janeiro: mexer no relógio do outro derrubaria o token de acesso.
    const amb = await criarAmbiente({ relogio: new Date("2027-01-15T15:00:00Z") });
    try {
      const tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
      amb.ia.respostas.push(JSON.stringify({ texto: "Veja dezembro", acao: { tipo: "navegar", destino: "dashboard_meus_periodo", filtro: "2026-12" } }));
      const r = await amb.req("POST", "/vitoria/mensagens", {
        como: tecnico,
        json: { mensagem: "o que eu executei no mês passado", tela: "padrao", contexto: {}, historico: [], numero_mensagem: 1 },
      });
      assert.equal(r.status, 200);

      const sistema = amb.ia.chamadas[0]!.mensagens.filter((m) => m.papel === "sistema");
      assert.equal(sistema.length, 3);
      assert.equal(sistema[1]!.cache, true, "o manual é o bloco em cache");
      assert.ok(!sistema[0]!.texto.includes("2027") && !sistema[1]!.texto.includes("2027"), "a data não entra antes do manual: mudaria todo dia e invalidaria o cache");
      assert.match(sistema[2]!.texto, /Tela atual: padrao/);
      assert.match(sistema[2]!.texto, /Hoje é 15\/01\/2027/);
      assert.match(sistema[2]!.texto, /- dezembro de 2026 = 2026-12 \(mês passado\)/);
    } finally {
      await amb.fechar();
    }
  });
});
