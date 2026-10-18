import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { duracaoDaReacao, reacaoDaExpressao, respostaLocalDaVitoria, REACOES } from "../../shared/vitoria/reacoes";

/**
 * As reações da Vitória (`shared/vitoria/reacoes.ts`): o pedido para imitar uma emoção é entendido pelo contexto, não por
 * frases exatas, e uma pergunta de verdade nunca pode ser tomada por um pedido (ela segue para a IA).
 */
describe("Reações da Vitória: pedido para imitar uma emoção", () => {
  const pedidos: Array<[string, string]> = [
    ["Vitória, fique triste", "triste"],
    ["Fique triste", "triste"],
    ["Finja que está triste", "triste"],
    ["fica triste aí", "triste"],
    ["Você pode ficar triste?", "triste"],
    ["tenta ficar chateada", "triste"],
    ["Faça uma cara de surpresa", "surpresa"],
    ["finge que ficou surpresa", "surpresa"],
    ["Me mostra como você fica com vergonha", "vergonha"],
    ["fique envergonhada por favor", "vergonha"],
    ["pode fazer uma carinha fofa?", "fofo"],
    ["comemora!", "comemorando"],
    ["Vitória, celebre", "comemorando"],
    ["fique animada", "comemorando"],
    ["fique feliz", "certo"],
    ["dá um joinha", "certo"],
    ["Joinha!", "certo"],
    ["fique brava", "atencao"],
    ["faz uma cara séria", "atencao"],
    ["fique pensativa", "pensando"],
    ["faz cara de quem errou", "errada"],
    ["fique sem graça", "errada"],
    ["acene para mim", "ola"],
    ["dá um tchau", "ola"],
    ["quero ver você triste", "triste"],
    ["como você ficaria triste?", "triste"],
  ];
  for (const [mensagem, reacao] of pedidos) {
    it(`"${mensagem}" vira a reação ${reacao}, tocada inteira`, () => {
      const r = respostaLocalDaVitoria(mensagem);
      assert.ok(r, "devia reconhecer o pedido");
      assert.equal(r.reacao, reacao);
      assert.equal(r.completa, true);
      assert.ok(r.texto.length > 0 && r.texto.length < 120, "a frase fica curta");
    });
  }

  const perguntasDeVerdade = [
    "Como faço a APR?",
    "Como fico feliz com meus pontos?",
    "Qual é a tela triste de erro?",
    "Onde vejo a cara da equipe?",
    "por que você está triste?",
    "Não fique triste",
    "estou triste com a OS bloqueada",
    "Mostre o dashboard",
    "Mostre a tela de quem comemorou",
    "Faça a APR de surpresa",
    "fique tranquilo, o treinamento foi concluído",
    "para de ficar triste",
    "O que significa o selo de feliz no ranking?",
    "Posso trocar o modelo da APR depois de responder uma pergunta com o botão vermelho?",
    "triste",
    "ok",
    "",
    "   ",
  ];
  for (const mensagem of perguntasDeVerdade) {
    it(`"${mensagem}" não é um pedido: segue para a IA`, () => {
      assert.equal(respostaLocalDaVitoria(mensagem), null);
    });
  }
});

describe("Reações da Vitória: saudação e agradecimento", () => {
  it("responde à saudação sem IA, repetindo o período do dia", () => {
    assert.equal(respostaLocalDaVitoria("Oi")?.reacao, "ola");
    assert.match(respostaLocalDaVitoria("Bom dia, Vitória!")?.texto ?? "", /^Bom dia!/);
    assert.match(respostaLocalDaVitoria("boa tarde")?.texto ?? "", /^Boa tarde!/);
    assert.match(respostaLocalDaVitoria("Oi Vitória, tudo bem?")?.texto ?? "", /^Oi!/);
    assert.equal(respostaLocalDaVitoria("Oi")?.completa, false);
  });

  it("não toma por saudação uma pergunta que começa com oi", () => {
    assert.equal(respostaLocalDaVitoria("oi, como faço a APR?"), null);
    assert.equal(respostaLocalDaVitoria("bom dia, onde vejo meus pontos"), null);
  });

  it("responde ao agradecimento com o joinha, curto", () => {
    const obrigada = respostaLocalDaVitoria("obrigada!");
    assert.equal(obrigada?.reacao, "certo");
    assert.equal(obrigada?.completa, false);
    assert.match(obrigada?.texto ?? "", /^De nada/);
    assert.match(respostaLocalDaVitoria("valeu, entendi")?.texto ?? "", /^De nada/);
    assert.match(respostaLocalDaVitoria("entendi, perfeito")?.texto ?? "", /^Que bom/);
  });

  it("não toma por agradecimento uma dúvida", () => {
    assert.equal(respostaLocalDaVitoria("obrigado, mas ainda não entendi"), null);
    assert.equal(respostaLocalDaVitoria("funcionou?"), null);
  });

  it("responde à despedida com o aceno", () => {
    assert.equal(respostaLocalDaVitoria("tchau")?.reacao, "ola");
    assert.equal(respostaLocalDaVitoria("até logo")?.reacao, "ola");
  });
});

describe("Reações da Vitória: o que a api devolve", () => {
  it("só `alerta`, `ops`, `pensando` e `comemorando` têm animação", () => {
    assert.equal(reacaoDaExpressao("alerta"), "atencao");
    assert.equal(reacaoDaExpressao("ops"), "errada");
    assert.equal(reacaoDaExpressao("pensando"), "pensando");
    assert.equal(reacaoDaExpressao("comemorando"), "comemorando");
    for (const quieta of ["padrao", "feliz", "explicando", undefined, null, "qualquer"]) assert.equal(reacaoDaExpressao(quieta), null);
  });

  it("a duração sozinha é curta, a atenção ainda mais, e a pedido toca inteira", () => {
    assert.equal(duracaoDaReacao("ola", false), 2500);
    assert.equal(duracaoDaReacao("atencao", false), 900);
    for (const r of REACOES) assert.equal(duracaoDaReacao(r, true), 5000);
  });
});
