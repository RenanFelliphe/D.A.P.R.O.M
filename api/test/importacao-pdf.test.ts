import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { alerta, atividade, auditoria, importacao, localInstalacao, os } from "../src/db/schema";
import { dataDoPdf, lerOrdensDoPdf } from "../src/dominio/importacao-pdf";
import { lerTextoDoPdf } from "../src/servicos/pdf-texto";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { PNG_VALIDO } from "./fixture-os";
import { CORRETIVA_4023470, gerarPdfDeOs, PREVENTIVA_4019821, type OsDoPdf } from "./fixture-pdf-os";

/** PDF qualquer feito com o pdfkit: só texto solto, ou só uma imagem (como uma folha digitalizada). */
async function pdfSimples(conteudo: { texto?: string[]; imagem?: boolean }): Promise<Uint8Array> {
  const doc = new PDFDocument({ size: "A4" });
  const pedacos: Buffer[] = [];
  doc.on("data", (p: Buffer) => pedacos.push(p));
  const pronto = new Promise((ok) => doc.on("end", ok));
  for (const linha of conteudo.texto ?? []) doc.text(linha);
  if (conteudo.imagem) doc.image(Buffer.from(PNG_VALIDO), 50, 50, { width: 400 });
  doc.end();
  await pronto;
  return new Uint8Array(Buffer.concat(pedacos));
}

const arquivoPdf = (bytes: Uint8Array, nome = "ordens.pdf") => new File([new Uint8Array(bytes)], nome, { type: "application/pdf" });

describe("Importação por PDF: leitura da OS impressa pelo SAP", () => {
  it("lê cada OS do PDF pelos rótulos impressos, no formato do contrato do SAP", async () => {
    const leitura = lerOrdensDoPdf(await lerTextoDoPdf(await gerarPdfDeOs([PREVENTIVA_4019821, CORRETIVA_4023470])));
    assert.deepEqual(leitura.paginasSemOrdem, []);
    assert.equal(leitura.ordens.length, 2);

    const [preventiva, corretiva] = leitura.ordens;
    assert.deepEqual(preventiva!.paginas, [1, 2]);
    assert.deepEqual(preventiva!.ordem, {
      numero_ordem: "4019821",
      numero_nota: null,
      tipo_ordem: "YBA2",
      tipo_atividade: "Z02-Manutenção Preventiva",
      codigo_atividade: null,
      titulo: "1.2 - Inspeção Funcional de Retificador",
      descricao:
        "1.2 - Inspeção Funcional de Retificador\nComponentes monitorados semanalmente:\nHorímetro: registro acumulado de horas de operação.\nTensão de saída (VDC): avaliação da estabilidade operacional.",
      centro_trabalho: "PROT_CAT",
      local_instalacao: { codigo: "GUARAPARI CATOD. RETIFIC/RETIFICADOR - GUARAPARI", endereco: null, plus_code: null, cliente: null },
      equipamento: "10002381 - RETIFICADOR - RET-12-001",
      prioridade: "Alto",
      data_inicio_prog: "2026-01-12",
      data_fim_prog: "2026-01-12",
      status_sap: "LIB CAPC NOAP SCDM",
      solicitante: null,
      criado_por: "IP1020251202",
      criada_em: "2025-12-02",
      plano_manutencao: "10573",
      item_manutencao: "10603",
    });
    assert.deepEqual(preventiva!.faltando, []);
    assert.deepEqual(preventiva!.observacoes, ["Tipo da ordem deduzido do tipo de atividade (Z02-Manutenção Preventiva)."]);

    assert.deepEqual(corretiva!.paginas, [3, 4]);
    const c = corretiva!.ordem;
    assert.deepEqual(
      [c.numero_ordem, c.numero_nota, c.tipo_ordem, c.centro_trabalho, c.local_instalacao.codigo, c.local_instalacao.endereco, c.plano_manutencao, c.criado_por],
      ["4023470", "10006463", "YBA1", "SERV_ESP", "VILA VELHA/REDE VILA VELHA", "Rua das Palmeiras, 120, Vila Velha/ES", null, "RFAVARO"],
    );
    assert.equal(c.descricao, "Caixa de válvula com acúmulo de água e sedimento.\nDesobstruir, drenar e verificar o estado da válvula.");
  });

  it("aponta o que falta e o que foi deduzido: sem status vale como liberada, sem tipo a conferência escolhe", async () => {
    const semNada: OsDoPdf = { ...CORRETIVA_4023470, numero: "4023999", tipoAtividade: "", statusSistema: "", centroPrincipal: "", local: "", inicio: "" };
    const [lida] = lerOrdensDoPdf(await lerTextoDoPdf(await gerarPdfDeOs([semNada]))).ordens;
    assert.equal(lida!.ordem.status_sap, "LIB");
    assert.equal(lida!.ordem.tipo_ordem, null);
    // Sem o centro principal, vale o centro da tabela de operações (que no PDF também veio vazio).
    assert.deepEqual(lida!.faltando, ["tipo_ordem", "centro_trabalho", "local_instalacao", "data_inicio_prog"]);
    assert.ok(lida!.observacoes.some((o) => o.startsWith("O PDF não traz o status do sistema")));

    const naoLiberada: OsDoPdf = { ...CORRETIVA_4023470, numero: "4023998", statusSistema: "CRTD" };
    const [outra] = lerOrdensDoPdf(await lerTextoDoPdf(await gerarPdfDeOs([naoLiberada]))).ordens;
    assert.equal(outra!.ordem.status_sap, "CRTD");
    assert.ok(outra!.observacoes.some((o) => o.startsWith("O status do sistema não tem LIB")));
  });

  it("folha sem número continua a OS anterior; folha sem número antes da primeira OS fica de fora", () => {
    const folha = (numero: number, linhas: string[]) => ({ numero, linhas });
    const leitura = lerOrdensDoPdf([
      folha(1, ["Capa do lote de impressão"]),
      folha(2, ["Ordem de Manutenção\tData da Ordem: 01/10/2026", "4100001", "Centro de trabalho principal da ordem:SERV_ESP", "Título da OS", "OBJETOS TÉCNICOS", "Local de Instalação:LOCAL/A"]),
      folha(3, ["Texto que continua a OS anterior"]),
      folha(4, ["Ordem de Manutenção", "4100002", "Tipo Ativ Manut:Z01-Manutenção Corretiva"]),
    ]);
    assert.deepEqual(leitura.paginasSemOrdem, [1]);
    assert.deepEqual(
      leitura.ordens.map((o) => [o.ordem.numero_ordem, o.paginas]),
      [
        ["4100001", [2, 3]],
        ["4100002", [4]],
      ],
    );
    assert.equal(leitura.ordens[0]!.ordem.titulo, "Título da OS");
    assert.equal(leitura.ordens[0]!.ordem.criada_em, "2026-10-01");
  });

  it("datas do PDF: dd/mm/aaaa, ano com 2 dígitos e data que não existe", () => {
    assert.equal(dataDoPdf("12/01/2026"), "2026-01-12");
    assert.equal(dataDoPdf("12.01.26"), "2026-01-12");
    assert.equal(dataDoPdf("31/02/2026"), null);
    assert.equal(dataDoPdf(""), null);
  });

  it("PDF digitalizado (só imagem) não tem texto: as folhas voltam vazias", async () => {
    const real = await lerTextoDoPdf(new Uint8Array(await readFile(new URL("../../base/os-examples/Exemplos_de_OS1.pdf", import.meta.url))));
    assert.ok(real.length > 0);
    assert.ok(real.every((p) => p.linhas.length === 0));
  });
});

describe("Importação por PDF: POST /importacoes/pdf/leitura e POST /importacoes/pdf", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let equipeServ: string;
  let equipeProt: string;
  let pdfDuasOs: Uint8Array;

  const ler = (bytes: Uint8Array | File, como: UsuarioDeTeste | null = admin) => {
    const form = new FormData();
    form.set("arquivo", bytes instanceof File ? bytes : arquivoPdf(bytes));
    return amb.req("POST", "/importacoes/pdf/leitura", { como, form });
  };
  const registrar = (bytes: Uint8Array, ordens: unknown, como: UsuarioDeTeste | null = admin, nome = "ordens.pdf") => {
    const form = new FormData();
    form.set("arquivo", arquivoPdf(bytes, nome));
    form.set("ordens", typeof ordens === "string" ? ordens : JSON.stringify(ordens));
    return amb.req("POST", "/importacoes/pdf", { como, form });
  };
  const osDe = async (numero: string) => (await amb.db.select().from(os).where(eq(os.numeroOrdem, numero)))[0];

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    admin = await amb.criarUsuario({ perfil: "admin" });
    equipeServ = (await amb.criarEquipe({ nome: "Serviços Especiais", centroTrabalho: "SERV_ESP" })).id;
    equipeProt = (await amb.criarEquipe({ nome: "Proteção Catódica", centroTrabalho: "PROT_CAT" })).id;
    // "1.2" já cadastrada em Atividades: a leitura a sugere pelo título "1.2 - Inspeção Funcional de Retificador".
    await amb.db.insert(atividade).values({ codigo: "1.2", descricao: "Inspeção Funcional de Retificador", modeloAprCodigo: null, provisorio: false });
    pdfDuasOs = await gerarPdfDeOs([PREVENTIVA_4019821, CORRETIVA_4023470]);
  });
  after(() => amb.fechar());

  it("a leitura devolve as OS do PDF com a situação no sistema e não grava nada", async () => {
    const antes = (await amb.db.select({ id: importacao.id }).from(importacao)).length;
    const r = await ler(pdfDuasOs);
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.deepEqual([r.corpo.arquivo, r.corpo.paginas, r.corpo.paginas_sem_ordem], ["ordens.pdf", 4, []]);
    const [preventiva, corretiva] = r.corpo.ordens;
    assert.deepEqual(preventiva.equipe, { id: equipeProt, nome: "Proteção Catódica" });
    assert.equal(preventiva.existente, null);
    assert.deepEqual(preventiva.atividade, { codigo: "1.2", com_modelo: false });
    assert.equal(preventiva.ordem.codigo_atividade, "1.2");
    assert.deepEqual(corretiva.equipe, { id: equipeServ, nome: "Serviços Especiais" });
    assert.equal(corretiva.atividade, null);
    assert.equal(corretiva.ordem.codigo_atividade, null);
    assert.deepEqual(corretiva.faltando, []);
    assert.equal(await osDe("4019821"), undefined);
    assert.equal((await amb.db.select({ id: importacao.id }).from(importacao)).length, antes);
  });

  it("registra as OS conferidas com origem pdf, guarda o PDF e deixa o registro no histórico e na auditoria", async () => {
    const { corpo: lido } = await ler(pdfDuasOs);
    // A conferência corrigiu a prioridade da corretiva.
    const conferidas = lido.ordens.map((o: any) => (o.ordem.numero_ordem === "4023470" ? { ...o.ordem, prioridade: "Alto" } : o.ordem));
    const r = await registrar(pdfDuasOs, conferidas, admin, "Ordens de outubro.pdf");
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.deepEqual([r.corpo.criadas, r.corpo.atualizadas, r.corpo.ignoradas], [2, 0, []]);
    assert.deepEqual(r.corpo.avisos.map((a: any) => [a.numero_ordem, a.motivo]), [
      ["4019821", "Atividade sem modelo de APR"],
      ["4023470", "Atividade sem modelo de APR"],
    ]);

    const preventiva = (await osDe("4019821"))!;
    assert.deepEqual(
      [preventiva.origem, preventiva.status, preventiva.tipo, preventiva.equipeId, preventiva.dataInicioProg, preventiva.planoManutencao, preventiva.itemManutencao, preventiva.statusSap, preventiva.dataOrdem, preventiva.criadoPorSap],
      ["pdf", "liberada", "preventiva", equipeProt, "2026-01-12", "10573", "10603", "LIB CAPC NOAP SCDM", "2025-12-02", "IP1020251202"],
    );
    // A atividade sugerida não tem modelo: a OS entra sem ela, como na leitura pela API.
    assert.equal(preventiva.codigoAtividade, null);
    const corretiva = (await osDe("4023470"))!;
    assert.deepEqual([corretiva.origem, corretiva.tipo, corretiva.prioridade, corretiva.numeroNota, corretiva.equipeId], ["pdf", "corretiva", "Alto", "10006463", equipeServ]);
    const [local] = await amb.db.select().from(localInstalacao).where(eq(localInstalacao.id, corretiva.localInstalacaoId));
    assert.deepEqual([local!.codigo, local!.endereco], ["VILA VELHA/REDE VILA VELHA", "Rua das Palmeiras, 120, Vila Velha/ES"]);

    const [registro] = await amb.db.select().from(importacao).where(eq(importacao.id, r.corpo.importacao_id));
    assert.deepEqual([registro!.origem, registro!.usuarioId, registro!.criadas, registro!.erro], ["pdf", admin.id, 2, null]);
    assert.equal(registro!.arquivo, `${r.corpo.importacao_id}/Ordens_de_outubro.pdf`);
    const guardado = await amb.armazenamento.ler("importacoes", registro!.arquivo!);
    assert.equal(Buffer.from(guardado!.subarray(0, 5)).toString("latin1"), "%PDF-");

    const [trilha] = await amb.db.select().from(auditoria).where(eq(auditoria.entidadeId, r.corpo.importacao_id));
    assert.equal(trilha!.acao, "importacao.pdf");
    assert.equal(trilha!.resumo, "Importou o PDF Ordens de outubro.pdf: 2 criadas, 0 atualizadas, 0 ignoradas");

    const lista = await amb.esperar(200, "GET", "/importacoes", { como: admin });
    assert.equal(lista.importacoes[0].origem, "pdf");
  });

  it("ler de novo mostra a OS que já existe; registrar de novo atualiza o planejamento sem duplicar", async () => {
    const { corpo: lido } = await ler(pdfDuasOs);
    assert.deepEqual(
      lido.ordens.map((o: any) => [o.ordem.numero_ordem, o.existente?.status, o.existente?.origem]),
      [
        ["4019821", "liberada", "pdf"],
        ["4023470", "liberada", "pdf"],
      ],
    );
    const so = lido.ordens.filter((o: any) => o.ordem.numero_ordem === "4019821").map((o: any) => ({ ...o.ordem, data_inicio_prog: "2026-01-20", data_fim_prog: "2026-01-21" }));
    const r = await registrar(pdfDuasOs, so);
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.deepEqual([r.corpo.criadas, r.corpo.atualizadas], [0, 1]);
    assert.equal((await osDe("4019821"))!.dataInicioProg, "2026-01-20");
    assert.equal((await amb.db.select({ id: os.id }).from(os).where(eq(os.numeroOrdem, "4019821"))).length, 1);
  });

  it("o PDF nunca cancela uma OS: status sem LIB é ignorado, a OS fica como está", async () => {
    const { corpo: lido } = await ler(pdfDuasOs);
    const r = await registrar(pdfDuasOs, [{ ...lido.ordens[1].ordem, status_sap: "ENTE" }]);
    assert.equal(r.status, 201);
    assert.deepEqual(r.corpo.ignoradas, [{ numero_ordem: "4023470", motivo: "Status SAP diferente de liberada" }]);
    const corretiva = (await osDe("4023470"))!;
    assert.deepEqual([corretiva.status, corretiva.canceladaEm], ["liberada", null]);
  });

  it("centro de trabalho sem equipe e obrigatório em branco viram ignoradas com o motivo", async () => {
    const outra: OsDoPdf = { ...CORRETIVA_4023470, numero: "4023471", centroPrincipal: "SEM_EQUIPE" };
    const pdf = await gerarPdfDeOs([outra, { ...outra, numero: "4023472", centroPrincipal: "SERV_ESP" }]);
    const { corpo: lido } = await ler(pdf);
    assert.equal(lido.ordens[0].equipe, null);
    const r = await registrar(pdf, [lido.ordens[0].ordem, { ...lido.ordens[1].ordem, titulo: " " }]);
    assert.equal(r.status, 201);
    assert.deepEqual(r.corpo.ignoradas, [
      { numero_ordem: "4023471", centro_trabalho: "SEM_EQUIPE", motivo: "Centro de trabalho sem equipe cadastrada" },
      { numero_ordem: "4023472", motivo: "Ordem inválida: titulo: Campo obrigatório" },
    ]);
  });

  it("ordem que não está no PDF: 422, nenhuma OS muda, a falha fica no histórico com o PDF e vira alerta", async () => {
    const r = await registrar(pdfDuasOs, [{ ...PREVENTIVA_4019821, numero_ordem: "4999999" }], admin, "lote.pdf");
    assert.equal(r.status, 422);
    assert.equal(r.corpo.erro.codigo, "ordem_fora_do_pdf");
    assert.equal(await osDe("4999999"), undefined);
    const [falha] = await amb.db.select().from(importacao).where(eq(importacao.erro, "A ordem 4999999 não está no PDF enviado"));
    assert.deepEqual([falha!.origem, falha!.criadas], ["pdf", 0]);
    assert.ok(await amb.armazenamento.ler("importacoes", falha!.arquivo!));
    const [aviso] = await amb.db.select().from(alerta).where(and(eq(alerta.importacaoId, falha!.id), eq(alerta.tipo, "falha_importacao")));
    assert.equal(aviso!.detalhe, 'A importação do PDF da OS "lote.pdf" falhou: A ordem 4999999 não está no PDF enviado. Nenhuma OS foi criada, alterada ou removida.');

    const repetida = await registrar(pdfDuasOs, [{ numero_ordem: "4019821" }, { numero_ordem: "4019821" }]);
    assert.equal(repetida.corpo.erro.codigo, "ordem_repetida");
  });

  it("recusa o que não é PDF, o PDF digitalizado, o PDF sem OS, o arquivo vazio e as ordens fora do formato", async () => {
    const texto = await ler(new File(["Ordem de Manutenção 4019821"], "ordem.txt", { type: "text/plain" }));
    assert.deepEqual([texto.status, texto.corpo.erro.codigo], [422, "pdf_invalido"]);
    const digitalizado = await ler(await pdfSimples({ imagem: true }));
    assert.deepEqual([digitalizado.status, digitalizado.corpo.erro.codigo], [422, "pdf_sem_texto"]);
    const real = await ler(new Uint8Array(await readFile(new URL("../../base/os-examples/Exemplos_de_OS1.pdf", import.meta.url))));
    assert.deepEqual([real.status, real.corpo.erro.codigo], [422, "pdf_sem_texto"]);
    const semOs = await ler(await pdfSimples({ texto: ["Relatório mensal", "Nada de ordem aqui"] }));
    assert.deepEqual([semOs.status, semOs.corpo.erro.codigo], [422, "pdf_sem_ordem"]);
    assert.equal((await ler(new File([], "vazio.pdf"))).corpo.erro.codigo, "arquivo_vazio");
    assert.equal((await amb.req("POST", "/importacoes/pdf/leitura", { como: admin, form: new FormData() })).status, 422);

    for (const ordens of ["não é json", "{}", "[]", JSON.stringify([{ titulo: "sem número" }])]) {
      const r = await registrar(pdfDuasOs, ordens);
      assert.deepEqual([r.status, r.corpo.erro.codigo], [422, "validacao"], ordens);
    }
  });

  it("só o admin lê e registra PDF; sem token é 401", async () => {
    const tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeServ });
    assert.equal((await ler(pdfDuasOs, null)).status, 401);
    assert.equal((await ler(pdfDuasOs, tecnico)).status, 403);
    assert.equal((await registrar(pdfDuasOs, [{ numero_ordem: "4019821" }], tecnico)).status, 403);
  });

  it("o diagnóstico da entrada de OS conta o PDF no método Arquivo", async () => {
    const resumo = await amb.esperar(200, "GET", "/importacoes/resumo", { como: admin, consulta: { periodo: "7d" } });
    assert.ok(resumo.por_origem.planilha.criadas >= 2);
    assert.ok(resumo.por_origem.planilha.arquivos >= 3);
    assert.equal(resumo.serie.reduce((t: number, p: any) => t + p.planilha, 0), resumo.por_origem.planilha.criadas);
  });
});
