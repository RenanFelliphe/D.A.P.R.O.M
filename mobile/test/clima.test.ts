import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { alertaUrgente } from "@shared/api/alertas";
import { CATEGORIA_DO_AVISO, ROTULO_DO_AVISO } from "@shared/notificacoes/avisos";
import { adicionarFoto, montarPayload, novoRascunho, responder, type FotoDoRascunho, type ModeloDoRascunho, type RascunhoApr } from "@shared/api/apr";
import type { HoraDoClima, NivelDeRisco, PrevisaoDoTempo } from "@shared/api/clima";
import { chaveDaPrevisao, consultaDoClima, criarPrevisoes, guardarPrevisao, lerPrevisaoGuardada } from "../src/campo/clima-previsoes";
import {
  climaVistoNoRascunho,
  descartarFotosDoModal,
  evidenciasDoClima,
  exigenciaDaResposta,
  instrucaoDoModal,
  montarAvaliacaoComClima,
  montarPayloadComClima,
  perguntaDeClima,
  podeConfirmar,
  responderClima,
} from "../src/apr/clima-da-apr";
import { destinoDoAvisoNoApp } from "../src/avisos/destino";
import { iconeDoAviso } from "../src/avisos/referencia";
import { horasParaChips, iconeDoClima, linhaDoLocal, rotuloDaHora, textoDeAtualizacao, tomDoNivel } from "../src/clima/regras";
import { novoBancoDeTeste } from "./ajuda-offline";

/**
 * A previsão do tempo no app (`previsao-do-tempo.md`): a cópia guardada para o modo sem sinal (validade de hoje), a decisão do que a
 * pergunta de clima da APR exige, o que vai no evento (a previsão vista e a foto do local) e o que as telas desenham.
 */

const HOJE = "2026-10-21";
const AGORA = new Date(`${HOJE}T14:20:00-03:00`);

const hora = (h: number, nivel: NivelDeRisco = "sem_risco"): HoraDoClima => ({
  hora: `${HOJE}T${String(h).padStart(2, "0")}:00`,
  temperatura: 27,
  sensacao: 29,
  chance_chuva: 20,
  chuva_mm: 0,
  rajada_kmh: 12,
  indice_uv: 5,
  trovoada: nivel === "extremo",
  condicao: nivel === "extremo" ? "Trovoada" : "Céu limpo",
  icone: nivel === "extremo" ? "trovoada" : "sol",
  nivel,
});

const previsaoDe = (nivel: NivelDeRisco, extra: Partial<PrevisaoDoTempo> = {}): PrevisaoDoTempo => ({
  disponivel: true,
  local: { nome: "Vitória, ES", latitude: -20.3155, longitude: -40.3128, origem: "padrao" },
  janela: "proximas_horas",
  nivel,
  titulo: nivel === "extremo" ? "Trovoada prevista das 15h às 17h" : nivel === "atencao" ? "Chuva prevista por volta das 16h" : "Sem risco climático previsto para as próximas horas",
  orientacao: "Siga a orientação.",
  causas: nivel === "extremo" ? ["trovoada"] : [],
  horas: [14, 15, 16, 17].map((h) => hora(h, nivel)),
  consultada_em: `${HOJE}T14:05:00-03:00`,
  fonte: "Open-Meteo",
  ...extra,
});

describe("Previsão do tempo — a cópia guardada para o modo sem sinal", () => {
  it("guarda a última previsão de cada janela e a devolve enquanto é de hoje e ainda tem horas pela frente", async () => {
    const banco = await novoBancoDeTeste();
    await guardarPrevisao(banco, previsaoDe("atencao"));
    await guardarPrevisao(banco, previsaoDe("sem_risco", { janela: "expediente" }));
    assert.equal((await lerPrevisaoGuardada(banco, "proximas_horas", AGORA))?.nivel, "atencao");
    assert.equal((await lerPrevisaoGuardada(banco, "expediente", AGORA))?.nivel, "sem_risco");
    assert.equal(chaveDaPrevisao("expediente"), "clima:expediente");
  });

  it("não serve a previsão de ontem, a que já passou toda, a indisponível, a estragada nem a que nunca houve", async () => {
    const banco = await novoBancoDeTeste();
    assert.equal(await lerPrevisaoGuardada(banco, "proximas_horas", AGORA), null, "nunca houve");

    await guardarPrevisao(banco, previsaoDe("atencao"));
    assert.equal(await lerPrevisaoGuardada(banco, "proximas_horas", new Date(`2026-10-22T07:00:00-03:00`)), null, "de ontem");
    assert.equal(await lerPrevisaoGuardada(banco, "proximas_horas", new Date(`${HOJE}T18:30:00-03:00`)), null, "as horas já passaram");
    assert.notEqual(await lerPrevisaoGuardada(banco, "proximas_horas", new Date(`${HOJE}T17:59:00-03:00`)), null, "a última hora (17h) ainda não terminou");

    await guardarPrevisao(banco, previsaoDe("atencao", { disponivel: false, nivel: null, horas: [], janela: "expediente" }));
    assert.equal(await lerPrevisaoGuardada(banco, "expediente", AGORA), null, "a indisponível nem é guardada");

    await banco.executar("INSERT INTO meta (chave, valor) VALUES (?, ?)", [chaveDaPrevisao("expediente"), "{não é json"]);
    assert.equal(await lerPrevisaoGuardada(banco, "expediente", AGORA), null, "texto estragado");
  });
});

describe("Previsão do tempo — de onde vem", () => {
  const montar = async (opcoes: { conexao?: "online" | "offline"; resposta?: PrevisaoDoTempo | Error } = {}) => {
    const banco = await novoBancoDeTeste();
    const consultas: Record<string, string | number>[] = [];
    const previsoes = criarPrevisoes({
      banco,
      buscar: async (consulta) => {
        consultas.push(consulta);
        const r = opcoes.resposta ?? previsaoDe("sem_risco");
        if (r instanceof Error) throw r;
        return r;
      },
      conexao: () => opcoes.conexao ?? "online",
      agora: () => AGORA,
    });
    return { banco, consultas, previsoes };
  };

  it("online pergunta à api (com a posição, se houver) e guarda a resposta", async () => {
    const { banco, consultas, previsoes } = await montar();
    const p = await previsoes.obter({ janela: "proximas_horas", posicao: { latitude: -20.31, longitude: -40.31 } });
    assert.equal(p?.nivel, "sem_risco");
    assert.deepEqual(consultas, [{ janela: "proximas_horas", latitude: -20.31, longitude: -40.31 }]);
    assert.equal((await lerPrevisaoGuardada(banco, "proximas_horas", AGORA))?.nivel, "sem_risco");
    assert.deepEqual(consultaDoClima({ janela: "expediente", posicao: null }), { janela: "expediente" }, "sem posição, a api usa a cidade padrão");
  });

  it("sem sinal, vale a guardada de hoje; sem nenhuma, não há previsão (e a api nem é chamada)", async () => {
    const { banco, consultas, previsoes } = await montar({ conexao: "offline" });
    assert.equal(await previsoes.obter({ janela: "proximas_horas" }), null);
    await guardarPrevisao(banco, previsaoDe("extremo"));
    assert.equal((await previsoes.obter({ janela: "proximas_horas" }))?.nivel, "extremo");
    assert.equal(consultas.length, 0);
  });

  it("a api fora do ar ou sem previsão cai para a guardada; sem guardada, não há previsão e nada é lançado", async () => {
    const fora = await montar({ resposta: new Error("rede") });
    assert.equal(await fora.previsoes.obter({ janela: "proximas_horas" }), null);
    await guardarPrevisao(fora.banco, previsaoDe("atencao"));
    assert.equal((await fora.previsoes.obter({ janela: "proximas_horas" }))?.nivel, "atencao");

    const semPrevisao = await montar({ resposta: previsaoDe("atencao", { disponivel: false, nivel: null, horas: [] }) });
    assert.equal(await semPrevisao.previsoes.obter({ janela: "proximas_horas" }), null);
    await guardarPrevisao(semPrevisao.banco, previsaoDe("extremo"));
    assert.equal((await semPrevisao.previsoes.obter({ janela: "proximas_horas" }))?.nivel, "extremo", "a guardada de hoje vale mais do que 'indisponível'");
  });
});

describe("Previsão do tempo — o que as telas desenham", () => {
  it("os chips das horas: até 6, espalhados, sempre com a primeira e a última", () => {
    const doze = Array.from({ length: 12 }, (_, i) => hora(6 + i));
    const chips = horasParaChips(doze);
    assert.equal(chips.length, 6);
    assert.equal(chips[0]!.hora.slice(11, 13), "06");
    assert.equal(chips.at(-1)!.hora.slice(11, 13), "17");
    assert.deepEqual(horasParaChips(doze.slice(0, 4)), doze.slice(0, 4));
  });

  it("o rótulo da hora, a atualização e o local, com o aviso de cidade padrão", () => {
    assert.equal(rotuloDaHora(hora(9)), "9h");
    assert.equal(textoDeAtualizacao(`${HOJE}T14:05:00-03:00`), "atualizada às 14:05");
    assert.equal(linhaDoLocal({ nome: "Vitória, ES", origem: "padrao" }, `${HOJE}T14:05:00-03:00`), "Vitória, ES (cidade padrão) · atualizada às 14:05");
    assert.equal(linhaDoLocal({ nome: "Sua localização", origem: "aparelho" }, `${HOJE}T14:05:00-03:00`), "Sua localização · atualizada às 14:05");
  });

  it("cada nível e cada ícone do clima têm a sua aparência (sem vermelho puro no extremo)", () => {
    assert.deepEqual(Object.keys(tomDoNivel).sort(), ["atencao", "extremo", "sem_risco"]);
    assert.notEqual(tomDoNivel.extremo.texto.toUpperCase(), "#FF0000");
    assert.deepEqual(Object.keys(iconeDoClima).sort(), ["chuva", "nevoeiro", "nuvem", "nuvem-sol", "sol", "trovoada"]);
  });
});

describe("Pergunta de clima da APR", () => {
  const modelo: ModeloDoRascunho = {
    id: "m1",
    codigo: "APR 01",
    versao: 1,
    titulo: "Trabalho externo",
    riscos: [],
    itens: [
      { id: "i1", secao: "verificacao", risco_id: null, ordem: 1, texto: "O veículo está em boas condições?", permite_na: false },
      { id: "i2", secao: "verificacao", risco_id: null, ordem: 2, texto: "As condições climáticas estão favoráveis?", permite_na: false, mostrar_clima: true },
    ],
  };
  const rascunho = (): RascunhoApr =>
    novoRascunho({ osId: "os-1", usuarioId: "u1", modelo, participantes: [{ usuarioId: "u1", funcao: "responsavel" }, { usuarioId: "u2", funcao: "executor" }], riscos: [] });
  const item = modelo.itens[1]!;
  const foto = (id = "f1"): FotoDoRascunho => ({ id, arquivoId: `arq-${id}`, capturadaEm: `${HOJE}T14:10:00-03:00`, latitude: -20.3, longitude: -40.3, miniatura: "file:///f.jpg" });

  it("só o 'Sim' na pergunta de clima, com previsão que aponta risco, pede algo; sem previsão ou sem risco segue direto", () => {
    assert.equal(exigenciaDaResposta(item, "sim", previsaoDe("sem_risco")), "nada");
    assert.equal(exigenciaDaResposta(item, "sim", previsaoDe("atencao")), "confirmar");
    assert.equal(exigenciaDaResposta(item, "sim", previsaoDe("extremo")), "confirmar_com_foto");
    assert.equal(exigenciaDaResposta(item, "nao", previsaoDe("extremo")), "nada");
    assert.equal(exigenciaDaResposta(item, "na", previsaoDe("extremo")), "nada");
    assert.equal(exigenciaDaResposta(modelo.itens[0]!, "sim", previsaoDe("extremo")), "nada", "outra pergunta nunca mostra o aviso");
    assert.equal(exigenciaDaResposta(item, "sim", null), "nada");
    assert.equal(exigenciaDaResposta(item, "sim", previsaoDe("extremo", { disponivel: false, nivel: null })), "nada");
  });

  it("no risco extremo, confirmar exige ao menos uma foto do local; na atenção, não", () => {
    assert.equal(podeConfirmar("confirmar_com_foto", 0), false);
    assert.equal(podeConfirmar("confirmar_com_foto", 1), true);
    assert.equal(podeConfirmar("confirmar", 0), true);
    assert.match(instrucaoDoModal("confirmar_com_foto"), /foto do local/);
    assert.doesNotMatch(`${instrucaoDoModal("confirmar")} ${instrucaoDoModal("confirmar_com_foto")}`, /eliminat|bloque/i, "o técnico não sabe o que bloqueia a APR");
  });

  it("acha a pergunta de clima do modelo (a que a APR faz)", () => {
    assert.equal(perguntaDeClima(rascunho())?.id, "i2");
    assert.equal(perguntaDeClima({ ...rascunho(), modelo: { ...modelo, itens: [modelo.itens[0]!] } }), undefined);
  });

  it("responder guarda a previsão que a pessoa viu, com a confirmação só quando confirmou", () => {
    const visto = responderClima(rascunho(), item, "sim", previsaoDe("sem_risco"));
    assert.equal(visto.respostas.i2?.resposta, "sim");
    assert.equal(climaVistoNoRascunho(visto)?.nivel, "sem_risco");
    assert.equal(climaVistoNoRascunho(visto)?.confirmou_apesar_do_aviso, undefined);

    const confirmado = responderClima(rascunho(), item, "sim", previsaoDe("extremo"), true);
    assert.equal(climaVistoNoRascunho(confirmado)?.nivel, "extremo");
    assert.equal(climaVistoNoRascunho(confirmado)?.confirmou_apesar_do_aviso, true);

    assert.equal(climaVistoNoRascunho(responderClima(rascunho(), item, "sim", null)), null, "sem previsão não há o que guardar");
  });

  it("trocar o 'Sim' por 'Não' descarta a confirmação e as fotos do local", () => {
    const confirmado = adicionarFoto(responderClima(rascunho(), item, "sim", previsaoDe("extremo"), true), "i2", foto());
    assert.equal(confirmado.fotos.i2?.length, 1);
    const trocado = responderClima(confirmado, item, "nao", previsaoDe("extremo"));
    assert.deepEqual(trocado.fotos.i2, []);
    assert.equal(climaVistoNoRascunho(trocado)?.confirmou_apesar_do_aviso, undefined);
    assert.deepEqual(evidenciasDoClima(trocado), []);
  });

  it("desistir da janela tira as fotos tiradas para ela, mas não as de uma confirmação anterior", () => {
    const soFoto = adicionarFoto(rascunho(), "i2", foto());
    assert.deepEqual(descartarFotosDoModal(soFoto, "i2").fotos.i2, []);
    const jaConfirmado = adicionarFoto(responderClima(rascunho(), item, "sim", previsaoDe("extremo"), true), "i2", foto());
    assert.equal(descartarFotosDoModal(jaConfirmado, "i2").fotos.i2?.length, 1);
  });

  it("o evento leva a previsão vista e a foto do local (que `montarPayload` não leva: o item não reprovou)", () => {
    const r = adicionarFoto(responderClima(responder(rascunho(), modelo.itens[0]!, "sim"), item, "sim", previsaoDe("extremo"), true), "i2", foto("f9"));
    assert.deepEqual(montarPayload(r).evidencias, [], "a foto de um item que não reprovou não vai no payload de sempre");
    const p = montarPayloadComClima({ ...r, concluidaEm: `${HOJE}T14:30:00-03:00` });
    assert.equal(p.clima?.nivel, "extremo");
    assert.equal(p.clima?.confirmou_apesar_do_aviso, true);
    assert.deepEqual(p.evidencias, [{ id: "f9", arquivo_id: "arq-f9", item_id: "i2", capturada_em: `${HOJE}T14:10:00-03:00`, latitude: -20.3, longitude: -40.3 }]);
    assert.equal(montarAvaliacaoComClima(r).clima?.nivel, "extremo");
    assert.equal("evidencias" in montarAvaliacaoComClima(r), false, "a avaliação não leva fotos");
  });

  it("sem previsão vista, o payload é o de sempre (sem `clima`, sem foto)", () => {
    const r = responder(responder(rascunho(), modelo.itens[0]!, "sim"), item, "sim");
    assert.deepEqual(montarPayloadComClima(r), montarPayload(r));
    assert.equal("clima" in montarPayloadComClima(r), false);
    assert.equal("clima" in montarAvaliacaoComClima(r), false);
  });

  it("a previsão vista sobrevive ao rascunho gravado e relido (JSON)", () => {
    const r = responderClima(rascunho(), item, "sim", previsaoDe("atencao"), true);
    const relido = JSON.parse(JSON.stringify(r)) as RascunhoApr;
    assert.equal(climaVistoNoRascunho(relido)?.nivel, "atencao");
  });
});

describe("Aviso de clima extremo no sino", () => {
  const aviso = { tipo: "clima_extremo", os_id: "os-1", destinatario_id: "sup", usuario_alvo_id: null, sugestao_id: null } as const;

  it("é um aviso de segurança (urgente), leva ao detalhe da OS e tem o ícone da tempestade", () => {
    assert.equal(alertaUrgente(aviso), true);
    assert.equal(destinoDoAvisoNoApp(aviso), "/os/os-1");
    assert.equal(iconeDoAviso(aviso as never, true), "thunderstorm-outline");
    assert.equal(ROTULO_DO_AVISO.clima_extremo, "Risco climático extremo na APR");
    assert.equal(CATEGORIA_DO_AVISO.clima_extremo, "seguranca", "vai por e-mail e não dá para desligar");
  });
});
