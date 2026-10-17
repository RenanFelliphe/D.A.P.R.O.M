import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import {
  atividade,
  atividadeMaterial,
  auditoria,
  conquista,
  conquistaUsuario,
  material,
  treinamentoServico,
  treinamentoServicoTentativa,
  treinamentoServicoVersao,
  usuario,
} from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";

/**
 * Testes dos treinamentos de serviço (seção 3 do `vitoria.md`): os 5 tipos de fase, o gabarito nunca exposto antes da
 * resposta, o embaralhamento por tentativa, a pontuação (primeira conclusão, refazer, abandonar), quem aguarda liberação
 * jogando, as 3 conquistas, o admin pré-visualizando sem pontuar, as permissões e a auditoria da publicação.
 */
describe("Treinamentos de serviço", () => {
  let amb: Ambiente;
  let admin: UsuarioDeTeste;
  let tecnico: UsuarioDeTeste;

  before(async () => {
    amb = await criarAmbiente();
    admin = await amb.criarUsuario({ perfil: "admin", nome: "Admin" });
    tecnico = await amb.criarUsuario({ perfil: "tecnico", nome: "Técnico" });
  });
  after(() => amb.fechar());

  // ---- Ajuda ----------------------------------------------------------------------------------------------------

  async function novaAtividade(codigo: string, descricao = codigo) {
    await amb.db.insert(atividade).values({ codigo, descricao }).onConflictDoNothing();
  }
  async function novoMaterial(descricao: string) {
    const [m] = await amb.db.insert(material).values({ descricao, unidade: "un" }).returning();
    return m!;
  }
  async function ligarMaterial(atividadeCodigo: string, materialId: string, ordem = 0) {
    await amb.db.insert(atividadeMaterial).values({ atividadeCodigo, materialId, ordem });
  }
  async function novaAssinatura() {
    const id = randomUUID();
    await amb.armazenamento.gravar("assinaturas", id, new Uint8Array([1, 2, 3]), "image/png");
    return id;
  }

  const EXPLICACAO = [
    { ordem: 0, texto: "Antes de começar, confira os EPIs.", expressao: "explicando" },
    { ordem: 1, texto: "Vamos praticar!", expressao: "feliz" },
  ];

  /** Uma fase de cada tipo, com um gabarito conhecido; `materiaisCertos` (2+) são os itens certos de "separar os itens". */
  function fasesDosCincoTipos(materiaisCertos: string[]) {
    return [
      { tipo: "quiz", enunciado: "Qual EPI é obrigatório?", opcoes: ["Luva", "Chapéu", "Óculos escuro", "Nenhum"], correta: 0, explicacao: "A luva protege as mãos." },
      {
        tipo: "decisao",
        situacao: "Você sente cheiro de gás.",
        opcoes: [
          { texto: "Continuar o serviço", consequencia: "Risco de explosão." },
          { texto: "Parar e ventilar o local", consequencia: "Local seguro." },
          { texto: "Acender um isqueiro para checar", consequencia: "Explosão." },
        ],
        correta: 1,
        explicacao: "Sempre pare e ventile.",
      },
      { tipo: "separar_itens", enunciado: "Toque nos itens deste serviço.", material_ids: materiaisCertos, quantidade_errados: 1, explicacao: "Só estes materiais são deste serviço." },
      {
        tipo: "ligar",
        pares: [
          { esquerda: "Vazamento", direita: "Ventilar o local" },
          { esquerda: "Faísca perto do gás", direita: "Afastar a fonte" },
        ],
        explicacao: "Ligue o risco à ação certa.",
      },
      { tipo: "ordem", enunciado: "Coloque as etapas em ordem.", etapas: ["Isolar a área", "Vestir o EPI", "Iniciar o serviço"], explicacao: "Siga sempre essa ordem." },
    ];
  }

  function fasesSimples(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      tipo: "quiz" as const,
      enunciado: `Pergunta ${i + 1}`,
      opcoes: ["Certa", "Errada 1", "Errada 2"],
      correta: 0,
      explicacao: "A primeira opção é a certa.",
    }));
  }

  async function obterRascunho(codigo: string) {
    return amb.esperar(200, "GET", `/treinamentos/${codigo}/rascunho`, { como: admin });
  }
  async function salvarRascunho(codigo: string, explicacao: unknown[], fases: unknown[]) {
    return amb.esperar(200, "PUT", `/treinamentos/${codigo}/rascunho`, { como: admin, json: { explicacao, fases } });
  }
  async function publicar(codigo: string) {
    const arquivo_id = await novaAssinatura();
    return amb.esperar(200, "POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id } });
  }

  /** Cria a atividade, o rascunho, salva e publica um treinamento com `fases` fases triviais (todas quiz, opção 0 certa). */
  async function criarEPublicar(codigo: string, fases: unknown[] = fasesSimples(3)) {
    await novaAtividade(codigo);
    await obterRascunho(codigo);
    await salvarRascunho(codigo, EXPLICACAO, fases);
    return publicar(codigo);
  }

  /** Lê a apresentação (embaralhamento) e o gabarito direto do banco, para montar respostas certas sem adivinhar. */
  async function apresentacaoEGabarito(tentativaId: string) {
    const [tentativa] = await amb.db.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.id, tentativaId));
    const [versao] = await amb.db.select().from(treinamentoServicoVersao).where(eq(treinamentoServicoVersao.id, tentativa!.versaoId));
    return { apresentacao: tentativa!.apresentacao as any, fases: versao!.fases as any[] };
  }

  /** A resposta certa de uma fase, calculada a partir do gabarito e do embaralhamento daquela tentativa. */
  function respostaCerta(ap: any, fase: any): unknown {
    if (fase.tipo === "quiz" || fase.tipo === "decisao") return { escolha: ap.ordem.indexOf(fase.correta) };
    if (fase.tipo === "separar_itens") return { selecionados: ap.itens.filter((i: any) => fase.material_ids.includes(i.materialId)).map((i: any) => i.materialId) };
    if (fase.tipo === "ligar") {
      const n = fase.pares.length;
      return { pares: Array.from({ length: n }, (_, k) => ({ esquerda: ap.esquerdaOrdem.indexOf(k), direita: ap.direitaOrdem.indexOf(k) })) };
    }
    const n = fase.etapas.length;
    return { sequencia: Array.from({ length: n }, (_, k) => ap.ordem.indexOf(k)) };
  }
  /** Uma resposta plausível, mas errada (sempre existe porque cada fase tem mais de uma opção/posição). */
  /**
   * Uma resposta sempre errada, qualquer que seja o embaralhamento daquela tentativa: em "ligar" e "pôr em ordem", aponta
   * tudo para a mesma posição (nunca forma um casamento ou uma sequência válida), em vez de um padrão fixo (como inverter),
   * que poderia coincidir com a resposta certa dependendo do sorteio.
   */
  function respostaErrada(ap: any, fase: any): unknown {
    if (fase.tipo === "quiz" || fase.tipo === "decisao") return { escolha: (ap.ordem.indexOf(fase.correta) + 1) % fase.opcoes.length };
    if (fase.tipo === "separar_itens") return { selecionados: [] };
    if (fase.tipo === "ligar") return { pares: Array.from({ length: fase.pares.length }, () => ({ esquerda: 0, direita: 0 })) };
    return { sequencia: Array.from({ length: fase.etapas.length }, () => 0) };
  }

  async function abrirTentativa(codigo: string, como: UsuarioDeTeste) {
    return amb.esperar(201, "POST", `/treinamentos/${codigo}/tentativas`, { como });
  }
  async function responder(tentativaId: string, fase: number, resposta: unknown, como: UsuarioDeTeste) {
    return amb.esperar(200, "POST", `/treinamentos/tentativas/${tentativaId}/fases/${fase}`, { como, json: resposta });
  }
  async function concluir(tentativaId: string, como: UsuarioDeTeste) {
    return amb.esperar(200, "POST", `/treinamentos/tentativas/${tentativaId}/concluir`, { como });
  }

  /**
   * Joga uma tentativa inteira de um treinamento de fases simples (todas quiz, opção 0). `acertar` vale para todas as fases,
   * ou uma a uma (um array), para controlar se a tentativa gabarita (o que também concede a conquista Nota máxima).
   */
  async function jogarTudo(codigo: string, como: UsuarioDeTeste, acertar: boolean | boolean[]) {
    const aberta = await abrirTentativa(codigo, como);
    const { apresentacao, fases } = await apresentacaoEGabarito(aberta.tentativa_id);
    for (let i = 0; i < fases.length; i++) {
      const acerta = Array.isArray(acertar) ? acertar[i] : acertar;
      const resposta = acerta ? respostaCerta(apresentacao.fases[i], fases[i]) : respostaErrada(apresentacao.fases[i], fases[i]);
      await responder(aberta.tentativa_id, i, resposta, como);
    }
    return concluir(aberta.tentativa_id, como);
  }

  // ---- Editor e publicação (admin) -------------------------------------------------------------------------------

  it("admin monta o rascunho, valida o conteúdo, publica com termo e assinatura, e a auditoria registra", async () => {
    const codigo = "TRE-5TIPOS";
    const material1 = await novoMaterial("Chave de fenda isolada");
    const material1b = await novoMaterial("Óculos de proteção");
    const material2 = await novoMaterial("Fita isolante");
    await novaAtividade(codigo);
    await novaAtividade("TRE-OUTRO");
    await ligarMaterial(codigo, material1.id, 0);
    await ligarMaterial(codigo, material1b.id, 1);
    await ligarMaterial("TRE-OUTRO", material2.id);

    const rascunho = await obterRascunho(codigo);
    assert.equal(rascunho.treinamento_id !== undefined, true);
    assert.equal(rascunho.versao, 1);
    assert.equal(rascunho.explicacao.length, 0);
    assert.equal(rascunho.fases.length, 0);
    // Abrir de novo é idempotente: não cria um segundo rascunho.
    const rascunho2 = await obterRascunho(codigo);
    assert.equal(rascunho2.versao_id, rascunho.versao_id);

    // Fase sem opção certa dentro do intervalo: 422.
    const comErro = await amb.req("PUT", `/treinamentos/${codigo}/rascunho`, {
      como: admin,
      json: { explicacao: EXPLICACAO, fases: [{ tipo: "quiz", enunciado: "X", opcoes: ["A", "B", "C"], correta: 9, explicacao: "x" }] },
    });
    assert.equal(comErro.status, 422);

    // Material inexistente no catálogo: 422.
    const comMaterialRuim = await amb.req("PUT", `/treinamentos/${codigo}/rascunho`, {
      como: admin,
      json: { explicacao: EXPLICACAO, fases: [{ tipo: "separar_itens", enunciado: "X", material_ids: [randomUUID(), randomUUID()], quantidade_errados: 1, explicacao: "x" }] },
    });
    assert.equal(comMaterialRuim.status, 422);

    // Publicar com menos de 3 fases: recusado.
    await salvarRascunho(codigo, EXPLICACAO, fasesSimples(2));
    const poucasFases = await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: await novaAssinatura() } });
    assert.equal(poucasFases.status, 422);

    const salvo = await salvarRascunho(codigo, EXPLICACAO, fasesDosCincoTipos([material1.id, material1b.id]));
    assert.equal(salvo.fases.length, 5);

    const publicado = await publicar(codigo);
    assert.equal(publicado.versao, 1);
    assert.ok(publicado.publicada_em);

    const [registro] = await amb.db.select().from(auditoria).where(eq(auditoria.acao, "treinamento.publicar"));
    assert.ok(registro, "a publicação é auditada");
    assert.equal(registro!.entidadeId, codigo);
    assert.match(registro!.resumo, /Publicou a versão 1/);

    const versoes = await amb.esperar(200, "GET", `/treinamentos/${codigo}/versoes`, { como: admin });
    assert.equal(versoes.versoes.length, 1);
    assert.equal(versoes.versoes[0].estado, "publicada");
    assert.equal(versoes.versoes[0].publicada_por_nome, "Admin");

    // Publicar sem assinatura enviada antes: 422 (um novo rascunho precisa existir; editar cria a versão 2).
    await obterRascunho(codigo);
    await salvarRascunho(codigo, EXPLICACAO, fasesSimples(3));
    const semAssinatura = await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: randomUUID() } });
    assert.equal(semAssinatura.status, 422);
  });

  it("permissões: só o admin edita e publica; só o técnico (e pendente) joga de verdade", async () => {
    const codigo = "TRE-PERM";
    await criarEPublicar(codigo);

    for (const [metodo, caminho] of [
      ["GET", `/treinamentos/${codigo}/rascunho`],
      ["PUT", `/treinamentos/${codigo}/rascunho`],
      ["POST", `/treinamentos/${codigo}/publicar`],
      ["GET", `/treinamentos/${codigo}/versoes`],
      ["GET", "/treinamentos/reportes"],
    ] as const) {
      const comCorpo = metodo === "PUT" || metodo === "POST" ? { json: {} } : {};
      assert.equal((await amb.req(metodo, caminho, { como: tecnico, ...comCorpo })).status, 403, `${metodo} ${caminho}`);
      assert.equal((await amb.req(metodo, caminho)).status, 401, `${metodo} ${caminho} sem token`);
    }
    // O admin não joga: abrir uma tentativa real é proibido (só a pré-visualização do rascunho).
    assert.equal((await amb.req("POST", `/treinamentos/${codigo}/tentativas`, { como: admin })).status, 403);
  });

  // ---- O jogo: gabarito escondido, os 5 tipos, idempotência --------------------------------------------------------

  it("a versão publicada não expõe fases, e a tentativa some o gabarito até a resposta", async () => {
    const codigo = "TRE-GABARITO";
    const material1 = await novoMaterial("Luva de raspa");
    const material1b = await novoMaterial("Protetor auricular");
    await novaAtividade(codigo);
    await ligarMaterial(codigo, material1.id, 0);
    await ligarMaterial(codigo, material1b.id, 1);
    await obterRascunho(codigo);
    await salvarRascunho(codigo, EXPLICACAO, fasesDosCincoTipos([material1.id, material1b.id]));
    await publicar(codigo);

    const publicada = await amb.esperar(200, "GET", `/treinamentos/${codigo}`, { como: tecnico });
    assert.equal(publicada.explicacao.length, 2);
    assert.equal(publicada.total_fases, 5);
    assert.equal("fases" in publicada, false, "a versão publicada nunca traz as fases");

    const aberta = await abrirTentativa(codigo, tecnico);
    assert.equal(aberta.total_fases, 5);
    assert.equal(aberta.fases.length, 5);
    for (const f of aberta.fases) {
      assert.equal("correta" in f, false);
      assert.equal("explicacao" in f, false);
      assert.equal("certos" in f, false);
      if (f.tipo === "decisao") for (const o of f.opcoes ?? []) assert.equal(typeof o, "string", "sem a consequência antes de responder");
    }
  });

  it("os 5 tipos de fase: certo e errado, e vale a primeira resposta de cada fase", async () => {
    const codigo = "TRE-TIPOS-2";
    const certo1 = await novoMaterial("Capacete");
    const certo2 = await novoMaterial("Botina de segurança");
    const errado = await novoMaterial("Luvas de couro (de outro serviço)");
    await novaAtividade(codigo);
    await novaAtividade("TRE-TIPOS-2-OUTRO");
    await ligarMaterial(codigo, certo1.id, 0);
    await ligarMaterial(codigo, certo2.id, 1);
    await ligarMaterial("TRE-TIPOS-2-OUTRO", errado.id);
    await obterRascunho(codigo);
    await salvarRascunho(codigo, EXPLICACAO, fasesDosCincoTipos([certo1.id, certo2.id]));
    await publicar(codigo);

    const aberta = await abrirTentativa(codigo, tecnico);
    const { apresentacao, fases } = await apresentacaoEGabarito(aberta.tentativa_id);

    // separar_itens: o pool tem os 2 certos e exatamente 1 errado, sorteado de outro serviço (não necessariamente
    // o `errado` desta atividade: outros testes já cadastraram materiais em outros serviços, candidatos válidos também).
    const faseItens = apresentacao.fases[2];
    assert.equal(faseItens.itens.length, 3);
    assert.ok(faseItens.itens.some((i: any) => i.materialId === certo1.id));
    assert.ok(faseItens.itens.some((i: any) => i.materialId === certo2.id));
    const idsCertos = new Set([certo1.id, certo2.id]);
    assert.equal(faseItens.itens.filter((i: any) => !idsCertos.has(i.materialId)).length, 1, "exatamente 1 item errado no pool");

    for (let i = 0; i < fases.length; i++) {
      const errada = await responder(aberta.tentativa_id, i, respostaErrada(apresentacao.fases[i], fases[i]), tecnico);
      assert.equal(errada.certa, false, `fase ${i} (${fases[i].tipo}) deveria estar errada`);
      assert.ok(errada.explicacao, `fase ${i} explica depois de responder`);
      // A primeira resposta (errada) já venceu: responder de novo, agora certo, não muda o que pontua.
      const segundaChamada = await responder(aberta.tentativa_id, i, respostaCerta(apresentacao.fases[i], fases[i]), tecnico);
      assert.equal(segundaChamada.certa, true, "a correção em si é sempre fiel ao gabarito");
    }
    const resultado = await concluir(aberta.tentativa_id, tecnico);
    assert.equal(resultado.fases_certas, 0, "a resposta gravada foi a primeira (errada) de cada fase");
  });

  it("reportar problema: registra com a fase e sem exigir perfil de admin", async () => {
    const codigo = "TRE-REPORTE";
    await criarEPublicar(codigo);
    const reporte = await amb.esperar(201, "POST", `/treinamentos/${codigo}/reportes`, { como: tecnico, json: { fase: 0, texto: "Esta resposta parece errada." } });
    assert.equal(reporte.texto, "Esta resposta parece errada.");
    const lista = await amb.esperar(200, "GET", "/treinamentos/reportes", { como: admin, consulta: { tratado: false } });
    assert.ok(lista.reportes.some((r: any) => r.id === reporte.id));
    const tratado = await amb.esperar(200, "PATCH", `/treinamentos/reportes/${reporte.id}`, { como: admin });
    assert.ok(tratado.tratado_em);
  });

  // ---- Pontuação ------------------------------------------------------------------------------------------------

  it("pontua na primeira conclusão (5 + 1 por fase certa), é idempotente e refazer não pontua de novo", async () => {
    const codigo = "TRE-PONTOS";
    const u = await amb.criarUsuario({ perfil: "tecnico" });
    await criarEPublicar(codigo, fasesSimples(4));

    // 3 certas e 1 errada: não gabarita, para isolar esta conta da conquista "Nota máxima" (que tem teste próprio).
    const primeira = await jogarTudo(codigo, u, [true, true, true, false]);
    assert.equal(primeira.fases_certas, 3);
    assert.equal(primeira.total_fases, 4);
    assert.equal(primeira.pontos_ganhos, 8, "5 do treinamento + 1 por cada uma das 3 fases certas");
    assert.equal(primeira.ganhos.length, 2);

    // Concluir a mesma tentativa de novo é idempotente: não gera novos pontos.
    const tentativas = await amb.db.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.usuarioId, u.id));
    const repetir = await concluir(tentativas[0]!.id, u);
    assert.equal(repetir.pontos_ganhos, 0);

    // Refazer (nova tentativa) não pontua de novo, mesmo acertando tudo.
    const refeita = await jogarTudo(codigo, u, true);
    assert.equal(refeita.fases_certas, 4);
    assert.equal(refeita.pontos_ganhos, 0, "refazer não pontua");

    const marcadasPontuadas = await amb.db.select().from(treinamentoServicoTentativa).where(and(eq(treinamentoServicoTentativa.usuarioId, u.id), eq(treinamentoServicoTentativa.pontuada, true)));
    assert.equal(marcadasPontuadas.length, 1, "só uma tentativa pontuou");
  });

  it("abandonar a primeira tentativa e concluir a segunda pontua normalmente (mas não conta como 'gabaritou na 1ª')", async () => {
    const codigo = "TRE-ABANDONO";
    const u = await amb.criarUsuario({ perfil: "tecnico" });
    await criarEPublicar(codigo, fasesSimples(3));

    // Abre e abandona (nunca conclui).
    await abrirTentativa(codigo, u);
    // Abre e conclui a segunda, gabaritando.
    const resultado = await jogarTudo(codigo, u, true);
    assert.equal(resultado.pontos_ganhos, 8);

    const pontuada = (await amb.db.select().from(treinamentoServicoTentativa).where(and(eq(treinamentoServicoTentativa.usuarioId, u.id), eq(treinamentoServicoTentativa.pontuada, true))))[0]!;
    assert.equal(pontuada.fasesCertas, 3, "a pontuada gabaritou");

    // "Gabaritado na 1ª tentativa" não vale aqui: havia uma tentativa anterior (abandonada) para este treinamento.
    const { progressoDaPessoa, carregarDadosDaPessoa } = await import("../src/dominio/conquistas");
    const dados = await carregarDadosDaPessoa(amb.db, u.id);
    assert.equal(dados.treinamentosGabaritados.length, 0);
    void progressoDaPessoa;
  });

  it("quem aguarda liberação (pendente) joga e pontua", async () => {
    const codigo = "TRE-PENDENTE";
    const pendente = await amb.criarUsuario({ perfil: "tecnico" });
    await amb.db.update(usuario).set({ liberacao: "pendente" }).where(eq(usuario.id, pendente.id));
    await criarEPublicar(codigo, fasesSimples(3));

    const lista = await amb.esperar(200, "GET", "/treinamentos", { como: pendente });
    assert.ok(lista.treinamentos.some((t: any) => t.atividade_codigo === codigo));
    // Gabarita a única tentativa: concede também a conquista "Nota máxima" (5 + 3 fases + 25 da conquista).
    const resultado = await jogarTudo(codigo, pendente, true);
    assert.equal(resultado.pontos_ganhos, 33);
  });

  it("admin pré-visualiza o rascunho sem pontuar", async () => {
    const codigo = "TRE-PREVIA";
    await novaAtividade(codigo);
    await obterRascunho(codigo);
    await salvarRascunho(codigo, EXPLICACAO, fasesSimples(3));

    const aberta = await amb.esperar(201, "POST", `/treinamentos/${codigo}/rascunho/pre-visualizar/tentativas`, { como: admin });
    const { apresentacao, fases } = await apresentacaoEGabarito(aberta.tentativa_id);
    for (let i = 0; i < fases.length; i++) await responder(aberta.tentativa_id, i, respostaCerta(apresentacao.fases[i], fases[i]), admin);
    const concluida = await concluir(aberta.tentativa_id, admin);
    assert.equal(concluida.fases_certas, 3);
    assert.equal(concluida.pontos_ganhos, 0, "a pré-visualização nunca pontua");

    const [linha] = await amb.db.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.id, aberta.tentativa_id));
    assert.equal(linha!.pontuada, false);
    assert.equal(linha!.preVisualizacao, true);
  });

  // ---- Conquistas -----------------------------------------------------------------------------------------------

  it("conquista Aprendiz (3 treinamentos concluídos)", async () => {
    const u = await amb.criarUsuario({ perfil: "tecnico" });
    for (let i = 1; i <= 3; i++) {
      await criarEPublicar(`TRE-APRENDIZ-${i}`, fasesSimples(3));
      await jogarTudo(`TRE-APRENDIZ-${i}`, u, i !== 2);
    }
    const [c] = await amb.db.select().from(conquista).where(eq(conquista.titulo, "Aprendiz"));
    const obtida = await amb.db.select().from(conquistaUsuario).where(and(eq(conquistaUsuario.usuarioId, u.id), eq(conquistaUsuario.conquistaId, c!.id)));
    assert.equal(obtida.length, 1, "3 treinamentos concluídos (acertando ou não) bastam para o Aprendiz");
  });

  it("conquista Especialista (10 treinamentos concluídos)", async () => {
    const u = await amb.criarUsuario({ perfil: "tecnico" });
    for (let i = 1; i <= 10; i++) {
      await criarEPublicar(`TRE-ESPECIALISTA-${i}`, fasesSimples(3));
      await jogarTudo(`TRE-ESPECIALISTA-${i}`, u, true);
    }
    const [c] = await amb.db.select().from(conquista).where(eq(conquista.titulo, "Especialista"));
    const obtida = await amb.db.select().from(conquistaUsuario).where(and(eq(conquistaUsuario.usuarioId, u.id), eq(conquistaUsuario.conquistaId, c!.id)));
    assert.equal(obtida.length, 1);
  });

  it("conquista Nota máxima (gabaritou um treinamento na primeira tentativa)", async () => {
    const u = await amb.criarUsuario({ perfil: "tecnico" });
    await criarEPublicar("TRE-NOTA-MAXIMA", fasesSimples(3));
    await jogarTudo("TRE-NOTA-MAXIMA", u, true);
    const [c] = await amb.db.select().from(conquista).where(eq(conquista.titulo, "Nota máxima"));
    const obtida = await amb.db.select().from(conquistaUsuario).where(and(eq(conquistaUsuario.usuarioId, u.id), eq(conquistaUsuario.conquistaId, c!.id)));
    assert.equal(obtida.length, 1);
  });

  it("uma tabela nova de treinamento (sem versão publicada) devolve 404 ao abrir ou jogar", async () => {
    await novaAtividade("TRE-SEM-PUBLICAR");
    assert.equal((await amb.req("GET", "/treinamentos/TRE-SEM-PUBLICAR", { como: tecnico })).status, 404);
    assert.equal((await amb.req("POST", "/treinamentos/TRE-SEM-PUBLICAR/tentativas", { como: tecnico })).status, 404);
  });

  it("treinamento inexistente no catálogo: o editor recusa criar rascunho", async () => {
    assert.equal((await amb.req("GET", "/treinamentos/NAO-EXISTE-NO-CATALOGO/rascunho", { como: admin })).status, 404);
  });

  it("instância de treinamento isolada por serviço", async () => {
    const [linha] = await amb.db.select().from(treinamentoServico).where(eq(treinamentoServico.atividadeCodigo, "TRE-5TIPOS"));
    assert.ok(linha, "o primeiro teste já criou o treinamento do serviço TRE-5TIPOS");
  });
});
