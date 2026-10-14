import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { atividade, auditoria, itemModeloApr, localInstalacao, modeloApr, os } from "../src/db/schema";
import { executarTarefasPendentes } from "../src/servicos/tarefas";
import { arquivoDeImagem, criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * Conferência dos materiais do serviço na APR: o item obrigatório da lista da atividade exige a foto dele; sem a foto, ou
 * sem o item, a APR é bloqueada (a OS fica pendente e o supervisor é avisado). Não há controle de estoque.
 */
describe("Conferência dos materiais na APR", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;
  let colega: UsuarioDeTeste;
  let outraEquipe: UsuarioDeTeste;
  let equipeId: string;
  let localId: string;
  let modeloId: string;
  let respostas: { item_id: string; resposta: string }[];
  let contadorOs = 7000000;

  const servico = "SERV-MAT";
  const material: Record<"detector" | "luva" | "fita", string> = { detector: "", luva: "", fita: "" };

  before(async () => {
    amb = await criarAmbiente({ comCarga: true });
    admin = await amb.criarUsuario({ perfil: "admin" });
    const supervisor = await amb.criarUsuario({ perfil: "tecnico" });
    equipeId = (await amb.criarEquipe({ supervisorId: supervisor.id })).id;
    tecnico = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    colega = await amb.criarUsuario({ perfil: "tecnico", equipeId });
    outraEquipe = await amb.criarUsuario({ perfil: "tecnico", equipeId: (await amb.criarEquipe()).id });
    [{ id: localId }] = (await amb.db.insert(localInstalacao).values({ codigo: "SERRA/ERS" }).returning({ id: localInstalacao.id })) as [{ id: string }];

    const [m] = await amb.db.select().from(modeloApr).where(eq(modeloApr.codigo, "APR 01"));
    modeloId = m!.id;
    const itens = (await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, modeloId))).filter((i) => i.secao === "verificacao");
    // Só respostas que não bloqueiam: o que bloqueia aqui é o material.
    respostas = itens.map((i) => ({ item_id: i.id, resposta: i.respostaBloqueante === "sim" ? "nao" : "sim" }));

    await amb.db.insert(atividade).values({ codigo: servico, descricao: "Serviço com materiais" });
    material.detector = (await criarMaterial({ descricao: "Detector de gases", unidade: "un", categoria: "ferramenta" })).id;
    material.luva = (await criarMaterial({ descricao: "Luva de vaqueta", unidade: "par", categoria: "epi" })).id;
    material.fita = (await criarMaterial({ descricao: "Fita veda-rosca", unidade: "un" })).id;
    await definirLista([
      { material_id: material.detector, quantidade: 1, obrigatorio: true },
      { material_id: material.luva, quantidade: 1 },
      { material_id: material.fita, quantidade: 2 },
    ]);
  });
  after(() => amb.fechar());

  const criarMaterial = (json: object) => amb.esperar(201, "POST", "/catalogo/materiais", { como: admin, json });
  const caminho = `/catalogo/servicos/${encodeURIComponent(servico)}`;
  const definirLista = (materiais: object[]) => amb.esperar(200, "PUT", caminho, { como: admin, json: { materiais } });
  const agora = () => amb.relogio.agora.toISOString();

  async function novaOs(dados: Partial<typeof os.$inferInsert> = {}) {
    const [o] = await amb.db
      .insert(os)
      .values({ numeroOrdem: String(++contadorOs), tipo: "corretiva", titulo: "Serviço com materiais", localInstalacaoId: localId, equipeId, dataInicioProg: "2026-10-11", origem: "sap", codigoAtividade: servico, ...dados })
      .returning();
    return o!;
  }
  const foto = async () => {
    const id = randomUUID();
    await amb.armazenamento.gravar("fotos", id, new Uint8Array([1]), "image/png");
    return id;
  };
  const fotoDoItem = async () => ({ arquivo_id: await foto(), capturada_em: agora(), latitude: -20.3, longitude: -40.3 });
  const levou = async (id: string, comFoto: boolean) => ({ material_id: id, levou: true, ...(comFoto ? { foto: await fotoDoItem() } : {}) });

  const corpoDaApr = (materiais: object[] | undefined, extra: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    modelo_apr_id: modeloId,
    participantes: [tecnico, colega].map((u, i) => ({ usuario_id: u.id, funcao: i === 0 ? "responsavel" : "executor" })),
    riscos: [],
    respostas,
    ...(materiais ? { materiais } : {}),
    concluida_em: agora(),
    ...extra,
  });
  const avaliar = (osId: string, corpo: object, como = tecnico) => amb.req("POST", "/aprs/avaliar", { como, json: { ...corpo, os_id: osId } });
  const registrar = (osId: string, corpo: object, como = tecnico, ocorrido = agora()) =>
    amb.req("POST", "/eventos", { como, json: { eventos: [{ id: randomUUID(), tipo: "apr_concluida", os_id: osId, payload: { ...corpo, evidencias: [] }, ocorrido_em: ocorrido }] } });
  const statusDa = async (id: string) => (await amb.db.select({ s: os.status }).from(os).where(eq(os.id, id)))[0]!.s;
  const alertasDeBloqueio = (osId: string) => amb.sql<{ detalhe: string }>("select detalhe from alerta where os_id = $1 and tipo = 'bloqueio'", [osId]);

  describe("o catálogo", () => {
    it("o admin marca o item obrigatório; o técnico o vê na lista da OS e no snapshot", async () => {
      const lista = await amb.esperar(200, "GET", caminho, { como: tecnico });
      assert.deepEqual(
        lista.materiais.map((m: { descricao: string; obrigatorio: boolean }) => [m.descricao, m.obrigatorio]),
        [["Detector de gases", true], ["Luva de vaqueta", false], ["Fita veda-rosca", false]],
      );
      const o = await novaOs();
      const detalhe = await amb.esperar(200, "GET", `/os/${o.id}`, { como: tecnico });
      assert.deepEqual(detalhe.servico.materiais.map((m: { obrigatorio: boolean }) => m.obrigatorio), [true, false, false]);
      const snapshot = await amb.esperar(200, "POST", "/sync/pull", { como: tecnico });
      const doServico = snapshot.atividades.find((a: { codigo: string }) => a.codigo === servico);
      assert.deepEqual(doServico.materiais.map((m: { obrigatorio: boolean }) => m.obrigatorio), [true, false, false]);
    });

    it("sem dizer, o item não é obrigatório; mudar só o obrigatório entra na auditoria", async () => {
      await definirLista([{ material_id: material.detector, quantidade: 1 }]);
      assert.equal((await amb.esperar(200, "GET", caminho, { como: admin })).materiais[0].obrigatorio, false);
      await definirLista([{ material_id: material.detector, quantidade: 1, obrigatorio: true }, { material_id: material.luva, quantidade: 1 }, { material_id: material.fita, quantidade: 2 }]);
      const registros = await amb.db.select().from(auditoria).where(eq(auditoria.entidadeId, servico));
      assert.ok(registros.every((r) => r.acao === "atividade.materiais"));
      const mudanca = registros
        .map((r) => (r.detalhes as { materiais: { de: string[]; para: string[] } }).materiais)
        .find((m) => m.de.includes("Detector de gases (1 un)") && m.para.includes("Detector de gases (1 un, obrigatório)"));
      assert.ok(mudanca, "a troca só do obrigatório aparece com o antes e o depois");
    });

    it("não exclui o material que já foi conferido numa APR", async () => {
      const o = await novaOs({ codigoAtividade: servico });
      const r = await registrar(o.id, corpoDaApr([await levou(material.detector, true)]));
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      const solto = (await criarMaterial({ descricao: "Material conferido e depois tirado da lista", unidade: "un" })).id;
      await definirLista([
        { material_id: material.detector, quantidade: 1, obrigatorio: true },
        { material_id: material.luva, quantidade: 1 },
        { material_id: material.fita, quantidade: 2 },
        { material_id: solto, quantidade: 1 },
      ]);
      const o2 = await novaOs();
      assert.equal(
        (await registrar(o2.id, corpoDaApr([await levou(material.detector, true), await levou(solto, false)]))).status,
        200,
      );
      await definirLista([{ material_id: material.detector, quantidade: 1, obrigatorio: true }, { material_id: material.luva, quantidade: 1 }, { material_id: material.fita, quantidade: 2 }]);
      const excluir = await amb.req("DELETE", `/catalogo/materiais/${solto}`, { como: admin });
      assert.equal(excluir.status, 409);
      assert.equal(excluir.corpo.erro.codigo, "material_em_uso");
    });
  });

  describe("a validação da APR", () => {
    it("com a foto do item obrigatório, a APR passa; os demais só precisam ser conferidos", async () => {
      const o = await novaOs();
      const corpo = corpoDaApr([await levou(material.detector, true), { material_id: material.luva, levou: true }, { material_id: material.fita, levou: false }]);
      const r = await avaliar(o.id, corpo);
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      assert.deepEqual(r.corpo, { resultado: "aprovada", reprovados: [], materiais_faltando: [] });
      assert.equal((await amb.sql("select 1 from apr where os_id = $1", [o.id])).length, 0, "a aprovada só é registrada pelo apr_concluida");

      const registro = await registrar(o.id, corpo);
      assert.deepEqual(registro.corpo.aprs, [{ id: corpo.id, resultado: "aprovada" }]);
      const linhas = await amb.sql<{ descricao: string; obrigatorio: boolean; levou: boolean; foto_path: string | null }>(
        "select m.descricao, am.obrigatorio, am.levou, am.foto_path from apr_material am join material m on m.id = am.material_id where am.apr_id = $1 order by m.descricao",
        [corpo.id],
      );
      assert.deepEqual(
        linhas.map((l) => [l.descricao, l.obrigatorio, l.levou, l.foto_path !== null]),
        [["Detector de gases", true, true, true], ["Fita veda-rosca", false, false, false], ["Luva de vaqueta", false, true, false]],
      );
      assert.equal(await statusDa(o.id), "liberada");
    });

    it("sem a foto do item obrigatório, a APR é bloqueada na hora: OS pendente e alerta ao supervisor", async () => {
      const o = await novaOs();
      const corpo = corpoDaApr([await levou(material.detector, false), await levou(material.luva, false)]);
      const r = await avaliar(o.id, corpo);
      assert.equal(r.status, 200, JSON.stringify(r.corpo));
      assert.equal(r.corpo.resultado, "bloqueada");
      assert.deepEqual(r.corpo.reprovados, []);
      assert.deepEqual(r.corpo.materiais_faltando, [{ material_id: material.detector, descricao: "Detector de gases", levou: true }]);
      assert.deepEqual(await amb.sql("select resultado from apr where id = $1", [corpo.id]), [{ resultado: "bloqueada" }]);
      assert.equal(await statusDa(o.id), "pendente");
      const alertas = await alertasDeBloqueio(o.id);
      assert.equal(alertas.length, 1);
      assert.match(alertas[0]!.detalhe, /APR bloqueada \(1 material\(is\) obrigatório\(s\) sem comprovação\): Detector de gases — sem foto/);

      // Validar de novo a mesma APR devolve o que ficou gravado, sem duplicar o alerta.
      const deNovo = await avaliar(o.id, corpo);
      assert.deepEqual(deNovo.corpo, r.corpo);
      assert.equal((await alertasDeBloqueio(o.id)).length, 1);
      // Nada mais a completar: o evento da mesma APR só confirma o que já está gravado.
      const confirmada = await registrar(o.id, corpo);
      assert.equal(confirmada.status, 200);
      assert.deepEqual(confirmada.corpo.aprs, [{ id: corpo.id, resultado: "bloqueada" }]);
      assert.equal((await alertasDeBloqueio(o.id)).length, 1);
    });

    it("o e-mail ao supervisor diz quais materiais obrigatórios ficaram sem comprovação", async () => {
      const o = await novaOs();
      const corpo = corpoDaApr([await levou(material.detector, false)]);
      assert.equal((await avaliar(o.id, corpo)).corpo.resultado, "bloqueada");
      const antes = amb.email.enviados.length;
      // A tarefa nasce no relógio real, depois do relógio fixo do ambiente: avança o relógio só para executá-la.
      const relogio = amb.relogio.agora;
      amb.relogio.agora = new Date(Date.now() + 120_000);
      try {
        await executarTarefasPendentes(amb.deps);
      } finally {
        amb.relogio.agora = relogio;
      }
      const mensagem = amb.email.enviados.slice(antes).find((m) => m.assunto.includes(String(o.numeroOrdem)));
      assert.ok(mensagem, "o supervisor recebe o e-mail do bloqueio");
      assert.match(mensagem.texto, /Materiais obrigatórios sem comprovação:\n1\. Detector de gases — sem foto/);
      assert.match(mensagem.html ?? "", /Materiais obrigatórios sem comprovação/);
    });

    it("o item obrigatório que não levou, ou que nem veio na conferência, bloqueia", async () => {
      for (const materiais of [[{ material_id: material.detector, levou: false }], [], undefined]) {
        const o = await novaOs();
        const corpo = corpoDaApr(materiais);
        const r = await avaliar(o.id, corpo);
        assert.equal(r.corpo.resultado, "bloqueada", JSON.stringify(materiais));
        assert.deepEqual(r.corpo.materiais_faltando, [{ material_id: material.detector, descricao: "Detector de gases", levou: false }]);
        assert.match((await alertasDeBloqueio(o.id))[0]!.detalhe, /Detector de gases — não levou/);
        // O obrigatório fica gravado como não levado, mesmo quando a conferência nem o trazia.
        assert.deepEqual(await amb.sql("select levou, obrigatorio from apr_material where apr_id = $1 and material_id = $2", [corpo.id, material.detector]), [{ levou: false, obrigatorio: true }]);
      }
    });

    it("o item obrigatório que faltou e um item de verificação reprovado aparecem juntos, no mesmo alerta", async () => {
      const o = await novaOs();
      const eliminatorio = (await amb.db.select().from(itemModeloApr).where(eq(itemModeloApr.modeloAprId, modeloId))).find((i) => i.secao === "verificacao" && i.tipo === "eliminatorio")!;
      const corpo = corpoDaApr([{ material_id: material.detector, levou: false }], {
        respostas: respostas.map((r) => (r.item_id === eliminatorio.id ? { ...r, resposta: eliminatorio.respostaBloqueante } : r)),
      });
      const r = await avaliar(o.id, corpo);
      assert.equal(r.corpo.resultado, "bloqueada");
      assert.equal(r.corpo.reprovados.length, 1);
      assert.equal(r.corpo.materiais_faltando.length, 1);
      assert.match((await alertasDeBloqueio(o.id))[0]!.detalhe, /APR bloqueada \(1 item\(ns\) reprovado\(s\) e 1 material\(is\) obrigatório\(s\) sem comprovação\)/);
    });

    it("serviço sem item obrigatório, ou OS sem atividade, não exige conferência nenhuma", async () => {
      const semAtividade = await novaOs({ codigoAtividade: null });
      assert.equal((await avaliar(semAtividade.id, corpoDaApr(undefined))).corpo.resultado, "aprovada");
      await definirLista([{ material_id: material.luva, quantidade: 1 }]);
      try {
        const o = await novaOs();
        assert.equal((await avaliar(o.id, corpoDaApr(undefined))).corpo.resultado, "aprovada");
        assert.equal((await avaliar(o.id, corpoDaApr([{ material_id: material.luva, levou: false }]))).corpo.resultado, "aprovada");
      } finally {
        await definirLista([{ material_id: material.detector, quantidade: 1, obrigatorio: true }, { material_id: material.luva, quantidade: 1 }, { material_id: material.fita, quantidade: 2 }]);
      }
    });

    it("recusa a conferência malformada, antes do resultado", async () => {
      const o = await novaOs();
      const recusa = async (materiais: object[], codigo: string, status = 422) => {
        const r = await avaliar(o.id, corpoDaApr(materiais));
        assert.equal(r.status, status, JSON.stringify(r.corpo));
        assert.equal(r.corpo.erro.codigo, codigo);
      };
      await recusa([{ material_id: randomUUID(), levou: true }], "material_invalido");
      await recusa([await levou(material.detector, true), { material_id: material.detector, levou: false }], "material_repetido");
      await recusa([{ material_id: material.detector, levou: false, foto: await fotoDoItem() }], "foto_sem_material");
      await recusa([{ material_id: material.detector, levou: true, foto: { arquivo_id: randomUUID(), capturada_em: agora() } }], "arquivo_ausente");
      assert.equal((await amb.req("POST", "/aprs/avaliar", { como: tecnico, json: { ...corpoDaApr([{ material_id: "x", levou: true }]), os_id: o.id } })).status, 422);
      assert.equal((await amb.sql("select 1 from apr where os_id = $1", [o.id])).length, 0);
      assert.equal(await statusDa(o.id), "liberada");
    });

    it("a OS de outra equipe não existe para o técnico", async () => {
      const o = await novaOs();
      assert.equal((await avaliar(o.id, corpoDaApr([await levou(material.detector, true)]), outraEquipe)).status, 404);
    });
  });

  describe("o registro da APR (apr_concluida)", () => {
    it("a conferência que veio da fila offline sem o item que já saiu da lista é aceita; online é recusada", async () => {
      const removido = (await criarMaterial({ descricao: "Item que saiu da lista", unidade: "un" })).id;
      const detector = await levou(material.detector, true);
      const materiais = [detector, { material_id: removido, levou: true }];

      const online = await novaOs();
      const recusada = await registrar(online.id, corpoDaApr(materiais));
      assert.equal(recusada.corpo.rejeitados[0].codigo, "material_invalido");

      const offline = await novaOs();
      const antes = new Date(amb.relogio.agora.getTime() - 3 * 3600_000).toISOString();
      const aceita = await registrar(offline.id, corpoDaApr(materiais, { concluida_em: antes }), tecnico, antes);
      assert.equal(aceita.status, 200, JSON.stringify(aceita.corpo));
      assert.equal(aceita.corpo.rejeitados.length, 0, JSON.stringify(aceita.corpo));
      assert.equal(aceita.corpo.aprs[0].resultado, "aprovada");
      assert.equal((await amb.sql("select 1 from apr_material where material_id = $1", [removido])).length, 0, "o item que saiu da lista não é gravado");
    });

    it("o servidor não confia no resultado do aparelho: obrigatório sem foto é bloqueada mesmo com `resultado: aprovada`", async () => {
      const o = await novaOs();
      const corpo = corpoDaApr([await levou(material.detector, false)], { resultado: "aprovada" });
      const r = await registrar(o.id, corpo);
      assert.deepEqual(r.corpo.aprs, [{ id: corpo.id, resultado: "bloqueada" }]);
      assert.equal(await statusDa(o.id), "pendente");
    });

    it("o arquivo da foto ainda não enviado deixa o evento pendente", async () => {
      const o = await novaOs();
      const corpo = corpoDaApr([{ material_id: material.detector, levou: true, foto: { arquivo_id: randomUUID(), capturada_em: agora() } }]);
      const r = await registrar(o.id, corpo);
      assert.equal(r.corpo.pendentes[0].codigo, "arquivo_ausente");
      assert.equal((await amb.sql("select 1 from apr where id = $1", [corpo.id])).length, 0);
    });
  });

  describe("a leitura", () => {
    it("o histórico de APRs da OS traz a conferência e a foto do item é lida por quem é da equipe", async () => {
      const o = await novaOs();
      const arquivoId = randomUUID();
      const form = new FormData();
      form.set("arquivo", arquivoDeImagem());
      form.set("tipo", "foto");
      const put = await amb.req("PUT", `/arquivos/${arquivoId}`, { como: tecnico, form });
      assert.equal(put.status, 200, JSON.stringify(put.corpo));
      const corpo = corpoDaApr([
        { material_id: material.detector, levou: true, foto: { arquivo_id: arquivoId, capturada_em: agora(), latitude: -20.3, longitude: -40.3 } },
        { material_id: material.fita, levou: false },
      ]);
      assert.equal((await registrar(o.id, corpo)).corpo.aprs[0].resultado, "aprovada");

      for (const como of [tecnico, admin]) {
        const { aprs } = await amb.esperar(200, "GET", `/os/${o.id}/aprs`, { como });
        const conferencia = aprs[0].materiais;
        assert.deepEqual(
          conferencia.map((m: { descricao: string; obrigatorio: boolean; levou: boolean; foto: { foto_path: string } | null }) => [m.descricao, m.obrigatorio, m.levou, m.foto?.foto_path ?? null]),
          [["Detector de gases", true, true, arquivoId], ["Fita veda-rosca", false, false, null]],
        );
        assert.equal(conferencia[0].categoria, "ferramenta");
      }
      assert.equal((await amb.req("GET", `/arquivos/${arquivoId}/url`, { como: tecnico })).status, 200);
      assert.equal((await amb.req("GET", `/arquivos/${arquivoId}/url`, { como: colega })).status, 200);
      assert.equal((await amb.req("GET", `/arquivos/${arquivoId}/url`, { como: outraEquipe })).status, 403);
    });
  });
});
