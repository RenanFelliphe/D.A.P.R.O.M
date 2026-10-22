import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { exigenciaDoClima, registrarClima, type PrevisaoDoTempo } from "../../shared/api/clima";
import { itemModeloApr, localInstalacao, modeloApr, os } from "../src/db/schema";
import { descreverJanela, horasDaJanela, limparCacheDoClima } from "../src/dominio/clima";
import type { HoraBruta } from "../src/servicos/clima";
import { gerarRelatorioDaExecucao } from "../src/servicos/relatorio-execucao";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { ajudaDeExecucao } from "./ajuda-execucao";

/**
 * A previsão do tempo (`docs/operacao-de-campo.md`, seção 4.7): a classificação do risco e as frases, `GET /clima` com o provedor trocado por uma
 * versão em memória, a pergunta de clima da APR (aviso, foto no risco extremo e aviso na hora ao supervisor) e o clima do
 * encerramento no relatório do supervisor.
 */

const DIA = "2026-10-21";
const hora = (h: number, campos: Partial<HoraBruta> = {}): HoraBruta => ({
  hora: `${DIA}T${String(h).padStart(2, "0")}:00`,
  temperatura: 26,
  sensacao: 27,
  chanceChuva: 5,
  chuvaMm: 0,
  rajadaKmh: 15,
  indiceUv: 4,
  codigo: 1,
  ...campos,
});
/** O dia inteiro de céu limpo, com as horas de `mudar` trocadas. */
const diaTodo = (mudar: Record<number, Partial<HoraBruta>> = {}) => Array.from({ length: 24 }, (_, h) => hora(h, mudar[h]));

describe("Previsão do tempo — classificação e frases", () => {
  it("céu limpo é sem risco, nas duas janelas, com a frase de 'nenhuma situação de risco'", () => {
    const horas = diaTodo().filter((h) => Number(h.hora.slice(11, 13)) >= 8 && Number(h.hora.slice(11, 13)) <= 17);
    const e = descreverJanela(horas, "expediente");
    assert.equal(e.nivel, "sem_risco");
    assert.match(e.orientacao, /Não há situação climática de risco/);
    assert.equal(descreverJanela(horas, "proximas_horas").nivel, "sem_risco");
  });

  it("trovoada é extremo e manda não iniciar o serviço externo, com a faixa de horas", () => {
    const horas = [13, 14, 15, 16].map((h) => hora(h, { codigo: 95, chuvaMm: 4, chanceChuva: 90 }));
    const d = descreverJanela(horas, "expediente");
    assert.equal(d.nivel, "extremo");
    assert.equal(d.titulo, "Trovoada prevista das 13h às 17h");
    assert.match(d.orientacao, /Não inicie serviços externos/);
    assert.equal(d.causas[0], "trovoada");
  });

  it("rajada de 60 km/h ou mais, e chuva de 10 mm/h ou mais, são extremo; 40 km/h e 2,5 mm/h, atenção", () => {
    assert.equal(descreverJanela([hora(10, { rajadaKmh: 62 })], "proximas_horas").nivel, "extremo");
    assert.equal(descreverJanela([hora(10, { chuvaMm: 10, chanceChuva: 100, codigo: 65 })], "proximas_horas").nivel, "extremo");
    assert.equal(descreverJanela([hora(10, { rajadaKmh: 42 })], "proximas_horas").nivel, "atencao");
    assert.equal(descreverJanela([hora(10, { chuvaMm: 3, chanceChuva: 50, codigo: 61 })], "proximas_horas").nivel, "atencao");
    assert.equal(descreverJanela([hora(10, { chanceChuva: 70 })], "proximas_horas").nivel, "atencao");
    assert.equal(descreverJanela([hora(10, { sensacao: 37 })], "proximas_horas").nivel, "atencao");
    assert.equal(descreverJanela([hora(10, { indiceUv: 9 })], "proximas_horas").nivel, "atencao");
    assert.equal(descreverJanela([hora(10, { rajadaKmh: 39, chuvaMm: 2, chanceChuva: 59, sensacao: 34, indiceUv: 7 })], "proximas_horas").nivel, "sem_risco");
  });

  it("o nível da janela é o da pior hora, e a frase fala da causa mais grave (a outra entra como segunda dica)", () => {
    const d = descreverJanela([hora(9, { chanceChuva: 70 }), hora(10, { rajadaKmh: 65 }), hora(11, { rajadaKmh: 66 })], "expediente");
    assert.equal(d.nivel, "extremo");
    assert.match(d.titulo, /Rajadas de vento de até 66 km\/h previstas das 10h às 12h/);
    assert.match(d.orientacao, /Não faça trabalho em altura/);
    assert.match(d.orientacao, /capa e bota de PVC/);
  });

  it("a janela do expediente vai da hora atual até as 17h (nunca antes das 6h); passado das 17h, as próximas 4 horas", () => {
    const dia = diaTodo();
    const horasDe = (h: HoraBruta[]) => h.map((x) => Number(x.hora.slice(11, 13)));
    assert.deepEqual(horasDe(horasDaJanela(dia, "expediente", new Date(`${DIA}T14:20:00-03:00`))), [14, 15, 16, 17]);
    assert.deepEqual(horasDe(horasDaJanela(dia, "expediente", new Date(`${DIA}T03:00:00-03:00`))), [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]);
    assert.deepEqual(horasDe(horasDaJanela(dia, "expediente", new Date(`${DIA}T18:30:00-03:00`))), [18, 19, 20, 21]);
    assert.deepEqual(horasDe(horasDaJanela(dia, "proximas_horas", new Date(`${DIA}T09:05:00-03:00`))), [9, 10, 11, 12]);
    assert.deepEqual(horasDe(horasDaJanela(dia, "proximas_horas", new Date(`${DIA}T22:30:00-03:00`))), [22, 23]);
  });

  it("o que a tela faz com a resposta 'Sim': nada, confirmar, ou confirmar com a foto (só no extremo); sem previsão não exige nada", () => {
    const p = (nivel: PrevisaoDoTempo["nivel"], disponivel = true) => ({ disponivel, nivel });
    assert.equal(exigenciaDoClima(p("sem_risco")), "nada");
    assert.equal(exigenciaDoClima(p("atencao")), "confirmar");
    assert.equal(exigenciaDoClima(p("extremo")), "confirmar_com_foto");
    assert.equal(exigenciaDoClima(p(null, false)), "nada");
    assert.equal(exigenciaDoClima(null), "nada");
    assert.equal(registrarClima(null), null);
  });
});

describe("Previsão do tempo — GET /clima, a APR e o relatório", () => {
  let amb: Ambiente;
  let h: ReturnType<typeof ajudaDeExecucao>;
  let admin: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let equipeId: string;
  let modelo: { id: string; itens: (typeof itemModeloApr.$inferSelect)[] };
  let localId: string;
  let contadorOs = 6000000;

  before(async () => {
    amb = await criarAmbiente({ comCarga: true, relogio: new Date(`${DIA}T14:00:00-03:00`) });
    h = ajudaDeExecucao(amb);
    admin = await amb.criarUsuario({ perfil: "admin" });
    supervisor = await amb.criarUsuario({ perfil: "tecnico" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
    modelo = { id: m!.id, itens: await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, m!.id)) };
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "VILA VELHA/REDE" }).returning({ id: localInstalacao.id })) as [{ id: string }];
  });
  after(() => amb.fechar());

  /** Programa as horas do provedor e esquece o cache (a previsão guardada de um teste não vale no outro). */
  const programar = (horas: HoraBruta[]) => {
    amb.clima.horas = horas;
    limparCacheDoClima(amb.clima);
  };
  const clima = (consulta: Record<string, string | number> = {}, como: UsuarioDeTeste = tecnico) => amb.esperar(200, "GET", "/clima", { como, consulta }) as Promise<PrevisaoDoTempo>;

  it("sem risco: devolve as horas da janela, o nível e a orientação; usa a cidade padrão (Vitória) sem a posição do aparelho", async () => {
    programar(diaTodo());
    const p = await clima();
    assert.equal(p.disponivel, true);
    assert.equal(p.nivel, "sem_risco");
    assert.equal(p.janela, "proximas_horas");
    assert.deepEqual(p.horas.map((x) => x.hora.slice(11, 13)), ["14", "15", "16", "17"]);
    assert.equal(p.local.origem, "padrao");
    assert.match(p.local.nome, /Vitória/);
    assert.equal(p.horas[0]!.icone, "sol");
  });

  it("com a posição do aparelho: usa essa posição (arredondada) e diz que veio do aparelho; só a latitude é recusada", async () => {
    programar(diaTodo({ 16: { codigo: 63, chuvaMm: 4, chanceChuva: 80 } }));
    amb.clima.consultas.length = 0;
    const p = await clima({ latitude: -20.64213, longitude: -40.47821, janela: "expediente" });
    assert.equal(p.local.origem, "aparelho");
    assert.equal(p.nivel, "atencao");
    assert.match(p.titulo, /Chuva prevista por volta das 16h/);
    assert.deepEqual(amb.clima.consultas.at(-1), { latitude: -20.6, longitude: -40.5, dia: DIA });
    assert.equal((await amb.req("GET", "/clima", { como: tecnico, consulta: { latitude: -20.3 } })).status, 422);
    assert.equal((await amb.req("GET", "/clima")).status, 401);
  });

  it("guarda em cache por quadrado de 0,1° (uma consulta ao provedor para vários pedidos) e, com o provedor fora do ar, usa a previsão guardada", async () => {
    programar(diaTodo({ 15: { codigo: 95 } }));
    amb.clima.consultas.length = 0;
    await clima({ latitude: -19.39, longitude: -40.07 });
    await clima({ latitude: -19.41, longitude: -40.06 });
    assert.equal(amb.clima.consultas.length, 1);
    // Meia hora depois o cache vence; o provedor caiu, mas a previsão antiga do dia ainda vale.
    amb.relogio.agora = new Date(amb.relogio.agora.getTime() + 31 * 60_000);
    amb.clima.falhar = true;
    const antiga = await clima({ latitude: -19.39, longitude: -40.07 });
    assert.equal(antiga.disponivel, true);
    assert.equal(antiga.nivel, "extremo");
    amb.clima.falhar = false;
    amb.relogio.agora = new Date(`${DIA}T14:00:00-03:00`);
  });

  it("provedor fora do ar e sem previsão guardada: 'indisponível', sem nível, sem erro (nada é avisado nem bloqueado)", async () => {
    programar(diaTodo());
    amb.clima.falhar = true;
    const p = await clima({ latitude: -22.9, longitude: -43.2 });
    amb.clima.falhar = false;
    assert.equal(p.disponivel, false);
    assert.equal(p.nivel, null);
    assert.deepEqual(p.horas, []);
    assert.equal(exigenciaDoClima(p), "nada");
  });

  async function novaOs() {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "DCV Desobstrução", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-21", origem: "sap" })
      .returning();
    return o!;
  }
  const itemDeClima = () => modelo.itens.find((i) => i.mostrarClima)!;

  it("a pergunta de clima dos modelos já vem marcada para mostrar a previsão (migração e carga inicial)", async () => {
    const marcadas = modelo.itens.filter((i) => i.mostrarClima);
    assert.equal(marcadas.length, 1);
    assert.match(marcadas[0]!.texto, /condições climáticas estão favoráveis/i);
    const todas = await amb.sql<{ n: number }>("select count(*)::int as n from item_modelo_apr where mostrar_clima");
    assert.ok(todas[0]!.n >= 8, "cada modelo tem a sua pergunta de clima");
  });

  async function payloadApr(opcoes: { clima?: object | null; fotoDoClima?: boolean } = {}) {
    const verificacao = modelo.itens.filter((i) => i.secao === "verificacao");
    const respostas = verificacao.map((i) => ({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" }));
    const evidencias = opcoes.fotoDoClima ? [{ id: await h.foto(), item_id: itemDeClima().id, capturada_em: h.agora(), latitude: -20.3, longitude: -40.3 }] : [];
    return {
      id: randomUUID(),
      modelo_apr_id: modelo.id,
      participantes: [tecnico, colega].map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
      riscos: [],
      respostas,
      evidencias,
      observacao_geral: "Sem observações",
      concluida_em: h.agora(),
      ...(opcoes.clima === null ? {} : opcoes.clima ? { clima: opcoes.clima } : {}),
    };
  }
  const climaVisto = async (nivel: "atencao" | "extremo", confirmou = true) => {
    programar(diaTodo(nivel === "extremo" ? { 15: { codigo: 95 }, 16: { codigo: 95 } } : { 15: { chuvaMm: 4, chanceChuva: 80, codigo: 61 } }));
    const p = await clima({ latitude: -20.31, longitude: -40.31 });
    return registrarClima(p, confirmou)!;
  };

  it("risco de atenção: a APR segue sem foto, o clima fica guardado com a confirmação e ninguém é avisado na hora", async () => {
    const o = await novaOs();
    const p = await payloadApr({ clima: await climaVisto("atencao") });
    const r = await h.enviar(tecnico, h.evento("apr_concluida", p, o.id));
    assert.deepEqual(r.aprs, [{ id: p.id, resultado: "aprovada" }]);
    assert.deepEqual(r.alertas, []);
    const [linha] = await amb.sql<{ nivel: string; confirmou_apesar_do_aviso: boolean; momento: string }>("select nivel, confirmou_apesar_do_aviso, momento from clima_registro where apr_id = $1", [p.id]);
    assert.deepEqual(linha, { nivel: "atencao", confirmou_apesar_do_aviso: true, momento: "apr" });
  });

  it("risco extremo e 'Sim': online só segue com a foto do local; com ela, o supervisor é avisado na hora (e por e-mail, segurança)", async () => {
    const o = await novaOs();
    const semFoto = await payloadApr({ clima: await climaVisto("extremo") });
    const recusa = await h.enviar(tecnico, h.evento("apr_concluida", semFoto, o.id));
    assert.equal(recusa.rejeitados[0].codigo, "foto_do_clima_faltando");
    assert.equal((await amb.sql("select 1 from apr where id = $1", [semFoto.id])).length, 0);

    const comFoto = await payloadApr({ clima: await climaVisto("extremo"), fotoDoClima: true });
    const r = await h.enviar(tecnico, h.evento("apr_concluida", comFoto, o.id));
    assert.deepEqual(r.rejeitados, []);
    assert.equal(r.alertas.length, 1);
    const [alerta] = await amb.sql<{ tipo: string; destinatario_id: string; detalhe: string }>("select tipo, destinatario_id, detalhe from alerta where id = $1", [r.alertas[0]]);
    assert.equal(alerta!.tipo, "clima_extremo");
    assert.equal(alerta!.destinatario_id, supervisor.id);
    assert.match(alerta!.detalhe, /risco climático extremo previsto \(Trovoada prevista/);
    assert.equal((await amb.sql("select 1 from evidencia where apr_id = $1 and item_id = $2", [comFoto.id, itemDeClima().id])).length, 1);
    const emails = await amb.sql("select 1 from tarefa where tipo = 'email_alerta' and referencia_id = $1", [r.alertas[0]]);
    assert.equal(emails.length, 1);
  });

  it("sem previsão (provedor fora do ar) ou sem o campo `clima`, a APR segue normalmente e nada é guardado", async () => {
    const o = await novaOs();
    const p = await payloadApr({ clima: null });
    const r = await h.enviar(tecnico, h.evento("apr_concluida", p, o.id));
    assert.deepEqual(r.aprs, [{ id: p.id, resultado: "aprovada" }]);
    assert.equal((await amb.sql("select 1 from clima_registro where apr_id = $1", [p.id])).length, 0);
  });

  it("o clima do encerramento e o da APR vão para o detalhe da OS e para o relatório do supervisor", async () => {
    const o = await novaOs();
    const p = await payloadApr({ clima: await climaVisto("atencao") });
    await h.enviar(tecnico, h.evento("apr_concluida", p, o.id));
    await h.assinarApr(p.id, o.id, [tecnico, colega]);
    const execId = await h.iniciar(tecnico, o.id, p.id);
    programar(diaTodo({ 16: { codigo: 95 } }));
    const noEncerramento = await clima({ latitude: -20.31, longitude: -40.31 });
    await h.clicarEncerrar(tecnico, o.id, execId);
    const r = await h.assinarEncerramento(tecnico, o.id, execId, { clima: registrarClima(noEncerramento) });
    assert.deepEqual(r.rejeitados, []);

    const [linha] = await amb.sql<{ nivel: string; momento: string }>("select nivel, momento from clima_registro where execucao_id = $1", [execId]);
    assert.deepEqual(linha, { nivel: "extremo", momento: "encerramento" });

    const detalhe = (await amb.esperar(200, "GET", `/os/${o.id}`, { como: supervisor })) as { aprs: { clima: { nivel: string; confirmou_apesar_do_aviso: boolean } | null }[]; execucoes: { clima: { nivel: string } | null }[] };
    assert.equal(detalhe.aprs[0]!.clima?.nivel, "atencao");
    assert.equal(detalhe.aprs[0]!.clima?.confirmou_apesar_do_aviso, true);
    assert.equal(detalhe.execucoes[0]!.clima?.nivel, "extremo");

    const pdf = await gerarRelatorioDaExecucao(amb.deps, o.id);
    assert.ok(pdf.length > 1000);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
  });

  describe("Configurações do sistema", () => {
    it("só o admin lê e muda; o valor muda na hora, vai à auditoria e 'voltar ao padrão' desfaz", async () => {
      assert.equal((await amb.req("GET", "/configuracoes/sistema", { como: tecnico })).status, 403);
      assert.equal((await amb.req("PUT", "/configuracoes/sistema/rh_leitura_hora", { como: supervisor, json: { valor: 5 } })).status, 403);

      type Painel = { cidade_padrao: { nome: string; personalizado: boolean }; itens: { chave: string; valor: number; padrao: number; personalizado: boolean }[] };
      const lido = async () => (await amb.esperar(200, "GET", "/configuracoes/sistema", { como: admin })) as Painel;
      const item = async (chave: string) => (await lido()).itens.find((i) => i.chave === chave)!;
      const antes = await item("sap_leitura_intervalo_min");
      assert.deepEqual([antes.valor, antes.personalizado], [15, false]);

      const depois = (await amb.esperar(200, "PUT", "/configuracoes/sistema/sap_leitura_intervalo_min", { como: admin, json: { valor: 30 } })) as Painel;
      assert.equal(depois.itens.find((i) => i.chave === "sap_leitura_intervalo_min")!.valor, 30);
      assert.equal(amb.deps.config.sapLeituraIntervaloMin, 30);
      await amb.esperar(200, "PUT", "/configuracoes/sistema/vitoria_limite_por_conta_dia", { como: admin, json: { valor: 12 } });
      assert.equal(amb.deps.config.vitoria.limitePorContaDia, 12);
      assert.equal(amb.deps.config.vitoria.limitePorConversa, 20);

      const trilha = await amb.sql<{ acao: string; resumo: string }>("select acao, resumo from auditoria where entidade = 'configuracao' order by em");
      assert.equal(trilha[0]!.acao, "configuracao.alterar");
      assert.match(trilha[0]!.resumo, /Leitura do SAP/);

      assert.equal((await amb.req("PUT", "/configuracoes/sistema/sap_leitura_intervalo_min", { como: admin, json: { valor: 2 } })).status, 422);
      assert.equal((await amb.req("PUT", "/configuracoes/sistema/rh_leitura_hora", { como: admin, json: { valor: 24 } })).status, 422);
      assert.equal((await amb.req("PUT", "/configuracoes/sistema/rh_leitura_hora", { como: admin, json: { valor: "3" } })).status, 422);
      assert.equal((await amb.req("PUT", "/configuracoes/sistema/segredo_qualquer", { como: admin, json: { valor: 1 } })).status, 404);

      await amb.esperar(200, "DELETE", "/configuracoes/sistema/sap_leitura_intervalo_min", { como: admin });
      assert.equal(amb.deps.config.sapLeituraIntervaloMin, 15);
      assert.equal((await item("sap_leitura_intervalo_min")).personalizado, false);
      await amb.esperar(200, "DELETE", "/configuracoes/sistema/vitoria_limite_por_conta_dia", { como: admin });
      assert.equal(amb.deps.config.vitoria.limitePorContaDia, 40);
    });

    it("a cidade padrão muda a previsão de quem está sem GPS; a busca de cidades é do admin", async () => {
      amb.clima.cidades = [{ nome: "Linhares", regiao: "Espírito Santo", latitude: -19.3946, longitude: -40.0643 }];
      const busca = (await amb.esperar(200, "GET", "/clima/cidades", { como: admin, consulta: { busca: "linha" } })) as { cidades: { nome: string }[] };
      assert.deepEqual(busca.cidades.map((c) => c.nome), ["Linhares"]);
      assert.equal((await amb.req("GET", "/clima/cidades", { como: tecnico, consulta: { busca: "linha" } })).status, 403);

      await amb.esperar(200, "PUT", "/configuracoes/sistema/cidade_padrao", { como: admin, json: { valor: { nome: "Linhares, ES", latitude: -19.3946, longitude: -40.0643 } } });
      programar(diaTodo());
      amb.clima.consultas.length = 0;
      const p = await clima();
      assert.equal(p.local.nome, "Linhares, ES");
      assert.deepEqual(amb.clima.consultas.at(-1), { latitude: -19.4, longitude: -40.1, dia: DIA });
      assert.equal((await amb.req("PUT", "/configuracoes/sistema/cidade_padrao", { como: admin, json: { valor: { nome: "X", latitude: 200, longitude: 0 } } })).status, 422);

      await amb.esperar(200, "DELETE", "/configuracoes/sistema/cidade_padrao", { como: admin });
      assert.match((await clima()).local.nome, /Vitória/);
    });
  });
});
