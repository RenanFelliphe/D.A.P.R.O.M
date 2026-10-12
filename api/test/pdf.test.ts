import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { os } from "../src/db/schema";
import { gerarPdfOs, manipularPdfOs } from "../src/servicos/pdf-os";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { criarOs, paginasDoPdf, textoDoPdf } from "./fixture-os";

const comeca = (b: Uint8Array) => Buffer.from(b.subarray(0, 5)).toString("latin1");

describe("PDF da OS", () => {
  let amb: Ambiente;
  let equipeId: string;
  let supervisor: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-10T15:00:00Z") });
    equipeId = (await amb.criarEquipe()).id;
    supervisor = await amb.criarUsuario({ perfil: "tecnico", equipeId, nome: "Marta Supervisora", supervisor: true });
  });
  after(() => amb.fechar());

  it("gera um PDF de 2 páginas com os dados da OS, da APR e da execução (horário de Brasília)", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, numeroOrdem: "4023470", fotos: 2 });
    const pdf = await gerarPdfOs(amb.deps, o.osId);
    assert.equal(comeca(pdf), "%PDF-");
    assert.equal(paginasDoPdf(pdf), 2);

    const texto = textoDoPdf(await gerarPdfOs(amb.deps, o.osId, { comprimir: false }));
    for (const esperado of [
      "ANÁLISE PRELIMINAR DE RISCO",
      "Supervisor da Atividade",
      "Elismário dos Santos",
      "Damião Pestana",
      "O local está sinalizado?",
      "ALERTA",
      "Sem intercorrências",
      "Grande Vitória",
      "Versão 04",
      "24/07/2026",
      "ORDEM DE MANUTENÇÃO Nº 4023470",
      "09/10/2026 09:00", // 12:00Z em Brasília
      "09/10/2026 12:00",
      "3h 00min",
      "30min",
      "2h 30min",
      "Dreno desobstruído e testado",
      "EXECUTANTE",
      "RESPONSÁVEL DA MANUTENÇÃO",
      "-20.315500, -40.312800",
      "Posição: não informada",
    ]) {
      assert.ok(texto.includes(esperado), `faltou "${esperado}" no PDF`);
    }
    assert.ok(!texto.includes("[imagem indisponível]"));
    assert.ok(!texto.includes("Ciente"));
  });

  it("atividade de vários dias: soma o tempo líquido dos trechos e lista as datas dos anteriores", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true, trechoAnterior: true });
    const texto = textoDoPdf(await gerarPdfOs(amb.deps, o.osId, { comprimir: false }));
    assert.ok(texto.includes("TRECHOS ANTERIORES"));
    assert.ok(texto.includes("08/10/2026"));
    assert.ok(texto.includes("5h 00min"), "tempo total dos dois trechos");
    assert.ok(texto.includes("4h 30min"), "líquido: 2h do dia anterior + 2h30 do último");
  });

  it("mostra a ciência do supervisor quando existe", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    await amb.db.update(os).set({ cienciaPor: supervisor.id, cienciaEm: new Date("2026-10-10T14:30:00Z") }).where(eq(os.id, o.osId));
    const pdf = await gerarPdfOs(amb.deps, o.osId, { comprimir: false });
    assert.equal(paginasDoPdf(pdf), 2);
    const texto = textoDoPdf(pdf);
    assert.ok(texto.includes("CIÊNCIA DO SUPERVISOR"));
    assert.ok(texto.includes("Marta Supervisora"));
    assert.ok(texto.includes("10/10/2026 11:30"));
  });

  it("imagem ausente ou em formato ilegível vira \"[imagem indisponível]\" e o PDF sai igual", async () => {
    const ausentes = await criarOs(amb, { equipeId, encerrada: true, fotos: 1, gravarImagens: false });
    const t1 = textoDoPdf(await gerarPdfOs(amb.deps, ausentes.osId, { comprimir: false }));
    assert.ok(t1.includes("[imagem indisponível]"));

    const ruins = await criarOs(amb, { equipeId, encerrada: true, fotos: 1, bytesFoto: new Uint8Array([1, 2, 3, 4]) });
    const pdf = await gerarPdfOs(amb.deps, ruins.osId, { comprimir: false });
    assert.equal(paginasDoPdf(pdf), 2);
    assert.ok(textoDoPdf(pdf).includes("[imagem indisponível]"));
  });

  it("OS sem Execução encerrada não gera PDF", async () => {
    const o = await criarOs(amb, { equipeId });
    await assert.rejects(() => gerarPdfOs(amb.deps, o.osId), /Execução encerrada/);
    await assert.rejects(() => gerarPdfOs(amb.deps, "00000000-0000-4000-8000-000000000000"), /não encontrada/);
  });

  it("a tarefa pdf_os guarda o PDF no bucket pdfs (caminho = id da OS), atualiza a OS e regera sobrescrevendo", async () => {
    const o = await criarOs(amb, { equipeId, encerrada: true });
    await manipularPdfOs(amb.deps, { id: "t", referenciaId: o.osId });
    const guardado = amb.armazenamento.arquivos.get(`pdfs/${o.osId}`);
    assert.ok(guardado);
    assert.equal(guardado.tipoMime, "application/pdf");
    assert.equal(comeca(guardado.bytes), "%PDF-");
    const [linha] = await amb.db.select().from(os).where(eq(os.id, o.osId));
    assert.equal(linha!.pdfPath, o.osId);
    assert.deepEqual(linha!.pdfEm, amb.relogio.agora);

    // Ciência dada depois: o PDF é gerado de novo, no mesmo caminho.
    amb.relogio.agora = new Date("2026-10-11T12:00:00Z");
    await amb.db.update(os).set({ cienciaPor: supervisor.id, cienciaEm: amb.relogio.agora }).where(eq(os.id, o.osId));
    await manipularPdfOs(amb.deps, { id: "t", referenciaId: o.osId });
    const novo = amb.armazenamento.arquivos.get(`pdfs/${o.osId}`)!;
    assert.notEqual(Buffer.compare(Buffer.from(novo.bytes), Buffer.from(guardado.bytes)), 0);
    const [depois] = await amb.db.select().from(os).where(eq(os.id, o.osId));
    assert.deepEqual(depois!.pdfEm, new Date("2026-10-11T12:00:00Z"));
    amb.relogio.agora = new Date("2026-10-10T15:00:00Z");
  });

  it("a tarefa pdf_os de OS ainda sem encerramento falha (a tarefa tenta de novo) e sem referência também", async () => {
    const o = await criarOs(amb, { equipeId });
    await assert.rejects(() => manipularPdfOs(amb.deps, { id: "t", referenciaId: o.osId }));
    await assert.rejects(() => manipularPdfOs(amb.deps, { id: "t", referenciaId: null }), /referência/);
  });
});

describe("GET /os/{id}/pdf", () => {
  let amb: Ambiente;
  let equipeA: string;
  let equipeB: string;
  let tecnicoA: UsuarioDeTeste;
  let supervisorA: UsuarioDeTeste;
  let tecnicoB: UsuarioDeTeste;
  let admin: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente({ relogio: new Date("2026-10-10T15:00:00Z") });
    equipeA = (await amb.criarEquipe()).id;
    equipeB = (await amb.criarEquipe()).id;
    tecnicoA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA });
    supervisorA = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeA, supervisor: true });
    tecnicoB = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeB });
    admin = await amb.criarUsuario({ perfil: "admin" });
  });
  after(() => amb.fechar());

  it("recusa sem token (401)", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    assert.equal((await amb.req("GET", `/os/${o.osId}/pdf`)).status, 401);
  });

  it("OS encerrada sem PDF guardado: gera na hora, guarda, atualiza a OS e devolve application/pdf inline", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    const r = await amb.req("GET", `/os/${o.osId}/pdf`, { como: tecnicoA });
    assert.equal(r.status, 200);
    assert.equal(r.cabecalhos.get("content-type"), "application/pdf");
    assert.match(r.cabecalhos.get("content-disposition") ?? "", /^inline/);
    const bytes = new Uint8Array(r.corpo as ArrayBuffer);
    assert.equal(comeca(bytes), "%PDF-");
    assert.equal(paginasDoPdf(bytes), 2);
    assert.ok(amb.armazenamento.arquivos.has(`pdfs/${o.osId}`));
    const [linha] = await amb.db.select().from(os).where(eq(os.id, o.osId));
    assert.equal(linha!.pdfPath, o.osId);
    assert.ok(linha!.pdfEm);
  });

  it("com PDF guardado, devolve o guardado sem gerar de novo", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    await amb.armazenamento.gravar("pdfs", o.osId, new TextEncoder().encode("%PDF-guardado"), "application/pdf");
    await amb.db.update(os).set({ pdfPath: o.osId, pdfEm: amb.relogio.agora }).where(eq(os.id, o.osId));
    const r = await amb.req("GET", `/os/${o.osId}/pdf`, { como: supervisorA });
    assert.equal(r.status, 200);
    assert.equal(Buffer.from(r.corpo as ArrayBuffer).toString(), "%PDF-guardado");
  });

  it("OS que ainda não encerrou: 409", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, status: "em_execucao" });
    const r = await amb.req("GET", `/os/${o.osId}/pdf`, { como: tecnicoA });
    assert.equal(r.status, 409);
    assert.equal(r.corpo.erro.codigo, "os_nao_encerrada");
    assert.equal(r.corpo.erro.mensagem, "A OS ainda não foi encerrada");
  });

  it("técnico e supervisor só veem a própria equipe (404 para a outra); o admin vê todas", async () => {
    const o = await criarOs(amb, { equipeId: equipeA, encerrada: true });
    const caminho = `/os/${o.osId}/pdf`;
    assert.equal((await amb.req("GET", caminho, { como: tecnicoB })).status, 404);
    assert.equal((await amb.req("GET", caminho, { como: tecnicoA })).status, 200);
    assert.equal((await amb.req("GET", caminho, { como: supervisorA })).status, 200);
    for (const u of [admin]) assert.equal((await amb.req("GET", caminho, { como: u })).status, 200, u.perfil);
  });

  it("OS inexistente ou id que não é UUID: 404", async () => {
    assert.equal((await amb.req("GET", "/os/00000000-0000-4000-8000-000000000000/pdf", { como: admin })).status, 404);
    assert.equal((await amb.req("GET", "/os/abc/pdf", { como: admin })).status, 404);
  });
});
