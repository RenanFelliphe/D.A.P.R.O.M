import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALTURA_DO_DESENHO, caminhoDoTraco, ControleDoDesenho, LARGURA_DO_DESENHO, pontoDoToque, temTraco, type Ponto } from "../src/assinatura/traco";

describe("traço da assinatura", () => {
  it("o toque vai para o espaço do desenho (600 × 180) pela razão da caixa", () => {
    assert.deepEqual(pontoDoToque(150, 45, 300, 90), { x: 300, y: 90 });
    assert.deepEqual(pontoDoToque(0, 0, 300, 90), { x: 0, y: 0 });
  });

  it("o toque fora da caixa fica preso na borda", () => {
    assert.deepEqual(pontoDoToque(-20, 500, 300, 90), { x: 0, y: ALTURA_DO_DESENHO });
    assert.deepEqual(pontoDoToque(999, 10, 300, 90), { x: LARGURA_DO_DESENHO, y: 20 });
  });

  it("a caixa ainda sem medida não quebra a conta", () => {
    const p = pontoDoToque(10, 10, 0, 0);
    assert.deepEqual(p, { x: 10, y: 10 });
  });

  it("um traço vazio não tem caminho", () => {
    assert.equal(caminhoDoTraco([]), "");
  });

  it("um toque sem arrasto vira um pontinho", () => {
    assert.equal(caminhoDoTraco([{ x: 10, y: 20 }]), "M 10 20 l 0.01 0.01");
  });

  it("dois pontos viram uma linha reta", () => {
    assert.equal(caminhoDoTraco([{ x: 0, y: 0 }, { x: 10, y: 10 }]), "M 0 0 L 10 10");
  });

  it("três pontos ou mais viram curvas pelos pontos médios e terminam no último", () => {
    const d = caminhoDoTraco([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    assert.equal(d, "M 0 0 Q 10 0 10 5 L 10 10");
  });

  it("só há desenho quando algum traço tem ponto", () => {
    assert.equal(temTraco([]), false);
    assert.equal(temTraco([[]]), false);
    assert.equal(temTraco([[], [{ x: 1, y: 1 }]]), true);
  });
});

describe("controle do desenho", () => {
  const novo = () => {
    const vistas: Ponto[][][] = [];
    const controle = new ControleDoDesenho((t) => vistas.push(t));
    controle.medir(300, 90);
    return { controle, vistas };
  };

  it("começar abre um traço e mover o estende, em pontos do desenho", () => {
    const { controle, vistas } = novo();
    controle.comecar(0, 0);
    controle.mover(150, 45);
    assert.deepEqual(vistas.at(-1), [[{ x: 0, y: 0 }, { x: 300, y: 90 }]]);
    assert.equal(controle.temTraco, true);
  });

  it("um segundo toque abre um segundo traço", () => {
    const { controle, vistas } = novo();
    controle.comecar(10, 10);
    controle.comecar(20, 20);
    assert.equal(vistas.at(-1)?.length, 2);
  });

  it("mover sem ter começado não faz nada", () => {
    const { controle, vistas } = novo();
    controle.mover(10, 10);
    assert.equal(vistas.length, 0);
  });

  it("limpar apaga tudo", () => {
    const { controle, vistas } = novo();
    controle.comecar(10, 10);
    controle.limpar();
    assert.deepEqual(vistas.at(-1), []);
    assert.equal(controle.temTraco, false);
  });

  it("travado, o desenho não muda", () => {
    const { controle, vistas } = novo();
    controle.comecar(10, 10);
    controle.travar(true);
    controle.comecar(20, 20);
    controle.mover(30, 30);
    assert.equal(vistas.length, 1);
  });
});
