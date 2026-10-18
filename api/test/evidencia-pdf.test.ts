import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { alerta, evidencia, itemModeloApr, localInstalacao, modeloApr, os } from "../src/db/schema";
import { documentoDemo } from "../src/db/seed/documento-demo";
import { manipularEmailAlerta } from "../src/servicos/email-alerta";
import { gerarRelatorioDaExecucao } from "../src/servicos/relatorio-execucao";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { textoDoPdf } from "./fixture-os";

/**
 * Evidência em PDF: o documento sobe pelo `PUT /arquivos` (`tipo=pdf`, bucket `documentos`), entra nos eventos como
 * evidência `tipo: "pdf"` e aparece separado das fotos no detalhe, no e-mail de alerta e no PDF da OS.
 */
describe("Evidência em PDF", () => {
  let amb: Ambiente;
  let equipeId: string;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let supervisor: UsuarioDeTeste;
  let localId: string;
  let contadorOs = 7100000;
  /** Modelo publicado com três itens eliminatórios: um pede foto, um pede PDF e um só texto. */
  let modelo: { id: string; foto: string; pdf: string; texto: string; itens: (typeof itemModeloApr.$inferSelect)[] };

  before(async () => {
    amb = await criarAmbiente();
    supervisor = await amb.criarUsuario({ perfil: "tecnico" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "SERRA/REDE" }).returning({ id: localInstalacao.id })) as [{ id: string }];

    const [m] = await amb.db.insert(modeloApr).values({ codigo: "APR PDF", versao: 1, titulo: "Modelo com evidência em PDF" }).returning();
    const itens = await amb.db
      .insert(itemModeloApr)
      .values([
        { modeloAprId: m!.id, secao: "verificacao", ordem: 1, texto: "O acesso está desobstruído?", respostaBloqueante: "nao", tipo: "eliminatorio", evidencia: "foto" },
        { modeloAprId: m!.id, secao: "verificacao", ordem: 2, texto: "O detector de gases está calibrado?", respostaBloqueante: "nao", tipo: "eliminatorio", evidencia: "pdf" },
        { modeloAprId: m!.id, secao: "verificacao", ordem: 3, texto: "Você está em condições de executar a atividade?", respostaBloqueante: "nao", tipo: "eliminatorio", evidencia: "texto" },
      ])
      .returning();
    await amb.db.update(modeloApr).set({ publicadoEm: new Date() }).where(eq(modeloApr.id, m!.id));
    modelo = { id: m!.id, foto: itens[0]!.id, pdf: itens[1]!.id, texto: itens[2]!.id, itens };
  });
  after(() => amb.fechar());

  async function novaOs() {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "Reparo em ramal", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-11", origem: "sap" })
      .returning();
    return o!;
  }
  const agora = () => amb.relogio.agora.toISOString();
  const evento = (tipo: string, payload: object, osId?: string) => ({ id: randomUUID(), tipo, os_id: osId ?? null, payload, ocorrido_em: agora() });
  const enviar = (como: UsuarioDeTeste, ...eventos: unknown[]) => amb.esperar(200, "POST", "/eventos", { como, json: { eventos } });

  /** Sobe um arquivo pela rota, como o navegador faz; devolve o id. */
  async function subir(tipo: "foto" | "pdf", bytes: Uint8Array<ArrayBuffer> = tipo === "pdf" ? documentoDemo("Laudo") : new Uint8Array([137, 80, 78, 71]), mime = tipo === "pdf" ? "application/pdf" : "image/png") {
    const id = randomUUID();
    const form = new FormData();
    form.set("arquivo", new File([bytes], tipo === "pdf" ? "laudo.pdf" : "foto.png", { type: mime }));
    form.set("tipo", tipo);
    await amb.esperar(200, "PUT", `/arquivos/${id}`, { como: tecnico, form });
    return id;
  }

  /**
   * APR com os itens pedidos reprovados e os demais aprovados, como o técnico valida: sem observação nos reprovados (ele
   * ainda não sabe o que reprova). `comEvidencia` monta o `apr_concluida` seguinte, com a observação e os arquivos.
   */
  function apr(osId: string, reprovar: string[]) {
    const base = {
      id: randomUUID(),
      os_id: osId,
      modelo_apr_id: modelo.id,
      participantes: [
        { usuario_id: tecnico.id, funcao: "responsavel" },
        { usuario_id: colega.id, funcao: "executor" },
      ],
      riscos: [],
      respostas: modelo.itens.map((i) => ({ item_id: i.id, resposta: reprovar.includes(i.id) ? "nao" : "sim" })),
      concluida_em: agora(),
    };
    const comEvidencia = (evidencias: object[]) => ({
      ...base,
      respostas: base.respostas.map((r) => (reprovar.includes(r.item_id) ? { ...r, observacao: "Motivo registrado em campo" } : r)),
      evidencias,
    });
    return Object.assign(base, { comEvidencia });
  }

  describe("envio do arquivo", () => {
    it("aceita um PDF de verdade e o guarda no bucket documentos", async () => {
      const id = await subir("pdf");
      assert.ok(await amb.armazenamento.existe("documentos", id));
      assert.equal(await amb.armazenamento.existe("fotos", id), false);
    });

    it("recusa o que não é PDF, mesmo declarado como PDF", async () => {
      const form = new FormData();
      form.set("arquivo", new File([new Uint8Array([137, 80, 78, 71, 1, 2])], "falso.pdf", { type: "application/pdf" }));
      form.set("tipo", "pdf");
      const r = await amb.req("PUT", `/arquivos/${randomUUID()}`, { como: tecnico, form });
      assert.equal(r.status, 422);
      assert.equal(r.corpo.erro.codigo, "tipo_de_arquivo");
    });

    it("não aceita PDF como foto nem tipo desconhecido", async () => {
      const comoFoto = new FormData();
      comoFoto.set("arquivo", new File([documentoDemo("x")], "x.pdf", { type: "application/pdf" }));
      comoFoto.set("tipo", "foto");
      assert.equal((await amb.req("PUT", `/arquivos/${randomUUID()}`, { como: tecnico, form: comoFoto })).corpo.erro.codigo, "tipo_de_arquivo");

      const outro = new FormData();
      outro.set("arquivo", new File([documentoDemo("x")], "x.pdf", { type: "application/pdf" }));
      outro.set("tipo", "documento");
      const r = await amb.req("PUT", `/arquivos/${randomUUID()}`, { como: tecnico, form: outro });
      assert.equal(r.status, 422);
      assert.match(r.corpo.erro.mensagem, /"pdf"/);
    });

    it("recusa PDF acima de 10 MB", async () => {
      const grande = new Uint8Array(10 * 1024 * 1024 + 1);
      grande.set(Buffer.from("%PDF-1.4"));
      const form = new FormData();
      form.set("arquivo", new File([grande], "grande.pdf", { type: "application/pdf" }));
      form.set("tipo", "pdf");
      assert.equal((await amb.req("PUT", `/arquivos/${randomUUID()}`, { como: tecnico, form })).status, 413);
    });
  });

  describe("item reprovado da APR", () => {
    it("o item que pede PDF só fica completo com um PDF; a foto não o substitui", async () => {
      const o = await novaOs();
      const p = apr(o.id, [modelo.pdf]);
      const avaliacao = await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: { ...p, comEvidencia: undefined } });
      assert.equal(avaliacao.resultado, "bloqueada");
      assert.deepEqual(avaliacao.reprovados.map((x: { evidencia: string }) => x.evidencia), ["pdf"]);

      const soFoto = await enviar(tecnico, evento("apr_concluida", p.comEvidencia([{ id: await subir("foto"), item_id: modelo.pdf, capturada_em: agora() }]), o.id));
      assert.equal(soFoto.rejeitados[0]?.codigo, "evidencia_faltando");

      const pdf = await subir("pdf");
      const r = await enviar(tecnico, evento("apr_concluida", p.comEvidencia([{ id: randomUUID(), arquivo_id: pdf, tipo: "pdf", nome: "certificado-calibracao.pdf", item_id: modelo.pdf, capturada_em: agora() }]), o.id));
      assert.deepEqual(r.rejeitados, []);
      const [linha] = await amb.db.select().from(evidencia).where(eq(evidencia.fotoPath, pdf));
      assert.equal(linha!.tipo, "pdf");
      assert.equal(linha!.nomeArquivo, "certificado-calibracao.pdf");
    });

    it("o item que pede foto não aceita só um PDF; foto e PDF juntos valem", async () => {
      const o = await novaOs();
      const p = apr(o.id, [modelo.foto]);
      await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: { ...p, comEvidencia: undefined } });
      const pdf = await subir("pdf");
      const soPdf = await enviar(tecnico, evento("apr_concluida", p.comEvidencia([{ id: pdf, tipo: "pdf", item_id: modelo.foto, capturada_em: agora() }]), o.id));
      assert.equal(soPdf.rejeitados[0]?.codigo, "evidencia_faltando");

      const foto = await subir("foto");
      const r = await enviar(
        tecnico,
        evento("apr_concluida", p.comEvidencia([{ id: foto, item_id: modelo.foto, capturada_em: agora() }, { id: pdf, tipo: "pdf", nome: "croqui.pdf", item_id: modelo.foto, capturada_em: agora() }]), o.id),
      );
      assert.deepEqual(r.rejeitados, []);

      const detalhe = await amb.esperar(200, "GET", `/os/${o.id}`, { como: supervisor });
      const [item] = detalhe.aprs[0].itens_reprovados;
      assert.deepEqual(item.fotos.map((f: { foto_path: string }) => f.foto_path), [foto]);
      assert.deepEqual(item.documentos.map((d: { arquivo_path: string; nome: string }) => [d.arquivo_path, d.nome]), [[pdf, "croqui.pdf"]]);
    });

    it("o item de texto aceita um PDF opcional (ex.: atestado)", async () => {
      const o = await novaOs();
      const p = apr(o.id, [modelo.texto]);
      await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: { ...p, comEvidencia: undefined } });
      const pdf = await subir("pdf");
      const r = await enviar(tecnico, evento("apr_concluida", p.comEvidencia([{ id: pdf, tipo: "pdf", nome: "atestado.pdf", item_id: modelo.texto, capturada_em: agora() }]), o.id));
      assert.deepEqual(r.rejeitados, []);
      assert.equal((await amb.db.select().from(evidencia).where(eq(evidencia.fotoPath, pdf))).length, 1);
    });

    it("o PDF que ainda não subiu deixa o evento pendente", async () => {
      const o = await novaOs();
      const p = apr(o.id, [modelo.pdf]);
      await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: { ...p, comEvidencia: undefined } });
      const r = await enviar(tecnico, evento("apr_concluida", p.comEvidencia([{ id: randomUUID(), tipo: "pdf", item_id: modelo.pdf, capturada_em: agora() }]), o.id));
      assert.equal(r.pendentes[0]?.codigo, "arquivo_ausente");
    });

    it("o link do PDF sai do bucket documentos, e só para quem vê a equipe", async () => {
      const o = await novaOs();
      const p = apr(o.id, [modelo.pdf]);
      await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: { ...p, comEvidencia: undefined } });
      const pdf = await subir("pdf");
      await enviar(tecnico, evento("apr_concluida", p.comEvidencia([{ id: pdf, tipo: "pdf", item_id: modelo.pdf, capturada_em: agora() }]), o.id));

      const { url } = await amb.esperar(200, "GET", `/arquivos/${pdf}/url`, { como: colega });
      assert.match(url, /\/documentos\//);
      const deFora = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
      assert.equal((await amb.req("GET", `/arquivos/${pdf}/url`, { como: deFora })).status, 403);
    });

    it("o e-mail de bloqueio leva o link do PDF ao lado das fotos", async () => {
      const o = await novaOs();
      const p = apr(o.id, [modelo.foto, modelo.pdf]);
      await amb.esperar(200, "POST", "/aprs/avaliar", { como: tecnico, json: { ...p, comEvidencia: undefined } });
      const foto = await subir("foto");
      const pdf = await subir("pdf");
      await enviar(
        tecnico,
        evento("apr_concluida", p.comEvidencia([{ id: foto, item_id: modelo.foto, capturada_em: agora() }, { id: pdf, tipo: "pdf", nome: "laudo.pdf", item_id: modelo.pdf, capturada_em: agora() }]), o.id),
      );
      const [a] = await amb.db.select().from(alerta).where(eq(alerta.osId, o.id));
      const antes = amb.email.enviados.length;
      await manipularEmailAlerta(amb.deps, { id: "t", referenciaId: a!.id });
      const m = amb.email.enviados[antes]!;
      assert.ok(m.texto.includes(`Foto 1: https://storage.local/fotos/${foto}`));
      assert.ok(m.texto.includes(`PDF 1: laudo.pdf: https://storage.local/documentos/${pdf}`));
      assert.ok(m.html!.includes("PDF 1: laudo.pdf"));
    });
  });

  describe("execução", () => {
    async function emExecucao() {
      const o = await novaOs();
      const p = apr(o.id, []);
      await enviar(tecnico, evento("apr_concluida", { ...p, comEvidencia: undefined, assinatura_presencial: true, participantes: p.participantes.map((x) => ({ ...x, assinada_em: agora() })) }, o.id));
      const execucaoId = randomUUID();
      await enviar(tecnico, evento("execucao_iniciada", { id: execucaoId, apr_id: p.id, inicio: agora() }, o.id));
      return { osId: o.id, execucaoId };
    }
    /** O encerramento em dois passos: o clique em "Encerrar OS" e o preenchimento (fotos e PDFs opcionais) assinado pelo responsável; devolve a resposta do segundo. */
    const encerramento = async (osId: string, execucaoId: string, evidencias: object[]) => {
      await enviar(tecnico, evento("execucao_encerrada", { execucao_id: execucaoId, fim: agora() }, osId));
      return enviar(tecnico, evento("encerramento_assinado", { execucao_id: execucaoId, descricao_atividade: "Ramal reparado e testado", evidencias }, osId));
    };

    it("encerrar aceita só o PDF (a foto é opcional); com foto e PDFs, eles aparecem como documentos", async () => {
      const soPdf = await emExecucao();
      const r1 = await encerramento(soPdf.osId, soPdf.execucaoId, [{ id: await subir("pdf"), tipo: "pdf", nome: "laudo.pdf", capturada_em: agora() }]);
      assert.deepEqual(r1.rejeitados, []);

      const { osId, execucaoId } = await emExecucao();
      const foto = await subir("foto");
      const laudos = [await subir("pdf"), await subir("pdf")];
      const r = await encerramento(osId, execucaoId, [{ id: foto, capturada_em: agora() }, ...laudos.map((id, i) => ({ id, tipo: "pdf", nome: `laudo-${i + 1}.pdf`, capturada_em: agora() }))]);
      assert.deepEqual(r.rejeitados, []);
      const detalhe = await amb.esperar(200, "GET", `/os/${osId}`, { como: supervisor });
      const [execucao] = detalhe.execucoes;
      assert.equal(execucao.fotos.length, 1);
      assert.deepEqual(execucao.documentos.map((d: { nome: string }) => d.nome).sort(), ["laudo-1.pdf", "laudo-2.pdf"]);
    });

    it("no máximo 5 PDFs por execução", async () => {
      const { osId, execucaoId } = await emExecucao();
      const pdfs = [];
      for (let i = 0; i < 6; i++) pdfs.push({ id: await subir("pdf"), tipo: "pdf", capturada_em: agora() });
      const r = await encerramento(osId, execucaoId, [{ id: await subir("foto"), capturada_em: agora() }, ...pdfs]);
      assert.equal(r.rejeitados[0]?.codigo, "pdfs_demais");
    });

    it("interromper aceita PDF junto da foto obrigatória", async () => {
      const { execucaoId } = await emExecucao();
      const pdf = await subir("pdf");
      const soPdf = await enviar(tecnico, evento("execucao_interrompida", { execucao_id: execucaoId, fim: agora(), motivo: "Vazamento no ramal", evidencias: [{ id: pdf, tipo: "pdf", capturada_em: agora() }] }));
      assert.equal(soPdf.rejeitados[0]?.codigo, "interrupcao_incompleta");
      const r = await enviar(
        tecnico,
        evento("execucao_interrompida", { execucao_id: execucaoId, fim: agora(), motivo: "Vazamento no ramal", evidencias: [{ id: await subir("foto"), capturada_em: agora() }, { id: pdf, tipo: "pdf", nome: "medicao.pdf", capturada_em: agora() }] }),
      );
      assert.deepEqual(r.rejeitados, []);
    });

    it("o relatório da execução lista os documentos anexados e desenha só as fotos (o PDF da OS não os traz)", async () => {
      const { osId, execucaoId } = await emExecucao();
      const r = await encerramento(osId, execucaoId, [{ id: await subir("foto"), capturada_em: agora() }, { id: await subir("pdf"), tipo: "pdf", nome: "relatorio-medicao.pdf", capturada_em: agora() }]);
      assert.deepEqual(r.rejeitados, []);
      const texto = textoDoPdf(await gerarRelatorioDaExecucao(amb.deps, osId, { comprimir: false }));
      assert.ok(texto.includes("DOCUMENTOS ANEXADOS (PDF)"), texto);
      assert.ok(texto.includes("relatorio-medicao.pdf"));
    });
  });
});
