import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import {
  atividade,
  atividadeMaterial,
  auditoria,
  conquista,
  conquistaUsuario,
  material,
  treinamentoServico,
  treinamentoServicoResposta,
  treinamentoServicoTentativa,
  treinamentoServicoVersao,
  usuario,
} from "../src/db/schema";
import { criarAmbiente, type Ambiente, type UsuarioDeTeste } from "./ajuda";
import { letrasDaGrade, letrasDaPalavra } from "../../shared/treinamento-servico/jogos";

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

  /** Uma fase de cada tipo antigo, com um gabarito conhecido; `materiaisCertos` (2+) são os itens certos do Selecione com os materiais do serviço. */
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
      { tipo: "selecione", enunciado: "Toque nos itens deste serviço.", opcoes: [], materiais: { material_ids: materiaisCertos, quantidade_errados: 1 }, explicacao: "Só estes materiais são deste serviço." },
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

  /** Os bancos de 10 palavras do Desembaralhe e do Termo (cada tentativa sorteia uma). */
  const BANCO_DESEMBARALHE = ["Inspeção", "Bloqueio", "Capacete", "Aterramento", "Etiqueta", "Isolamento", "Disjuntor", "Sinalização", "Medição", "Trava"];
  const BANCO_TERMO = ["Risco", "Calor", "Fusível", "Chave", "Luva", "Cabo", "Poste", "Fiação", "Tensão", "Terra"];

  /** Uma fase de cada minijogo novo (verdadeiro ou falso, caça-palavras, memória, selecione, desembaralhe e Termo). */
  function fasesDosJogosNovos() {
    return [
      { tipo: "verdadeiro_falso", afirmacao: "Antes da manutenção, o equipamento precisa estar desligado e bloqueado.", verdadeira: true, explicacao: "Sempre bloqueie antes." },
      {
        tipo: "caca_palavras",
        enunciado: "Encontre os termos do serviço.",
        modo: "pistas",
        palavras: [
          { palavra: "Bloqueio", pista: "Impede religar o equipamento" },
          { palavra: "EPI", pista: "Equipamento de proteção individual" },
          { palavra: "Inspeção", pista: "Olhar com atenção antes de começar" },
        ],
        explicacao: "São os termos do procedimento.",
      },
      {
        tipo: "memoria",
        pares: [
          { termo: "Capacete", correspondente: "Protege a cabeça" },
          { termo: "Luva", correspondente: "Protege as mãos" },
        ],
        explicacao: "Cada EPI protege uma parte do corpo.",
      },
      {
        tipo: "selecione",
        enunciado: "Selecione os EPIs desta atividade.",
        opcoes: [
          { texto: "Capacete", correta: true },
          { texto: "Luva isolante", correta: true },
          { texto: "Chinelo", correta: false },
          { texto: "Boné", correta: false },
        ],
        explicacao: "Capacete e luva isolante.",
      },
      { tipo: "desembaralhe", palavras: BANCO_DESEMBARALHE.map((palavra) => ({ palavra, dica: `O que é ${palavra.length} letras` })), explicacao: "São palavras do serviço." },
      { tipo: "termo", palavras: BANCO_TERMO.map((palavra) => ({ palavra, dica: "Do serviço" })), explicacao: "São palavras do serviço." },
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
    if (fase.tipo === "verdadeiro_falso") return { verdadeira: fase.verdadeira };
    if (fase.tipo === "caca_palavras") return { selecoes: ap.posicoes };
    if (fase.tipo === "memoria") return { jogadas: fase.pares.map((_: unknown, p: number) => ap.cartas.flatMap((c: any, i: number) => (c.par === p ? [i] : []))) };
    if (fase.tipo === "selecione" && fase.materiais) return { marcadas: ap.itens.flatMap((item: any, i: number) => (fase.materiais.material_ids.includes(item.materialId) ? [i] : [])) };
    if (fase.tipo === "selecione") return { marcadas: ap.ordem.flatMap((original: number, i: number) => (fase.opcoes[original].correta ? [i] : [])) };
    if (fase.tipo === "desembaralhe") return { letras: ap.ordem.map((_: unknown, k: number) => ap.ordem.indexOf(k)) };
    if (fase.tipo === "termo") {
      const segredo = letrasDaGrade(fase.palavras[ap.sorteada].palavra);
      return { palpites: ["Z".repeat(segredo.length), segredo.toLowerCase()] };
    }
    if (fase.tipo === "ligar") {
      const n = fase.pares.length;
      return { pares: Array.from({ length: n }, (_, k) => ({ esquerda: ap.esquerdaOrdem.indexOf(k), direita: ap.direitaOrdem.indexOf(k) })) };
    }
    const n = fase.etapas.length;
    return { sequencia: Array.from({ length: n }, (_, k) => ap.ordem.indexOf(k)) };
  }
  /**
   * Uma resposta sempre errada, qualquer que seja o embaralhamento daquela tentativa: no "ligar", tudo na mesma posição (só o
   * primeiro par conta, e nunca todos); no "pôr em ordem", a ordem mostrada (o embaralhamento nunca é a ordem certa).
   */
  function respostaErrada(ap: any, fase: any): unknown {
    if (fase.tipo === "quiz" || fase.tipo === "decisao") return { escolha: (ap.ordem.indexOf(fase.correta) + 1) % fase.opcoes.length };
    if (fase.tipo === "verdadeiro_falso") return { verdadeira: !fase.verdadeira };
    if (fase.tipo === "caca_palavras") return { selecoes: [] };
    if (fase.tipo === "memoria") {
      // Erra mais vezes que o limite (um erro por par) virando uma carta do par 0 com uma do par 1, depois completa a mesa.
      const certas = (respostaCerta(ap, fase) as { jogadas: [number, number][] }).jogadas;
      const erro: [number, number] = [certas[0]![0], certas[1]![0]];
      return { jogadas: [...Array(fase.pares.length + 1).fill(erro), ...certas] };
    }
    if (fase.tipo === "selecione") return { marcadas: [] };
    if (fase.tipo === "termo") {
      const n = letrasDaGrade(fase.palavras[ap.sorteada].palavra).length;
      return { palpites: Array(n + 1).fill("Z".repeat(n)) };
    }
    // Na ordem em que as letras foram mostradas, que nunca formam a palavra.
    if (fase.tipo === "desembaralhe") return { letras: ap.ordem.map((_: unknown, i: number) => i) };
    if (fase.tipo === "ligar") return { pares: Array.from({ length: fase.pares.length }, () => ({ esquerda: 0, direita: 0 })) };
    // A ordem mostrada: o embaralhamento nunca deixa as etapas já na ordem certa.
    return { sequencia: ap.ordem.map((_: unknown, i: number) => i) };
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
      json: { explicacao: EXPLICACAO, fases: [{ tipo: "selecione", enunciado: "X", opcoes: [], materiais: { material_ids: [randomUUID(), randomUUID()], quantidade_errados: 1 }, explicacao: "x" }] },
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

    // Selecione com os materiais do serviço: o pool tem os 2 certos e exatamente 1 errado, sorteado de outro serviço (não necessariamente
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
      // A primeira resposta (errada) já venceu e fica travada: responder de novo, agora certo, devolve a correção gravada.
      const segundaChamada = await responder(aberta.tentativa_id, i, respostaCerta(apresentacao.fases[i], fases[i]), tecnico);
      assert.equal(segundaChamada.certa, false, "a resposta confirmada não muda");
      assert.equal(segundaChamada.pontos, errada.pontos);
    }
    const resultado = await concluir(aberta.tentativa_id, tecnico);
    assert.equal(resultado.fases_certas, 0, "a resposta gravada foi a primeira (errada) de cada fase");
  });

  it("os minijogos novos: nada do gabarito antes da resposta, certo e errado em cada um", async () => {
    const codigo = "TRE-MINIJOGOS";
    await criarEPublicar(codigo, fasesDosJogosNovos());

    const aberta = await abrirTentativa(codigo, tecnico);
    assert.equal(aberta.fases.length, 6);
    const [vf, caca, memoria, selecione, desembaralhe, termo] = aberta.fases;
    const { apresentacao, fases } = await apresentacaoEGabarito(aberta.tentativa_id);
    const doTermo = letrasDaGrade(BANCO_TERMO[apresentacao.fases[5].sorteada]!);
    assert.equal(termo.letras, doTermo.length);
    assert.equal(termo.tentativas, doTermo.length + 1, "letras + 1");
    assert.equal(JSON.stringify(termo).toUpperCase().includes(doTermo), false, "a palavra não vai à vista");
    assert.equal("verdadeira" in vf, false);
    assert.equal(caca.modo, "pistas");
    assert.ok(caca.palavras.every((p: any) => p.palavra === null && p.pista && p.letras > 0 && p.chave), "no modo de pistas a palavra não vai");
    assert.ok(caca.grade.every((l: string) => l.length === caca.grade.length), "grade quadrada");
    assert.equal(memoria.cartas.length, 4);
    assert.ok(memoria.cartas.every((c: any) => !("par" in c)), "o índice do par no gabarito não vai");
    assert.equal(memoria.limite_erros, 2);
    assert.ok(selecione.opcoes.every((o: unknown) => typeof o === "string"), "sem a marca de certa");
    const doDesembaralhe = letrasDaPalavra(BANCO_DESEMBARALHE[apresentacao.fases[4].sorteada]!);
    assert.notEqual(desembaralhe.letras.join(""), doDesembaralhe.join(""), "as letras vêm embaralhadas");
    assert.deepEqual([...desembaralhe.letras].sort(), [...doDesembaralhe].sort());
    assert.match(desembaralhe.enunciado, /^O que é/, "a dica é a da palavra sorteada");
    // Errado numa tentativa e certo noutra (a resposta confirmada fica travada na tentativa).
    const outraParaAcertar = await abrirTentativa(codigo, tecnico);
    const paraAcertar = await apresentacaoEGabarito(outraParaAcertar.tentativa_id);
    for (let i = 0; i < fases.length; i++) {
      const errada = await responder(aberta.tentativa_id, i, respostaErrada(apresentacao.fases[i], fases[i]), tecnico);
      assert.equal(errada.certa, false, `fase ${i} (${fases[i].tipo}) deveria estar errada`);
      const certa = await responder(outraParaAcertar.tentativa_id, i, respostaCerta(paraAcertar.apresentacao.fases[i], paraAcertar.fases[i]), tecnico);
      assert.equal(certa.certa, true, `fase ${i} (${fases[i].tipo}) deveria estar certa`);
      assert.equal(certa.acertos, certa.possiveis);
      assert.equal(certa.pontos, 10, "sem tempo passado, o multiplicador é 1,0");
    }

    // O gabarito que volta depois da resposta.
    const outra = await abrirTentativa(codigo, tecnico);
    const daOutra = await apresentacaoEGabarito(outra.tentativa_id);
    const gCaca = await responder(outra.tentativa_id, 1, { selecoes: [daOutra.apresentacao.fases[1].posicoes[0]] }, tecnico);
    assert.equal(gCaca.certa, false, "achou só uma das três");
    assert.deepEqual(
      gCaca.gabarito.palavras.map((p: any) => p.achada),
      [true, false, false],
    );
    const gDes = await responder(outra.tentativa_id, 4, respostaCerta(daOutra.apresentacao.fases[4], daOutra.fases[4]), tecnico);
    assert.equal(gDes.gabarito.palavra, letrasDaPalavra(BANCO_DESEMBARALHE[daOutra.apresentacao.fases[4].sorteada]!).join(""));
    const palpiteCurto = await amb.req("POST", `/treinamentos/tentativas/${outra.tentativa_id}/fases/5`, { como: tecnico, json: { palpites: ["RIS"] } });
    assert.equal(palpiteCurto.status, 422);
    const n = letrasDaGrade(BANCO_TERMO[daOutra.apresentacao.fases[5].sorteada]!).length;
    const demais = await amb.req("POST", `/treinamentos/tentativas/${outra.tentativa_id}/fases/5`, { como: tecnico, json: { palpites: Array(n + 2).fill("Z".repeat(n)) } });
    assert.equal(demais.status, 422, "mais palpites que letras + 1");
    const jogadaImpossivel = await amb.req("POST", `/treinamentos/tentativas/${outra.tentativa_id}/fases/2`, { como: tecnico, json: { jogadas: [[0, 0]] } });
    assert.equal(jogadaImpossivel.status, 422);
  });

  it("a cada tentativa, Termo e Desembaralhe sorteiam a palavra do banco e toda fase com opções vem numa ordem nova", async () => {
    const codigo = "TRE-MINIJOGOS-SORTEIO";
    const [quiz, , , ligar] = fasesDosCincoTipos([]);
    await criarEPublicar(codigo, [...fasesDosJogosNovos(), { tipo: "ordem", enunciado: "Ordem", etapas: ["A", "B", "C"], explicacao: "x" }, quiz, ligar]);
    const sorteadas = { termo: new Set<number>(), desembaralhe: new Set<number>() };
    const grades = new Set<string>();
    const ordensDoQuiz = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const aberta = await abrirTentativa(codigo, tecnico);
      const { apresentacao } = await apresentacaoEGabarito(aberta.tentativa_id);
      sorteadas.desembaralhe.add(apresentacao.fases[4].sorteada);
      sorteadas.termo.add(apresentacao.fases[5].sorteada);
      grades.add(apresentacao.fases[1].linhas.join(""));
      assert.notDeepEqual(apresentacao.fases[6].ordem, [0, 1, 2], "o pôr em ordem nunca começa já na ordem certa");
      assert.notDeepEqual(apresentacao.fases[7].ordem, [0, 1, 2, 3], "o quiz nunca sai na ordem escrita");
      assert.notDeepEqual(apresentacao.fases[3].ordem, [0, 1, 2, 3], "o selecione nunca sai na ordem escrita");
      assert.notDeepEqual(apresentacao.fases[8].direitaOrdem, apresentacao.fases[8].esquerdaOrdem, "no ligar, os pares nunca ficam um em frente ao outro");
      ordensDoQuiz.add(apresentacao.fases[7].ordem.join(""));
    }
    assert.ok(sorteadas.termo.size > 1, "o Termo sorteia palavras diferentes");
    assert.ok(sorteadas.desembaralhe.size > 1, "o Desembaralhe sorteia palavras diferentes");
    assert.ok(grades.size > 1, "a grade do caça-palavras muda a cada tentativa");
    assert.ok(ordensDoQuiz.size > 1, "as opções do quiz mudam de ordem entre as tentativas");
  });

  it("o jogo não tem limite de fases: salva e publica com 12", async () => {
    const publicado = await criarEPublicar("TRE-SEM-LIMITE", fasesSimples(12));
    assert.ok(publicado);
    const aberta = await abrirTentativa("TRE-SEM-LIMITE", tecnico);
    assert.equal(aberta.total_fases, 12);
  });

  it("o catálogo lista primeiro os serviços com treinamento publicado (rascunho não conta)", async () => {
    await novaAtividade("ORDCAT-A-SEM");
    await novaAtividade("ORDCAT-B-RASCUNHO");
    await obterRascunho("ORDCAT-B-RASCUNHO");
    await criarEPublicar("ORDCAT-Z-COM");
    const lista = await amb.esperar(200, "GET", "/catalogo/servicos", { como: tecnico, consulta: { busca: "ORDCAT" } });
    assert.deepEqual(
      lista.servicos.map((s: { codigo: string }) => s.codigo),
      ["ORDCAT-Z-COM", "ORDCAT-A-SEM", "ORDCAT-B-RASCUNHO"],
    );
  });

  it("publicar exige as 10 palavras no Termo e no Desembaralhe", async () => {
    const codigo = "TRE-MINIJOGOS-BANCO";
    await novaAtividade(codigo);
    await obterRascunho(codigo);
    const nove = { tipo: "termo", palavras: BANCO_TERMO.slice(0, 9).map((palavra) => ({ palavra })), explicacao: "x" };
    await salvarRascunho(codigo, EXPLICACAO, [...fasesSimples(3), nove]);
    const recusada = await amb.req("POST", `/treinamentos/${codigo}/publicar`, { como: admin, json: { arquivo_id: await novaAssinatura() } });
    assert.equal(recusada.status, 422);
    assert.equal(recusada.corpo.erro.codigo, "palavras_insuficientes");
  });

  it("as regras dos minijogos novos recusam o rascunho incoerente", async () => {
    const codigo = "TRE-MINIJOGOS-REGRAS";
    await novaAtividade(codigo);
    await obterRascunho(codigo);
    const recusar = async (fase: unknown, codigoErro: string) => {
      const r = await amb.req("PUT", `/treinamentos/${codigo}/rascunho`, { como: admin, json: { explicacao: EXPLICACAO, fases: [fase] } });
      assert.equal(r.status, 422, codigoErro);
      assert.equal(r.corpo.erro.codigo, codigoErro);
    };
    const selecione = (certas: boolean[]) => ({ tipo: "selecione", enunciado: "X", opcoes: certas.map((correta, i) => ({ texto: `Op ${i}`, correta })), explicacao: "x" });
    await recusar(selecione([false, false, false]), "fase_selecione_certas");
    await recusar(selecione([true, true, true]), "fase_selecione_sem_errada");
    await recusar(selecione([...Array(11).fill(true), false]), "fase_selecione_certas");
    const caca = (modo: string, palavras: unknown[]) => ({ tipo: "caca_palavras", enunciado: "X", modo, palavras, explicacao: "x" });
    await recusar(caca("palavras", [{ palavra: "Inspeção" }, { palavra: "INSPECAO" }]), "fase_palavra_repetida");
    await recusar(caca("pistas", [{ palavra: "Bloqueio", pista: "x" }, { palavra: "Epi" }]), "fase_sem_pista");
    const espaco = await amb.req("PUT", `/treinamentos/${codigo}/rascunho`, { como: admin, json: { explicacao: EXPLICACAO, fases: [caca("palavras", [{ palavra: "Detector de gás" }, { palavra: "EPI" }])] } });
    assert.equal(espaco.status, 422, "palavra com espaço não entra na grade");
    await recusar({ tipo: "desembaralhe", palavras: [{ palavra: "AAA", dica: "x" }], explicacao: "x" }, "fase_palavra_invalida");
    await recusar({ tipo: "termo", palavras: [{ palavra: "Risco" }, { palavra: "RISCO" }], explicacao: "x" }, "fase_palavra_repetida");
    const longa = await amb.req("PUT", `/treinamentos/${codigo}/rascunho`, { como: admin, json: { explicacao: EXPLICACAO, fases: [{ tipo: "termo", palavras: [{ palavra: "Bloqueio" }], explicacao: "x" }] } });
    assert.equal(longa.status, 422, "Termo com mais de 7 letras");
  });

  it("a migração 0033 converte o antigo Separar os itens no Selecione com os materiais do serviço", async () => {
    const codigo = "TRE-MIGRACAO-SEPARAR";
    const certo = await novoMaterial("Capacete (migração)");
    const certo2 = await novoMaterial("Botina (migração)");
    await criarEPublicar(codigo);
    const aberta = await abrirTentativa(codigo, tecnico);
    const [tentativa] = await amb.db.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.id, aberta.tentativa_id));
    const antiga = { tipo: "separar_itens", enunciado: "Toque nos itens.", material_ids: [certo.id, certo2.id], quantidade_errados: 1, explicacao: "Os dois.", ia: { origem: "x", impressao: "abc", pendencias: [], conferido: true } };
    // Volta a versão e a tentativa ao formato antigo (a fase 1 vira "separar_itens") e roda a migração de novo.
    const fasesAntigas = ((await apresentacaoEGabarito(aberta.tentativa_id)).fases as unknown[]).map((f, i) => (i === 1 ? antiga : f));
    await amb.db.update(treinamentoServicoVersao).set({ fases: fasesAntigas }).where(eq(treinamentoServicoVersao.id, tentativa!.versaoId));
    const itens = [
      { materialId: certo2.id, descricao: certo2.descricao },
      { materialId: randomUUID(), descricao: "Intruso" },
      { materialId: certo.id, descricao: certo.descricao },
    ];
    const ap = tentativa!.apresentacao as { fases: unknown[] };
    await amb.db
      .update(treinamentoServicoTentativa)
      .set({ apresentacao: { fases: ap.fases.map((a, i) => (i === 1 ? { tipo: "separar_itens", itens } : a)) } })
      .where(eq(treinamentoServicoTentativa.id, aberta.tentativa_id));

    const migracao = readFileSync(new URL("../db/migrations/0033_selecione_com_materiais.sql", import.meta.url), "utf8");
    for (const comando of migracao.split("--> statement-breakpoint")) await amb.db.execute(sql.raw(comando));

    const depois = await apresentacaoEGabarito(aberta.tentativa_id);
    assert.deepEqual(depois.fases[1], {
      tipo: "selecione",
      enunciado: "Toque nos itens.",
      opcoes: [],
      materiais: { material_ids: [certo.id, certo2.id], quantidade_errados: 1 },
      explicacao: "Os dois.",
      ia: antiga.ia,
    });
    assert.equal(depois.fases[0].tipo, "quiz", "as outras fases não mudam");
    assert.deepEqual(depois.apresentacao.fases[1], { tipo: "selecione", itens });
    const certa = await responder(aberta.tentativa_id, 1, { marcadas: [0, 2] }, tecnico);
    assert.equal(certa.certa, true, "a tentativa aberta antes da migração continua corrigindo");
    assert.deepEqual(certa.gabarito.corretas, [0, 2]);
  });

  it("a nota: tempo por faixas, cronômetro que pausa e continua, acerto parcial ao finalizar e resposta travada", async () => {
    const codigo = "TRE-NOTA";
    const selecione = {
      tipo: "selecione",
      enunciado: "Marque os EPIs.",
      opcoes: [
        { texto: "Capacete", correta: true },
        { texto: "Luva", correta: true },
        { texto: "Chinelo", correta: false },
        { texto: "Boné", correta: false },
      ],
      explicacao: "Capacete e luva.",
    };
    const ordem = { tipo: "ordem", enunciado: "Ordem", etapas: ["A", "B", "C"], explicacao: "x" };
    await criarEPublicar(codigo, [fasesSimples(1)[0], selecione, ordem]);
    const u = await amb.criarUsuario({ perfil: "tecnico" });
    const passar = (segundos: number) => (amb.relogio.agora = new Date(amb.relogio.agora.getTime() + segundos * 1000));
    const entrar = (id: string, fase: number) => amb.esperar(200, "POST", `/treinamentos/tentativas/${id}/fases/${fase}/entrar`, { como: u });
    const progresso = (id: string, fase: number, resposta: unknown) => amb.esperar(204, "PUT", `/treinamentos/tentativas/${id}/fases/${fase}/progresso`, { como: u, json: { resposta } });

    const aberta = await abrirTentativa(codigo, u);
    const { apresentacao } = await apresentacaoEGabarito(aberta.tentativa_id);
    // Fase 1 (quiz): 15 s e certa → 10 × 0,9 = 9.
    await entrar(aberta.tentativa_id, 0);
    passar(15);
    const quiz = await responder(aberta.tentativa_id, 0, { escolha: apresentacao.fases[0].ordem.indexOf(0) }, u);
    assert.deepEqual([quiz.certa, quiz.tempo_ms, quiz.multiplicador, quiz.pontos], [true, 15000, 0.9, 9]);
    // Voltar e responder de novo, errado, não muda nada.
    const deNovo = await responder(aberta.tentativa_id, 0, { escolha: (apresentacao.fases[0].ordem.indexOf(0) + 1) % 3 }, u);
    assert.deepEqual([deNovo.certa, deNovo.pontos], [true, 9]);

    // Fase 2 (selecione): marca 1 das 2 certas, avança sem confirmar e volta; o tempo soma as duas visitas (5 + 3 s).
    await entrar(aberta.tentativa_id, 1);
    passar(5);
    await progresso(aberta.tentativa_id, 1, { marcadas: [apresentacao.fases[1].ordem.indexOf(0)] });
    await entrar(aberta.tentativa_id, 2);
    passar(25);
    await entrar(aberta.tentativa_id, 1);
    passar(3);
    // Fase 3 (ordem) fica sem resposta nenhuma; finaliza.
    const resultado = await concluir(aberta.tentativa_id, u);
    assert.deepEqual(
      resultado.fases.map((f: any) => [f.fase, f.acertos, f.possiveis, f.tempo_ms, f.pontos, f.confirmada]),
      [
        [0, 1, 1, 15000, 9, true],
        [1, 1, 2, 8000, 5, false],
        [2, 0, 1, 25000, 0, false],
      ],
    );
    assert.equal(resultado.nota, Math.round((9 + 5 + 0) * 3 * 10), "a soma das fases × (3 fases × 10)");
    assert.equal(resultado.nota_maxima, 900);
    assert.equal(resultado.melhor_anterior, null);
    assert.equal(resultado.fases_certas, 1);
    assert.equal(resultado.pontos_ganhos, 6, "a gamificação segue 5 + 1 por fase certa");

    // Jogar de novo sem avisar a entrada na fase não zera o tempo: os 70 s desde a abertura vão para a fase respondida.
    const outra = await abrirTentativa(codigo, u);
    const ap2 = (await apresentacaoEGabarito(outra.tentativa_id)).apresentacao;
    passar(70);
    const semEntrar = await responder(outra.tentativa_id, 0, { escolha: ap2.fases[0].ordem.indexOf(0) }, u);
    assert.deepEqual([semEntrar.tempo_ms, semEntrar.multiplicador, semEntrar.pontos], [70000, 0.4, 4]);
    const segunda = await concluir(outra.tentativa_id, u);
    assert.equal(segunda.melhor_anterior, resultado.nota);
    assert.equal(segunda.pontos_ganhos, 0, "refazer não pontua na gamificação");
    assert.equal((await amb.req("POST", `/treinamentos/tentativas/${outra.tentativa_id}/fases/1/entrar`, { como: u })).status, 409, "a tentativa concluída não aceita mais nada");
  });

  it("a migração 0035 dá nota às tentativas de antes dela (fase certa = 10, sem tempo)", async () => {
    const codigo = "TRE-MIGRACAO-NOTA";
    await criarEPublicar(codigo, fasesSimples(4));
    const u = await amb.criarUsuario({ perfil: "tecnico" });
    await jogarTudo(codigo, u, [true, true, true, false]);
    const [tentativa] = await amb.db.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.usuarioId, u.id));
    // Volta ao formato de antes: sem nota, e as respostas sem acertos nem pontos.
    await amb.db.update(treinamentoServicoTentativa).set({ nota: null }).where(eq(treinamentoServicoTentativa.id, tentativa!.id));
    await amb.db.update(treinamentoServicoResposta).set({ acertos: 0, possiveis: 1, pontos: 0 }).where(eq(treinamentoServicoResposta.tentativaId, tentativa!.id));

    const migracao = readFileSync(new URL("../db/migrations/0035_nota_das_tentativas_antigas.sql", import.meta.url), "utf8");
    for (const comando of migracao.split("--> statement-breakpoint")) await amb.db.execute(sql.raw(comando));

    const [depois] = await amb.db.select().from(treinamentoServicoTentativa).where(eq(treinamentoServicoTentativa.id, tentativa!.id));
    assert.equal(depois!.nota, 30 * 4 * 10, "3 fases certas × 10, × (4 fases × 10)");
    const respostas = await amb.db.select().from(treinamentoServicoResposta).where(eq(treinamentoServicoResposta.tentativaId, tentativa!.id));
    assert.deepEqual(respostas.map((r) => [r.acertos, r.pontos]).sort(), [
      [0, 0],
      [1, 10],
      [1, 10],
      [1, 10],
    ]);
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

  it("ranking do treinamento: a melhor nota de cada um, anônimos mascarados, pendente entra, recusado e admin não", async () => {
    const codigo = "TRE-RANKING";
    await criarEPublicar(codigo, fasesSimples(4));
    const ana = await amb.criarUsuario({ perfil: "tecnico", nome: "Ana" });
    const bia = await amb.criarUsuario({ perfil: "tecnico", nome: "Bia" });
    const caio = await amb.criarUsuario({ perfil: "tecnico", nome: "Caio" });
    const zeca = await amb.criarUsuario({ perfil: "tecnico", nome: "Zeca" });
    const rui = await amb.criarUsuario({ perfil: "tecnico", nome: "Rui" });
    await amb.db.update(usuario).set({ rankingAnonimo: true }).where(eq(usuario.id, caio.id));
    await amb.db.update(usuario).set({ liberacao: "pendente" }).where(eq(usuario.id, zeca.id));

    // Ninguém concluiu ainda.
    const vazio = await amb.esperar(200, "GET", `/treinamentos/${codigo}/ranking`, { como: ana });
    assert.equal(vazio.participantes, 0);
    assert.deepEqual(vazio.linhas, []);
    assert.equal(vazio.minha, null);

    // Ana faz 2 de 4 e depois gabarita: no ranking vale a melhor nota (a gamificação, só a primeira conclusão).
    await jogarTudo(codigo, ana, [true, true, false, false]);
    await jogarTudo(codigo, ana, true);
    await jogarTudo(codigo, bia, true);
    await jogarTudo(codigo, caio, [true, true, true, false]);
    await jogarTudo(codigo, zeca, true);
    await jogarTudo(codigo, rui, true);
    await amb.db.update(usuario).set({ liberacao: "recusado" }).where(eq(usuario.id, rui.id));
    // Abrir sem concluir não entra no ranking.
    await abrirTentativa(codigo, tecnico);

    const visto = await amb.esperar(200, "GET", `/treinamentos/${codigo}/ranking`, { como: ana });
    assert.equal(visto.participantes, 4, "Rui (recusado) e quem só abriu ficam de fora");
    assert.deepEqual(
      visto.linhas.map((l: any) => [l.posicao, l.nome, l.nota, l.fases_certas, l.aproveitamento]),
      [
        // 4 fases × 10 pontos = 40, × (4 × 10) = 1.600 (a nota máxima); no empate, o relógio de teste parado deixa a ordem pelo nome.
        [1, "Ana", 1600, 4, 100],
        [2, "Bia", 1600, 4, 100],
        [3, "Zeca", 1600, 4, 100],
        [4, "Participante anônimo", 1200, 3, 75],
      ],
    );
    assert.equal(visto.linhas[0].nota_maxima, 1600);
    assert.equal(visto.linhas[3].usuario_id, null, "o anônimo não mostra o id para os outros");
    assert.equal(visto.minha.posicao, 1);
    assert.equal(visto.minha.voce, true);
    assert.equal(visto.linhas.filter((l: any) => l.voce).length, 1);

    // O próprio anônimo se vê pelo nome; o limite corta as linhas, mas a própria linha vem sempre.
    const doCaio = await amb.esperar(200, "GET", `/treinamentos/${codigo}/ranking?limite=2`, { como: caio });
    assert.equal(doCaio.linhas.length, 2);
    assert.equal(doCaio.participantes, 4);
    assert.equal(doCaio.minha.nome, "Caio");
    assert.equal(doCaio.minha.posicao, 4);

    // Quem aguarda liberação vê o ranking; o admin vê os nomes e não aparece.
    const doZeca = await amb.esperar(200, "GET", `/treinamentos/${codigo}/ranking`, { como: zeca });
    assert.equal(doZeca.minha.posicao, 3);
    const doAdmin = await amb.esperar(200, "GET", `/treinamentos/${codigo}/ranking`, { como: admin });
    assert.equal(doAdmin.minha, null);
    assert.equal(doAdmin.linhas[3].nome, "Caio");

    assert.equal((await amb.req("GET", `/treinamentos/${codigo}/ranking?limite=0`, { como: ana })).status, 422);
    await novaAtividade("TRE-RANKING-SEM-PUBLICAR");
    assert.equal((await amb.req("GET", "/treinamentos/TRE-RANKING-SEM-PUBLICAR/ranking", { como: ana })).status, 404);
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
