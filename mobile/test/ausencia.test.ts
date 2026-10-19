import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RespostaMe } from "@shared/api/tipos";
import { botoesDaAusencia, campoDoDia, corpoDoPedido, diaDoCampo, faltaNoFimAntecipado, faltaNoNovoRetorno, faltaNoPedido, modoDaAusencia, periodoDoTexto } from "../src/ausencia/regras";
import { retornoDoPeriodo } from "@shared/api/ausencia-periodo";

const HOJE = "2026-10-20";
const periodo = (extra: Partial<{ inicio: string; modo: "dias" | "retorno"; dias: string; retorno: string }> = {}) => ({ inicio: "21/10/2026", modo: "dias" as const, dias: "5", retorno: "", ...extra });

describe("data digitada da ausência", () => {
  it("dd/mm/aaaa vira AAAA-MM-DD e volta", () => {
    assert.equal(diaDoCampo("05/11/2026"), "2026-11-05");
    assert.equal(diaDoCampo(" 5/1/2027 "), "2027-01-05");
    assert.equal(campoDoDia("2026-11-05"), "05/11/2026");
  });

  it("data que não existe ou texto solto é recusado", () => {
    assert.equal(diaDoCampo("31/02/2026"), null);
    assert.equal(diaDoCampo("2026-11-05"), null);
    assert.equal(diaDoCampo(""), null);
    assert.equal(diaDoCampo("05/11"), null);
  });
});

describe("pedido de ausência", () => {
  it("pedido certo não tem falta, com dias ou com data de retorno", () => {
    assert.equal(faltaNoPedido("Férias", periodo(), HOJE), null);
    assert.equal(faltaNoPedido("Férias", periodo({ modo: "retorno", retorno: "26/10/2026" }), HOJE), null);
  });

  it("sem motivo, diz que falta o motivo", () => {
    assert.match(faltaNoPedido("   ", periodo(), HOJE) ?? "", /motivo/);
  });

  it("início anterior a hoje ou inexistente é recusado", () => {
    assert.match(faltaNoPedido("Férias", periodo({ inicio: "19/10/2026" }), HOJE) ?? "", /anterior a hoje/);
    assert.match(faltaNoPedido("Férias", periodo({ inicio: "" }), HOJE) ?? "", /primeiro dia/);
  });

  it("os dias vão de 1 a 365 e são inteiros", () => {
    assert.match(faltaNoPedido("Férias", periodo({ dias: "0" }), HOJE) ?? "", /dias/);
    assert.match(faltaNoPedido("Férias", periodo({ dias: "366" }), HOJE) ?? "", /dias/);
    assert.match(faltaNoPedido("Férias", periodo({ dias: "2,5" }), HOJE) ?? "", /dias/);
    assert.equal(faltaNoPedido("Férias", periodo({ dias: "365" }), HOJE), null);
  });

  it("o retorno precisa ser depois do primeiro dia", () => {
    assert.match(faltaNoPedido("Férias", periodo({ modo: "retorno", retorno: "21/10/2026" }), HOJE) ?? "", /depois do primeiro dia/);
    assert.match(faltaNoPedido("Férias", periodo({ modo: "retorno", retorno: "" }), HOJE) ?? "", /retorno/);
  });

  it("motivo longo demais é recusado", () => {
    assert.match(faltaNoPedido("a".repeat(501), periodo(), HOJE) ?? "", /500/);
  });

  it("o retorno que o período dá é o primeiro dia de volta", () => {
    assert.equal(retornoDoPeriodo(periodoDoTexto(periodo({ inicio: "21/10/2026", dias: "5" }))), "2026-10-26");
    assert.equal(retornoDoPeriodo(periodoDoTexto(periodo({ modo: "retorno", retorno: "30/10/2026" }))), "2026-10-30");
  });
});

describe("fim antecipado e novo retorno", () => {
  const ausencia = { inicio: "2026-10-15", retorno: "2026-10-30" };

  it("o dia de volta fica entre hoje e a véspera do retorno previsto", () => {
    assert.equal(faltaNoFimAntecipado("25/10/2026", ausencia, HOJE), null);
    assert.equal(faltaNoFimAntecipado("29/10/2026", ausencia, HOJE), null);
    assert.match(faltaNoFimAntecipado("30/10/2026", ausencia, HOJE) ?? "", /antes do retorno/);
    assert.match(faltaNoFimAntecipado("19/10/2026", ausencia, HOJE) ?? "", /anterior a hoje/);
    assert.match(faltaNoFimAntecipado("", ausencia, HOJE) ?? "", /Informe/);
  });

  it("o novo retorno é depois de hoje e diferente do atual", () => {
    assert.equal(faltaNoNovoRetorno("31/10/2026", ausencia, HOJE), null);
    assert.match(faltaNoNovoRetorno("20/10/2026", ausencia, HOJE) ?? "", /depois de hoje/);
    assert.match(faltaNoNovoRetorno("30/10/2026", ausencia, HOJE) ?? "", /já é a data/);
  });
});

const eu = (usuario: Record<string, unknown>, equipe: Record<string, unknown> | null): Pick<RespostaMe, "usuario" | "equipe"> =>
  ({ usuario: { id: "eu", ...usuario }, equipe }) as unknown as Pick<RespostaMe, "usuario" | "equipe">;

describe("modo de pedir a ausência", () => {
  it("o técnico com supervisor pede", () => {
    const m = modoDaAusencia(eu({}, { id: "e1", supervisor_id: "sup" }));
    assert.deepEqual(m, { modo: "pedir", titular: false, motivoSemPedido: null });
  });

  it("o supervisor titular registra a própria", () => {
    const m = modoDaAusencia(eu({ equipes_supervisionadas: [{ id: "e1", nome: "A" }] }, { id: "e1", supervisor_id: "eu" }));
    assert.equal(m.modo, "registrar");
    assert.equal(m.titular, true);
  });

  it("o representante no comando pede, como técnico", () => {
    const m = modoDaAusencia(eu({ equipes_supervisionadas: [{ id: "e1", nome: "A" }], equipes_representadas: [{ id: "e1" }] }, { id: "e1", supervisor_id: "sup", representante_id: "eu" }));
    assert.equal(m.modo, "pedir");
    assert.equal(m.titular, false);
  });

  it("sem equipe, não há a quem pedir", () => {
    assert.match(modoDaAusencia(eu({}, null)).motivoSemPedido ?? "", /não está em uma equipe/);
  });

  it("equipe sem supervisor e sem representante, não há a quem pedir", () => {
    assert.match(modoDaAusencia(eu({}, { id: "e1", supervisor_id: null, representante_id: null })).motivoSemPedido ?? "", /ninguém responde/);
  });

  it("o representante da equipe sem supervisor não tem a quem pedir", () => {
    const m = modoDaAusencia(eu({}, { id: "e1", supervisor_id: null, representante_id: "eu", representacao: { motivo: "sem_supervisor" } }));
    assert.match(m.motivoSemPedido ?? "", /é você quem responde/);
  });
});

describe("botões da ausência", () => {
  const botoes = (origem: "pedido" | "propria", situacao: Parameters<typeof botoesDaAusencia>[0]["situacao"], titular = false, fimPedido: string | null = null) =>
    botoesDaAusencia({ origem, situacao, fim_pedido_em: fimPedido }, titular).map((b) => b.acao);

  it("o pedido que espera o supervisor só pode ser cancelado", () => {
    assert.deepEqual(botoes("pedido", "pedida"), ["cancelar"]);
  });

  it("o que o supervisor aprovou se confirma, se recusa as datas ou se cancela", () => {
    assert.deepEqual(botoes("pedido", "aguardando_confirmacao"), ["confirmar", "recusar-ajuste", "cancelar"]);
  });

  it("a em curso pede o fim antecipado, uma vez só", () => {
    assert.deepEqual(botoes("pedido", "em_curso"), ["pedir-fim"]);
    assert.deepEqual(botoes("pedido", "em_curso", false, "2026-10-20T10:00:00Z"), []);
  });

  it("a vencida pede a confirmação do retorno", () => {
    assert.deepEqual(botoes("pedido", "vencida"), ["confirmar-retorno"]);
  });

  it("a que já terminou não tem botão", () => {
    for (const s of ["encerrada", "recusada", "cancelada", "agendada"] as const) assert.deepEqual(botoes("pedido", s), []);
  });

  it("a registrada pelo supervisor para si tem retorno alterável e encerramento", () => {
    assert.deepEqual(botoes("propria", "em_curso", true), ["prorrogar", "encerrar"]);
    assert.deepEqual(botoes("propria", "agendada", true), ["prorrogar", "encerrar"]);
    assert.deepEqual(botoes("propria", "encerrada", true), []);
    assert.deepEqual(botoes("propria", "em_curso", false), []);
  });
});

describe("corpo do pedido", () => {
  it("pelos dias: início ISO e dias como número", () => {
    assert.deepEqual(corpoDoPedido("  Férias ", periodo({ dias: "5" }), false), { motivo: "Férias", inicio: "2026-10-21", dias: 5 });
  });

  it("pela data de retorno: início e retorno ISO", () => {
    assert.deepEqual(corpoDoPedido("Viagem", periodo({ modo: "retorno", retorno: "30/10/2026" }), false), { motivo: "Viagem", inicio: "2026-10-21", retorno: "2026-10-30" });
  });

  it("o supervisor que registra a própria assina", () => {
    assert.equal(corpoDoPedido("Férias", periodo(), true).assinar, true);
  });
});
