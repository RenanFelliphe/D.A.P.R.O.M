import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import ExcelJS from "exceljs";
import { eq } from "drizzle-orm";
import {
  alerta,
  apr,
  atividade,
  aprParticipante,
  aprResposta,
  aprRisco,
  equipe,
  eventoCampo,
  evidencia,
  execucao,
  execucaoAssinatura,
  execucaoPausa,
  itemModeloApr,
  localInstalacao,
  modeloApr,
  os,
  reprogramacao,
  riscoModeloApr,
  tarefa,
} from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/** "Agora" dos testes: 15/10/2026 12:00 em São Paulo (UTC-3). */
const AGORA = new Date("2026-10-15T15:00:00Z");
const h = (iso: string) => new Date(iso);

// ---------------------------------------------------------------------------------------------------------------
// Auxiliares para montar OS, APRs e execuções direto nas tabelas
// ---------------------------------------------------------------------------------------------------------------

let contadorOs = 0;

async function criarLocal(amb: Ambiente, codigo: string, critico = false) {
  const [l] = await amb.db.insert(localInstalacao).values({ codigo, critico }).returning();
  return l!;
}

interface DadosOs {
  equipeId: string;
  localId: string;
  numero?: string | null;
  tipo?: "corretiva" | "preventiva";
  status?: "liberada" | "pendente" | "em_execucao" | "encerrada" | "cancelada";
  titulo?: string;
  inicio?: string;
  fim?: string | null;
  equipamento?: string | null;
  prioridade?: string | null;
  origem?: "sap" | "planilha" | "apoio";
  /** A OS que o apoio destrava; obrigatória quando `origem` é `apoio`. */
  osOrigemId?: string;
  comPdf?: boolean;
  exportadaEm?: Date;
  ciencia?: { por: string; em: Date };
}

async function criarOs(amb: Ambiente, d: DadosOs) {
  contadorOs++;
  const numero = d.numero === undefined ? `9${String(contadorOs).padStart(6, "0")}` : d.numero;
  const [o] = await amb.db
    .insert(os)
    .values({
      numeroOrdem: numero,
      tipo: d.tipo ?? "preventiva",
      titulo: d.titulo ?? `OS ${numero ?? "de apoio"}`,
      equipamento: d.equipamento ?? null,
      prioridade: d.prioridade ?? null,
      localInstalacaoId: d.localId,
      equipeId: d.equipeId,
      dataInicioProg: d.inicio ?? "2026-10-20",
      dataFimProg: d.fim ?? null,
      status: d.status ?? "liberada",
      origem: d.origem ?? (numero === null ? "apoio" : "sap"),
      osOrigemId: d.osOrigemId ?? null,
      pdfPath: d.comPdf ? "pdf-x" : null,
      pdfEm: d.comPdf ? AGORA : null,
      exportadaSapEm: d.exportadaEm ?? null,
      cienciaPor: d.ciencia?.por ?? null,
      cienciaEm: d.ciencia?.em ?? null,
    })
    .returning();
  return o!;
}

/** Modelo `APR 03` v4 publicado, com 3 itens de verificação e 1 risco. */
async function criarModelo(amb: Ambiente) {
  const [m] = await amb.db.insert(modeloApr).values({ codigo: "APR 03", versao: 4, titulo: "Leitura de retificador" }).returning();
  const [risco] = await amb.db.insert(riscoModeloApr).values({ modeloAprId: m!.id, classificacao: "Ambiente", nome: "Áreas molhadas", ordem: 1 }).returning();
  const itens = await amb.db
    .insert(itemModeloApr)
    .values([
      { modeloAprId: m!.id, secao: "verificacao", ordem: 1, texto: "Há EPI adequado?", respostaBloqueante: "nao", tipo: "eliminatorio", evidencia: "foto" },
      { modeloAprId: m!.id, secao: "verificacao", ordem: 2, texto: "Requer iluminação auxiliar?", respostaBloqueante: "sim", tipo: "alerta", evidencia: "foto" },
      { modeloAprId: m!.id, secao: "verificacao", ordem: 3, texto: "Há impedimento?", respostaBloqueante: "sim", tipo: "eliminatorio", evidencia: "texto" },
    ])
    .returning();
  await amb.db.update(modeloApr).set({ publicadoEm: AGORA }).where(eq(modeloApr.id, m!.id));
  return { modeloId: m!.id, riscoId: risco!.id, itens: itens.sort((a, b) => a.ordem - b.ordem) };
}
type Modelo = Awaited<ReturnType<typeof criarModelo>>;

async function criarApr(
  amb: Ambiente,
  d: { osId: string; modeloId: string; por: string; resultado: "aprovada" | "bloqueada"; concluidaEm: Date; observacaoGeral?: string; participantes?: { usuarioId: string; funcao: "responsavel" | "executor" }[] },
) {
  const id = randomUUID();
  await amb.db.insert(apr).values({ id, osId: d.osId, modeloAprId: d.modeloId, preenchidaPor: d.por, resultado: d.resultado, concluidaEm: d.concluidaEm, observacaoGeral: d.observacaoGeral ?? null });
  const participantes = d.participantes ?? [{ usuarioId: d.por, funcao: "responsavel" as const }];
  await amb.db.insert(aprParticipante).values(participantes.map((p) => ({ aprId: id, usuarioId: p.usuarioId, funcao: p.funcao, assinaturaPath: `ass-${p.usuarioId}`, assinadaEm: d.concluidaEm })));
  return id;
}

interface DadosExecucao {
  osId: string;
  modelo: Modelo;
  executorId: string;
  inicio: Date;
  fim?: Date | null;
  resultado?: "encerrada" | "interrompida" | "suspensa" | "cancelada" | null;
  pausas?: { inicio: Date; fim: Date | null; motivo?: "almoco" | "descanso" | "outro" }[];
  assinaturas?: string[];
  descricao?: string;
  motivo?: string;
  pessoas?: number;
}

/** Cria a APR aprovada que ampara a Execução (um minuto antes do início) e a própria Execução. */
async function criarExecucao(amb: Ambiente, d: DadosExecucao) {
  const aprId = await criarApr(amb, { osId: d.osId, modeloId: d.modelo.modeloId, por: d.executorId, resultado: "aprovada", concluidaEm: new Date(d.inicio.getTime() - 60_000) });
  const id = randomUUID();
  const resultado = d.resultado === undefined ? (d.fim ? "encerrada" : null) : d.resultado;
  await amb.db.insert(execucao).values({
    id,
    osId: d.osId,
    aprId,
    executorId: d.executorId,
    numeroPessoas: d.pessoas ?? 1,
    inicio: d.inicio,
    fim: d.fim ?? null,
    resultado,
    descricaoAtividade: resultado === "encerrada" ? (d.descricao ?? "Atividade concluída") : (d.descricao ?? null),
    motivo: resultado === "interrompida" ? (d.motivo ?? "Risco no local") : (d.motivo ?? null),
  });
  for (const p of d.pausas ?? []) await amb.db.insert(execucaoPausa).values({ id: randomUUID(), execucaoId: id, inicio: p.inicio, fim: p.fim, motivo: p.motivo ?? null });
  for (const u of d.assinaturas ?? [d.executorId]) await amb.db.insert(execucaoAssinatura).values({ execucaoId: id, usuarioId: u, assinaturaPath: `ass-${u}`, assinadaEm: d.fim ?? d.inicio });
  return { id, aprId };
}

async function lerPlanilha(buffer: ArrayBuffer) {
  const livro = new ExcelJS.Workbook();
  await livro.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return livro;
}

/** Linhas de uma aba como objetos `{cabeçalho: valor}`. */
function linhasDaAba(livro: ExcelJS.Workbook, nome: string) {
  const aba = livro.getWorksheet(nome)!;
  const cabecalho = (aba.getRow(1).values as unknown[]).slice(1) as string[];
  const linhas: Record<string, unknown>[] = [];
  aba.eachRow((linha, i) => {
    if (i === 1) return;
    const v = (linha.values as unknown[]).slice(1);
    linhas.push(Object.fromEntries(cabecalho.map((c, j) => [c, v[j] ?? null])));
  });
  return { cabecalho, linhas };
}

const numerosDe = (corpo: { os: { numero_ordem: string | null }[] }) => corpo.os.map((o) => o.numero_ordem);

// ---------------------------------------------------------------------------------------------------------------
// Quadro, detalhe e ciência
// ---------------------------------------------------------------------------------------------------------------

describe("Painel: quadro, detalhe e ciência", () => {
  let amb: Ambiente;
  let modelo: Modelo;
  let equipeA: string, equipeB: string;
  let supA: UsuarioDeTeste, supB: UsuarioDeTeste, tecA: UsuarioDeTeste, tecB: UsuarioDeTeste, tecSemEquipe: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let osLiberada: typeof os.$inferSelect, osPendente: typeof os.$inferSelect;
  let osAberta14h: typeof os.$inferSelect, osAberta11h: typeof os.$inferSelect;
  let osEncerrada: typeof os.$inferSelect;
  let localCritico: typeof localInstalacao.$inferSelect, localComum: typeof localInstalacao.$inferSelect;
  let detalheIds: { apr1: string; apr2: string; exec: string; foto: string; itemReprovado: string };

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA });
    modelo = await criarModelo(amb);
    equipeA = (await amb.criarEquipe({ nome: "Serviços Especiais" })).id;
    equipeB = (await amb.criarEquipe({ nome: "Instrumentação" })).id;
    supA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, nome: "Sara Supervisora", supervisor: true });
    supB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB, supervisor: true });
    tecA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, nome: "Tiago Técnico", matricula: "TA1" });
    tecB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB });
    tecSemEquipe = await amb.criarUsuario({ perfil: "tecnico" });
    admin = await amb.criarUsuario({ perfil: "admin" });

    localCritico = await criarLocal(amb, "PR VILA VELHA", true);
    localComum = await criarLocal(amb, "ERS SERRA");

    osLiberada = await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4001", titulo: "Inspeção de retificador", equipamento: "Retificador 1", prioridade: "Muito alto", inicio: "2026-10-20" });
    await criarOs(amb, { equipeId: equipeA, localId: localCritico.id, numero: "4002", tipo: "corretiva", titulo: "Vazamento", inicio: "2026-10-25" });
    osPendente = await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4003", tipo: "corretiva", status: "pendente", titulo: "Caixa de válvula", inicio: "2026-10-10", fim: "2026-10-12" });
    await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4004", inicio: "2026-10-01", fim: "2026-10-16" });
    osAberta14h = await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4005", status: "em_execucao", inicio: "2026-10-14" });
    osAberta11h = await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4006", status: "em_execucao", inicio: "2026-10-14" });
    osEncerrada = await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4007", status: "encerrada", inicio: "2026-10-05", comPdf: true });
    await criarOs(amb, { equipeId: equipeB, localId: localComum.id, numero: "4008", inicio: "2026-11-02" });

    await criarExecucao(amb, { osId: osAberta14h.id, modelo, executorId: tecA.id, inicio: new Date(AGORA.getTime() - 14.5 * 3_600_000) });
    await criarExecucao(amb, { osId: osAberta11h.id, modelo, executorId: tecA.id, inicio: new Date(AGORA.getTime() - 11 * 3_600_000) });
    await criarExecucao(amb, { osId: osEncerrada.id, modelo, executorId: tecA.id, inicio: h("2026-10-05T12:00:00Z"), fim: h("2026-10-05T14:00:00Z") });

    // Detalhe da OS pendente: APR bloqueada com foto, alerta, reprogramação, APR aprovada e uma execução suspensa com pausa.
    const [i1, i2, i3] = modelo.itens as [typeof modelo.itens[0], typeof modelo.itens[0], typeof modelo.itens[0]];
    const apr1 = await criarApr(amb, {
      osId: osPendente.id,
      modeloId: modelo.modeloId,
      por: tecA.id,
      resultado: "bloqueada",
      concluidaEm: h("2026-10-10T12:00:00Z"),
      observacaoGeral: "Caixa cheia d'água",
      participantes: [
        { usuarioId: tecA.id, funcao: "responsavel" },
        { usuarioId: supA.id, funcao: "executor" },
      ],
    });
    await amb.db.insert(aprRisco).values({ aprId: apr1, riscoId: modelo.riscoId });
    await amb.db.insert(aprResposta).values([
      { aprId: apr1, itemId: i1.id, resposta: "nao", observacao: "Sem capacete", respondidaEm: h("2026-10-10T11:50:00Z") },
      { aprId: apr1, itemId: i2.id, resposta: "sim", observacao: "Área escura", respondidaEm: h("2026-10-10T11:51:00Z") },
      { aprId: apr1, itemId: i3.id, resposta: "nao", respondidaEm: h("2026-10-10T11:52:00Z") },
    ]);
    const foto = randomUUID();
    await amb.db.insert(evidencia).values({ id: foto, aprId: apr1, itemId: i1.id, fotoPath: "foto-1", capturadaEm: h("2026-10-10T11:55:00Z"), latitude: -20.3, longitude: -40.3 });
    await amb.db.insert(alerta).values({ tipo: "bloqueio", osId: osPendente.id, destinatarioId: supA.id, detalhe: "APR bloqueada: Há EPI adequado?", criadoEm: h("2026-10-10T12:05:00Z") });
    await amb.db.insert(reprogramacao).values({ osId: osPendente.id, usuarioId: supA.id, dataAnterior: "2026-10-05", dataNova: "2026-10-10", equipeAnteriorId: equipeB, equipeNovaId: equipeA, justificativa: "Aguardando a equipe civil", criadaEm: h("2026-10-11T10:00:00Z") });
    const exec = await criarExecucao(amb, {
      osId: osPendente.id,
      modelo,
      executorId: tecA.id,
      inicio: h("2026-10-12T12:00:00Z"),
      fim: h("2026-10-12T14:00:00Z"),
      resultado: "suspensa",
      pausas: [{ inicio: h("2026-10-12T12:30:00Z"), fim: h("2026-10-12T13:00:00Z"), motivo: "almoco" }],
    });
    // A APR aprovada que amparou a execução suspensa entra no histórico (concluída às 11:59 de 12/10).
    await amb.db.insert(evidencia).values({ id: randomUUID(), execucaoId: exec.id, fotoPath: "foto-exec", capturadaEm: h("2026-10-12T13:30:00Z") });

    await amb.db.insert(eventoCampo).values([
      { id: randomUUID(), usuarioId: tecA.id, tipo: "execucao_iniciada", osId: osPendente.id, payload: {}, ocorridoEm: h("2026-10-12T12:00:00Z"), recebidoEm: h("2026-10-12T12:00:05Z") },
      { id: randomUUID(), usuarioId: tecA.id, tipo: "execucao_suspensa", osId: osPendente.id, payload: {}, ocorridoEm: h("2026-10-12T20:00:00Z"), recebidoEm: h("2026-10-12T14:00:00Z") },
    ]);
    detalheIds = { apr1, apr2: exec.aprId, exec: exec.id, foto, itemReprovado: i1.id };
  });
  after(() => amb.fechar());

  describe("GET /os", () => {
    it("exige autenticação", async () => {
      assert.equal((await amb.req("GET", "/os")).status, 401);
    });

    it("técnico e supervisor só veem a própria equipe; os demais perfis veem todas", async () => {
      const daA = ["4001", "4002", "4003", "4004", "4005", "4006", "4007"];
      for (const u of [tecA, supA]) {
        const c = await amb.esperar(200, "GET", "/os", { como: u });
        assert.deepEqual(numerosDe(c).sort(), daA);
        assert.equal(c.total, 7);
      }
      assert.deepEqual(numerosDe(await amb.esperar(200, "GET", "/os", { como: supB })), ["4008"]);
      assert.deepEqual(numerosDe(await amb.esperar(200, "GET", "/os", { como: tecB })), ["4008"]);
      for (const u of [admin]) assert.equal((await amb.esperar(200, "GET", "/os", { como: u })).total, 8);
      assert.equal((await amb.esperar(200, "GET", "/os", { como: tecSemEquipe })).total, 0);
    });

    it("equipe_id de outra equipe não amplia o escopo de quem só vê a própria", async () => {
      const c = await amb.esperar(200, "GET", "/os", { como: supA, consulta: { equipe_id: equipeB } });
      assert.equal(c.total, 0);
      assert.deepEqual(c.os, []);
    });

    it("ordena por prioridade (padrão): maior peso primeiro e, nas empatadas, a data limite mais próxima", async () => {
      const c = await amb.esperar(200, "GET", "/os", { como: supA });
      assert.deepEqual(numerosDe(c), ["4001", "4007", "4003", "4005", "4006", "4004", "4002"]);
    });

    it("ordena por data limite (data_fim_prog, ou o início se não houver), desempatando por prioridade", async () => {
      const c = await amb.esperar(200, "GET", "/os", { como: supA, consulta: { ordem: "data_limite" } });
      assert.deepEqual(numerosDe(c), ["4007", "4003", "4005", "4006", "4004", "4001", "4002"]);
    });

    it("cada item traz os campos do quadro, o atraso e a execução aberta há mais de 12 h", async () => {
      const c = await amb.esperar(200, "GET", "/os", { como: admin });
      const por = (n: string) => c.os.find((o: any) => o.numero_ordem === n);

      assert.deepEqual(Object.keys(por("4001")).sort(), [
        "atrasada", "ciencia_em", "data_fim_prog", "data_inicio_prog", "equipamento", "equipe_id", "equipe_nome", "execucao_aberta_ha_horas",
        "id", "local_instalacao", "numero_nota", "numero_ordem", "pdf_pronto", "prioridade", "responsavel", "status", "tipo", "titulo",
      ]);
      assert.equal(por("4001").titulo, "Inspeção de retificador");
      assert.equal(por("4001").equipamento, "Retificador 1");
      assert.equal(por("4001").prioridade, "Muito alto");
      assert.equal(por("4001").equipe_nome, "Serviços Especiais");
      assert.deepEqual(por("4001").local_instalacao, { id: localComum.id, codigo: "ERS SERRA", cliente: null, critico: false });
      assert.equal(por("4002").local_instalacao.critico, true);

      assert.equal(por("4003").atrasada, true, "pendente com data_fim_prog anterior a hoje");
      assert.equal(por("4004").atrasada, false, "a referência é data_fim_prog (16/10), mesmo com início em 01/10");
      assert.equal(por("4001").atrasada, false);
      assert.equal(por("4005").atrasada, false, "em_execucao não conta como atrasada");
      assert.equal(por("4007").atrasada, false);

      assert.equal(por("4005").execucao_aberta_ha_horas, 14);
      assert.equal(por("4006").execucao_aberta_ha_horas, null, "11 h não passa do limite de 12 h");
      assert.equal(por("4007").execucao_aberta_ha_horas, null, "execução encerrada não está aberta");

      assert.equal(por("4007").pdf_pronto, true);
      assert.equal(por("4001").pdf_pronto, false);
      assert.equal(por("4001").ciencia_em, null);
    });

    it("OS atrasada só conta depois do dia de hoje no fuso de São Paulo", async () => {
      // 16/10 às 01:00 UTC ainda é 15/10 22:00 em São Paulo: a OS com data 15/10 ainda não está atrasada.
      const o = await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4090", inicio: "2026-10-15" });
      const antes = amb.relogio.agora;
      try {
        amb.relogio.agora = h("2026-10-16T01:00:00Z");
        const leitor = await amb.criarUsuario({ perfil: "admin" });
        const noMesmoDia = await amb.esperar(200, "GET", "/os", { como: leitor, consulta: { numero_ordem: "4090" } });
        assert.equal(noMesmoDia.os[0].atrasada, false);
        amb.relogio.agora = h("2026-10-16T03:30:00Z");
        const leitorDepois = await amb.criarUsuario({ perfil: "admin" });
        const noDiaSeguinte = await amb.esperar(200, "GET", "/os", { como: leitorDepois, consulta: { numero_ordem: "4090" } });
        assert.equal(noDiaSeguinte.os[0].atrasada, true);
      } finally {
        amb.relogio.agora = antes;
        await amb.db.delete(os).where(eq(os.id, o.id));
      }
    });

    it("filtra por equipe, tipo, criticidade, período, status, número da ordem e busca", async () => {
      const consulta = async (q: Record<string, string>, como = admin) => numerosDe(await amb.esperar(200, "GET", "/os", { como, consulta: q })).sort();

      assert.deepEqual(await consulta({ equipe_id: equipeB }), ["4008"]);
      assert.deepEqual(await consulta({ tipo: "corretiva" }), ["4002", "4003"]);
      assert.deepEqual(await consulta({ critica: "true" }), ["4002"]);
      assert.equal((await consulta({ critica: "false" })).length, 7);
      assert.deepEqual(await consulta({ periodo: "2026-11" }), ["4008"]);
      assert.deepEqual((await consulta({ periodo: "2026-10" })).length, 7);
      assert.deepEqual(await consulta({ status: "pendente" }), ["4003"]);
      assert.deepEqual(await consulta({ status: "em_execucao" }), ["4005", "4006"]);
      assert.deepEqual(await consulta({ numero_ordem: "4003" }), ["4003"]);
      assert.deepEqual(await consulta({ numero_ordem: "400" }), [], "o número da ordem é exato");
      assert.deepEqual(await consulta({ busca: "RETIFICADOR" }), ["4001"]);
      assert.deepEqual(await consulta({ busca: "vila velha" }), ["4002"]);
      assert.deepEqual(await consulta({ busca: "4005" }), ["4005"]);
      assert.deepEqual(await consulta({ busca: "100%" }), [], "% é literal na busca");
      assert.deepEqual(await consulta({ tipo: "corretiva", status: "pendente", periodo: "2026-10" }), ["4003"]);
      assert.deepEqual(await consulta({ status: "pendente" }, supB), []);
    });

    it("contagem_por_status ignora o filtro de status e respeita os demais e o escopo", async () => {
      const todas = await amb.esperar(200, "GET", "/os", { como: supA });
      assert.deepEqual(todas.contagem_por_status, { liberada: 3, pendente: 1, em_execucao: 2, encerrada: 1, cancelada: 0, devolvida: 0 });

      const soPendentes = await amb.esperar(200, "GET", "/os", { como: supA, consulta: { status: "pendente" } });
      assert.equal(soPendentes.total, 1);
      assert.deepEqual(soPendentes.contagem_por_status, todas.contagem_por_status);

      const soCorretivas = await amb.esperar(200, "GET", "/os", { como: admin, consulta: { tipo: "corretiva", status: "liberada" } });
      assert.deepEqual(soCorretivas.contagem_por_status, { liberada: 1, pendente: 1, em_execucao: 0, encerrada: 0, cancelada: 0, devolvida: 0 });

      const equipeBcontagem = await amb.esperar(200, "GET", "/os", { como: supB });
      assert.deepEqual(equipeBcontagem.contagem_por_status, { liberada: 1, pendente: 0, em_execucao: 0, encerrada: 0, cancelada: 0, devolvida: 0 });
    });

    it("exportada separa as OS já exportadas para o SAP das que ainda não foram (pré-visualização da exportação)", async () => {
      const exportada = await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4095", status: "encerrada", inicio: "2026-10-05", comPdf: true });
      try {
        await amb.db.update(os).set({ exportadaSapEm: h("2026-10-10T10:00:00Z") }).where(eq(os.id, exportada.id));
        const consulta = async (q: Record<string, string>) => numerosDe(await amb.esperar(200, "GET", "/os", { como: admin, consulta: q })).sort();
        assert.deepEqual(await consulta({ status: "encerrada", exportada: "false" }), ["4007"]);
        assert.deepEqual(await consulta({ status: "encerrada", exportada: "true" }), ["4095"]);
        assert.deepEqual(await consulta({ status: "encerrada" }), ["4007", "4095"]);
        assert.equal((await amb.req("GET", "/os", { como: admin, consulta: { exportada: "talvez" } })).status, 422);
      } finally {
        await amb.db.delete(os).where(eq(os.id, exportada.id));
      }
    });

    it("pagina a lista", async () => {
      const p1 = await amb.esperar(200, "GET", "/os", { como: supA, consulta: { tamanho: 3, pagina: 1 } });
      const p3 = await amb.esperar(200, "GET", "/os", { como: supA, consulta: { tamanho: 3, pagina: 3 } });
      assert.equal(p1.os.length, 3);
      assert.equal(p1.total, 7);
      assert.equal(p1.pagina, 1);
      assert.equal(p1.tamanho, 3);
      assert.deepEqual(numerosDe(p3), ["4002"]);
    });

    it("recusa filtros inválidos com 422", async () => {
      for (const q of [{ periodo: "2026-13" }, { periodo: "outubro" }, { status: "feita" }, { tipo: "x" }, { equipe_id: "nao-e-uuid" }, { critica: "talvez" }, { ordem: "alfabetica" }]) {
        assert.equal((await amb.req("GET", "/os", { como: admin, consulta: q })).status, 422, JSON.stringify(q));
      }
    });
  });

  describe("GET /os/{id}", () => {
    it("devolve o detalhe completo: OS, serviço do catálogo, APRs, execuções, alertas, reprogramações e linha do tempo", async () => {
      // Só o admin vê o que é eliminatório e o que é alerta (tipo, evidência, resposta bloqueante, alerta marcado).
      const c = await amb.esperar(200, "GET", `/os/${osPendente.id}`, { como: admin });
      assert.deepEqual(Object.keys(c).sort(), ["alertas", "aprs", "checklist_inspecao", "execucoes", "linha_do_tempo", "os", "reprogramacoes", "servico"]);

      assert.equal(c.os.id, osPendente.id);
      assert.equal(c.os.numero_ordem, "4003");
      assert.equal(c.os.status, "pendente");
      assert.equal(c.os.tipo, "corretiva");
      assert.equal(c.os.data_fim_prog, "2026-10-12");
      assert.equal(c.os.local_instalacao.codigo, "ERS SERRA");
      assert.equal(c.os.equipe.nome, "Serviços Especiais");
      assert.equal(c.os.pdf_pronto, false);
      assert.equal(c.os.atrasada, true);
      assert.equal(c.os.execucao_aberta_ha_horas, null);
      assert.equal(c.os.eventos_com_relogio_suspeito, 1);

      // APRs: a bloqueada e a aprovada que amparou a execução, da mais antiga para a mais recente.
      assert.equal(c.aprs.length, 2);
      const [bloqueada, aprovada] = c.aprs;
      assert.equal(bloqueada.id, detalheIds.apr1);
      assert.equal(bloqueada.resultado, "bloqueada");
      assert.equal(bloqueada.observacao_geral, "Caixa cheia d'água");
      assert.deepEqual(bloqueada.modelo, { codigo: "APR 03", versao: 4, titulo: "Leitura de retificador" });
      assert.equal(bloqueada.concluida_em, "2026-10-10T12:00:00.000Z");
      assert.equal(bloqueada.preenchida_por.nome, "Tiago Técnico");
      assert.deepEqual(
        bloqueada.participantes.map((p: any) => [p.funcao, p.nome, p.matricula]),
        [["executor", "Sara Supervisora", supA.matricula], ["responsavel", "Tiago Técnico", "TA1"]].sort((a, b) => (a[0]! < b[0]! ? -1 : 1)),
      );
      assert.ok(bloqueada.participantes.every((p: any) => p.assinatura_path && p.assinada_em));
      assert.deepEqual(bloqueada.riscos.map((r: any) => [r.classificacao, r.nome]), [["Ambiente", "Áreas molhadas"]]);
      assert.equal(bloqueada.respostas.length, 3, "todas as respostas, não só as reprovadas");
      assert.deepEqual(bloqueada.respostas.map((r: any) => [r.resposta, r.reprovado, r.alerta_marcado]), [["nao", true, false], ["sim", false, true], ["nao", false, false]]);

      assert.equal(bloqueada.itens_reprovados.length, 1);
      const reprovado = bloqueada.itens_reprovados[0];
      assert.equal(reprovado.item_id, detalheIds.itemReprovado);
      assert.equal(reprovado.texto, "Há EPI adequado?");
      assert.equal(reprovado.resposta, "nao");
      assert.equal(reprovado.observacao, "Sem capacete");
      assert.equal(reprovado.tipo, "eliminatorio");
      assert.equal(reprovado.evidencia, "foto");
      assert.equal(reprovado.fotos.length, 1);
      assert.equal(reprovado.fotos[0].id, detalheIds.foto);
      assert.equal(reprovado.fotos[0].foto_path, "foto-1");
      assert.equal(reprovado.fotos[0].capturada_em, "2026-10-10T11:55:00.000Z");
      assert.equal(reprovado.fotos[0].latitude, -20.3);
      assert.equal(reprovado.fotos[0].longitude, -40.3);

      assert.equal(aprovada.id, detalheIds.apr2);
      assert.equal(aprovada.resultado, "aprovada");
      assert.deepEqual(aprovada.itens_reprovados, []);

      // Execução: pausas, tempo, assinaturas e fotos.
      assert.equal(c.execucoes.length, 1);
      const e = c.execucoes[0];
      assert.equal(e.id, detalheIds.exec);
      assert.equal(e.apr_id, detalheIds.apr2);
      assert.equal(e.resultado, "suspensa");
      assert.equal(e.executor.nome, "Tiago Técnico");
      assert.equal(e.tempo_liquido_min, 90);
      assert.equal(e.pausa_min, 30);
      assert.equal(e.pausas.length, 1);
      assert.equal(e.pausas[0].motivo, "almoco");
      assert.equal(e.assinaturas.length, 1);
      assert.equal(e.assinaturas[0].matricula, "TA1");
      assert.equal(e.fotos.length, 1);
      assert.equal(e.fotos[0].foto_path, "foto-exec");

      assert.equal(c.alertas.length, 1);
      assert.equal(c.alertas[0].tipo, "bloqueio");
      assert.equal(c.alertas[0].destinatario_nome, "Sara Supervisora");
      assert.equal(c.alertas[0].lido_em, null);

      assert.equal(c.reprogramacoes.length, 1);
      assert.equal(c.reprogramacoes[0].justificativa, "Aguardando a equipe civil");
      assert.equal(c.reprogramacoes[0].data_anterior, "2026-10-05");
      assert.equal(c.reprogramacoes[0].data_nova, "2026-10-10");
      assert.equal(c.reprogramacoes[0].equipe_anterior_nome, "Instrumentação");
    });

    it("técnico e supervisor não recebem o que é eliminatório nem o que é alerta; sabem só o que reprovou", async () => {
      for (const u of [tecA, supA]) {
        for (const aprs of [(await amb.esperar(200, "GET", `/os/${osPendente.id}`, { como: u })).aprs, (await amb.esperar(200, "GET", `/os/${osPendente.id}/aprs`, { como: u })).aprs]) {
          const [bloqueada] = aprs;
          for (const r of bloqueada.respostas) {
            for (const campo of ["tipo", "evidencia", "resposta_bloqueante", "alerta_marcado"]) assert.equal(campo in r, false, `${u.matricula}: resposta traz ${campo}`);
          }
          assert.deepEqual(bloqueada.respostas.map((r: any) => [r.resposta, r.reprovado]), [["nao", true], ["sim", false], ["nao", false]]);
          assert.equal(bloqueada.itens_reprovados.length, 1);
          assert.equal(bloqueada.itens_reprovados[0].texto, "Há EPI adequado?");
          for (const campo of ["tipo", "evidencia"]) assert.equal(campo in bloqueada.itens_reprovados[0], false);
        }
      }
    });

    it("a linha do tempo une APRs, execução, pausas, alertas e reprogramações em ordem cronológica", async () => {
      const c = await amb.esperar(200, "GET", `/os/${osPendente.id}`, { como: admin });
      const tempos = c.linha_do_tempo.map((i: any) => i.em);
      assert.deepEqual(tempos, [...tempos].sort());
      assert.deepEqual(
        c.linha_do_tempo.map((i: any) => i.tipo),
        ["apr_concluida", "alerta", "reprogramacao", "apr_concluida", "execucao_iniciada", "pausa_iniciada", "pausa_encerrada", "execucao_suspensa"],
      );
      for (const item of c.linha_do_tempo) {
        assert.deepEqual(Object.keys(item).sort(), ["descricao", "em", "tipo"]);
        assert.ok(item.descricao.length > 0);
      }
      assert.match(c.linha_do_tempo[0].descricao, /bloqueada/);
      assert.match(c.linha_do_tempo[2].descricao, /Aguardando a equipe civil/);
    });

    it("execução em andamento não tem tempo líquido e o PDF pronto aparece em os", async () => {
      const aberta = await amb.esperar(200, "GET", `/os/${osAberta14h.id}`, { como: tecA });
      assert.equal(aberta.execucoes[0].fim, null);
      assert.equal(aberta.execucoes[0].tempo_liquido_min, null);
      assert.equal(aberta.execucoes[0].pausa_min, null);
      assert.equal(aberta.os.execucao_aberta_ha_horas, 14);
      assert.equal(aberta.os.status, "em_execucao");

      const encerrada = await amb.esperar(200, "GET", `/os/${osEncerrada.id}`, { como: tecA });
      assert.equal(encerrada.os.pdf_pronto, true);
      assert.equal(encerrada.execucoes[0].tempo_liquido_min, 120);
    });

    it("a OS não traz modelo de APR (o técnico escolhe a cada APR); a atividade vira o serviço do catálogo", async () => {
      await amb.db.insert(atividade).values({ codigo: "ATV-1", descricao: "Atividade do plano" });
      const comAtividade = await criarOs(amb, { equipeId: equipeA, localId: localComum.id, numero: "4090", inicio: "2026-10-21" });
      await amb.db.update(os).set({ codigoAtividade: "ATV-1" }).where(eq(os.id, comAtividade.id));

      const c = await amb.esperar(200, "GET", `/os/${comAtividade.id}`, { como: tecA });
      assert.equal("modelo_apr_codigo" in c.os, false);
      assert.deepEqual(c.servico, { codigo: "ATV-1", descricao: "Atividade do plano", materiais: [] });
    });

    it("OS sem APR, execução, alerta nem reprogramação devolve listas vazias", async () => {
      const c = await amb.esperar(200, "GET", `/os/${osLiberada.id}`, { como: admin });
      assert.deepEqual([c.aprs, c.execucoes, c.alertas, c.reprogramacoes, c.linha_do_tempo], [[], [], [], [], []]);
      assert.equal(c.os.eventos_com_relogio_suspeito, 0);
    });

    it("quem não vê a equipe da OS recebe 404; os perfis com visão geral abrem", async () => {
      for (const u of [supB, tecB, tecSemEquipe]) assert.equal((await amb.req("GET", `/os/${osPendente.id}`, { como: u })).status, 404);
      for (const u of [tecA, supA, admin]) assert.equal((await amb.req("GET", `/os/${osPendente.id}`, { como: u })).status, 200);
      assert.equal((await amb.req("GET", `/os/${randomUUID()}`, { como: admin })).status, 404);
      assert.equal((await amb.req("GET", "/os/nao-e-uuid", { como: admin })).status, 404);
      assert.equal((await amb.req("GET", `/os/${osPendente.id}`)).status, 401);
    });
  });

  describe("GET /os/{id}/aprs", () => {
    it("devolve o histórico de APRs no mesmo formato do detalhe", async () => {
      const c = await amb.esperar(200, "GET", `/os/${osPendente.id}/aprs`, { como: tecA });
      const detalhe = await amb.esperar(200, "GET", `/os/${osPendente.id}`, { como: tecA });
      assert.deepEqual(Object.keys(c), ["aprs"]);
      assert.deepEqual(c.aprs, detalhe.aprs);
      assert.deepEqual(c.aprs.map((a: any) => a.resultado), ["bloqueada", "aprovada"]);
    });

    it("respeita o escopo de equipe", async () => {
      assert.equal((await amb.req("GET", `/os/${osPendente.id}/aprs`, { como: supB })).status, 404);
      assert.equal((await amb.req("GET", `/os/${osPendente.id}/aprs`, { como: admin })).status, 200);
      assert.equal((await amb.req("GET", `/os/${randomUUID()}/aprs`, { como: admin })).status, 404);
      assert.deepEqual((await amb.esperar(200, "GET", `/os/${osLiberada.id}/aprs`, { como: supA })).aprs, []);
    });
  });

  describe("POST /os/{id}/ciencia", () => {
    it("só o supervisor da equipe da OS pode: os outros perfis recebem 403", async () => {
      for (const u of [admin, tecA]) {
        assert.equal((await amb.req("POST", `/os/${osEncerrada.id}/ciencia`, { como: u })).status, 403, u.perfil);
      }
      assert.equal((await amb.req("POST", `/os/${osEncerrada.id}/ciencia`)).status, 401);
    });

    it("supervisor de outra equipe recebe 404 e nada é gravado", async () => {
      assert.equal((await amb.req("POST", `/os/${osEncerrada.id}/ciencia`, { como: supB })).status, 404);
      const [o] = await amb.db.select().from(os).where(eq(os.id, osEncerrada.id));
      assert.equal(o!.cienciaEm, null);
      assert.equal((await amb.req("POST", `/os/${randomUUID()}/ciencia`, { como: supA })).status, 404);
    });

    it("OS que não está encerrada é 409, sem tarefa nem ciência", async () => {
      for (const o of [osLiberada, osPendente, osAberta14h]) {
        const r = await amb.req("POST", `/os/${o.id}/ciencia`, { como: supA });
        assert.equal(r.status, 409, o.numeroOrdem!);
        assert.equal(r.corpo.erro.codigo, "os_nao_encerrada");
      }
      assert.deepEqual(await amb.db.select().from(tarefa), []);
    });

    it("supervisor da equipe dá a ciência: grava quem e quando e enfileira o PDF na mesma transação", async () => {
      const c = await amb.esperar(200, "POST", `/os/${osEncerrada.id}/ciencia`, { como: supA });
      assert.equal(c.ciencia_em, AGORA.toISOString());

      const [o] = await amb.db.select().from(os).where(eq(os.id, osEncerrada.id));
      assert.equal(o!.cienciaPor, supA.id);
      assert.equal(o!.cienciaEm?.toISOString(), AGORA.toISOString());

      const tarefas = await amb.db.select().from(tarefa).where(eq(tarefa.referenciaId, osEncerrada.id));
      assert.equal(tarefas.length, 1);
      assert.equal(tarefas[0]!.tipo, "pdf_os");
      assert.equal(tarefas[0]!.estado, "pendente");

      const detalhe = await amb.esperar(200, "GET", `/os/${osEncerrada.id}`, { como: supA });
      assert.equal(detalhe.os.ciencia_em, AGORA.toISOString());
      assert.equal(detalhe.os.ciencia_por_nome, "Sara Supervisora");
      assert.equal(detalhe.linha_do_tempo.at(-1).tipo, "ciencia");
      const quadro = await amb.esperar(200, "GET", "/os", { como: supA, consulta: { numero_ordem: "4007" } });
      assert.equal(quadro.os[0].ciencia_em, AGORA.toISOString());
    });

    it("segunda ciência é 409 e não enfileira outra tarefa", async () => {
      const r = await amb.req("POST", `/os/${osEncerrada.id}/ciencia`, { como: supA });
      assert.equal(r.status, 409);
      assert.equal(r.corpo.erro.codigo, "ciencia_ja_dada");
      assert.equal((await amb.db.select().from(tarefa).where(eq(tarefa.referenciaId, osEncerrada.id))).length, 1);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Indicadores e histórico
// ---------------------------------------------------------------------------------------------------------------

describe("Painel: indicadores e histórico", () => {
  let amb: Ambiente;
  let modelo: Modelo;
  let equipeA: string, equipeB: string;
  let supA: UsuarioDeTeste, tecA: UsuarioDeTeste, tecA2: UsuarioDeTeste, tecB: UsuarioDeTeste, supB: UsuarioDeTeste;
  let admin: UsuarioDeTeste;
  let l1: typeof localInstalacao.$inferSelect, l2: typeof localInstalacao.$inferSelect;
  const exec: Record<string, string> = {};

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA });
    modelo = await criarModelo(amb);
    equipeA = (await amb.criarEquipe({ nome: "Alfa" })).id;
    equipeB = (await amb.criarEquipe({ nome: "Beta" })).id;
    supA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, supervisor: true });
    supB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB, supervisor: true });
    tecA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, nome: "Ana" });
    tecA2 = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, nome: "Caio" });
    tecB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB, nome: "Bia" });
    admin = await amb.criarUsuario({ perfil: "admin" });
    l1 = await criarLocal(amb, "PR ALFA");
    l2 = await criarLocal(amb, "ERS BETA");

    const base = { localId: l1.id };
    // Equipe Alfa, preventivas de setembro/2026.
    const a1 = await criarOs(amb, { ...base, equipeId: equipeA, numero: "A1", status: "encerrada", inicio: "2026-09-05", equipamento: "Manômetro X" });
    const a2 = await criarOs(amb, { ...base, equipeId: equipeA, numero: "A2", status: "encerrada", inicio: "2026-09-06", equipamento: "Manômetro Y" });
    await criarOs(amb, { ...base, equipeId: equipeA, numero: "A3", status: "liberada", inicio: "2026-09-10", fim: "2026-09-12" }); // sem justificativa
    const a4 = await criarOs(amb, { ...base, equipeId: equipeA, numero: "A4", status: "liberada", inicio: "2026-09-15" }); // reprogramada: justificada
    await amb.db.insert(reprogramacao).values({ osId: a4.id, usuarioId: supA.id, dataAnterior: "2026-09-01", dataNova: "2026-09-15", justificativa: "Chuva" });
    await criarOs(amb, { ...base, equipeId: equipeA, numero: "A5", status: "pendente", inicio: "2026-09-20" }); // pendente: justificada
    await criarOs(amb, { ...base, equipeId: equipeA, numero: "A6", status: "liberada", inicio: "2026-09-28", fim: "2026-10-20" }); // referência futura
    await criarOs(amb, { ...base, equipeId: equipeA, numero: "A7", status: "em_execucao", inicio: "2026-09-02" }); // em execução: não conta
    await criarOs(amb, { ...base, equipeId: equipeA, numero: "A8", status: "cancelada", inicio: "2026-09-03" }); // cancelada: não conta
    await criarOs(amb, { ...base, equipeId: equipeA, numero: "A9", status: "liberada", tipo: "corretiva", inicio: "2026-09-04" }); // corretiva: fora
    await criarOs(amb, { ...base, equipeId: equipeA, numero: "A10", status: "liberada", inicio: "2026-08-31" }); // agosto: fora
    await criarOs(amb, { ...base, equipeId: equipeA, numero: "A11", status: "liberada", inicio: "2026-10-01" }); // outubro: fora
    const a12 = await criarOs(amb, { ...base, equipeId: equipeA, numero: "A12", status: "encerrada", inicio: "2026-10-01", equipamento: "Manômetro X" });
    // Equipe Beta.
    const b1 = await criarOs(amb, { localId: l2.id, equipeId: equipeB, numero: "B1", status: "encerrada", inicio: "2026-09-10" });
    await criarOs(amb, { localId: l2.id, equipeId: equipeB, numero: "B2", status: "liberada", inicio: "2026-09-11" }); // sem justificativa

    // Execuções (setembro/2026, fuso de São Paulo).
    exec.e1 = (await criarExecucao(amb, { osId: a1.id, modelo, executorId: tecA.id, inicio: h("2026-09-05T11:00:00Z"), fim: h("2026-09-05T15:00:00Z"), pausas: [{ inicio: h("2026-09-05T12:00:00Z"), fim: h("2026-09-05T13:00:00Z"), motivo: "almoco" }], descricao: "Calibração do manômetro" })).id;
    exec.e2 = (await criarExecucao(amb, { osId: a2.id, modelo, executorId: tecA2.id, inicio: h("2026-09-06T11:00:00Z"), fim: h("2026-09-06T13:00:00Z") })).id;
    exec.e3 = (await criarExecucao(amb, { osId: b1.id, modelo, executorId: tecB.id, inicio: h("2026-09-10T11:00:00Z"), fim: h("2026-09-10T12:00:00Z"), pausas: [{ inicio: h("2026-09-10T11:20:00Z"), fim: h("2026-09-10T11:35:00Z") }] })).id;
    // 01/10 02:30 UTC = 30/09 23:30 em São Paulo: ainda é setembro.
    exec.e4 = (await criarExecucao(amb, { osId: a12.id, modelo, executorId: tecA.id, inicio: h("2026-10-01T02:30:00Z"), fim: h("2026-10-01T04:30:00Z"), descricao: "Segunda calibração" })).id;
    // Fora do indicador: 31/08 02:30 UTC = 30/08 23:30 em São Paulo (agosto) e uma execução interrompida em setembro.
    await criarExecucao(amb, { osId: a1.id, modelo, executorId: tecA.id, inicio: h("2026-09-01T02:30:00Z"), fim: h("2026-09-01T04:30:00Z"), resultado: "encerrada" }).then(async ({ id }) => {
      await amb.db.update(execucao).set({ inicio: h("2026-08-31T02:30:00Z"), fim: h("2026-08-31T04:30:00Z") }).where(eq(execucao.id, id));
    });
    await criarExecucao(amb, { osId: a1.id, modelo, executorId: tecA.id, inicio: h("2026-09-08T11:00:00Z"), fim: h("2026-09-08T12:00:00Z"), resultado: "interrompida" });
  });
  after(() => amb.fechar());

  describe("GET /indicadores", () => {
    it("conta só preventivas do mês: encerradas, atrasadas justificadas e atrasadas sem justificativa", async () => {
      const c = await amb.esperar(200, "GET", "/indicadores", { como: admin, consulta: { mes: "2026-09" } });
      assert.equal(c.encerradas, 3);
      assert.equal(c.atrasadas_justificadas, 2);
      assert.equal(c.atrasadas_sem_justificativa, 2);
      assert.deepEqual(c.por_equipe, [
        { equipe_id: equipeA, equipe_nome: "Alfa", encerradas: 2, atrasadas_justificadas: 2, atrasadas_sem_justificativa: 1 },
        { equipe_id: equipeB, equipe_nome: "Beta", encerradas: 1, atrasadas_justificadas: 0, atrasadas_sem_justificativa: 1 },
      ]);
    });

    it("segurança e admin veem todas as equipes; equipe_id restringe o resultado", async () => {
      for (const u of [admin]) assert.equal((await amb.esperar(200, "GET", "/indicadores", { como: u, consulta: { mes: "2026-09" } })).encerradas, 3);
      const soB = await amb.esperar(200, "GET", "/indicadores", { como: admin, consulta: { mes: "2026-09", equipe_id: equipeB } });
      assert.equal(soB.encerradas, 1);
      assert.equal(soB.atrasadas_sem_justificativa, 1);
      assert.equal(soB.por_equipe.length, 1);
    });

    it("supervisor vê só a própria equipe; pedir outra equipe é 403", async () => {
      const c = await amb.esperar(200, "GET", "/indicadores", { como: supA, consulta: { mes: "2026-09" } });
      assert.equal(c.encerradas, 2);
      assert.equal(c.por_equipe.length, 1);
      assert.equal(c.por_equipe[0].equipe_id, equipeA);
      assert.equal((await amb.esperar(200, "GET", "/indicadores", { como: supA, consulta: { mes: "2026-09", equipe_id: equipeA } })).encerradas, 2);
      assert.equal((await amb.req("GET", "/indicadores", { como: supA, consulta: { mes: "2026-09", equipe_id: equipeB } })).status, 403);
      assert.equal((await amb.esperar(200, "GET", "/indicadores", { como: supB, consulta: { mes: "2026-09" } })).encerradas, 1);
    });

    it("técnico não acessa (403) e sem token é 401", async () => {
      assert.equal((await amb.req("GET", "/indicadores", { como: tecA, consulta: { mes: "2026-09" } })).status, 403);
      assert.equal((await amb.req("GET", "/indicadores", { consulta: { mes: "2026-09" } })).status, 401);
    });

    it("exige mes no formato AAAA-MM", async () => {
      for (const mes of [undefined, "2026-9", "2026-13", "setembro"]) assert.equal((await amb.req("GET", "/indicadores", { como: admin, consulta: { mes } })).status, 422, String(mes));
    });

    it("mês sem OS devolve zeros e nenhuma equipe", async () => {
      const c = await amb.esperar(200, "GET", "/indicadores", { como: admin, consulta: { mes: "2026-01" } });
      assert.deepEqual(c, { encerradas: 0, atrasadas_justificadas: 0, atrasadas_sem_justificativa: 0, por_equipe: [] });
    });

    it("o dia de hoje não conta como atraso: a OS com referência em 15/10 só atrasa a partir de 16/10", async () => {
      const antes = await amb.esperar(200, "GET", "/indicadores", { como: admin, consulta: { mes: "2026-10" } });
      const o = await criarOs(amb, { localId: l1.id, equipeId: equipeA, numero: "A13", status: "liberada", inicio: "2026-10-15" });
      try {
        const hoje = await amb.esperar(200, "GET", "/indicadores", { como: admin, consulta: { mes: "2026-10" } });
        assert.equal(hoje.atrasadas_sem_justificativa, antes.atrasadas_sem_justificativa);
        amb.relogio.agora = h("2026-10-16T12:00:00Z");
        const leitor = await amb.criarUsuario({ perfil: "admin" });
        const depois = await amb.esperar(200, "GET", "/indicadores", { como: leitor, consulta: { mes: "2026-10" } });
        assert.equal(depois.atrasadas_sem_justificativa, antes.atrasadas_sem_justificativa + 1);
      } finally {
        amb.relogio.agora = AGORA;
        await amb.db.delete(os).where(eq(os.id, o.id));
      }
    });
  });

  describe("GET /indicadores/tempo", () => {
    it("calcula tempo líquido médio, pausa média e proporção, por equipe e por usuário", async () => {
      const c = await amb.esperar(200, "GET", "/indicadores/tempo", { como: admin, consulta: { mes: "2026-09" } });
      // Execuções do mês: Ana 240 min com 60 de pausa; Caio 120; Bia 60 com 15; Ana 120 (30/09 23:30 em SP).
      assert.equal(c.tempo_liquido_medio_min, 116.3, "(180 + 120 + 120 + 45) / 4");
      assert.equal(c.pausa_media_min, 18.8, "(60 + 0 + 0 + 15) / 4");
      assert.equal(c.proporcao_pausa, 0.1389, "75 / 540");
      assert.equal(c.tempo_total_medio_min, 135, "(240 + 120 + 60 + 120) / 4");
      assert.equal(c.execucoes_com_pausa, 2);
      assert.equal(c.pausas_por_execucao, 0.5);
      // A pausa da Ana tem motivo (almoço); a da Bia, não.
      assert.deepEqual(c.por_motivo, [
        { motivo: "almoco", pausas: 1, minutos: 60 },
        { motivo: "sem_motivo", pausas: 1, minutos: 15 },
      ]);
      assert.deepEqual(
        c.os_com_mais_pausa.map((o: any) => [o.numero_ordem, o.executor, o.tempo_total_min, o.tempo_liquido_min, o.pausa_min, o.pausas, o.proporcao_pausa]),
        [
          ["A1", "Ana", 240, 180, 60, 1, 0.25],
          ["B1", "Bia", 60, 45, 15, 1, 0.25],
        ],
      );

      assert.equal(c.por_equipe.length, 2);
      const alfa = c.por_equipe.find((e: any) => e.equipe_id === equipeA);
      assert.deepEqual(alfa, {
        equipe_id: equipeA,
        equipe_nome: "Alfa",
        execucoes: 3,
        tempo_total_medio_min: 160,
        tempo_liquido_medio_min: 140,
        pausa_media_min: 20,
        proporcao_pausa: 0.125,
        execucoes_com_pausa: 1,
        pausas_por_execucao: 0.3,
      });
      const beta = c.por_equipe.find((e: any) => e.equipe_id === equipeB);
      assert.deepEqual(beta, {
        equipe_id: equipeB,
        equipe_nome: "Beta",
        execucoes: 1,
        tempo_total_medio_min: 60,
        tempo_liquido_medio_min: 45,
        pausa_media_min: 15,
        proporcao_pausa: 0.25,
        execucoes_com_pausa: 1,
        pausas_por_execucao: 1,
      });

      assert.deepEqual(
        c.por_usuario.map((u: any) => [u.usuario_nome, u.execucoes, u.tempo_liquido_medio_min, u.pausa_media_min, u.proporcao_pausa]),
        [["Ana", 2, 150, 30, 0.1667], ["Bia", 1, 45, 15, 0.25], ["Caio", 1, 120, 0, 0]],
      );
    });

    it("só conta Execuções encerradas iniciadas no mês, no fuso de São Paulo", async () => {
      // 31/08 23:30 em SP (agosto) e a interrompida de setembro ficam de fora; 30/09 23:30 em SP entra.
      const c = await amb.esperar(200, "GET", "/indicadores/tempo", { como: admin, consulta: { mes: "2026-09" } });
      assert.equal(c.por_equipe.reduce((n: number, e: any) => n + e.execucoes, 0), 4);
      const agosto = await amb.esperar(200, "GET", "/indicadores/tempo", { como: admin, consulta: { mes: "2026-08" } });
      assert.equal(agosto.por_equipe.reduce((n: number, e: any) => n + e.execucoes, 0), 1);
      const outubro = await amb.esperar(200, "GET", "/indicadores/tempo", { como: admin, consulta: { mes: "2026-10" } });
      assert.deepEqual(outubro.por_equipe, []);
    });

    it("filtra por equipe e por usuário", async () => {
      const porUsuario = await amb.esperar(200, "GET", "/indicadores/tempo", { como: admin, consulta: { mes: "2026-09", usuario_id: tecA.id } });
      assert.equal(porUsuario.tempo_liquido_medio_min, 150);
      assert.equal(porUsuario.por_usuario.length, 1);
      const porEquipe = await amb.esperar(200, "GET", "/indicadores/tempo", { como: admin, consulta: { mes: "2026-09", equipe_id: equipeB } });
      assert.equal(porEquipe.tempo_liquido_medio_min, 45);
      assert.equal(porEquipe.proporcao_pausa, 0.25);
    });

    it("sem Execuções no mês devolve nulos e listas vazias", async () => {
      const c = await amb.esperar(200, "GET", "/indicadores/tempo", { como: admin, consulta: { mes: "2026-01" } });
      assert.deepEqual(c, {
        execucoes: 0,
        tempo_total_medio_min: null,
        tempo_liquido_medio_min: null,
        pausa_media_min: null,
        proporcao_pausa: null,
        execucoes_com_pausa: 0,
        pausas_por_execucao: null,
        por_equipe: [],
        por_usuario: [],
        por_motivo: [],
        os_com_mais_pausa: [],
      });
    });

    it("supervisor vê só a própria equipe; outra equipe é 403; técnico é 403", async () => {
      const c = await amb.esperar(200, "GET", "/indicadores/tempo", { como: supA, consulta: { mes: "2026-09" } });
      assert.equal(c.por_equipe.length, 1);
      assert.equal(c.por_equipe[0].equipe_id, equipeA);
      assert.equal(c.tempo_liquido_medio_min, 140);
      assert.equal((await amb.req("GET", "/indicadores/tempo", { como: supA, consulta: { mes: "2026-09", equipe_id: equipeB } })).status, 403);
      assert.equal((await amb.req("GET", "/indicadores/tempo", { como: tecA, consulta: { mes: "2026-09" } })).status, 403);
      assert.equal((await amb.req("GET", "/indicadores/tempo", { como: admin, consulta: {} })).status, 422);
    });
  });

  describe("GET /historico", () => {
    it("lista as execuções encerradas do local, da mais recente para a mais antiga", async () => {
      const c = await amb.esperar(200, "GET", "/historico", { como: admin, consulta: { local_instalacao_id: l1.id } });
      // l1: e4 (30/09 23:30 SP), e2, e1, mais a de 31/08 (reescrita) e sem a interrompida.
      assert.equal(c.total, 4);
      assert.deepEqual(c.execucoes.slice(0, 3).map((e: any) => e.id), [exec.e4, exec.e2, exec.e1]);
      const e1 = c.execucoes.find((e: any) => e.id === exec.e1);
      assert.equal(e1.os.numero_ordem, "A1");
      assert.equal(e1.os.titulo, "OS A1");
      assert.equal(e1.os.equipamento, "Manômetro X");
      assert.equal(e1.executor.nome, "Ana");
      assert.equal(e1.fim, "2026-09-05T15:00:00.000Z");
      assert.equal(e1.descricao_atividade, "Calibração do manômetro");
      assert.equal(e1.tempo_liquido_min, 180);
      assert.equal(c.pagina, 1);
    });

    it("filtra por equipamento, sem diferenciar maiúsculas", async () => {
      const c = await amb.esperar(200, "GET", "/historico", { como: admin, consulta: { local_instalacao_id: l1.id, equipamento: "manômetro x" } });
      assert.deepEqual(c.execucoes.map((e: any) => e.id).slice(0, 2), [exec.e4, exec.e1]);
      assert.ok(c.execucoes.every((e: any) => e.os.equipamento === "Manômetro X"));
      const nenhum = await amb.esperar(200, "GET", "/historico", { como: admin, consulta: { local_instalacao_id: l1.id, equipamento: "Outro" } });
      assert.deepEqual(nenhum.execucoes, []);
    });

    it("pagina o resultado", async () => {
      const c = await amb.esperar(200, "GET", "/historico", { como: admin, consulta: { local_instalacao_id: l1.id, tamanho: 1, pagina: 2 } });
      assert.equal(c.total, 4);
      assert.deepEqual(c.execucoes.map((e: any) => e.id), [exec.e2]);
    });

    it("respeita o escopo de equipe da OS", async () => {
      assert.equal((await amb.esperar(200, "GET", "/historico", { como: supB, consulta: { local_instalacao_id: l1.id } })).total, 0);
      assert.equal((await amb.esperar(200, "GET", "/historico", { como: tecB, consulta: { local_instalacao_id: l1.id } })).total, 0);
      assert.equal((await amb.esperar(200, "GET", "/historico", { como: supA, consulta: { local_instalacao_id: l1.id } })).total, 4);
      assert.equal((await amb.esperar(200, "GET", "/historico", { como: tecA, consulta: { local_instalacao_id: l1.id } })).total, 4);
      const daB = await amb.esperar(200, "GET", "/historico", { como: supB, consulta: { local_instalacao_id: l2.id } });
      assert.deepEqual(daB.execucoes.map((e: any) => e.id), [exec.e3]);
      assert.equal(daB.execucoes[0].tempo_liquido_min, 45);
      assert.equal((await amb.esperar(200, "GET", "/historico", { como: supA, consulta: { local_instalacao_id: l2.id } })).total, 0);
      for (const u of [admin]) assert.equal((await amb.esperar(200, "GET", "/historico", { como: u, consulta: { local_instalacao_id: l2.id } })).total, 1);
    });

    it("local_instalacao_id é obrigatório e precisa ser um UUID (422); sem token é 401", async () => {
      assert.equal((await amb.req("GET", "/historico", { como: admin })).status, 422);
      assert.equal((await amb.req("GET", "/historico", { como: admin, consulta: { local_instalacao_id: "x" } })).status, 422);
      assert.equal((await amb.req("GET", "/historico", { consulta: { local_instalacao_id: l1.id } })).status, 401);
    });
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Exportação para o SAP
// ---------------------------------------------------------------------------------------------------------------

describe("Painel: exportação para o SAP", () => {
  let amb: Ambiente;
  let modelo: Modelo;
  let equipeA: string, equipeB: string;
  let supA: UsuarioDeTeste, tecA: UsuarioDeTeste, tecB: UsuarioDeTeste, admin: UsuarioDeTeste;
  let o: Record<string, typeof os.$inferSelect> = {};
  const jaExportada = h("2026-10-01T10:00:00Z");

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA });
    modelo = await criarModelo(amb);
    equipeA = (await amb.criarEquipe({ nome: "Serviços Especiais" })).id;
    equipeB = (await amb.criarEquipe({ nome: "Instrumentação" })).id;
    supA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, nome: "Sara Supervisora", supervisor: true });
    tecA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, matricula: "M-A" });
    tecB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, matricula: "M-B" });
    admin = await amb.criarUsuario({ perfil: "admin" });
    const local = await criarLocal(amb, "ERS SERRA");
    const base = { localId: local.id, equipeId: equipeA };

    // Encerradas com número: uma com ciência e duas pessoas, outra que cruza o dia no fuso de SP.
    o.e1 = await criarOs(amb, { ...base, numero: "5002", status: "encerrada", ciencia: { por: supA.id, em: h("2026-10-14T18:00:00Z") } });
    o.e2 = await criarOs(amb, { ...base, numero: "5001", status: "encerrada" });
    o.apoio = await criarOs(amb, { ...base, equipeId: equipeB, numero: null, status: "encerrada", titulo: "Troca de manômetro", origem: "apoio", osOrigemId: o.e1.id });
    o.antiga = await criarOs(amb, { ...base, numero: "5003", status: "encerrada", exportadaEm: jaExportada });
    o.p1 = await criarOs(amb, { ...base, numero: "5005", status: "pendente", titulo: "Caixa cheia" });
    o.p2 = await criarOs(amb, { ...base, numero: "5006", status: "pendente", titulo: "Válvula" });
    o.p3 = await criarOs(amb, { ...base, numero: null, status: "pendente", titulo: "Apoio civil", origem: "apoio", osOrigemId: o.e1.id });
    o.liberada = await criarOs(amb, { ...base, numero: "5008", status: "liberada" });

    await criarExecucao(amb, { osId: o.e1.id, modelo, executorId: tecA.id, inicio: h("2026-10-14T12:00:00Z"), fim: h("2026-10-14T15:30:00Z"), pessoas: 2, assinaturas: [tecB.id, tecA.id], pausas: [{ inicio: h("2026-10-14T13:00:00Z"), fim: h("2026-10-14T13:30:00Z") }], descricao: "Retificador inspecionado" });
    await criarExecucao(amb, { osId: o.e2.id, modelo, executorId: tecA.id, inicio: h("2026-10-14T01:00:00Z"), fim: h("2026-10-14T02:30:00Z"), descricao: "Leitura concluída" });
    await criarExecucao(amb, { osId: o.apoio.id, modelo, executorId: tecB.id, inicio: h("2026-10-13T12:00:00Z"), fim: h("2026-10-13T13:00:00Z"), descricao: "Troca feita" });
    await criarExecucao(amb, { osId: o.antiga.id, modelo, executorId: tecA.id, inicio: h("2026-09-20T12:00:00Z"), fim: h("2026-09-20T13:00:00Z") });

    await amb.db.insert(alerta).values({ tipo: "bloqueio", osId: o.p1.id, destinatarioId: supA.id, detalhe: "APR bloqueada: Há EPI adequado?", criadoEm: h("2026-10-13T12:05:00Z") });
    await criarApr(amb, { osId: o.p1.id, modeloId: modelo.modeloId, por: tecA.id, resultado: "bloqueada", concluidaEm: h("2026-10-13T12:00:00Z") });
    await amb.db.insert(alerta).values({ tipo: "bloqueio", osId: o.p2.id, destinatarioId: supA.id, detalhe: "APR bloqueada antiga", criadoEm: h("2026-10-10T12:05:00Z") });
    await criarExecucao(amb, { osId: o.p2.id, modelo, executorId: tecA.id, inicio: h("2026-10-13T11:00:00Z"), fim: h("2026-10-13T12:00:00Z"), resultado: "suspensa" });
    await criarExecucao(amb, { osId: o.p3.id, modelo, executorId: tecA.id, inicio: h("2026-10-12T11:00:00Z"), fim: h("2026-10-12T12:00:00Z"), resultado: "interrompida", motivo: "Vazamento de gás" });
  });
  after(() => amb.fechar());

  it("só o admin exporta; os outros perfis recebem 403 e sem token é 401", async () => {
    for (const u of [tecA, supA]) assert.equal((await amb.req("POST", "/exportacoes/sap", { como: u })).status, 403, u.perfil);
    assert.equal((await amb.req("POST", "/exportacoes/sap")).status, 401);
    const [ainda] = await amb.db.select().from(os).where(eq(os.id, o.e1!.id));
    assert.equal(ainda!.exportadaSapEm, null, "uma exportação recusada não marca nada");
  });

  it("gera o .xlsx com as 4 abas, as colunas e as linhas esperadas", async () => {
    const r = await amb.req("POST", "/exportacoes/sap", { como: admin });
    assert.equal(r.status, 200);
    assert.equal(r.cabecalhos.get("content-type"), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    assert.match(r.cabecalhos.get("content-disposition") ?? "", /^attachment; filename="exportacao-sap-20261015-1200\.xlsx"$/);
    assert.equal(r.cabecalhos.get("x-mensagem"), null);

    const livro = await lerPlanilha(r.corpo);
    assert.deepEqual(livro.worksheets.map((a) => a.name), ["Encerradas", "Sem ordem SAP", "Impedimentos", "Devolvidas"]);

    const enc = linhasDaAba(livro, "Encerradas");
    assert.deepEqual(enc.cabecalho, [
      "numero_ordem", "data_inicio", "hora_inicio", "data_fim", "hora_fim", "tempo_liquido_min", "pausa_min", "numero_pessoas", "executantes", "descricao_atividade", "link_pdf", "ciencia_supervisor",
    ]);
    assert.equal(enc.linhas.length, 2, "a já exportada e a sem número não entram");
    assert.deepEqual(enc.linhas[0], {
      numero_ordem: "5001",
      data_inicio: "13/10/2026",
      hora_inicio: "22:00",
      data_fim: "13/10/2026",
      hora_fim: "23:30",
      tempo_liquido_min: 90,
      pausa_min: 0,
      numero_pessoas: 1,
      executantes: "M-A",
      descricao_atividade: "Leitura concluída",
      link_pdf: `http://painel.local/doc/os/${o.e2!.id}`,
      ciencia_supervisor: null,
    });
    assert.deepEqual(enc.linhas[1], {
      numero_ordem: "5002",
      data_inicio: "14/10/2026",
      hora_inicio: "09:00",
      data_fim: "14/10/2026",
      hora_fim: "12:30",
      tempo_liquido_min: 180,
      pausa_min: 30,
      numero_pessoas: 2,
      executantes: "M-A,M-B",
      descricao_atividade: "Retificador inspecionado",
      link_pdf: `http://painel.local/doc/os/${o.e1!.id}`,
      ciencia_supervisor: "Sara Supervisora 14/10/2026 15:00",
    });

    const sem = linhasDaAba(livro, "Sem ordem SAP");
    assert.deepEqual(sem.cabecalho.slice(0, 3), ["titulo", "equipe", "data_inicio"]);
    assert.equal(sem.cabecalho.length, 13);
    assert.equal(sem.linhas.length, 1);
    assert.equal(sem.linhas[0]!.titulo, "Troca de manômetro");
    assert.equal(sem.linhas[0]!.equipe, "Instrumentação");
    assert.equal(sem.linhas[0]!.data_inicio, "13/10/2026");
    assert.equal(sem.linhas[0]!.hora_inicio, "09:00");
    assert.equal(sem.linhas[0]!.tempo_liquido_min, 60);
    assert.equal(sem.linhas[0]!.executantes, "M-B");
    assert.equal(sem.linhas[0]!.descricao_atividade, "Troca feita");

    const imp = linhasDaAba(livro, "Impedimentos");
    assert.deepEqual(imp.cabecalho, ["numero_ordem", "titulo", "equipe", "motivo", "desde"]);
    assert.equal(imp.linhas.length, 3, "só as pendentes");
    const por = (t: string) => imp.linhas.find((l) => l.titulo === t)!;
    assert.deepEqual(por("Caixa cheia"), { numero_ordem: "5005", titulo: "Caixa cheia", equipe: "Serviços Especiais", motivo: "APR bloqueada: Há EPI adequado?", desde: "13/10/2026 09:00" });
    assert.equal(por("Válvula").motivo, "Execução suspensa", "a suspensão mais recente vale mais que o alerta antigo");
    assert.equal(por("Válvula").desde, "13/10/2026 09:00");
    assert.equal(por("Apoio civil").numero_ordem, null);
    assert.equal(por("Apoio civil").motivo, "Vazamento de gás");
  });

  it("marca exportada_sap_em nas encerradas exportadas (com e sem número) e em mais nada", async () => {
    const linhas = await amb.db.select({ id: os.id, em: os.exportadaSapEm }).from(os);
    const em = (id: string) => linhas.find((l) => l.id === id)!.em?.toISOString() ?? null;
    assert.equal(em(o.e1!.id), AGORA.toISOString());
    assert.equal(em(o.e2!.id), AGORA.toISOString());
    assert.equal(em(o.apoio!.id), AGORA.toISOString());
    assert.equal(em(o.antiga!.id), jaExportada.toISOString(), "a exportação anterior não é sobrescrita");
    for (const k of ["p1", "p2", "p3", "liberada"]) assert.equal(em(o[k]!.id), null, `${k} não é exportada`);
  });

  it("exportar de novo sem OS novas devolve 200 com planilha vazia e X-Mensagem", async () => {
    const r = await amb.req("POST", "/exportacoes/sap", { como: admin });
    assert.equal(r.status, 200);
    assert.equal(r.cabecalhos.get("x-mensagem"), "Nenhuma OS nova para exportar");
    assert.match(r.cabecalhos.get("content-disposition") ?? "", /^attachment/);

    const livro = await lerPlanilha(r.corpo);
    assert.deepEqual(livro.worksheets.map((a) => a.name), ["Encerradas", "Sem ordem SAP", "Impedimentos", "Devolvidas"]);
    const enc = linhasDaAba(livro, "Encerradas");
    assert.equal(enc.cabecalho.length, 12);
    assert.deepEqual(enc.linhas, []);
    assert.equal(linhasDaAba(livro, "Sem ordem SAP").cabecalho.length, 13);
    assert.deepEqual(linhasDaAba(livro, "Sem ordem SAP").linhas, []);
    assert.equal(linhasDaAba(livro, "Impedimentos").linhas.length, 3, "os impedimentos continuam listados");
  });

  it("uma OS encerrada depois entra na exportação seguinte, e a ciência não a segura", async () => {
    const local = (await amb.db.select().from(localInstalacao))[0]!;
    const nova = await criarOs(amb, { localId: local.id, equipeId: equipeA, numero: "5010", status: "encerrada" });
    await criarExecucao(amb, { osId: nova.id, modelo, executorId: tecA.id, inicio: h("2026-10-15T11:00:00Z"), fim: h("2026-10-15T12:00:00Z") });
    const r = await amb.req("POST", "/exportacoes/sap", { como: admin });
    assert.equal(r.cabecalhos.get("x-mensagem"), null);
    const enc = linhasDaAba(await lerPlanilha(r.corpo), "Encerradas");
    assert.deepEqual(enc.linhas.map((l) => [l.numero_ordem, l.ciencia_supervisor]), [["5010", null]]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Supervisão por equipe: o supervisor é quem a equipe aponta (`equipe.supervisor_id`), de qualquer perfil
// ---------------------------------------------------------------------------------------------------------------

describe("Painel: técnico que supervisa outra equipe", () => {
  let amb: Ambiente;
  let semSupervisao: UsuarioDeTeste, tecnicoSupervisor: UsuarioDeTeste, tecDaEquipeSupervisionada: UsuarioDeTeste;
  let osDaOutra: typeof os.$inferSelect, osProprias: typeof os.$inferSelect, osSupervisionada: typeof os.$inferSelect, osQueEleExecutou: typeof os.$inferSelect;

  before(async () => {
    amb = await criarAmbiente({ relogio: AGORA });
    const modelo = await criarModelo(amb);
    const propria = (await amb.criarEquipe({ nome: "Própria" })).id;
    const supervisionada = (await amb.criarEquipe({ nome: "Supervisionada" })).id;
    const outra = (await amb.criarEquipe({ nome: "Outra" })).id;
    tecnicoSupervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId: propria, nome: "Téo Técnico-Supervisor" });
    semSupervisao = await amb.criarUsuario({ perfil: "tecnico", equipeId: propria });
    tecDaEquipeSupervisionada = await amb.criarUsuario({ perfil: "tecnico", equipeId: supervisionada });
    await amb.db.update(equipe).set({ supervisorId: tecnicoSupervisor.id }).where(eq(equipe.id, supervisionada));

    const local = await criarLocal(amb, "ERS SERRA");
    const encerrada = (equipeId: string, numero: string) => criarOs(amb, { equipeId, localId: local.id, numero, status: "encerrada", comPdf: true });
    osDaOutra = await encerrada(outra, "7001");
    osProprias = await encerrada(propria, "7002");
    osSupervisionada = await encerrada(supervisionada, "7003");
    osQueEleExecutou = await encerrada(supervisionada, "7004");
    await criarExecucao(amb, { osId: osSupervisionada.id, modelo, executorId: tecDaEquipeSupervisionada.id, inicio: h("2026-10-05T12:00:00Z"), fim: h("2026-10-05T14:00:00Z") });
    await criarExecucao(amb, { osId: osQueEleExecutou.id, modelo, executorId: tecnicoSupervisor.id, inicio: h("2026-10-06T12:00:00Z"), fim: h("2026-10-06T14:00:00Z") });
  });

  after(async () => amb.fechar());

  it("vê as OS da própria equipe e da que supervisiona, não as de outras; quem não supervisiona vê só a própria", async () => {
    const dele = await amb.esperar(200, "GET", "/os", { como: tecnicoSupervisor });
    assert.deepEqual(numerosDe(dele).sort(), ["7002", "7003", "7004"]);
    const dosOutros = await amb.esperar(200, "GET", "/os", { como: semSupervisao });
    assert.deepEqual(numerosDe(dosOutros), ["7002"]);
    assert.equal((await amb.req("GET", `/os/${osDaOutra.id}`, { como: tecnicoSupervisor })).status, 404);
  });

  it("dá a ciência nas OS da equipe que supervisiona, mas não nas da própria equipe nem de outra", async () => {
    assert.equal((await amb.req("POST", `/os/${osProprias.id}/ciencia`, { como: tecnicoSupervisor })).status, 403);
    assert.equal((await amb.req("POST", `/os/${osDaOutra.id}/ciencia`, { como: tecnicoSupervisor })).status, 404);
    assert.equal((await amb.req("POST", `/os/${osSupervisionada.id}/ciencia`, { como: semSupervisao })).status, 403);

    await amb.esperar(200, "POST", `/os/${osSupervisionada.id}/ciencia`, { como: tecnicoSupervisor });
    const [o] = await amb.db.select().from(os).where(eq(os.id, osSupervisionada.id));
    assert.equal(o!.cienciaPor, tecnicoSupervisor.id);
  });

  it("não dá a ciência numa OS em que participou da execução", async () => {
    const r = await amb.req("POST", `/os/${osQueEleExecutou.id}/ciencia`, { como: tecnicoSupervisor });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro.codigo, "ciencia_propria");
    const [o] = await amb.db.select().from(os).where(eq(os.id, osQueEleExecutou.id));
    assert.equal(o!.cienciaEm, null);
  });

  it("acessa a caixa de alertas e os indicadores só das equipes do próprio escopo", async () => {
    assert.equal((await amb.req("GET", "/alertas", { como: tecnicoSupervisor })).status, 200);
    // O técnico sem supervisão também tem o sino (o dos avisos endereçados a ele, como os da própria ausência).
    assert.equal((await amb.req("GET", "/alertas", { como: semSupervisao })).status, 200);
    assert.equal((await amb.req("GET", "/indicadores", { como: tecnicoSupervisor, consulta: { mes: "2026-10" } })).status, 200);
    const outra = (await amb.db.select().from(os).where(eq(os.id, osDaOutra.id)))[0]!.equipeId;
    assert.equal((await amb.req("GET", "/indicadores", { como: tecnicoSupervisor, consulta: { mes: "2026-10", equipe_id: outra } })).status, 403);
  });
});
