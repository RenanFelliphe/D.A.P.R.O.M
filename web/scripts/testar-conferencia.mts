// Confere as regras puras da tela da conferência da execução (`web/src/lib/conferencia.ts`): o que mostrar e habilitar por estado e por `eu`,
// sem servidor nem navegador.
//
//   cd api && node --import tsx --test ../web/scripts/testar-conferencia.mts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CampoDaConferencia, ConferenciaDaApi, ConferenciaDaOs } from "../../shared/api/conferencia-execucao";
import {
  acaoDaTela,
  assinaturaFinalEsperaConferencia,
  avisoDaConferenciaNaOs,
  camposParaEscolher,
  conferenciaAnda,
  conferenciaEmDestaque,
  conferenciaParaAbrir,
  escolhaEfetiva,
  escolhaValida,
  escolhasParaEnviar,
  etapasDaConferencia,
  pedeAtencaoNaFaixa,
  ressalvasDaConferencia,
  separarCampos,
  situacaoDoParticipante,
  textoDaEscolha,
} from "../src/lib/conferencia";

const ANA = "aaaaaaaa-0000-4000-8000-000000000001";
const BIA = "bbbbbbbb-0000-4000-8000-000000000002";

const campo = (nome: string, extra: Partial<CampoDaConferencia> = {}): CampoDaConferencia => ({
  campo: nome,
  rotulo: nome,
  decide: "responsavel",
  divergente: true,
  so_um: false,
  opcoes: [
    { autor_id: ANA, autor_nome: "Ana", instante: "2026-10-19T12:00:00.000Z", fim: null, texto: null, pausa_id: null },
    { autor_id: BIA, autor_nome: "Bia", instante: "2026-10-19T12:30:00.000Z", fim: null, texto: null, pausa_id: null },
  ],
  sugerido: ANA,
  valendo_de: null,
  ...extra,
});

function conferencia(extra: Partial<ConferenciaDaApi> = {}, eu: Partial<ConferenciaDaApi["eu"]> = {}): ConferenciaDaApi {
  return {
    id: "c1",
    execucao_id: "e1",
    os: { id: "o1", numero_ordem: "123", titulo: "Trocar rolamento" },
    estado: "aguardando_responsavel",
    tipo: "com_divergencia",
    criada_em: "2026-10-19T12:00:00.000Z",
    libera_fechar_em: "2026-10-22T12:00:00.000Z",
    limite_em: "2026-10-26T12:00:00.000Z",
    montada_em: null,
    responsavel: { id: ANA, nome: "Ana" },
    versoes: [],
    campos: [campo("inicio"), campo("fim", { divergente: false }), campo("resultado", { decide: "supervisor" })],
    decisoes: [],
    participantes: [],
    faltaram: null,
    fechada_em: null,
    fechada_por: null,
    eu: { participante: true, pode_decidir: [], deve_assinar: false, pode_fechar: false, ...eu },
    ...extra,
  };
}

describe("conferência: escolhas", () => {
  it("pré-marca o padrão sugerido, a escolha já gravada e depois a troca da pessoa, nesta ordem", () => {
    const inicio = campo("inicio");
    const c = conferencia({}, { pode_decidir: ["inicio"] });
    assert.equal(escolhaEfetiva(c, inicio, {}), ANA);
    assert.equal(escolhaEfetiva({ decisoes: [{ campo: "inicio", escolha: BIA, decidida_por: null, decidida_em: "x" }] }, inicio, {}), BIA);
    assert.equal(escolhaEfetiva({ decisoes: [{ campo: "inicio", escolha: BIA, decidida_por: null, decidida_em: "x" }] }, inicio, { inicio: ANA }), ANA);
  });

  it("só envia os campos que a pessoa decide, com a escolha marcada", () => {
    const c = conferencia({}, { pode_decidir: ["inicio", "fim"] });
    assert.deepEqual(camposParaEscolher(c).map((x) => x.campo), ["inicio", "fim"]);
    assert.deepEqual(escolhasParaEnviar(c, { fim: BIA }), [
      { campo: "inicio", escolha: ANA },
      { campo: "fim", escolha: BIA },
    ]);
    assert.deepEqual(escolhasParaEnviar(conferencia(), {}), []);
  });

  it("descartar só vale na pausa de um aparelho só", () => {
    const pausa = campo("pausa:0", { so_um: true, opcoes: [campo("x").opcoes[0]!], sugerido: ANA });
    assert.equal(escolhaValida(pausa, "descartar"), true);
    assert.equal(escolhaValida(pausa, ANA), true);
    assert.equal(escolhaValida(pausa, BIA), false);
    assert.equal(escolhaValida(campo("inicio"), "descartar"), false);
    const c = conferencia({ campos: [pausa] }, { pode_decidir: ["pausa:0"] });
    assert.deepEqual(escolhasParaEnviar(c, { "pausa:0": "descartar" }), [{ campo: "pausa:0", escolha: "descartar" }]);
    // uma escolha de quem não é opção do campo fica de fora do envio
    assert.deepEqual(escolhasParaEnviar(c, { "pausa:0": BIA }), []);
  });

  it("descreve a escolha na janela de confirmação", () => {
    const pausa = campo("pausa:0", { so_um: true, opcoes: [{ autor_id: ANA, autor_nome: "Ana", instante: "2026-10-19T15:00:00.000Z", fim: null, texto: "Almoço", pausa_id: "p" }] });
    assert.equal(textoDaEscolha(pausa, "descartar"), "Descartar a pausa");
    assert.match(textoDaEscolha(pausa, ANA), /^Aceitar a pausa \(Almoço, das /);
    assert.match(textoDaEscolha(campo("inicio"), BIA), /^Bia: /);
    assert.equal(textoDaEscolha(campo("inicio"), "ninguem"), "—");
  });

  it("separa o que diverge do que confere", () => {
    const { divergentes, conferem } = separarCampos(conferencia().campos);
    assert.deepEqual(divergentes.map((x) => x.campo), ["inicio", "resultado"]);
    assert.deepEqual(conferem.map((x) => x.campo), ["fim"]);
  });
});

describe("conferência: o que a tela põe em primeiro plano", () => {
  it("escolher vem antes de assinar e de fechar", () => {
    assert.equal(acaoDaTela(conferencia({}, { pode_decidir: ["inicio"], deve_assinar: true, pode_fechar: true })), "escolher");
  });

  it("dar ciência no resumo, assinar com divergência, só depois de comparar", () => {
    assert.equal(acaoDaTela(conferencia({ estado: "aguardando_assinaturas", tipo: "resumo" }, { deve_assinar: true })), "ciencia");
    assert.equal(acaoDaTela(conferencia({ estado: "aguardando_assinaturas", tipo: "com_divergencia" }, { deve_assinar: true })), "assinar");
    assert.equal(acaoDaTela(conferencia({ estado: "aguardando_sincronizacao", tipo: null }, { deve_assinar: true })), "acompanhar");
  });

  it("fechar com o que existe só aparece a quem a api libera, e depois de concluída nada mais anda", () => {
    assert.equal(acaoDaTela(conferencia({ estado: "aguardando_sincronizacao", tipo: null }, { pode_fechar: true })), "fechar");
    assert.equal(acaoDaTela(conferencia({ estado: "concluida" }, { pode_fechar: true, deve_assinar: true })), "acompanhar");
    assert.equal(conferenciaAnda({ estado: "concluida" }), false);
    assert.equal(conferenciaAnda({ estado: "fechada_sem_todos" }), false);
    assert.equal(conferenciaAnda({ estado: "aguardando_assinaturas" }), true);
  });

  it("a trilha marca o passo atual e os feitos", () => {
    const situacoes = (c: Parameters<typeof etapasDaConferencia>[0]) => etapasDaConferencia(c).map((e) => e.situacao);
    assert.deepEqual(situacoes({ estado: "aguardando_sincronizacao", tipo: null }), ["atual", "futura", "futura", "futura"]);
    assert.deepEqual(situacoes({ estado: "aguardando_responsavel", tipo: "com_divergencia" }), ["feita", "atual", "futura", "futura"]);
    assert.deepEqual(situacoes({ estado: "aguardando_assinaturas", tipo: "resumo" }), ["feita", "feita", "atual", "futura"]);
    assert.deepEqual(situacoes({ estado: "concluida", tipo: "resumo" }), ["feita", "feita", "feita", "feita"]);
    assert.equal(etapasDaConferencia({ estado: "fechada_sem_todos", tipo: "com_divergencia" }).at(-1)?.rotulo, "Fechada");
  });
});

describe("conferência: a OS", () => {
  const lista = (...estados: ConferenciaDaOs["estado"][]): ConferenciaDaOs[] => estados.map((estado, i) => ({ id: `c${i}`, execucao_id: `e${i}`, estado, tipo: null }));

  it("abre a pedida, ou a em aberto mais nova, ou a mais recente", () => {
    assert.equal(conferenciaParaAbrir(lista("concluida", "aguardando_assinaturas"), "c0")?.id, "c0");
    assert.equal(conferenciaParaAbrir(lista("concluida", "aguardando_assinaturas", "concluida"))?.id, "c1");
    assert.equal(conferenciaParaAbrir(lista("concluida", "fechada_sem_todos"))?.id, "c1");
    assert.equal(conferenciaParaAbrir(lista("concluida"), "de-outra-os")?.id, "c0");
    assert.equal(conferenciaParaAbrir([]), null);
    assert.equal(conferenciaEmDestaque([]), null);
  });

  it("o aviso da OS: nenhum sem conferência, um por estado com ela", () => {
    assert.equal(avisoDaConferenciaNaOs([]), null);
    assert.equal(avisoDaConferenciaNaOs(undefined), null);
    assert.equal(avisoDaConferenciaNaOs(lista("aguardando_sincronizacao"))?.tom, "al");
    assert.equal(avisoDaConferenciaNaOs(lista("aguardando_assinaturas"))?.tom, "info");
    assert.equal(avisoDaConferenciaNaOs(lista("concluida"))?.tom, "ok");
    assert.equal(avisoDaConferenciaNaOs(lista("concluida", "aguardando_responsavel"))?.conferenciaId, "c1");
  });

  it("a assinatura final do supervisor espera enquanto as versões não foram conferidas", () => {
    assert.equal(assinaturaFinalEsperaConferencia(undefined), false);
    assert.equal(assinaturaFinalEsperaConferencia(lista("aguardando_sincronizacao")), true);
    assert.equal(assinaturaFinalEsperaConferencia(lista("aguardando_responsavel")), true);
    assert.equal(assinaturaFinalEsperaConferencia(lista("aguardando_assinaturas")), false);
    assert.equal(assinaturaFinalEsperaConferencia(lista("concluida", "fechada_sem_todos")), false);
  });

  it("a faixa chama a atenção só de quem precisa escolher, dar ciência ou assinar", () => {
    assert.equal(pedeAtencaoNaFaixa({ minha_acao: "decidir" }), true);
    assert.equal(pedeAtencaoNaFaixa({ minha_acao: "ciencia" }), true);
    assert.equal(pedeAtencaoNaFaixa({ minha_acao: "assinar" }), true);
    assert.equal(pedeAtencaoNaFaixa({ minha_acao: "fechar" }), false);
    assert.equal(pedeAtencaoNaFaixa({ minha_acao: "aguardar" }), false);
  });
});

describe("conferência: a equipe", () => {
  const participante = (id: string, nome: string, extra: Partial<ConferenciaDaApi["participantes"][number]> = {}): ConferenciaDaApi["participantes"][number] => ({
    usuario: { id, nome },
    sincronizou: true,
    deve_assinar: true,
    assinatura: null,
    ...extra,
  });

  it("diz de cada um se sincronizou e o que já deu", () => {
    assert.equal(situacaoDoParticipante(participante(ANA, "Ana"), ANA).assinatura, "Responsável pela conferência");
    assert.equal(situacaoDoParticipante(participante(BIA, "Bia", { sincronizou: false }), ANA).sincronia, "Falta sincronizar");
    assert.equal(situacaoDoParticipante(participante(BIA, "Bia"), ANA).assinatura, "Falta a ciência ou assinatura");
    const ciencia = { tipo: "ciencia", ressalva: null, assinada_em: "2026-10-20T10:00:00.000Z" } as const;
    assert.equal(situacaoDoParticipante(participante(BIA, "Bia", { assinatura: ciencia }), ANA).assinatura, "Deu ciência");
    assert.equal(situacaoDoParticipante(participante(BIA, "Bia", { assinatura: { ...ciencia, tipo: "assinatura", ressalva: "discordo" } }), ANA).assinatura, "Assinou com ressalva");
  });

  it("junta as ressalvas de quem assinou", () => {
    const c = conferencia({
      participantes: [
        participante(ANA, "Ana", { deve_assinar: false }),
        participante(BIA, "Bia", { assinatura: { tipo: "assinatura", ressalva: "a pausa foi maior", assinada_em: "2026-10-20T10:00:00.000Z" } }),
      ],
    });
    assert.deepEqual(ressalvasDaConferencia(c), [{ nome: "Bia", ressalva: "a pausa foi maior", quando: "2026-10-20T10:00:00.000Z" }]);
  });
});
