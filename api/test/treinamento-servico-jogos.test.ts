import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { embaralharLetras, ladoDaGrade, mesaDaMemoria, montarGrade, palavrasAchadas, permutacaoDesordenada, refazerMemoria } from "../src/dominio/treinamento-servico-jogos";
import { celulasEntre, chaveDaPalavra, codificarTermo, coresDoPalpite, decodificarTermo, letrasDaGrade, letrasDaPalavra } from "../../shared/treinamento-servico/jogos";

/**
 * As peças dos minijogos que não dependem do banco: a grade do caça-palavras (na linha, na coluna e na diagonal, com
 * palavras se cruzando e sempre com todas), a partida da memória refeita no servidor e as letras do "desembaralhe" nunca já na ordem certa.
 */
describe("Treinamentos de serviço — peças dos minijogos", () => {
  it("letras da grade: maiúsculas sem acento; peças do desembaralhe: com acento", () => {
    assert.equal(letrasDaGrade("Inspeção"), "INSPECAO");
    assert.deepEqual(letrasDaPalavra("inspeção"), ["I", "N", "S", "P", "E", "Ç", "Ã", "O"]);
    assert.equal(chaveDaPalavra("Inspeção"), chaveDaPalavra("INSPECAO"), "a impressão não depende do acento nem da caixa");
  });

  it("células entre dois pontos: em linha reta (linha, coluna ou diagonal), em qualquer sentido de toque", () => {
    assert.deepEqual(celulasEntre([2, 5], [2, 3], 8), [
      [2, 3],
      [2, 4],
      [2, 5],
    ]);
    assert.deepEqual(celulasEntre([0, 1], [2, 1], 8), [
      [0, 1],
      [1, 1],
      [2, 1],
    ]);
    assert.deepEqual(celulasEntre([2, 2], [0, 0], 8), [
      [0, 0],
      [1, 1],
      [2, 2],
    ], "diagonal descendo, lida da esquerda para a direita");
    assert.deepEqual(celulasEntre([0, 2], [2, 0], 8), [
      [2, 0],
      [1, 1],
      [0, 2],
    ], "diagonal subindo, lida da esquerda para a direita");
    assert.equal(celulasEntre([0, 0], [1, 2], 8), null, "linha torta não vale");
    assert.equal(celulasEntre([0, 0], [0, 8], 8), null, "fora da grade");
  });

  it("a grade traz todas as palavras na posição gravada, na linha, na coluna ou na diagonal, e cruzando", () => {
    const palavras = ["Bloqueio", "EPI", "Inspeção", "Segurança", "Etiqueta"];
    let diagonais = 0;
    let cruzadas = 0;
    for (let rodada = 0; rodada < 200; rodada++) {
      const { linhas, posicoes } = montarGrade(palavras);
      const lado = ladoDaGrade(palavras);
      assert.equal(linhas.length, lado);
      assert.ok(linhas.every((l) => l.length === lado && /^[A-Z]+$/.test(l)));
      palavras.forEach((p, i) => {
        const { inicio, fim } = posicoes[i]!;
        const diagonal = inicio[0] !== fim[0] && inicio[1] !== fim[1];
        if (diagonal) diagonais++;
        assert.ok(inicio[1] < fim[1] || (inicio[1] === fim[1] && inicio[0] < fim[0]), "da esquerda para a direita ou, na coluna, de cima para baixo");
        const lido = celulasEntre(inicio, fim, lado)!.map(([l, c]) => linhas[l]![c]).join("");
        assert.equal(lido, letrasDaGrade(p));
      });
      const casas = posicoes.flatMap((p) => celulasEntre(p.inicio, p.fim, lado)!.map(([l, c]) => `${l}:${c}`));
      if (new Set(casas).size < casas.length) cruzadas++;
      assert.equal(palavrasAchadas(linhas, palavras, posicoes).size, palavras.length);
    }
    assert.ok(diagonais > 0, "alguma palavra na diagonal");
    assert.ok(cruzadas > 150, `palavras se cruzando quase sempre (${cruzadas} de 200)`);
  });

  it("5 palavras de 12 letras sempre cabem", () => {
    const palavras = ["ABCDEFGHIJKL", "MNOPQRSTUVWX", "ZYXWVUTSRQPO", "LKJIHGFEDCBA", "QWERTYUIOPAS"];
    for (let rodada = 0; rodada < 50; rodada++) {
      const { linhas, posicoes } = montarGrade(palavras);
      assert.equal(linhas.length, 14);
      assert.equal(palavrasAchadas(linhas, palavras, posicoes).size, 5);
    }
  });

  it("marcação que não forma palavra, ou torta, não conta; na diagonal, conta", () => {
    const linhas = ["EPIX", "XPXX", "XXIX", "XXXX"];
    assert.equal(palavrasAchadas(linhas, ["EPI"], [{ inicio: [0, 0], fim: [0, 3] }]).size, 0);
    assert.equal(palavrasAchadas(linhas, ["EPI"], [{ inicio: [0, 0], fim: [1, 2] }]).size, 0);
    assert.equal(palavrasAchadas(linhas, ["EPI"], [{ inicio: [2, 2], fim: [0, 0] }]).size, 1, "na diagonal, de trás para a frente");
    assert.equal(palavrasAchadas(linhas, ["EPI"], [{ inicio: [0, 2], fim: [0, 0] }]).size, 1, "tocar do fim para o começo também vale");
  });

  it("memória: refaz a partida, conta os erros e recusa jogada impossível", () => {
    const mesa = mesaDaMemoria(3);
    assert.equal(mesa.length, 6);
    const doPar = (par: number) => mesa.flatMap((c, i) => (c.par === par ? [i] : []));
    const perfeita = [0, 1, 2].map((p) => doPar(p) as [number, number]);
    assert.deepEqual(refazerMemoria(mesa, perfeita), { valida: true, completa: true, erros: 0, formados: 3 });

    const [a0] = doPar(0);
    const [b0] = doPar(1);
    const comErro: [number, number][] = [[a0!, b0!], ...perfeita];
    assert.deepEqual(refazerMemoria(mesa, comErro), { valida: true, completa: true, erros: 1, formados: 3 });

    assert.equal(refazerMemoria(mesa, [...perfeita, perfeita[0]!]).valida, false, "carta já formada não volta para a mesa");
    assert.equal(refazerMemoria(mesa, [[0, 0]]).valida, false, "a mesma carta duas vezes");
    assert.equal(refazerMemoria(mesa, perfeita.slice(0, 2)).completa, false);
  });

  it("termo: verde, amarelo e cinza, respeitando quantas vezes a letra aparece", () => {
    assert.deepEqual(coresDoPalpite("RISCO", "RISCO"), ["certa", "certa", "certa", "certa", "certa"]);
    assert.deepEqual(coresDoPalpite("mao", "Mão"), ["certa", "certa", "certa"], "sem acento vale");
    assert.deepEqual(coresDoPalpite("CORES", "RISCO"), ["presente", "presente", "presente", "ausente", "presente"]);
    // Dois "A" no palpite e só um na palavra: o do lugar certo fica verde, o outro cinza.
    assert.deepEqual(coresDoPalpite("AAXX", "XAYY"), ["ausente", "certa", "presente", "ausente"]);
    // Um "E" a mais do que a palavra tem: só o primeiro fora do lugar fica amarelo.
    assert.deepEqual(coresDoPalpite("EEEB", "BEZE"), ["presente", "certa", "ausente", "presente"]);
    for (const p of ["RISCO", "Mão", "Válvula"]) assert.equal(decodificarTermo(codificarTermo(p)), letrasDaGrade(p));
    assert.notEqual(codificarTermo("RISCO").toUpperCase(), "RISCO");
  });

  it("pôr em ordem: o embaralhamento nunca é a própria ordem", () => {
    for (const n of [2, 3, 6]) {
      for (let rodada = 0; rodada < 300; rodada++) {
        const ordem = permutacaoDesordenada(n);
        assert.deepEqual([...ordem].sort((a, b) => a - b), [...Array(n).keys()]);
        assert.ok(ordem.some((v, i) => v !== i));
      }
    }
  });

  it("desembaralhe: as letras nunca vêm já formando a palavra", () => {
    for (const palavra of ["EPI", "AAB", "INSPEÇÃO"]) {
      const letras = letrasDaPalavra(palavra);
      for (let rodada = 0; rodada < 200; rodada++) {
        const ordem = embaralharLetras(letras);
        assert.deepEqual([...ordem].sort((x, y) => x - y), [...letras.keys()]);
        assert.notEqual(ordem.map((i) => letras[i]).join(""), letras.join(""));
      }
    }
  });
});
