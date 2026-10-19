import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { percentualDaBarra, progressoDaConquista, ultimasConquistas } from "../src/gamificacao/regras";

describe("barra até a próxima patente", () => {
  it("vai de 0 a 100 entre os pontos da patente de agora e os da próxima", () => {
    assert.equal(percentualDaBarra(150, { de: 100, ate: 200 }), 50);
    assert.equal(percentualDaBarra(100, { de: 100, ate: 200 }), 0);
    assert.equal(percentualDaBarra(200, { de: 100, ate: 200 }), 100);
  });

  it("não passa dos extremos", () => {
    assert.equal(percentualDaBarra(50, { de: 100, ate: 200 }), 0);
    assert.equal(percentualDaBarra(900, { de: 100, ate: 200 }), 100);
  });

  it("no topo da escada a barra está cheia", () => {
    assert.equal(percentualDaBarra(5000, { de: 1000, ate: null }), 100);
  });

  it("faixa de largura zero não divide por zero", () => {
    assert.equal(percentualDaBarra(100, { de: 100, ate: 100 }), 0);
  });
});

describe("progresso da conquista", () => {
  const conquista = (criterio: string, atual: number | null, meta: number) => ({ criterio, progresso: { atual, meta, cumprida: false } });

  it("sem progresso, nada", () => {
    assert.equal(progressoDaConquista({ criterio: "apr", progresso: null }), null);
  });

  it("contagem comum: 'N de M' e a barra", () => {
    assert.deepEqual(progressoDaConquista(conquista("apr", 37, 50)), { texto: "37 de 50", percentual: 74 });
  });

  it("sem valor ainda, começa em zero", () => {
    assert.deepEqual(progressoDaConquista(conquista("apr", null, 50)), { texto: "0 de 50", percentual: 0 });
  });

  it("a patente conta os pontos de uma temporada", () => {
    assert.equal(progressoDaConquista(conquista("patente", 300, 1000))?.texto, "300 de 1.000 pontos numa temporada");
  });

  it("a patente da equipe conta a média por membro", () => {
    assert.match(progressoDaConquista(conquista("patente_da_equipe", 92.5, 100))?.texto ?? "", /de média por membro$/);
  });

  it("a posição vira texto, sem barra", () => {
    assert.deepEqual(progressoDaConquista(conquista("posicao", 4, 3)), { texto: "Melhor posição: 4º (a meta é o 3º ou melhor)", percentual: null });
    assert.deepEqual(progressoDaConquista(conquista("posicao", null, 3)), { texto: "Ainda sem temporada fechada.", percentual: null });
  });

  it("a barra não passa de 100", () => {
    assert.equal(progressoDaConquista(conquista("apr", 80, 50))?.percentual, 100);
  });
});

describe("últimas conquistas", () => {
  it("só as obtidas, da mais nova para a mais antiga, até o limite", () => {
    const lista = [{ obtida_em: "2026-10-01T10:00:00Z" }, { obtida_em: null }, { obtida_em: "2026-10-05T10:00:00Z" }, { obtida_em: "2026-09-01T10:00:00Z" }];
    assert.deepEqual(ultimasConquistas(lista, 2).map((c) => c.obtida_em), ["2026-10-05T10:00:00Z", "2026-10-01T10:00:00Z"]);
  });
});
