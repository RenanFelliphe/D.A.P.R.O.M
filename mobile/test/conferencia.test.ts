import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Alerta } from "@shared/api/alertas";
import { ESCOLHA_DESCARTAR, type CampoDaConferencia, type ConferenciaDaApi, type ConferenciaResumo } from "@shared/api/conferencia-execucao";
import { destinoDoAvisoNoApp } from "../src/avisos/destino";
import { guardarQueViAExplicacao, jaViAExplicacao } from "../src/conferencia/ja-vi";
import {
  avisoDaConferenciaNaOs,
  camposParaEscolher,
  conferenciaPadrao,
  corpoDeAssinar,
  corpoDeDecidir,
  descricaoDoResumo,
  diferencasSemEscolha,
  escolhaFeita,
  escolhasIniciais,
  escolhaValida,
  faixaDeConferencia,
  opcoesParaEscolher,
  resumoDaEscolha,
  rotuloDoBotaoDeAssinar,
  situacaoDoCampo,
  textosDeAssinar,
  tomDoPasso,
} from "../src/conferencia/regras";
import { rotaDaAcao, rotas } from "../src/os/rotas";
import { novoBancoDeTeste } from "./ajuda-offline";

const TIAGO = "u-tiago";
const CARLA = "u-carla";
const T0 = new Date("2026-10-19T12:00:00Z");
const minuto = (n: number) => new Date(T0.getTime() + n * 60_000).toISOString();

const campo = (extra: Partial<CampoDaConferencia>): CampoDaConferencia => ({
  campo: "inicio",
  rotulo: "Início",
  decide: "responsavel",
  divergente: true,
  so_um: false,
  opcoes: [
    { autor_id: TIAGO, autor_nome: "Tiago Técnico", instante: minuto(0), fim: null, texto: null, pausa_id: null },
    { autor_id: CARLA, autor_nome: "Carla Colega", instante: minuto(10), fim: null, texto: null, pausa_id: null },
  ],
  sugerido: TIAGO,
  valendo_de: CARLA,
  ...extra,
});

const pausaDeUm = campo({
  campo: "pausa:2",
  rotulo: "Pausa 2",
  so_um: true,
  opcoes: [{ autor_id: CARLA, autor_nome: "Carla Colega", instante: minuto(60), fim: minuto(90), texto: "Almoço", pausa_id: "p-1" }],
  sugerido: CARLA,
});

function conferencia(extra: Partial<ConferenciaDaApi> = {}): ConferenciaDaApi {
  return {
    id: "c-1",
    execucao_id: "ex-1",
    os: { id: "os-1", numero_ordem: "4031187", titulo: "Trocar a bomba" },
    estado: "aguardando_responsavel",
    tipo: "com_divergencia",
    criada_em: minuto(0),
    libera_fechar_em: minuto(72 * 60),
    limite_em: minuto(7 * 24 * 60),
    montada_em: minuto(5),
    responsavel: { id: TIAGO, nome: "Tiago Técnico" },
    versoes: [
      { autor_id: TIAGO, autor_nome: "Tiago Técnico", inicio: minuto(0), fim: minuto(150), resultado: "encerrada", motivo: null, complemento: null, pausas: [], evidencias: 0, sem_sinal: true },
      { autor_id: CARLA, autor_nome: "Carla Colega", inicio: minuto(10), fim: minuto(170), resultado: "encerrada", motivo: null, complemento: null, pausas: [], evidencias: 1, sem_sinal: true },
    ],
    campos: [campo({}), campo({ campo: "fim", rotulo: "Fim" }), campo({ campo: "resultado", rotulo: "Resultado", divergente: false, decide: "supervisor" }), pausaDeUm],
    decisoes: [],
    participantes: [],
    faltaram: null,
    fechada_em: null,
    fechada_por: null,
    eu: { participante: true, pode_decidir: ["inicio", "fim", "pausa:2"], deve_assinar: false, pode_fechar: false },
    ...extra,
  };
}

describe("a conferência da execução no app: as escolhas do responsável", () => {
  it("vêm pré-marcadas com o padrão sugerido, só nos campos que a pessoa decide e que divergem", () => {
    assert.deepEqual(escolhasIniciais(conferencia()), { inicio: TIAGO, fim: TIAGO, "pausa:2": CARLA });
    const soOInicio = conferencia({ eu: { participante: true, pode_decidir: ["inicio", "resultado"], deve_assinar: false, pode_fechar: false } });
    assert.deepEqual(camposParaEscolher(soOInicio).map((c) => c.campo), ["inicio"], "o resultado não diverge: não há o que escolher");
    assert.deepEqual(escolhasIniciais(soOInicio), { inicio: TIAGO });
    assert.deepEqual(escolhasIniciais(conferencia({ eu: { participante: true, pode_decidir: [], deve_assinar: true, pode_fechar: false } })), {});
  });

  it("se o sugerido não for uma das versões, cai na primeira", () => {
    const c = conferencia({ campos: [campo({ sugerido: "alguem-que-nao-registrou" })] });
    assert.deepEqual(escolhasIniciais(c), { inicio: TIAGO });
  });

  it("cada campo oferece uma opção por aparelho; a pausa de um aparelho só oferece aceitar e descartar", () => {
    const c = conferencia();
    const inicio = opcoesParaEscolher(c, c.campos[0]!);
    assert.deepEqual(inicio.map((o) => [o.valor, o.rotulo, o.sugerida, o.valendo]), [
      [TIAGO, "Valer o de Tiago Técnico", true, false],
      [CARLA, "Valer o de Carla Colega", false, true],
    ]);
    assert.match(inicio[0]!.detalhe, /^Tiago Técnico: 19\/10\/2026 09:00$/);
    const pausa = opcoesParaEscolher(c, pausaDeUm);
    assert.deepEqual(pausa.map((o) => [o.valor, o.rotulo]), [[CARLA, "Aceitar a pausa"], [ESCOLHA_DESCARTAR, "Descartar a pausa"]]);
    assert.match(pausa[0]!.detalhe, /^Almoço, das 10:00 às 10:30$/);
  });

  it("descartar só vale na pausa de um aparelho só; uma versão que ninguém registrou não vale", () => {
    assert.equal(escolhaValida(pausaDeUm, ESCOLHA_DESCARTAR), true);
    assert.equal(escolhaValida(campo({}), ESCOLHA_DESCARTAR), false);
    assert.equal(escolhaValida(campo({}), "u-qualquer"), false);
    assert.equal(escolhaValida(campo({}), CARLA), true);
  });

  it("o corpo do POST /decidir leva uma escolha por campo da pessoa: o que ela mexeu e, no resto, o sugerido", () => {
    const c = conferencia();
    assert.deepEqual(corpoDeDecidir(c, {}), {
      escolhas: [
        { campo: "inicio", escolha: TIAGO },
        { campo: "fim", escolha: TIAGO },
        { campo: "pausa:2", escolha: CARLA },
      ],
    });
    const mexida = corpoDeDecidir(c, { ...escolhasIniciais(c), inicio: CARLA, "pausa:2": ESCOLHA_DESCARTAR });
    assert.deepEqual(mexida.escolhas, [
      { campo: "inicio", escolha: CARLA },
      { campo: "fim", escolha: TIAGO },
      { campo: "pausa:2", escolha: ESCOLHA_DESCARTAR },
    ]);
  });

  it("uma escolha que não serve para o campo (descartar fora da pausa, versão desconhecida, campo que a pessoa não decide) é ignorada", () => {
    const corpo = corpoDeDecidir(conferencia(), { inicio: ESCOLHA_DESCARTAR, fim: "u-qualquer", resultado: TIAGO });
    assert.deepEqual(corpo.escolhas, [
      { campo: "inicio", escolha: TIAGO },
      { campo: "fim", escolha: TIAGO },
      { campo: "pausa:2", escolha: CARLA },
    ]);
    assert.ok(!corpo.escolhas.some((e) => e.campo === "resultado"));
  });

  it("resume cada escolha para a janela de confirmação", () => {
    const c = conferencia();
    assert.equal(resumoDaEscolha(c.campos[0]!, CARLA), "Valer o de Carla Colega (19/10/2026 09:10)");
    assert.equal(resumoDaEscolha(pausaDeUm, ESCOLHA_DESCARTAR), "Descartar a pausa");
    assert.match(resumoDaEscolha(pausaDeUm, CARLA), /^Aceitar a pausa \(Almoço, das /);
  });
});

describe("a conferência da execução no app: o que cada campo mostra", () => {
  it("em que pé está o campo para quem olha", () => {
    const c = conferencia({ decisoes: [{ campo: "fim", escolha: TIAGO, decidida_por: { id: TIAGO, nome: "Tiago Técnico" }, decidida_em: minuto(200) }] });
    assert.equal(situacaoDoCampo(c, c.campos[0]!), "para_mim");
    assert.equal(situacaoDoCampo(c, c.campos[1]!), "decidido");
    assert.equal(situacaoDoCampo(c, c.campos[2]!), "sem_divergencia");
    const colega = conferencia({ eu: { participante: true, pode_decidir: [], deve_assinar: false, pode_fechar: false } });
    assert.equal(situacaoDoCampo(colega, colega.campos[0]!), "esperando_outro");
  });

  it("a escolha feita mostra quem escolheu e se a pausa foi descartada", () => {
    const c = conferencia({
      decisoes: [
        { campo: "inicio", escolha: TIAGO, decidida_por: { id: TIAGO, nome: "Tiago Técnico" }, decidida_em: minuto(200) },
        { campo: "pausa:2", escolha: ESCOLHA_DESCARTAR, decidida_por: null, decidida_em: minuto(200) },
      ],
    });
    assert.deepEqual(escolhaFeita(c, "inicio"), { escolha: TIAGO, porNome: "Tiago Técnico", descartada: false });
    assert.deepEqual(escolhaFeita(c, "pausa:2"), { escolha: ESCOLHA_DESCARTAR, porNome: null, descartada: true });
    assert.equal(escolhaFeita(c, "fim"), null);
    assert.equal(diferencasSemEscolha(c), 1, "só o fim ainda espera (o resultado não diverge)");
  });

  it("o tom do passo: pede a vez da pessoa (amarelo), só espera (azul), terminou (verde)", () => {
    assert.equal(tomDoPasso(conferencia()), "al");
    assert.equal(tomDoPasso(conferencia({ eu: { participante: true, pode_decidir: [], deve_assinar: false, pode_fechar: false } })), "info");
    assert.equal(tomDoPasso(conferencia({ estado: "aguardando_assinaturas", eu: { participante: true, pode_decidir: [], deve_assinar: true, pode_fechar: false } })), "al");
    assert.equal(tomDoPasso(conferencia({ estado: "concluida" })), "ok");
    assert.equal(tomDoPasso(conferencia({ estado: "fechada_sem_todos" })), "info");
  });
});

describe("a conferência da execução no app: assinar e a conferência que a tela abre", () => {
  it("ciência no resumo e assinatura com divergência; a ressalva só vai se foi escrita", () => {
    assert.equal(textosDeAssinar("resumo").botao, "Dar ciência");
    assert.equal(textosDeAssinar("com_divergencia").botao, "Assinar");
    assert.deepEqual(corpoDeAssinar("   "), {});
    assert.deepEqual(corpoDeAssinar("  Cheguei depois do almoço.  "), { ressalva: "Cheguei depois do almoço." });
    assert.equal(rotuloDoBotaoDeAssinar("com_divergencia", ""), "Assinar");
    assert.equal(rotuloDoBotaoDeAssinar("com_divergencia", "não vi a pausa"), "Assinar com ressalva");
    assert.equal(rotuloDoBotaoDeAssinar("resumo", "algo"), "Dar ciência");
  });

  it("sem dizer qual, a tela abre a conferência mais recente que ainda anda; sem nenhuma andando, a mais recente", () => {
    const a = { id: "a", execucao_id: "e1", estado: "aguardando_assinaturas", tipo: "resumo" } as const;
    const b = { id: "b", execucao_id: "e2", estado: "concluida", tipo: "resumo" } as const;
    const c = { id: "c", execucao_id: "e3", estado: "aguardando_responsavel", tipo: "com_divergencia" } as const;
    assert.equal(conferenciaPadrao([a, b, c])?.id, "c");
    assert.equal(conferenciaPadrao([a, b])?.id, "a");
    assert.equal(conferenciaPadrao([b])?.id, "b");
    assert.equal(conferenciaPadrao([]), null);
    assert.equal(conferenciaPadrao(undefined), null);
  });

  it("o aviso na OS tem um texto para cada estado", () => {
    const estados = ["aguardando_sincronizacao", "aguardando_responsavel", "aguardando_assinaturas", "concluida", "fechada_sem_todos"] as const;
    for (const estado of estados) {
      const a = avisoDaConferenciaNaOs({ id: "c", execucao_id: "e", estado, tipo: "com_divergencia" });
      assert.match(a.titulo, /^Conferência da execução: /);
      assert.ok(a.texto.length > 20);
    }
  });
});

describe("a conferência da execução no app: a faixa e o cartão do perfil", () => {
  const resumo = (extra: Partial<ConferenciaResumo>): ConferenciaResumo => ({
    id: "c-1",
    execucao_id: "ex-1",
    os: { id: "os-1", numero_ordem: "4031187", titulo: "Trocar a bomba" },
    estado: "aguardando_responsavel",
    tipo: "com_divergencia",
    criada_em: minuto(0),
    limite_em: minuto(7 * 24 * 60),
    minha_acao: "decidir",
    ...extra,
  });

  it("a faixa só aparece quando a pessoa precisa escolher, dar a ciência ou assinar", () => {
    assert.equal(faixaDeConferencia(undefined), null);
    assert.equal(faixaDeConferencia([]), null);
    assert.equal(faixaDeConferencia([resumo({ minha_acao: "aguardar" }), resumo({ id: "c-2", minha_acao: "fechar" })]), null);
    assert.match(faixaDeConferencia([resumo({})])!.titulo, /escolher a versão certa da execução/);
    assert.match(faixaDeConferencia([resumo({ minha_acao: "ciencia", tipo: "resumo", estado: "aguardando_assinaturas" })])!.titulo, /dar a ciência/);
    assert.match(faixaDeConferencia([resumo({ minha_acao: "assinar", estado: "aguardando_assinaturas" })])!.titulo, /assinar a conferência/);
  });

  it("com mais de uma, a faixa abre a primeira e conta as outras", () => {
    const f = faixaDeConferencia([resumo({ id: "c-1" }), resumo({ id: "c-2", minha_acao: "assinar" })])!;
    assert.equal(f.conferencia.id, "c-1");
    assert.match(f.titulo, /\(e mais 1\)/);
    assert.match(f.texto, /OS 4031187/);
  });

  it("a linha do cartão diz o estado e o tipo", () => {
    assert.equal(descricaoDoResumo(resumo({})), "Esperando a escolha do responsável · Com divergência");
    assert.equal(descricaoDoResumo(resumo({ tipo: null, estado: "aguardando_sincronizacao" })), "Esperando todos sincronizarem");
  });
});

describe("a conferência da execução no app: rotas e avisos", () => {
  it("a rota da conferência leva o id da conferência quando se sabe qual", () => {
    assert.equal(rotas.conferencia("os-1"), "/os/os-1/conferencia");
    assert.equal(rotas.conferencia("os-1", "c-9"), "/os/os-1/conferencia?c=c-9");
    assert.equal(rotaDaAcao("abrir-conferencia", "os-1", "c-9"), "/os/os-1/conferencia?c=c-9");
    assert.equal(rotaDaAcao("abrir-conferencia", "os-1"), "/os/os-1/conferencia");
  });

  it("os seis avisos novos levam à conferência da OS, e não ao detalhe", () => {
    const aviso = (tipo: Alerta["tipo"], osId: string | null = "os-1") => ({ tipo, os_id: osId, destinatario_id: "u1", usuario_alvo_id: null, sugestao_id: null });
    for (const tipo of ["conferencia_aberta", "conferencia_cobranca", "conferencia_para_decidir", "conferencia_para_assinar", "conferencia_ressalva", "conferencia_tempo_esgotado"] as const) {
      assert.equal(destinoDoAvisoNoApp(aviso(tipo)), "/os/os-1/conferencia", tipo);
    }
    assert.equal(destinoDoAvisoNoApp(aviso("conferencia_aberta", null)), null);
    assert.equal(destinoDoAvisoNoApp(aviso("bloqueio")), "/os/os-1", "os outros avisos de OS seguem para o detalhe");
  });
});

describe("a conferência da execução no app: a Vitória explica só na primeira vez", () => {
  it("guarda o 'já vi' por pessoa, no SQLite do aparelho", async () => {
    const banco = await novoBancoDeTeste();
    assert.equal(await jaViAExplicacao(banco, TIAGO), false);
    await guardarQueViAExplicacao(banco, TIAGO, T0);
    assert.equal(await jaViAExplicacao(banco, TIAGO), true);
    assert.equal(await jaViAExplicacao(banco, CARLA), false, "quem divide o aparelho vê a explicação na própria conta");
    await guardarQueViAExplicacao(banco, TIAGO, T0);
    assert.equal(await jaViAExplicacao(banco, TIAGO), true, "guardar de novo não quebra");
  });

  it("sem o armazenamento, nada quebra: ler diz 'já vi' (não repete a cada abertura) e gravar não lança", async () => {
    const quebrado = {
      executar: async () => {
        throw new Error("banco fechado");
      },
      todos: async () => {
        throw new Error("banco fechado");
      },
      um: async () => {
        throw new Error("banco fechado");
      },
    };
    assert.equal(await jaViAExplicacao(quebrado, TIAGO), true);
    await assert.doesNotReject(guardarQueViAExplicacao(quebrado, TIAGO, T0));
  });
});
