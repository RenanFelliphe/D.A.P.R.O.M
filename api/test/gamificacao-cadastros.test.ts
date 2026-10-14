import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { auditoria, patente, regraPontuacao } from "../src/db/schema";
import { lerImagem } from "../src/dominio/imagem";
import { CONQUISTAS_DA_CARGA, PATENTES_DA_CARGA, sqlDaCarga, sqlDaImagemDaEquipe } from "../src/db/seed/gamificacao-dados";
import { imagensDaCarga, garantirImagensDaGamificacao } from "../src/db/seed/imagens-gamificacao";
import { ArmazenamentoEmMemoria } from "../src/servicos/armazenamento";
import { arquivoPng, formulario, formularioDePatente, pngDeTeste, prepararCampo, type Campo } from "./gamificacao-ajuda";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Gamificação: cadastros do admin (patentes, tarefas, imagens, auditoria)", () => {
  let c: Campo;
  before(async () => {
    c = await prepararCampo();
  });
  after(() => c.amb.fechar());

  const admin = () => c.admin;
  const auditar = async (acao: string) => c.amb.db.select().from(auditoria).where(eq(auditoria.acao, acao));

  it("só o admin cadastra: técnico recebe 403 e sem token 401, em todas as rotas de cadastro", async () => {
    const tec = await c.tecnico();
    const [bronze] = await c.amb.db.select().from(patente).limit(1);
    const chamadas: [string, string, object?][] = [
      ["PATCH", "/gamificacao/regras/apr_completa", { json: { pontos: 1 } }],
      ["POST", "/gamificacao/patentes", { form: formulario({ nome: "X", pontos_necessarios: 1, cor: "#112233" }) }],
      ["PATCH", `/gamificacao/patentes/${bronze!.id}`, { json: { nome: "Y" } }],
      ["PUT", `/gamificacao/patentes/${bronze!.id}/imagem`, { form: formulario({}) }],
      ["PUT", `/gamificacao/patentes/${bronze!.id}/imagem-equipe`, { form: formularioDePatente({}, null) }],
      ["DELETE", `/gamificacao/patentes/${bronze!.id}`],
      ["POST", "/gamificacao/conquistas", { form: formulario({ titulo: "X", descricao: "x", criterio: "aprs_completas", quantidade: 1 }) }],
      ["PATCH", `/gamificacao/conquistas/${bronze!.id}`, { json: { titulo: "Y" } }],
      ["PUT", `/gamificacao/conquistas/${bronze!.id}/imagem`, { form: formulario({}) }],
      ["DELETE", `/gamificacao/conquistas/${bronze!.id}`],
    ];
    for (const [metodo, caminho, corpo] of chamadas) {
      assert.equal((await c.amb.req(metodo, caminho, { como: tec, ...(corpo ?? {}) } as never)).status, 403, `${metodo} ${caminho} (técnico)`);
      assert.equal((await c.amb.req(metodo, caminho, { ...(corpo ?? {}) } as never)).status, 401, `${metodo} ${caminho} (sem token)`);
    }
    assert.equal((await c.como(c.supervisor, "PATCH", "/gamificacao/regras/apr_completa", { json: { pontos: 1 } })).status, 403, "supervisor também não");
  });

  it("tarefas: valida o valor, recusa código inexistente e registra na auditoria", async () => {
    assert.equal((await c.como(admin(), "PATCH", "/gamificacao/regras/inexistente", { json: { pontos: 1 } })).status, 404);
    assert.equal((await c.como(admin(), "PATCH", "/gamificacao/regras/apr_completa", { json: {} })).status, 422);
    assert.equal((await c.como(admin(), "PATCH", "/gamificacao/regras/apr_completa", { json: { pontos: -1 } })).status, 422);
    assert.equal((await c.como(admin(), "PATCH", "/gamificacao/regras/apr_completa", { json: { pontos: 1001 } })).status, 422);
    assert.equal((await c.como(admin(), "PATCH", "/gamificacao/regras/apr_completa", { json: { pontos: 2.5 } })).status, 422);
    const r = await c.amb.esperar(200, "PATCH", "/gamificacao/regras/ciencia_no_prazo", { como: admin(), json: { pontos: 4 } });
    assert.deepEqual(r, { codigo: "ciencia_no_prazo", pontos: 4, ativa: true });
    const [regra] = await c.amb.db.select().from(regraPontuacao).where(eq(regraPontuacao.codigo, "ciencia_no_prazo"));
    assert.equal(regra!.atualizadaPor, admin().id);
    const [registro] = await auditar("regra_pontuacao.editar");
    assert.equal(registro!.entidade, "regra_pontuacao");
    assert.equal(registro!.entidadeId, "ciencia_no_prazo");
    assert.match(registro!.resumo, /de 3 para 4 pontos/);
    await c.amb.esperar(200, "PATCH", "/gamificacao/regras/ciencia_no_prazo", { como: admin(), json: { ativa: false } });
    assert.equal((await auditar("regra_pontuacao.desativar")).length, 1);
    await c.amb.esperar(200, "PATCH", "/gamificacao/regras/ciencia_no_prazo", { como: admin(), json: { ativa: true, pontos: 3 } });
    const regras = await c.amb.esperar(200, "GET", "/gamificacao/regras", { como: c.supervisor });
    const ciencia = regras.regras.find((x: any) => x.codigo === "ciencia_no_prazo");
    assert.equal(ciencia.pontos, 3);
    assert.equal(ciencia.ativa, true);
    assert.match(ciencia.quando, /72 horas/);
    assert.equal(regras.regras_do_jogo.length, 6);
    assert.ok(regras.nao_pontuam.length >= 10);
  });

  it("patente: cria com imagem (multipart), valida nome e pontuação únicos, edita, desativa e audita", async () => {
    const nova = await c.amb.req("POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Esmeralda", pontos_necessarios: 4000, cor: "#2ecc71", descricao: "Entre a platina e o diamante." }) });
    assert.equal(nova.status, 201, JSON.stringify(nova.corpo));
    assert.equal(nova.corpo.nome, "Esmeralda");
    assert.equal(nova.corpo.cor, "#2ECC71", "a cor é guardada em maiúsculas");
    assert.equal(nova.corpo.ativa, true);
    assert.ok(nova.corpo.imagem_url.includes("gamificacao"));
    assert.ok(nova.corpo.imagem_equipe_url.includes("gamificacao"));
    const [guardada] = await c.amb.db.select().from(patente).where(eq(patente.id, nova.corpo.id));
    assert.equal(await c.amb.armazenamento.existe("gamificacao", guardada!.imagemPath), true, "a imagem foi para o bucket gamificacao");
    assert.equal(await c.amb.armazenamento.existe("gamificacao", guardada!.imagemEquipePath), true, "a das equipes também");
    assert.notEqual(guardada!.imagemEquipePath, guardada!.imagemPath, "cada uma é um arquivo próprio, mesmo que o admin envie a mesma imagem nos dois campos");
    assert.notEqual(nova.corpo.imagem_url, nova.corpo.imagem_equipe_url);

    const nomeRepetido = await c.amb.req("POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Esmeralda", pontos_necessarios: 4100, cor: "#00ff00" }) });
    assert.equal(nomeRepetido.status, 409);
    assert.equal(nomeRepetido.corpo.erro.codigo, "nome_duplicado");
    const pontosRepetidos = await c.amb.req("POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Outra", pontos_necessarios: 4000, cor: "#00ff00" }) });
    assert.equal(pontosRepetidos.status, 409);
    assert.equal(pontosRepetidos.corpo.erro.codigo, "pontos_duplicados");

    const invalidos: [string, Record<string, string | number>][] = [
      ["sem nome", { nome: "", pontos_necessarios: 10, cor: "#112233" }],
      ["cor inválida", { nome: "Z", pontos_necessarios: 10, cor: "vermelho" }],
      ["pontuação negativa", { nome: "Z", pontos_necessarios: -1, cor: "#112233" }],
      ["pontuação que não é número", { nome: "Z", pontos_necessarios: "muitos", cor: "#112233" }],
    ];
    for (const [rotulo, campos] of invalidos) {
      assert.equal((await c.amb.req("POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente(campos) })).status, 422, rotulo);
    }
    // As duas imagens são obrigatórias: a das pessoas e a das equipes (e nada fica gravado se uma delas falta ou não serve).
    const semImagem = await c.amb.req("POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Sem imagem", pontos_necessarios: 10, cor: "#112233" }, null) });
    assert.equal(semImagem.status, 422);
    const semImagemDaEquipe = await c.amb.req("POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Sem imagem da equipe", pontos_necessarios: 10, cor: "#112233" }, undefined, null) });
    assert.equal(semImagemDaEquipe.status, 422);
    assert.match(semImagemDaEquipe.corpo.erro.mensagem, /imagem_equipe/);
    const equipeNaoQuadrada = await c.amb.req("POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Equipe torta", pontos_necessarios: 10, cor: "#112233" }, undefined, arquivoPng(200, 100)) });
    assert.equal(equipeNaoQuadrada.corpo.erro.codigo, "imagem_nao_quadrada");
    const nomes = (await c.amb.db.select({ nome: patente.nome }).from(patente)).map((p) => p.nome);
    assert.ok(!nomes.includes("Sem imagem") && !nomes.includes("Sem imagem da equipe") && !nomes.includes("Equipe torta"));

    // Editar: a desativada deixa de ser atribuída e libera a pontuação para outra.
    const editada = await c.amb.esperar(200, "PATCH", `/gamificacao/patentes/${nova.corpo.id}`, { como: admin(), json: { descricao: "", pontos_necessarios: 4200 } });
    assert.equal(editada.descricao, null);
    assert.equal(editada.pontos_necessarios, 4200);
    await c.amb.esperar(200, "PATCH", `/gamificacao/patentes/${nova.corpo.id}`, { como: admin(), json: { ativa: false } });
    const outra = await c.amb.req("POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Ocupa", pontos_necessarios: 4200, cor: "#112233" }) });
    assert.equal(outra.status, 201, "a pontuação só é única entre as ativas");
    const reativar = await c.como(admin(), "PATCH", `/gamificacao/patentes/${nova.corpo.id}`, { json: { ativa: true } });
    assert.equal(reativar.status, 409, "reativar com a pontuação de uma ativa é recusado");

    const verbos = ["patente.criar", "patente.editar", "patente.desativar"];
    for (const v of verbos) assert.ok((await auditar(v)).length >= 1, v);
    const [reg] = await auditar("patente.criar");
    assert.equal(reg!.entidade, "patente");
    assert.match(reg!.resumo, /Criou a patente "Esmeralda"/);

    // A desativada não aparece para o técnico, mas o admin a vê; "Sem patente" não existe com a carga (Bronze começa em 0).
    const tec = await c.tecnico();
    const paraTecnico = await c.amb.esperar(200, "GET", "/gamificacao/patentes", { como: tec });
    assert.ok(!paraTecnico.patentes.some((p: any) => p.nome === "Esmeralda"));
    const paraAdmin = await c.amb.esperar(200, "GET", "/gamificacao/patentes", { como: admin() });
    assert.ok(paraAdmin.patentes.some((p: any) => p.nome === "Esmeralda" && p.ativa === false));
    assert.equal(paraAdmin.voce, null);
    assert.equal(paraTecnico.voce.patente_id, paraTecnico.patentes[0].id);
  });

  it("imagem: só PNG, JPEG ou WebP, quadrada, até 1 MB; trocar apaga a antiga", async () => {
    const criada = await c.amb.esperar(201, "POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Imagem", pontos_necessarios: 7000, cor: "#abcdef" }) });
    const url = `/gamificacao/patentes/${criada.id}/imagem`;
    const [antes] = await c.amb.db.select().from(patente).where(eq(patente.id, criada.id));

    const naoQuadrada = await c.amb.req("PUT", url, { como: admin(), form: formulario({}, arquivoPng(200, 100)) });
    assert.equal(naoQuadrada.status, 422);
    assert.equal(naoQuadrada.corpo.erro.codigo, "imagem_nao_quadrada");
    assert.match(naoQuadrada.corpo.erro.mensagem, /200 × 100/);
    const texto = await c.amb.req("PUT", url, { como: admin(), form: formulario({}, new File(["isto não é uma imagem"], "x.png", { type: "image/png" })) });
    assert.equal(texto.status, 422);
    assert.equal(texto.corpo.erro.codigo, "tipo_de_arquivo");
    const grande = new Uint8Array(1024 * 1024 + 1);
    grande.set(pngDeTeste(128, 128));
    const enorme = await c.amb.req("PUT", url, { como: admin(), form: formulario({}, new File([grande], "g.png", { type: "image/png" })) });
    assert.equal(enorme.status, 413);
    const pequena = await c.amb.req("PUT", url, { como: admin(), form: formulario({}, arquivoPng(16, 16)) });
    assert.equal(pequena.status, 422);
    assert.equal(pequena.corpo.erro.codigo, "imagem_fora_do_tamanho");
    const semArquivo = await c.amb.req("PUT", url, { como: admin(), form: formulario({}, null) });
    assert.equal(semArquivo.status, 422);

    const ok = await c.amb.req("PUT", url, { como: admin(), form: formulario({}, arquivoPng(256)) });
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
    const [depois] = await c.amb.db.select().from(patente).where(eq(patente.id, criada.id));
    assert.notEqual(depois!.imagemPath, antes!.imagemPath);
    assert.equal(await c.amb.armazenamento.existe("gamificacao", antes!.imagemPath), false, "a imagem antiga foi apagada");
    assert.equal(await c.amb.armazenamento.existe("gamificacao", depois!.imagemPath), true);
    assert.equal((await auditar("patente.imagem")).length, 1);
    assert.equal((await c.como(admin(), "PUT", `/gamificacao/patentes/00000000-0000-4000-8000-000000000999/imagem`, { form: formulario({}) })).status, 404);
    assert.equal(depois!.imagemEquipePath, antes!.imagemEquipePath, "trocar a imagem das pessoas não mexe na das equipes");

    // A imagem das equipes é trocada à parte (campo `imagem_equipe`), com as mesmas regras, e não mexe na das pessoas.
    const urlEquipe = `/gamificacao/patentes/${criada.id}/imagem-equipe`;
    assert.equal((await c.como(admin(), "PUT", urlEquipe, { form: formularioDePatente({}, null, arquivoPng(200, 100)) })).corpo.erro.codigo, "imagem_nao_quadrada");
    assert.equal((await c.como(admin(), "PUT", urlEquipe, { form: formularioDePatente({}, arquivoPng(256), null) })).status, 422, "só o campo `imagem_equipe` vale nesta rota");
    const trocada = await c.amb.esperar(200, "PUT", urlEquipe, { como: admin(), form: formularioDePatente({}, null, arquivoPng(256)) });
    assert.ok(trocada.imagem_equipe_url.includes("gamificacao"));
    const [aposEquipe] = await c.amb.db.select().from(patente).where(eq(patente.id, criada.id));
    assert.notEqual(aposEquipe!.imagemEquipePath, depois!.imagemEquipePath);
    assert.equal(aposEquipe!.imagemPath, depois!.imagemPath, "trocar a imagem das equipes não mexe na das pessoas");
    assert.equal(await c.amb.armazenamento.existe("gamificacao", depois!.imagemEquipePath), false, "a imagem antiga das equipes foi apagada");
    assert.equal(await c.amb.armazenamento.existe("gamificacao", aposEquipe!.imagemEquipePath), true);
    assert.equal(await c.amb.armazenamento.existe("gamificacao", aposEquipe!.imagemPath), true);
    assert.equal((await auditar("patente.imagem")).length, 2);
    assert.equal((await c.como(admin(), "PUT", `/gamificacao/patentes/00000000-0000-4000-8000-000000000999/imagem-equipe`, { form: formularioDePatente({}, null) })).status, 404);
  });

  it("patente anterior à imagem de equipe (a migração deixa as duas apontando para o mesmo arquivo): trocar uma não apaga o que a outra ainda usa", async () => {
    const criada = await c.amb.esperar(201, "POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Herdada", pontos_necessarios: 7500, cor: "#123456" }) });
    const [linha] = await c.amb.db.select().from(patente).where(eq(patente.id, criada.id));
    await c.amb.db.update(patente).set({ imagemEquipePath: linha!.imagemPath }).where(eq(patente.id, criada.id));

    await c.amb.esperar(200, "PUT", `/gamificacao/patentes/${criada.id}/imagem`, { como: admin(), form: formulario({}, arquivoPng(256)) });
    assert.equal(await c.amb.armazenamento.existe("gamificacao", linha!.imagemPath), true, "as equipes ainda usam este arquivo");
    await c.amb.esperar(200, "PUT", `/gamificacao/patentes/${criada.id}/imagem-equipe`, { como: admin(), form: formularioDePatente({}, null, arquivoPng(256)) });
    assert.equal(await c.amb.armazenamento.existe("gamificacao", linha!.imagemPath), false, "agora ninguém o usa");
  });

  it("o leitor de imagens lê PNG, JPEG e WebP pelos bytes", () => {
    assert.deepEqual(lerImagem(pngDeTeste(512, 512)), { tipoMime: "image/png", largura: 512, altura: 512 });
    // JPEG mínimo: SOI, SOF0 (altura 300, largura 300).
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x2c, 0x01, 0x2c, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);
    assert.deepEqual(lerImagem(jpeg), { tipoMime: "image/jpeg", largura: 300, altura: 300 });
    // WebP sem perdas (VP8L): largura 100, altura 100.
    const webp = Buffer.alloc(30);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    webp.write("VP8L", 12);
    webp[20] = 0x2f;
    webp.writeUInt32LE((99 & 0x3fff) | ((99 & 0x3fff) << 14), 21);
    assert.deepEqual(lerImagem(webp), { tipoMime: "image/webp", largura: 100, altura: 100 });
    assert.equal(lerImagem(new Uint8Array([1, 2, 3])), null);
    assert.equal(lerImagem(new TextEncoder().encode("GIF89a........")), null);
  });

  it("excluir a patente: só se nunca foi gravada numa temporada fechada nem é meta de uma conquista", async () => {
    const livre = await c.amb.esperar(201, "POST", "/gamificacao/patentes", { como: admin(), form: formularioDePatente({ nome: "Descartável", pontos_necessarios: 9000, cor: "#101010" }) });
    const [linha] = await c.amb.db.select().from(patente).where(eq(patente.id, livre.id));
    assert.equal((await c.como(admin(), "DELETE", `/gamificacao/patentes/${livre.id}`)).status, 200);
    assert.equal(await c.amb.armazenamento.existe("gamificacao", linha!.imagemPath), false);
    assert.equal(await c.amb.armazenamento.existe("gamificacao", linha!.imagemEquipePath), false, "as duas imagens saem do bucket");
    assert.equal((await auditar("patente.excluir")).length, 1);
    assert.equal((await c.como(admin(), "DELETE", `/gamificacao/patentes/${livre.id}`)).status, 404);

    // Diamante é a meta de "Brilho de diamante": só desativa.
    const [diamante] = await c.amb.db.select().from(patente).where(eq(patente.nome, "Diamante"));
    const recusada = await c.como(admin(), "DELETE", `/gamificacao/patentes/${diamante!.id}`);
    assert.equal(recusada.status, 409);
    assert.equal(recusada.corpo.erro.codigo, "patente_em_uso");
    assert.match(recusada.corpo.erro.mensagem, /meta de uma conquista/);
  });

  it("conquista: cria com imagem, valida o título único, a quantidade e as imagens, e audita", async () => {
    const r = await c.amb.req("POST", "/gamificacao/conquistas", { como: admin(), form: formulario({ titulo: "Dez APRs", descricao: "Dez análises.", criterio: "aprs_completas", quantidade: 10, pontos: 40 }) });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.meta, "Complete 10 APRs");
    assert.equal(r.corpo.pontos, 40);
    assert.equal(r.corpo.ativa, true);
    assert.equal((await c.amb.req("POST", "/gamificacao/conquistas", { como: admin(), form: formulario({ titulo: "Dez APRs", descricao: "x", criterio: "aprs_completas", quantidade: 5 }) })).corpo.erro.codigo, "titulo_duplicado");
    const invalidos: [string, Record<string, string | number>][] = [
      ["critério inexistente", { titulo: "A1", descricao: "x", criterio: "nenhum", quantidade: 1 }],
      ["quantidade zero", { titulo: "A2", descricao: "x", criterio: "aprs_completas", quantidade: 0 }],
      ["sem descrição", { titulo: "A3", descricao: "", criterio: "aprs_completas", quantidade: 1 }],
      ["pontos negativos", { titulo: "A4", descricao: "x", criterio: "aprs_completas", quantidade: 1, pontos: -5 }],
    ];
    for (const [rotulo, campos] of invalidos) assert.equal((await c.amb.req("POST", "/gamificacao/conquistas", { como: admin(), form: formulario(campos) })).status, 422, rotulo);
    assert.equal((await c.amb.req("POST", "/gamificacao/conquistas", { como: admin(), form: formulario({ titulo: "A5", descricao: "x", criterio: "aprs_completas", quantidade: 1 }, arquivoPng(100, 90)) })).corpo.erro.codigo, "imagem_nao_quadrada");
    assert.equal((await auditar("conquista.criar")).length, 1);

    const editada = await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${r.corpo.id}`, { como: admin(), json: { titulo: "Dez análises", quantidade: 12 } });
    assert.equal(editada.meta, "Complete 12 APRs");
    assert.equal((await c.como(admin(), "PATCH", `/gamificacao/conquistas/${r.corpo.id}`, { json: {} })).status, 422);
    assert.equal((await c.como(admin(), "PATCH", `/gamificacao/conquistas/${r.corpo.id}`, { json: { titulo: "Primeiro passo" } })).status, 409);
    assert.equal((await auditar("conquista.editar")).length, 1);

    const troca = await c.amb.req("PUT", `/gamificacao/conquistas/${r.corpo.id}/imagem`, { como: admin(), form: formulario({}, arquivoPng(300)) });
    assert.equal(troca.status, 200, JSON.stringify(troca.corpo));
    assert.equal((await auditar("conquista.imagem")).length, 1);
    await c.amb.esperar(200, "PATCH", `/gamificacao/conquistas/${r.corpo.id}`, { como: admin(), json: { ativa: false } });
    assert.equal((await auditar("conquista.desativar")).length, 1);
    assert.equal((await c.como(admin(), "DELETE", `/gamificacao/conquistas/${r.corpo.id}`)).status, 200);
    assert.equal((await auditar("conquista.excluir")).length, 1);
    // As entidades novas aparecem na trilha de auditoria, com filtro.
    const trilha = await c.amb.esperar(200, "GET", "/auditoria", { como: admin(), consulta: { entidade: "conquista" } });
    assert.ok(trilha.registros.length >= 4);
    assert.ok(trilha.registros.every((x: any) => x.entidade === "conquista"));
  });

  it("a carga inicial: a migração tem exatamente os dados de gamificacao-dados.ts, e as imagens da carga são PNG quadrados", async () => {
    const migracao = readFileSync(join(import.meta.dirname, "..", "db", "migrations", "0016_gamificacao.sql"), "utf8").replace(/\r\n/g, "\n");
    assert.ok(migracao.includes(sqlDaCarga()), "o SQL da carga confere com os dados em TypeScript");
    const daEquipe = readFileSync(join(import.meta.dirname, "..", "db", "migrations", "0017_patente_imagem_da_equipe.sql"), "utf8").replace(/\r\n/g, "\n");
    assert.ok(daEquipe.includes(sqlDaImagemDaEquipe()), "a migração das imagens de equipe confere com os dados em TypeScript");
    const patentes = await c.amb.db.select().from(patente).where(eq(patente.id, PATENTES_DA_CARGA[0]!.id));
    assert.equal(patentes[0]!.imagemPath, PATENTES_DA_CARGA[0]!.imagemId);
    assert.equal(patentes[0]!.imagemEquipePath, PATENTES_DA_CARGA[0]!.imagemEquipeId);
    for (const p of PATENTES_DA_CARGA) assert.notEqual(p.imagemEquipeId, p.imagemId, "a carga traz uma imagem para as equipes e outra para as pessoas");
    assert.equal(CONQUISTAS_DA_CARGA.length, 23);

    const imagens = imagensDaCarga();
    assert.equal(imagens.size, 33, "5 medalhas, 5 brasões e 23 troféus");
    for (const bytes of imagens.values()) assert.deepEqual(lerImagem(bytes), { tipoMime: "image/png", largura: 192, altura: 192 });
    for (const p of PATENTES_DA_CARGA) assert.notDeepEqual(imagens.get(p.imagemEquipeId), imagens.get(p.imagemId), `${p.nome}: o brasão não é a medalha`);
    // A subida da api grava só as que faltam, e é idempotente.
    const deposito = new ArmazenamentoEmMemoria();
    assert.equal(await garantirImagensDaGamificacao(deposito), 33);
    assert.equal(await garantirImagensDaGamificacao(deposito), 0);
    assert.equal(await deposito.existe("gamificacao", PATENTES_DA_CARGA[4]!.imagemId), true);
    assert.equal(await deposito.existe("gamificacao", PATENTES_DA_CARGA[4]!.imagemEquipeId), true);
  });
});
