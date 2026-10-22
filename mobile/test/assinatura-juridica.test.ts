import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CABECALHO_ASSINATURA_JURIDICA, CAMPO_ASSINATURA_JURIDICA_DO_EVENTO, EVENTOS_ASSINADOS, type AssinaturaJuridica } from "@shared/api/assinatura-juridica";
import { ErroDaApi, ErroDeRede } from "../src/api/erros";
import { criarClienteApi, type ArmazemDeTokens, type Tokens } from "../src/api/cliente";
import {
  AssinaturaCancelada,
  AssinaturaNaoConcluida,
  aindaServeAoAto,
  assinaturaJuridicaAtiva,
  cabecalhosDaAssinaturaJuridica,
  comAssinaturaJuridicaNoEvento,
  criarEspera,
  definirAssinaturaJuridica,
} from "../src/assinatura/juridica";
import { criarEnvioComFila } from "../src/offline/envio";
import { eventosPendentes } from "../src/offline/fila";
import { EU, novoBancoDeTeste } from "./ajuda-offline";

const AGORA = new Date("2026-10-22T15:00:00.000Z");

const assinatura = (extra: Partial<AssinaturaJuridica> = {}): AssinaturaJuridica => ({
  id: "a1",
  titulo: "Assinar a APR",
  resumo: null,
  situacao: "aguardando",
  url_assinatura: "https://provedor.local/assinar/a1",
  criada_em: AGORA.toISOString(),
  assinada_em: null,
  usada: false,
  pdf_pronto: false,
  os_id: null,
  origem_offline: false,
  ...extra,
});

describe("o código da assinatura que o ato em curso leva", () => {
  it("vai no cabeçalho das rotas só enquanto há assinatura em curso", () => {
    assert.deepEqual(cabecalhosDaAssinaturaJuridica(), {});
    definirAssinaturaJuridica("abc");
    assert.equal(assinaturaJuridicaAtiva(), "abc");
    assert.deepEqual(cabecalhosDaAssinaturaJuridica(), { [CABECALHO_ASSINATURA_JURIDICA]: "abc" });
    definirAssinaturaJuridica(null);
    assert.deepEqual(cabecalhosDaAssinaturaJuridica(), {});
  });

  it("vai no payload dos eventos assinados, e só neles", () => {
    for (const tipo of EVENTOS_ASSINADOS) {
      const e = comAssinaturaJuridicaNoEvento({ tipo, payload: { apr_id: "x" } }, "abc");
      assert.equal(e.payload[CAMPO_ASSINATURA_JURIDICA_DO_EVENTO], "abc", tipo);
      assert.equal(e.payload.apr_id, "x", "o resto do payload fica");
    }
    const outro = { tipo: "pausa_iniciada" as const, payload: { id: "p" } };
    assert.equal(comAssinaturaJuridicaNoEvento(outro, "abc"), outro);
  });

  it("sem código, ou com um código já no payload, o evento passa intacto", () => {
    const e = { tipo: "apr_assinada" as const, payload: { apr_id: "x" } };
    assert.equal(comAssinaturaJuridicaNoEvento(e, null), e);
    const jaTem = { tipo: "apr_assinada" as const, payload: { [CAMPO_ASSINATURA_JURIDICA_DO_EVENTO]: "antigo" } };
    assert.equal(comAssinaturaJuridicaNoEvento(jaTem, "novo"), jaTem);
  });

  it("o evento guardado na fila leva o código no payload, e vale mesmo se esperar sinal", async () => {
    const banco = await novoBancoDeTeste();
    definirAssinaturaJuridica("codigo-da-assinatura");
    try {
      const envio = criarEnvioComFila({
        banco,
        sincronizador: { enviarFila: async () => ({ porEvento: new Map() }) as never, enviarArquivo: async () => undefined as never },
        usuarioId: () => EU,
        conexao: () => "offline",
        agora: () => AGORA,
        subirAgora: async (_a, _t, id) => id,
        guardarCopiaDoArquivo: async (a) => a,
        apagarArquivoLocal: () => undefined,
        aoMudar: () => undefined,
        comAssinaturaJuridica: (e) => comAssinaturaJuridicaNoEvento(e),
      });
      const r = await envio.enviarEvento({ tipo: "encerramento_assinado", os_id: null, payload: { execucao_id: "e1" } });
      assert.equal(r.naFila, true);
      const [guardado] = await eventosPendentes(banco, EU);
      assert.equal(guardado!.payload[CAMPO_ASSINATURA_JURIDICA_DO_EVENTO], "codigo-da-assinatura");
      assert.equal(guardado!.payload.execucao_id, "e1");
    } finally {
      definirAssinaturaJuridica(null);
    }
  });
});

describe("o cliente da api leva o cabeçalho só nas escritas autenticadas", () => {
  const tokens: Tokens = { accessToken: "AT", refreshToken: "RT", expiraEm: "2026-10-22T18:00:00Z" };
  const armazem: ArmazemDeTokens = { ler: async () => tokens, gravar: async () => undefined, apagar: async () => undefined };

  function chamadas() {
    const vistas: { metodo: string; assinatura: string | null }[] = [];
    const cliente = criarClienteApi({
      urlBase: "http://api.local",
      armazem,
      agora: () => AGORA.getTime(),
      cabecalhosDeEscrita: () => ({ [CABECALHO_ASSINATURA_JURIDICA]: "abc" }),
      fetch: (async (_url: RequestInfo | URL, init?: RequestInit) => {
        vistas.push({ metodo: init?.method ?? "GET", assinatura: new Headers(init?.headers).get(CABECALHO_ASSINATURA_JURIDICA) });
        return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
      }) as typeof fetch,
    });
    return { cliente, vistas };
  }

  it("POST leva; GET não", async () => {
    const { cliente, vistas } = chamadas();
    await cliente.chamar("/os/1/cancelar", { corpo: {} });
    await cliente.chamar("/os");
    assert.deepEqual(vistas, [
      { metodo: "POST", assinatura: "abc" },
      { metodo: "GET", assinatura: null },
    ]);
  });
});

describe("a assinatura confirmada ainda serve ao ato?", () => {
  const assinada = (min: number, extra: Partial<AssinaturaJuridica> = {}) =>
    assinatura({ situacao: "assinada", assinada_em: new Date(AGORA.getTime() - min * 60_000).toISOString(), ...extra });

  it("serve por menos de 30 minutos (com um de folga) e uma vez só", () => {
    assert.equal(aindaServeAoAto(assinada(5), AGORA.getTime()), true);
    assert.equal(aindaServeAoAto(assinada(28), AGORA.getTime()), true);
    assert.equal(aindaServeAoAto(assinada(29.5), AGORA.getTime()), false);
    assert.equal(aindaServeAoAto(assinada(5, { usada: true }), AGORA.getTime()), false);
  });

  it("a que ainda não foi assinada não serve", () => {
    assert.equal(aindaServeAoAto(assinatura(), AGORA.getTime()), false);
    assert.equal(aindaServeAoAto(assinatura({ situacao: "recusada" }), AGORA.getTime()), false);
  });
});

describe("a espera pela assinatura na página do provedor", () => {
  const rapido = { intervaloMs: 5 };

  it("consulta até a assinatura ser confirmada e a devolve", async () => {
    const respostas = [assinatura(), assinatura(), assinatura({ situacao: "assinada", assinada_em: AGORA.toISOString() })];
    let consultas = 0;
    const espera = criarEspera({ ...rapido, consultar: async () => respostas[consultas++]! });
    const a = await espera.aguardar();
    assert.equal(a.situacao, "assinada");
    assert.equal(consultas, 3);
  });

  it("a falta de sinal no meio não encerra a espera", async () => {
    const passos: (AssinaturaJuridica | Error)[] = [new ErroDeRede(), assinatura({ situacao: "assinada", assinada_em: AGORA.toISOString() })];
    const espera = criarEspera({
      ...rapido,
      consultar: async () => {
        const p = passos.shift()!;
        if (p instanceof Error) throw p;
        return p;
      },
    });
    assert.equal((await espera.aguardar()).situacao, "assinada");
  });

  it("recusada e falha do provedor viram `AssinaturaNaoConcluida`, com a mensagem pronta", async () => {
    for (const situacao of ["recusada", "falhou"] as const) {
      const espera = criarEspera({ ...rapido, consultar: async () => assinatura({ situacao }) });
      await assert.rejects(espera.aguardar(), (e: unknown) => e instanceof AssinaturaNaoConcluida && /Tente de novo/.test(e.message));
    }
  });

  it("erro da `api` (a assinatura sumiu) encerra a espera com o próprio erro", async () => {
    const erro = new ErroDaApi(404, "nao_encontrado", "Registro não encontrado");
    const espera = criarEspera({ ...rapido, consultar: async () => Promise.reject(erro) });
    await assert.rejects(espera.aguardar(), (e: unknown) => e === erro);
  });

  it("cancelar acorda a espera na hora e encerra sem falha", async () => {
    const espera = criarEspera({ intervaloMs: 60_000, consultar: async () => assinatura() });
    const andamento = espera.aguardar();
    setTimeout(() => espera.cancelar(), 5);
    const inicio = Date.now();
    await assert.rejects(andamento, (e: unknown) => e instanceof AssinaturaCancelada);
    assert.ok(Date.now() - inicio < 5_000, "não esperou o intervalo inteiro");
  });

  it("`conferirJa` antecipa a consulta (o app voltou para a frente)", async () => {
    let consultas = 0;
    const espera = criarEspera({
      intervaloMs: 60_000,
      consultar: async () => {
        consultas++;
        return assinatura({ situacao: "assinada", assinada_em: AGORA.toISOString() });
      },
    });
    const andamento = espera.aguardar();
    setTimeout(() => espera.conferirJa(), 5);
    assert.equal((await andamento).situacao, "assinada");
    assert.equal(consultas, 1);
  });

  it("passado o tempo máximo, desiste com a mensagem de tempo esgotado", async () => {
    let relogio = 0;
    const espera = criarEspera({ intervaloMs: 1, limiteMs: 100, agora: () => (relogio += 60), consultar: async () => assinatura() });
    await assert.rejects(espera.aguardar(), (e: unknown) => e instanceof AssinaturaNaoConcluida && /tempo/.test(e.message));
  });
});
