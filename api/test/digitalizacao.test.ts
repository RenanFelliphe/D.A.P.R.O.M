import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { auditoria, digitalizacao, execucao, importacao, localInstalacao, os, osDigitalizacao, tarefa } from "../src/db/schema";
import { lerManuscritoComIa } from "../src/dominio/digitalizacao-ia";
import { MotorOcrTesseract } from "../src/servicos/ocr";
import { lerTextoDoPdf } from "../src/servicos/pdf-texto";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { IAIndisponivel } from "../src/servicos/ia";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { CORRETIVA_4023470, gerarPdfDeOs, PREVENTIVA_4019821 } from "./fixture-pdf-os";

const arquivoPdf = (bytes: Uint8Array, nome = "folhas.pdf") => new File([new Uint8Array(bytes)], nome, { type: "application/pdf" });

/** O que a IA de visão devolve de uma OS (o JSON que a instrução pede). */
const manuscrito = (o: Partial<{ inicio: string | null; fim: string | null; pessoas: number | null; texto: string | null; avisos: string[] }> = {}) =>
  JSON.stringify({ inicio: "2026-05-17T11:09", fim: "2026-05-17T12:18", pessoas: 2, texto: "Serviço feito normalmente.", avisos: [], ...o });

describe("Digitalização de OS antigas", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let equipeServ: string;
  let equipeProt: string;
  /** O PDF da leitura em curso (4 folhas, 2 OS) e as linhas que o OCR "leria" de cada folha: as do próprio PDF com texto. */
  let pdf: Uint8Array;
  let linhasDasFolhas: string[][];
  /** Os números das duas OS do PDF atual (a preventiva e a corretiva): cada teste usa os seus, porque o banco é um só. */
  let n1 = "";
  let n2 = "";
  let sequencia = 0;

  const enviar = (bytes: Uint8Array | File, como: UsuarioDeTeste | null = admin) => {
    const form = new FormData();
    form.set("arquivo", bytes instanceof File ? bytes : arquivoPdf(bytes));
    return amb.req("POST", "/digitalizacoes", { como, form });
  };
  /** Envia o PDF, roda a tarefa de leitura e devolve a digitalização pronta (ou falhada). */
  async function lerTudo(bytes: Uint8Array = pdf) {
    const enviada = await enviar(bytes);
    assert.equal(enviada.status, 202, JSON.stringify(enviada.corpo));
    await executarTarefasPendentes(amb.deps);
    const r = await amb.req("GET", `/digitalizacoes/${enviada.corpo.id}`, { como: admin });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    return r.corpo;
  }
  const execucaoConferida = (o: Partial<{ inicio: string | null; fim: string | null; numero_pessoas: number | null; texto: string | null }> = {}) => ({
    inicio: "2026-05-17T11:09",
    fim: "2026-05-17T12:18",
    numero_pessoas: 2,
    texto: "Serviço feito normalmente.",
    ...o,
  });
  /** O corpo do registro a partir da leitura, como a tela o monta: a OS lida, sem mexer. */
  const registro = (lida: any, extras: Record<string, unknown> = {}) => ({
    chave: lida.chave,
    ordem: lida.ordem,
    execucao: execucaoConferida({ inicio: lida.manuscrito.inicio, fim: lida.manuscrito.fim, numero_pessoas: lida.manuscrito.pessoas, texto: lida.manuscrito.texto }),
    ...extras,
  });
  const osDe = async (numero: string) => (await amb.db.select().from(os).where(eq(os.numeroOrdem, numero)))[0];

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    admin = await amb.criarUsuario({ perfil: "admin" });
    equipeServ = (await amb.criarEquipe({ nome: "Serviços Especiais", centroTrabalho: "SERV_ESP" })).id;
    equipeProt = (await amb.criarEquipe({ nome: "Proteção Catódica", centroTrabalho: "PROT_CAT" })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeServ });
  });
  after(() => amb.fechar());

  /** Gera o PDF (com números de ordem novos) e programa o OCR e a IA para a próxima leitura. */
  async function programar(opcoes: { ia?: string[]; iaFora?: boolean } = {}) {
    sequencia += 2;
    n1 = String(4100000 + sequencia);
    n2 = String(4100001 + sequencia);
    pdf = await gerarPdfDeOs([{ ...PREVENTIVA_4019821, numero: n1 }, { ...CORRETIVA_4023470, numero: n2 }]);
    linhasDasFolhas = (await lerTextoDoPdf(pdf)).map((p) => p.linhas);
    amb.ocr.folhas = linhasDasFolhas;
    amb.ocr.falhar = false;
    amb.ia.falhar = Boolean(opcoes.iaFora);
    amb.ia.chamadas.length = 0;
    amb.ia.respostas = opcoes.ia ?? [manuscrito(), manuscrito({ inicio: "2026-10-14T08:30", fim: "2026-10-14T10:00", pessoas: 3, texto: null })];
  }

  describe("a leitura, em segundo plano", () => {
    it("o admin envia o PDF e a tarefa lê as folhas: OS, manuscrito pela IA e as conferências", async () => {
      await programar();
      const enviada = await enviar(pdf);
      assert.equal(enviada.status, 202, JSON.stringify(enviada.corpo));
      assert.deepEqual([enviada.corpo.estado, enviada.corpo.nome_arquivo], ["lendo", "folhas.pdf"]);
      assert.equal(enviada.corpo.leitura, undefined);
      assert.equal((await amb.db.select().from(tarefa).where(eq(tarefa.referenciaId, enviada.corpo.id)))[0]?.tipo, "digitalizacao");

      assert.equal(await executarTarefasPendentes(amb.deps) >= 1, true);
      const { corpo } = await amb.req("GET", `/digitalizacoes/${enviada.corpo.id}`, { como: admin });
      assert.deepEqual([corpo.estado, corpo.paginas, corpo.paginas_lidas, corpo.usou_ia], ["lida", 4, 4, true]);
      assert.deepEqual([corpo.leitura.paginas, corpo.leitura.paginas_sem_ordem, corpo.leitura.ia], [4, [], { usada: true, motivo: null }]);

      const [preventiva, corretiva] = corpo.leitura.ordens;
      assert.deepEqual([preventiva.chave, preventiva.ordem.numero_ordem, preventiva.folhas_da_os], [n1, n1, [1, 2]]);
      assert.deepEqual([corretiva.chave, corretiva.folhas_da_os], [n2, [3, 4]]);
      assert.deepEqual(preventiva.manuscrito, { inicio: "2026-05-17T11:09", fim: "2026-05-17T12:18", pessoas: 2, texto: "Serviço feito normalmente.", avisos: [], lido_por: "ia" });
      assert.equal(corretiva.manuscrito.texto, null);
      // O impresso confere com os cadastros; o manuscrito nunca "confere": nada o confirma além da pessoa.
      assert.equal(preventiva.estados.centro_trabalho, "confere");
      assert.equal(preventiva.estados.local_instalacao, "duvidoso");
      assert.deepEqual([preventiva.estados.inicio_real, preventiva.estados.fim_real, preventiva.estados.numero_pessoas], ["duvidoso", "duvidoso", "duvidoso"]);
      assert.equal(corretiva.estados.texto, undefined);
      // A situação no sistema é de agora: a OS ainda não existe e a equipe sai do centro de trabalho.
      assert.deepEqual([preventiva.situacao.existente, preventiva.situacao.equipe], [null, { id: equipeProt, nome: "Proteção Catódica" }]);
      assert.equal(corretiva.situacao.equipe.id, equipeServ);
      // Cada OS foi à IA uma vez, com as imagens das folhas dela, e só do que está escrito à mão.
      assert.equal(amb.ia.chamadas.length, 2);
      assert.equal(amb.ia.chamadas[0]!.modelo, "digitalizacao");
      assert.equal(amb.ia.chamadas[0]!.mensagens[1]!.imagens!.length, 2);
      assert.equal(amb.ia.chamadas[0]!.mensagens[1]!.imagens![0]!.tipoMime, "image/jpeg");
    });

    it("a leitura vem em GET /digitalizacoes/{id}/folhas/{n} (JPEG) e a lista traz só as que faltam registrar", async () => {
      await programar();
      const lida = await lerTudo();
      const folha = await amb.req("GET", `/digitalizacoes/${lida.id}/folhas/1`, { como: admin });
      assert.equal(folha.status, 200);
      assert.equal(folha.cabecalhos.get("content-type"), "image/jpeg");
      assert.equal(new Uint8Array(folha.corpo)[0], 0xff);
      assert.equal((await amb.req("GET", `/digitalizacoes/${lida.id}/folhas/5`, { como: admin })).status, 404);
      assert.equal((await amb.req("GET", `/digitalizacoes/${lida.id}/folhas/0`, { como: admin })).status, 404);
      const lista = await amb.req("GET", "/digitalizacoes", { como: admin });
      assert.equal(lista.corpo.digitalizacoes.some((d: any) => d.id === lida.id && d.leitura === undefined), true);
    });

    it("sem a IA, o impresso é lido e o manuscrito fica em branco para a pessoa digitar", async () => {
      await programar({ iaFora: true });
      const lida = await lerTudo();
      assert.equal(lida.estado, "lida");
      assert.equal(lida.usou_ia, false);
      assert.equal(lida.leitura.ia.usada, false);
      assert.match(lida.leitura.ia.motivo, /IA/);
      const [preventiva] = lida.leitura.ordens;
      assert.deepEqual(preventiva.manuscrito, { inicio: null, fim: null, pessoas: null, texto: null, avisos: [], lido_por: "nenhum" });
      assert.deepEqual([preventiva.estados.inicio_real, preventiva.estados.numero_pessoas], ["faltando", "faltando"]);
      assert.equal(preventiva.ordem.numero_ordem, n1);
    });

    it("a IA que cai no meio deixa as demais OS sem ela, e a que devolve lixo só perde o manuscrito dela", async () => {
      await programar({ ia: ["isto não é um JSON", manuscrito()] });
      const lida = await lerTudo();
      const [a, b] = lida.leitura.ordens;
      assert.equal(a.manuscrito.lido_por, "nenhum");
      assert.equal(a.avisos.some((x: string) => /IA não conseguiu/.test(x)), true);
      assert.equal(b.manuscrito.lido_por, "ia");
      assert.deepEqual(lida.leitura.ia, { usada: true, motivo: null });
    });

    it("corrige o centro de trabalho pelo cadastro e avisa o que a conferência achou", async () => {
      const ordenado = [...linhasDasFolhas.map((l) => [...l])];
      // O OCR perde o "_": PROT_CAT sai PROTCAT. E o fim real vem antes do início.
      ordenado[0] = ordenado[0]!.map((l) => l.replace("PROT_CAT", "PROTCAT"));
      amb.ocr.folhas = ordenado;
      amb.ia.falhar = false;
      amb.ia.respostas = [manuscrito({ inicio: "2026-05-17T12:18", fim: "2026-05-17T11:09" }), manuscrito()];
      const lida = await lerTudo();
      const [preventiva] = lida.leitura.ordens;
      assert.equal(preventiva.ordem.centro_trabalho, "PROT_CAT");
      assert.equal(preventiva.estados.centro_trabalho, "confere");
      assert.equal(preventiva.observacoes.some((x: string) => /corrigido pelo cadastro/.test(x)), true);
      assert.deepEqual([preventiva.estados.inicio_real, preventiva.estados.fim_real], ["invalido", "invalido"]);
      assert.equal(preventiva.avisos.some((x: string) => /fim real vem antes/.test(x)), true);
    });

    it("centro de trabalho sem equipe fica inválido", async () => {
      const ordenado = linhasDasFolhas.map((l) => l.map((x) => x.replace("SERV_ESP", "XYZ_999")));
      amb.ocr.folhas = ordenado;
      amb.ia.falhar = false;
      amb.ia.respostas = [manuscrito(), manuscrito()];
      const lida = await lerTudo();
      assert.equal(lida.leitura.ordens[1].estados.centro_trabalho, "invalido");
    });

    it("o OCR que falha, o PDF sem OS e o PDF inválido viram falha com a mensagem, sem repetir a tarefa", async () => {
      await programar();
      amb.ocr.falhar = true;
      const f1 = await lerTudo();
      assert.deepEqual([f1.estado, f1.leitura], ["falhou", undefined]);
      assert.match(f1.erro, /Não foi possível ler as folhas/);

      amb.ocr.falhar = false;
      amb.ocr.folhas = [["Relatório mensal", "Nada de ordem aqui"]];
      const f2 = await lerTudo();
      assert.equal(f2.estado, "falhou");
      assert.match(f2.erro, /Nenhuma OS foi reconhecida/);

      const enviada = await enviar(new File([new Uint8Array([1, 2, 3, 4])], "x.pdf"));
      assert.equal(enviada.status, 422);
      assert.equal(enviada.corpo.erro.codigo, "pdf_invalido");
      assert.equal((await enviar(new File([], "vazio.pdf"))).corpo.erro.codigo, "arquivo_vazio");
      // Uma tarefa que falhou não volta para a fila: ler de novo gastaria a IA outra vez.
      assert.equal((await amb.db.select().from(tarefa).where(eq(tarefa.estado, "pendente"))).filter((t) => t.tipo === "digitalizacao").length, 0);
    });

    it("só o admin usa a Digitalização", async () => {
      assert.equal((await enviar(pdf, tecnico)).status, 403);
      assert.equal((await enviar(pdf, null)).status, 401);
      assert.equal((await amb.req("GET", "/digitalizacoes", { como: tecnico })).status, 403);
    });
  });

  describe("o registro", () => {
    it("registra as OS como encerradas, de histórico: sem execução, já exportadas, com o PDF das folhas", async () => {
      await programar();
      const lida = await lerTudo();
      const r = await amb.req("POST", `/digitalizacoes/${lida.id}/registro`, { como: admin, json: { ordens: lida.leitura.ordens.map((o: any) => registro(o)) } });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.deepEqual([r.corpo.criadas, r.corpo.atualizadas, r.corpo.ignoradas], [2, 0, []]);
      assert.equal(r.corpo.registradas.length, 2);

      const preventiva = (await osDe(n1))!;
      assert.deepEqual([preventiva.status, preventiva.origem, preventiva.tipo, preventiva.equipeId], ["encerrada", "digitalizacao", "preventiva", equipeProt]);
      assert.notEqual(preventiva.exportadaSapEm, null);
      assert.equal(preventiva.pdfPath, preventiva.id);
      assert.equal(preventiva.cienciaPor, null);
      assert.deepEqual(await amb.db.select().from(execucao).where(eq(execucao.osId, preventiva.id)), []);

      const [historico] = await amb.db.select().from(osDigitalizacao).where(eq(osDigitalizacao.osId, preventiva.id));
      assert.deepEqual([historico!.inicioReal?.toISOString(), historico!.fimReal?.toISOString()], ["2026-05-17T14:09:00.000Z", "2026-05-17T15:18:00.000Z"]);
      assert.deepEqual([historico!.numeroPessoas, historico!.manuscritoFonte, historico!.paginas, historico!.registradaPor], [2, "ia", [1, 2], admin.id]);

      const [lote] = await amb.db.select().from(digitalizacao).where(eq(digitalizacao.id, lida.id));
      assert.equal(lote!.estado, "registrada");
      const [imp] = await amb.db.select().from(importacao).where(eq(importacao.id, lote!.importacaoId!));
      assert.deepEqual([imp!.origem, imp!.criadas, imp!.usuarioId], ["digitalizacao", 2, admin.id]);
      assert.equal((await amb.db.select().from(auditoria)).some((a) => a.acao === "importacao.digitalizacao"), true);

      // O PDF da OS é o das folhas digitalizadas (uma página por folha), e a OS não entra na planilha de baixa do SAP.
      const pdfDaOs = await amb.req("GET", `/os/${preventiva.id}/pdf`, { como: admin });
      assert.equal(pdfDaOs.status, 200);
      assert.equal(Buffer.from(pdfDaOs.corpo).subarray(0, 5).toString(), "%PDF-");
      const detalhe = await amb.req("GET", `/os/${preventiva.id}`, { como: admin });
      assert.equal(detalhe.corpo.os.em_papel.fonte, "ia");
      assert.equal(detalhe.corpo.os.em_papel.folhas, 2);
      assert.equal(detalhe.corpo.os.em_papel.numero_pessoas, 2);
      // A digitalização é um método de entrada à parte no diagnóstico, e conta no perfil da Vitória.
      const resumo = await amb.esperar(200, "GET", "/importacoes/resumo", { como: admin, consulta: { periodo: "7d" } });
      assert.deepEqual([resumo.por_origem.digitalizacao.criadas, resumo.por_origem.digitalizacao.arquivos], [2, 1]);
      assert.equal(resumo.por_origem.planilha.criadas, 0);
      assert.equal((await amb.esperar(200, "GET", "/vitoria/sobre", { como: admin })).estatisticas.digitalizadas >= 2, true);
      // Registrar de novo o mesmo lote não repete nada.
      const outra = await amb.req("POST", `/digitalizacoes/${lida.id}/registro`, { como: admin, json: { ordens: lida.leitura.ordens.map((o: any) => registro(o)) } });
      assert.deepEqual([outra.status, outra.corpo.erro.codigo], [409, "digitalizacao_nao_lida"]);
    });

    it("o que a pessoa corrige vale (o número da ordem inclusive) e a fonte do manuscrito vira manual", async () => {
      await programar();
      const lida = await lerTudo();
      const [a, b] = lida.leitura.ordens;
      const corrigido = String(Number(n1) + 500);
      const r = await amb.req("POST", `/digitalizacoes/${lida.id}/registro`, {
        como: admin,
        json: {
          ordens: [
            { chave: a.chave, ordem: { ...a.ordem, numero_ordem: corrigido, titulo: "Inspeção corrigida" }, execucao: execucaoConferida({ numero_pessoas: 3 }) },
            { chave: b.chave, ordem: b.ordem, execucao: { inicio: null, fim: null, numero_pessoas: null, texto: null } },
          ],
        },
      });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      const corrigida = (await osDe(corrigido))!;
      assert.equal(corrigida.titulo, "Inspeção corrigida");
      assert.equal(await osDe(n1), undefined);
      const [h] = await amb.db.select().from(osDigitalizacao).where(eq(osDigitalizacao.osId, corrigida.id));
      assert.equal(h!.manuscritoFonte, "manual");
      const [vazia] = await amb.db.select().from(osDigitalizacao).where(eq(osDigitalizacao.osId, (await osDe(n2))!.id));
      assert.deepEqual([vazia!.manuscritoFonte, vazia!.inicioReal, vazia!.numeroPessoas], ["nenhuma", null, null]);
    });

    it("OS que já existe: encerra a liberada e sem execução; recusa a que já tem execução ou já foi encerrada", async () => {
      // A segunda OS já está liberada no sistema (veio do SAP) e a primeira já foi encerrada pelo caminho normal.
      await programar();
      const lida = await lerTudo();
      const [a, b] = lida.leitura.ordens;
      const [local] = await amb.db.insert(localInstalacao).values({ codigo: `LOCAL ${n1}` }).returning({ id: localInstalacao.id });
      const base = (numero: string, status: "liberada" | "encerrada") => ({
        numeroOrdem: numero,
        tipo: "corretiva" as const,
        titulo: "OS do sistema",
        localInstalacaoId: local!.id,
        equipeId: equipeServ,
        dataInicioProg: "2026-05-17",
        status,
        origem: "sap" as const,
      });
      await amb.db.insert(os).values([base(n1, "encerrada"), base(n2, "liberada")]);
      const r = await amb.req("POST", `/digitalizacoes/${lida.id}/registro`, { como: admin, json: { ordens: [registro(a), registro(b)] } });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.deepEqual([r.corpo.criadas, r.corpo.atualizadas], [0, 1]);
      assert.equal(r.corpo.ignoradas.length, 1);
      assert.equal(r.corpo.ignoradas[0].numero_ordem, n1);
      assert.match(r.corpo.ignoradas[0].motivo, /já está no sistema/);
      const encerrada = (await osDe(n2))!;
      assert.deepEqual([encerrada.status, encerrada.origem, encerrada.pdfPath], ["encerrada", "sap", encerrada.id]);
      // A OS recusada não ganhou PDF das folhas: o dela (se houvesse) não foi tocado.
      assert.equal((await osDe(n1))!.pdfPath, null);
      assert.equal(await amb.armazenamento.existe("pdfs", (await osDe(n1))!.id), false);
    });

    it("recusa o fim antes do início, a OS fora da leitura, a repetida e o lote que ainda não foi lido", async () => {
      await programar();
      const lida = await lerTudo();
      const [a, b] = lida.leitura.ordens;
      const post = (ordens: unknown[]) => amb.req("POST", `/digitalizacoes/${lida.id}/registro`, { como: admin, json: { ordens } });
      assert.equal((await post([{ ...registro(a), execucao: execucaoConferida({ inicio: "2026-05-17T12:00", fim: "2026-05-17T11:00" }) }])).corpo.erro.codigo, "execucao_invalida");
      assert.equal((await post([{ ...registro(a), chave: "9999999" }])).corpo.erro.codigo, "ordem_fora_do_pdf");
      assert.equal((await post([registro(a), registro(a)])).corpo.erro.codigo, "ordem_repetida");
      assert.equal((await post([registro(a), { ...registro(b), ordem: { ...b.ordem, numero_ordem: a.ordem.numero_ordem } }])).corpo.erro.codigo, "ordem_repetida");
      assert.equal((await post([{ ...registro(a), execucao: { ...execucaoConferida(), inicio: "17/05/2026" } }])).status, 422);
      assert.equal((await post([])).status, 422);
      assert.equal((await post([registro({ ...a, ordem: { ...a.ordem, centro_trabalho: "XYZ_999" } })])).corpo.criadas, 0);
      // Nada foi gravado pelas tentativas: o lote segue pronto e a OS não existe.
      assert.equal((await amb.req("GET", `/digitalizacoes/${lida.id}`, { como: admin })).corpo.estado, "lida");
      assert.equal(await osDe(n1), undefined);
      // Um lote que ainda lê não registra.
      amb.ocr.folhas = linhasDasFolhas;
      const lendo = await enviar(pdf);
      assert.equal((await amb.req("POST", `/digitalizacoes/${lendo.corpo.id}/registro`, { como: admin, json: { ordens: [registro(a)] } })).corpo.erro.codigo, "digitalizacao_nao_lida");
      await executarTarefasPendentes(amb.deps);
    });

    it("descartar apaga o PDF e as folhas; a registrada e a em leitura não se descartam", async () => {
      await programar();
      const lida = await lerTudo();
      assert.equal(await amb.armazenamento.existe("importacoes", `digitalizacoes/${lida.id}/folha-1.jpg`), true);
      assert.equal((await amb.req("DELETE", `/digitalizacoes/${lida.id}`, { como: admin })).status, 200);
      assert.equal(await amb.armazenamento.existe("importacoes", `digitalizacoes/${lida.id}/folha-1.jpg`), false);
      assert.equal(await amb.armazenamento.existe("importacoes", `digitalizacoes/${lida.id}/original.pdf`), false);
      assert.equal((await amb.req("GET", `/digitalizacoes/${lida.id}`, { como: admin })).status, 404);

      const lendo = await enviar(pdf);
      assert.equal((await amb.req("DELETE", `/digitalizacoes/${lendo.corpo.id}`, { como: admin })).corpo.erro.codigo, "digitalizacao_em_leitura");
      await executarTarefasPendentes(amb.deps);
    });
  });

  describe("a IA de visão", () => {
    it("confere o JSON: instante inexistente, número de pessoas absurdo e texto vazio viram nulo", async () => {
      amb.ia.falhar = false;
      amb.ia.respostas = ['```json\n{"inicio":"2026-02-30T10:00","fim":"2026-05-17T12:18","pessoas":0,"texto":"  ","avisos":["fim borrado"]}\n```'];
      const lido = await lerManuscritoComIa(amb.ia, [{ tipoMime: "image/jpeg", dados: new Uint8Array([0xff, 0xd8]) }]);
      assert.deepEqual(lido, { inicio: null, fim: "2026-05-17T12:18", pessoas: null, texto: null, avisos: ["fim borrado"] });
    });

    it("sem imagens não pergunta nada, e a IA fora do ar sobe como IAIndisponivel", async () => {
      amb.ia.falhar = false;
      amb.ia.chamadas.length = 0;
      assert.equal((await lerManuscritoComIa(amb.ia, [])).inicio, null);
      assert.equal(amb.ia.chamadas.length, 0);
      amb.ia.falhar = true;
      await assert.rejects(lerManuscritoComIa(amb.ia, [{ tipoMime: "image/jpeg", dados: new Uint8Array([1]) }]), IAIndisponivel);
      amb.ia.falhar = false;
    });
  });

  describe("o OCR de verdade (Tesseract)", () => {
    it("lê as OS de um PDF só de imagem: número, tipo, local, datas e o centro corrigido pelo cadastro", { timeout: 120_000 }, async () => {
      const real = new MotorOcrTesseract();
      const anterior = amb.deps.ocr;
      amb.deps.ocr = real;
      try {
        amb.ia.falhar = false;
        amb.ia.chamadas.length = 0;
        amb.ia.respostas = [manuscrito(), manuscrito()];
        const lida = await lerTudo();
        assert.equal(lida.estado, "lida", lida.erro);
        const [preventiva, corretiva] = lida.leitura.ordens;
        assert.deepEqual([preventiva.ordem.numero_ordem, corretiva.ordem.numero_ordem], [n1, n2]);
        assert.deepEqual([preventiva.ordem.tipo_ordem, corretiva.ordem.tipo_ordem], ["YBA2", "YBA1"]);
        assert.equal(preventiva.ordem.data_inicio_prog, "2026-01-12");
        // O OCR perde o "_" do código do centro; o cadastro de equipes o devolve.
        assert.equal(preventiva.ordem.centro_trabalho, "PROT_CAT");
        assert.equal(corretiva.ordem.centro_trabalho, "SERV_ESP");
        assert.equal(lida.leitura.confianca_media > 50, true);
        // A IA recebe imagens (o recorte da tabela de operações em diante, ou as folhas numeradas da OS).
        assert.equal(amb.ia.chamadas.length, 2);
        assert.equal(amb.ia.chamadas.every((c) => (c.mensagens[1]!.imagens?.length ?? 0) >= 1), true);
      } finally {
        await real.encerrar();
        amb.deps.ocr = anterior;
      }
    });
  });
});
