import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createCanvas } from "@napi-rs/canvas";
import { eq } from "drizzle-orm";
import { auditoria, digitalizacao, execucao, importacao, localInstalacao, os, osDigitalizacao, osDigitalizacaoApr, tarefa } from "../src/db/schema";
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

  describe("as fotos de folhas avulsas (câmera)", () => {
    /** Uma foto de celular de uma cor só (retrato, ou paisagem se pedirem): o OCR e a IA de teste não olham a imagem. */
    const foto = (opcoes: { largura?: number; altura?: number; tipo?: "jpeg" | "png" } = {}) => {
      const { largura = 900, altura = 1200, tipo = "jpeg" } = opcoes;
      const tela = createCanvas(largura, altura);
      const c = tela.getContext("2d");
      c.fillStyle = "#e8e8e8";
      c.fillRect(0, 0, largura, altura);
      return new File([new Uint8Array(tipo === "png" ? tela.toBuffer("image/png") : tela.toBuffer("image/jpeg", 80))], `folha.${tipo === "png" ? "png" : "jpg"}`, { type: `image/${tipo}` });
    };
    const enviarFotos = (fotos: File[], como: UsuarioDeTeste | null = admin) => {
      const form = new FormData();
      for (const f of fotos) form.append("fotos", f);
      return amb.req("POST", "/digitalizacoes", { como, form });
    };

    it("as fotos viram um PDF, uma página por foto, e seguem pelo mesmo caminho do PDF escaneado", async () => {
      await programar();
      // As duas folhas da primeira OS (a da ordem e a de execução): o OCR de teste devolve as linhas da folha de mesmo número.
      amb.ocr.folhas = linhasDasFolhas.slice(0, 2);
      amb.ia.respostas = [manuscrito()];
      const enviada = await enviarFotos([foto(), foto({ largura: 1200, altura: 900, tipo: "png" })]);
      assert.equal(enviada.status, 202, JSON.stringify(enviada.corpo));
      assert.equal(enviada.corpo.nome_arquivo, "Fotos de 2 folhas.pdf");
      const original = await amb.armazenamento.ler("importacoes", `digitalizacoes/${enviada.corpo.id}/original.pdf`);
      assert.equal(Buffer.from(original!).subarray(0, 5).toString(), "%PDF-");

      await executarTarefasPendentes(amb.deps);
      const { corpo } = await amb.req("GET", `/digitalizacoes/${enviada.corpo.id}`, { como: admin });
      assert.deepEqual([corpo.estado, corpo.paginas, corpo.leitura.ordens.length], ["lida", 2, 1]);
      assert.deepEqual([corpo.leitura.ordens[0].chave, corpo.leitura.ordens[0].paginas], [n1, [1, 2]]);
      assert.equal(corpo.leitura.ordens[0].manuscrito.lido_por, "ia");
      assert.equal(await amb.armazenamento.existe("importacoes", `digitalizacoes/${enviada.corpo.id}/folha-2.jpg`), true);
    });

    it("uma foto só tem o nome no singular", async () => {
      await programar();
      amb.ocr.folhas = linhasDasFolhas.slice(0, 1);
      amb.ia.respostas = [manuscrito()];
      const uma = await enviarFotos([foto()]);
      assert.equal(uma.status, 202);
      assert.equal(uma.corpo.nome_arquivo, "Fotos de 1 folha.pdf");
      await executarTarefasPendentes(amb.deps);
      assert.equal((await amb.req("GET", `/digitalizacoes/${uma.corpo.id}`, { como: admin })).corpo.estado, "lida");
    });

    it("recusa foto que não é JPEG nem PNG, foto demais, foto vazia, o envio sem nada e o PDF misturado com fotos", async () => {
      await programar();
      const invalida = await enviarFotos([new File([new Uint8Array([1, 2, 3, 4])], "x.jpg", { type: "image/jpeg" })]);
      assert.deepEqual([invalida.status, invalida.corpo.erro.codigo], [422, "foto_invalida"]);
      assert.equal((await enviarFotos([foto(), new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x01])], "quebrada.jpg")])).corpo.erro.codigo, "foto_invalida");
      assert.equal((await enviarFotos([foto(), new File([], "vazia.jpg")])).corpo.erro.codigo, "arquivo_vazio");
      const demais = await enviarFotos(Array.from({ length: 9 }, () => foto({ largura: 100, altura: 140 })));
      assert.deepEqual([demais.status, demais.corpo.erro.codigo], [422, "fotos_demais"]);
      assert.equal((await amb.req("POST", "/digitalizacoes", { como: admin, form: new FormData() })).corpo.erro.codigo, "validacao");
      const misturado = new FormData();
      misturado.set("arquivo", arquivoPdf(pdf));
      misturado.append("fotos", foto());
      assert.equal((await amb.req("POST", "/digitalizacoes", { como: admin, form: misturado })).corpo.erro.codigo, "validacao");
      // Nada ficou à espera de leitura.
      assert.equal((await amb.db.select().from(tarefa).where(eq(tarefa.estado, "pendente"))).filter((t) => t.tipo === "digitalizacao").length, 0);
    });

    it("só o admin envia fotos", async () => {
      assert.equal((await enviarFotos([foto()], tecnico)).status, 403);
      assert.equal((await enviarFotos([foto()], null)).status, 401);
    });
  });

  describe("a APR em papel que vem junto com a OS", () => {
    let carlos: UsuarioDeTeste;
    /** Os modelos como a conferência os recebe (o último publicado de cada código, com os itens). */
    let modelos: any[];
    const modeloDe = (codigo: string) => modelos.find((m) => m.codigo === codigo)!;

    before(async () => {
      carlos = await amb.criarUsuario({ perfil: "tecnico", equipeId: equipeServ, nome: "Carlos Alberto Souza", matricula: "AP1001" });
      amb.registrarFuncionario({ matricula: "RH2002", nome: "Marina Lopes Dias" });
      modelos = (await amb.esperar(200, "GET", "/digitalizacoes/modelos-apr", { como: admin })).modelos;
    });

    /** A folha 2 (a de execução da primeira OS) vira a APR em papel: o OCR lê o título impresso, e ela deixa de ter o cabeçalho da OS. */
    const comApr = (titulo = "ANÁLISE PRELIMINAR DE RISCO — APR 04") => {
      amb.ocr.folhas = linhasDasFolhas.map((l, i) => (i === 1 ? [titulo, "Supervisor da Atividade", "Executante"] : l));
    };
    const cabecalho = (o: Record<string, unknown> = {}) =>
      JSON.stringify({
        modelo_codigo: "APR 04",
        numero_os: n1,
        data_hora: "2026-05-17T11:09",
        servico: "Inspeção da estação",
        participantes: [
          { nome: "Carlos Souza", matricula: "AP1001", funcao: "responsavel" },
          { nome: "Marina Lopes", matricula: "RH2002", funcao: "executor" },
          { nome: "Joana", matricula: "ZZ9999", funcao: "executor" },
        ],
        avisos: [],
        ...o,
      });
    /** As quatro primeiras perguntas do modelo: sim, não, N/A e a quarta em branco no papel. */
    const marcas = (codigo = "APR 04") => {
      const itens = modeloDe(codigo).itens.slice(0, 4);
      return JSON.stringify({ respostas: itens.map((i: any, n: number) => ({ item: i.ordem, resposta: ["sim", "nao", "na", null][n] })), avisos: [] });
    };
    /** IA: o manuscrito das duas OS, depois o cabeçalho e as marcas da APR da primeira. */
    const lerComApr = async (cab: Record<string, unknown> | string = {}, titulo?: string, respostas: string[] = [marcas()]) => {
      // O cabeçalho só é montado depois de `programar`, que sorteia os números das OS deste teste.
      await programar({ ia: [manuscrito(), manuscrito({ inicio: "2026-10-14T08:30", fim: "2026-10-14T10:00", pessoas: 3, texto: null })] });
      amb.ia.respostas.push(typeof cab === "string" ? cab : cabecalho(cab), ...respostas);
      comApr(titulo);
      return lerTudo();
    };
    const aprConferida = (lida: any, extras: Record<string, unknown> = {}) => ({
      modelo_id: lida.apr.modelo.id,
      data_hora: lida.apr.data_hora,
      servico: lida.apr.servico,
      participantes: lida.apr.participantes.map((p: any) => ({ nome: p.nome, matricula: p.matricula, funcao: p.funcao })),
      respostas: lida.apr.respostas,
      ...extras,
    });

    it("GET /digitalizacoes/modelos-apr traz o último de cada código com os itens, e só o admin o vê", async () => {
      assert.equal(modelos.length >= 8, true);
      const m = modeloDe("APR 04");
      assert.equal(m.itens.length > 3, true);
      assert.deepEqual(Object.keys(m.itens[0]).sort(), ["id", "ordem", "permite_na", "resposta_bloqueante", "risco", "secao", "texto"]);
      assert.equal((await amb.req("GET", "/digitalizacoes/modelos-apr", { como: tecnico })).status, 403);
    });

    it("acha as folhas da APR, o modelo pelo título impresso e lê o cabeçalho, as pessoas e a marca de cada item", async () => {
      const lida = await lerComApr();
      assert.equal(lida.estado, "lida", lida.erro);
      const [a, b] = lida.leitura.ordens;
      assert.deepEqual([a.folhas_da_os, a.paginas, a.apr.paginas], [[1], [1, 2], [2]]);
      assert.equal(b.apr, null);
      assert.deepEqual([a.apr.lido_por, a.apr.modelo.codigo, a.apr.modelo.id, a.apr.data_hora, a.apr.servico, a.apr.numero_os], ["ia", "APR 04", modeloDe("APR 04").id, "2026-05-17T11:09", "Inspeção da estação", n1]);
      // Quem tem conta, quem só está no registro de funcionários e quem não está em lugar nenhum.
      const [responsavel, executor, desconhecido] = a.apr.participantes;
      assert.deepEqual([responsavel.estado, responsavel.usuario_id, responsavel.funcao], ["confere", carlos.id, "responsavel"]);
      assert.deepEqual([executor.estado, executor.usuario_id], ["confere", null]);
      assert.equal(desconhecido.estado, "duvidoso");
      assert.match(desconhecido.aviso, /não está no sistema nem no registro/);
      // As marcas: três respondidas (a quarta ficou em branco no papel).
      const itens = modeloDe("APR 04").itens;
      assert.deepEqual(a.apr.respostas, [0, 1, 2].map((n) => ({ item_id: itens[n].id, resposta: ["sim", "nao", "na"][n] })));
      assert.deepEqual(a.apr.avisos, []);
      // 2 manuscritos + o cabeçalho + as marcas. O cabeçalho vê a folha da APR e a lista dos modelos; as marcas, a lista dos itens do modelo.
      assert.equal(amb.ia.chamadas.length, 4);
      const [, , pedidoCab, pedidoMarcas] = amb.ia.chamadas;
      assert.equal(pedidoCab!.mensagens[1]!.imagens!.length, 1);
      assert.match(pedidoCab!.mensagens[1]!.texto, /APR 04: /);
      assert.match(pedidoMarcas!.mensagens[1]!.texto, new RegExp(`${itens[0].ordem}\\. `));
      // O manuscrito da OS não recebeu a folha da APR.
      assert.equal(amb.ia.chamadas[0]!.mensagens[1]!.imagens!.length, 1);
    });

    it("avisa quando o número da OS, a data ou o modelo da APR não batem", async () => {
      const lida = await lerComApr({ numero_os: "1234567", data_hora: "2026-05-20T09:00", modelo_codigo: "APR 05" });
      const [a] = lida.leitura.ordens;
      assert.equal(a.apr.modelo.codigo, "APR 04");
      const avisos = a.apr.avisos.join("\n");
      assert.match(avisos, /número de OS 1234567/);
      assert.match(avisos, /data da APR \(2026-05-20\) é diferente/);
      assert.match(avisos, /título impresso diz APR 04, mas a IA leu APR 05/);
    });

    it("sem modelo no título nem na IA, a APR vem sem modelo e a IA não lê as marcas; só a IA basta para achar o modelo", async () => {
      const lida = await lerComApr({ modelo_codigo: null }, "ANÁLISE PRELIMINAR DE RISCO", []);
      const [a] = lida.leitura.ordens;
      assert.deepEqual([a.apr.modelo, a.apr.respostas], [null, []]);
      assert.match(a.apr.avisos.join("\n"), /modelo da APR não foi identificado/);
      assert.equal(amb.ia.chamadas.length, 3);
      const lida2 = await lerComApr({ modelo_codigo: "APR 04" }, "ANÁLISE PRELIMINAR DE RISCO");
      assert.equal(lida2.leitura.ordens[0].apr.modelo.codigo, "APR 04");
      assert.equal(lida2.leitura.ordens[0].apr.respostas.length, 3);
    });

    it("sem a IA, a APR fica com as folhas e o modelo do título, e a pessoa preenche o resto", async () => {
      await programar({ iaFora: true });
      comApr();
      const lida = await lerTudo();
      const [a] = lida.leitura.ordens;
      assert.deepEqual([a.apr.lido_por, a.apr.modelo.codigo, a.apr.participantes, a.apr.respostas, a.apr.paginas], ["nenhum", "APR 04", [], [], [2]]);
      assert.equal(lida.leitura.ia.usada, false);
    });

    it("a IA que devolve lixo no cabeçalho deixa a APR para a conferência, sem derrubar a leitura", async () => {
      const lida = await lerComApr("isto não é um JSON", undefined, []);
      assert.equal(lida.estado, "lida", lida.erro);
      const [a] = lida.leitura.ordens;
      assert.deepEqual([a.apr.lido_por, a.apr.modelo.codigo, a.apr.participantes], ["nenhum", "APR 04", []]);
      assert.match(a.apr.avisos.join("\n"), /IA não conseguiu ler esta parte da APR/);
    });

    it("a APR com mais de uma folha leva a continuação sem número de OS, e o número escrito à mão na APR não vira OS", async () => {
      await programar({ ia: [manuscrito(), manuscrito({ inicio: "2026-10-14T08:30", fim: "2026-10-14T10:00", pessoas: 3, texto: null })] });
      amb.ia.respostas.push(cabecalho(), marcas());
      // Folha 2: o título da APR com o número da OS escrito à mão logo abaixo (o OCR o lê); folha 3: a 2ª folha da APR, sem número.
      amb.ocr.folhas = linhasDasFolhas.map((l, i) => (i === 1 ? ["ANÁLISE PRELIMINAR DE RISCO — APR 04", `${n1}\tData:\t17/05/26`, "Supervisor da Atividade"] : i === 2 ? ["Medidas preventivas", "Continuação da APR"] : l));
      const lida = await lerTudo();
      assert.equal(lida.estado, "lida", lida.erro);
      assert.equal(lida.leitura.ordens.length, 2);
      const [a, b] = lida.leitura.ordens;
      assert.deepEqual([a.chave, a.folhas_da_os, a.paginas, a.apr.paginas], [n1, [1], [1, 2, 3], [2, 3]]);
      assert.deepEqual([b.chave, b.folhas_da_os, b.paginas, b.apr], [n2, [4], [4], null]);
      // A IA vê as duas folhas da APR de uma vez.
      assert.equal(amb.ia.chamadas[2]!.mensagens[1]!.imagens!.length, 2);
    });

    it("o número da OS escrito na APR diz de quem ela é, mesmo com a APR no fim do PDF", async () => {
      await programar();
      // Folha 4 (a última): a APR, que vem depois das duas OS, mas traz o número da primeira.
      amb.ocr.folhas = linhasDasFolhas.map((l, i) => (i === 3 ? ["ANÁLISE PRELIMINAR DE RISCO — APR 04", "Supervisor da Atividade"] : l));
      amb.ia.respostas = [manuscrito(), manuscrito({ inicio: "2026-10-14T08:30", fim: "2026-10-14T10:00", pessoas: 3, texto: null }), cabecalho(), marcas()];
      const lida = await lerTudo();
      const [a, b] = lida.leitura.ordens;
      assert.deepEqual([a.paginas, a.apr.paginas], [[1, 2, 4], [4]]);
      assert.deepEqual([b.paginas, b.apr], [[3], null]);
      // Sem o número escrito, vale a posição: a APR é da OS que vem antes dela no PDF (a segunda).
      amb.ocr.folhas = linhasDasFolhas.map((l, i) => (i === 3 ? ["ANÁLISE PRELIMINAR DE RISCO — APR 04", "Supervisor da Atividade"] : l));
      amb.ia.respostas = [manuscrito(), manuscrito({ inicio: "2026-10-14T08:30", fim: "2026-10-14T10:00", pessoas: 3, texto: null }), cabecalho({ numero_os: null }), marcas()];
      const lida2 = await lerTudo();
      const [a2, b2] = lida2.leitura.ordens;
      assert.equal(a2.apr, null);
      assert.deepEqual([b2.paginas, b2.apr.paginas], [[3, 4], [4]]);
    });

    it("duas APR na mesma OS: só a primeira é lida, e a outra fica nas imagens das folhas com um aviso", async () => {
      await programar();
      amb.ocr.folhas = linhasDasFolhas.map((l, i) => (i === 1 || i === 2 ? ["ANÁLISE PRELIMINAR DE RISCO — APR 04", "Supervisor da Atividade"] : l));
      amb.ia.respostas = [manuscrito(), manuscrito({ inicio: "2026-10-14T08:30", fim: "2026-10-14T10:00", pessoas: 3, texto: null }), cabecalho({ numero_os: null }), marcas(), cabecalho({ numero_os: null })];
      const lida = await lerTudo();
      const [a, b] = lida.leitura.ordens;
      assert.deepEqual([a.paginas, a.apr.paginas, b.apr], [[1, 2, 3], [2], null]);
      assert.match(a.avisos.join("\n"), /mais de uma APR/);
    });

    it("o registro guarda a APR à parte, ligada à conta de quem tem uma, e ela aparece no detalhe da OS", async () => {
      const lida = await lerComApr();
      const [a, b] = lida.leitura.ordens;
      const r = await amb.req("POST", `/digitalizacoes/${lida.id}/registro`, { como: admin, json: { ordens: [registro(a, { apr: aprConferida(a) }), registro(b)] } });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      const osA = (await osDe(n1))!;
      const [linha] = await amb.db.select().from(osDigitalizacaoApr).where(eq(osDigitalizacaoApr.osId, osA.id));
      assert.deepEqual([linha!.manuscritoFonte, linha!.modeloAprId, linha!.paginas, linha!.servico, linha!.registradaPor], ["ia", modeloDe("APR 04").id, [2], "Inspeção da estação", admin.id]);
      assert.equal(linha!.dataHora?.toISOString(), "2026-05-17T14:09:00.000Z");
      assert.deepEqual((linha!.participantes as any[]).map((p) => [p.nome, p.matricula, p.funcao, p.usuario_id]), [
        ["Carlos Souza", "AP1001", "responsavel", carlos.id],
        ["Marina Lopes", "RH2002", "executor", null],
        ["Joana", "ZZ9999", "executor", null],
      ]);
      assert.equal((linha!.respostas as any[]).length, 3);
      // A outra OS não tem APR, e a APR não é uma APR do sistema.
      assert.equal((await amb.db.select().from(osDigitalizacaoApr).where(eq(osDigitalizacaoApr.osId, (await osDe(n2))!.id))).length, 0);
      assert.equal((await amb.sql<{ n: number }>("select count(*)::int as n from apr where os_id = $1", [osA.id]))[0]!.n, 0);

      const detalhe = (await amb.esperar(200, "GET", `/os/${osA.id}`, { como: admin })).os.em_papel;
      assert.deepEqual([detalhe.apr.modelo.codigo, detalhe.apr.servico, detalhe.apr.folhas, detalhe.apr.fonte], ["APR 04", "Inspeção da estação", 1, "ia"]);
      assert.deepEqual(detalhe.apr.respostas.map((x: any) => x.resposta), ["sim", "nao", "na"]);
      assert.equal(detalhe.apr.participantes.length, 3);
      // O que é eliminatório não vai para o detalhe: só a marca, como no papel.
      assert.equal(JSON.stringify(detalhe.apr).includes("bloqueante"), false);
      assert.equal((await amb.esperar(200, "GET", `/os/${(await osDe(n2))!.id}`, { como: admin })).os.em_papel.apr, null);
    });

    it("sem mandar a APR (ou com null), só a OS entra; o que a pessoa muda vira fonte manual", async () => {
      const lida = await lerComApr();
      const [a, b] = lida.leitura.ordens;
      const r = await amb.req("POST", `/digitalizacoes/${lida.id}/registro`, { como: admin, json: { ordens: [registro(a, { apr: null }), registro(b)] } });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.equal((await amb.db.select().from(osDigitalizacaoApr).where(eq(osDigitalizacaoApr.osId, (await osDe(n1))!.id))).length, 0);

      const lida2 = await lerComApr();
      const a2 = lida2.leitura.ordens[0];
      const apr = aprConferida(a2, { servico: "Serviço corrigido", respostas: a2.apr.respostas.slice(0, 2), participantes: [{ nome: "Carlos Alberto Souza", matricula: "AP1001", funcao: "responsavel" }] });
      assert.equal((await amb.req("POST", `/digitalizacoes/${lida2.id}/registro`, { como: admin, json: { ordens: [registro(a2, { apr })] } })).status, 201);
      const [linha] = await amb.db.select().from(osDigitalizacaoApr).where(eq(osDigitalizacaoApr.osId, (await osDe(n1))!.id));
      assert.deepEqual([linha!.manuscritoFonte, linha!.servico, (linha!.respostas as any[]).length], ["manual", "Serviço corrigido", 2]);
    });

    it("recusa a APR de OS sem folha de APR, modelo inexistente, item de outro modelo, item repetido e dois responsáveis", async () => {
      const lida = await lerComApr();
      const [a, b] = lida.leitura.ordens;
      const post = (os: any, apr: unknown) => amb.req("POST", `/digitalizacoes/${lida.id}/registro`, { como: admin, json: { ordens: [{ ...registro(os), apr }] } });
      const certa = aprConferida(a);
      assert.equal((await post(b, certa)).corpo.erro.codigo, "apr_fora_da_leitura");
      assert.equal((await post(a, { ...certa, modelo_id: "00000000-0000-4000-8000-000000000000" })).corpo.erro.codigo, "modelo_apr_invalido");
      const deOutroModelo = modeloDe("APR 05").itens[0].id;
      assert.equal((await post(a, { ...certa, respostas: [{ item_id: deOutroModelo, resposta: "sim" }] })).corpo.erro.codigo, "apr_resposta_invalida");
      const repetida = { item_id: modeloDe("APR 04").itens[0].id, resposta: "sim" };
      assert.equal((await post(a, { ...certa, respostas: [repetida, repetida] })).corpo.erro.codigo, "apr_resposta_invalida");
      const dois = [{ nome: "A", matricula: null, funcao: "responsavel" }, { nome: "B", matricula: null, funcao: "responsavel" }];
      assert.equal((await post(a, { ...certa, participantes: dois })).corpo.erro.codigo, "apr_participantes_invalidos");
      assert.equal((await post(a, { ...certa, participantes: [{ nome: "", matricula: null, funcao: "executor" }] })).status, 422);
      assert.equal((await post(a, { ...certa, respostas: [{ item_id: repetida.item_id, resposta: "talvez" }] })).status, 422);
      // Nada foi gravado pelas tentativas.
      assert.equal(await osDe(n1), undefined);
      assert.equal((await amb.req("GET", `/digitalizacoes/${lida.id}`, { como: admin })).corpo.estado, "lida");
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
